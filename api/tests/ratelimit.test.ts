/**
 * Ratenbegrenzung (Migration 005) und Aufraeumen (src/cleanup.ts) gegen eine
 * ECHTE PostgreSQL-Datenbank.
 *
 * Zwei Dinge, die dieser Test bewusst NICHT tut:
 *
 *   1. Er wartet keine echten Fenster ab. Die Uhr kommt aus AuthConfig.now;
 *      ein Fenster vergeht hier, indem die Uhr vorgestellt wird. Ein Test, der
 *      eine Minute schlaeft, ist kein Nachweis, sondern eine Bremse.
 *   2. Er glaubt der Antwort nicht. Jede Behauptung ueber die Begrenzung wird
 *      zusaetzlich in auth_rate_events nachgesehen - die Zeilen sind der
 *      eigentliche Beweis.
 *
 * Die Adresse der Verbindung gibt es bei app.request() nicht; der Schluessel
 * ist dann 'unknown' (siehe src/rateLimit.ts). Fuer die Faelle, in denen eine
 * bestimmte Adresse gebraucht wird, werden die Zeilen direkt gesetzt - die
 * Adressbildung selbst wird in derselben Datei ohne HTTP geprueft
 * (clientAddress, forwardedClientAddress, peerAddressOf).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { authConfigFromEnv, type AuthConfig } from '../src/auth.js';
import {
  cleanupAuth,
  describeCleanup,
  EXPIRED_CHALLENGE_GRACE_MS,
  RATE_EVENT_GRACE_MS,
  USED_CHALLENGE_GRACE_MS,
} from '../src/cleanup.js';
import { closeDb } from '../src/db.js';
import {
  DEFAULT_AUTH_RATE_LIMIT,
  DEFAULT_AUTH_RATE_WINDOW_MS,
  EnvError,
  loadEnv,
} from '../src/env.js';
import {
  CHALLENGE_RATE_BUCKET,
  clientAddress,
  forwardedClientAddress,
  peerAddressOf,
  RATE_LIMIT_REASON,
  UNKNOWN_CLIENT_KEY,
} from '../src/rateLimit.js';
import { createKeypair, signChallenge } from './auth.helpers.js';
import { sql } from './helpers.js';

/** Grenze und Fenster dieses Testlaufs. Klein, damit die Faelle lesbar bleiben. */
const LIMIT = 3;
const WINDOW_MS = 60_000;

/**
 * Die Uhr des Testlaufs. Sie wird nicht vorgestellt, sondern in jedem Test neu
 * auf die echte Zeit gesetzt - die Aufraeumfunktion rechnet mit echten
 * Zeitstempeln, und ein Sprung um eine Stunde wuerde dort Zeilen mitreissen.
 * Ein Fenster vergeht, indem die Uhr um WINDOW_MS vorgestellt wird.
 */
let clock: () => number = () => Date.now();

const TRUSTED_PROXY = '127.0.0.1';
/** Eine Adresse, die NICHT in AUTH_TRUSTED_PROXIES steht: der Kopf zaehlt dann nicht. */
const UNTRUSTED_PEER = '203.0.113.9';
const FREMDER_CLIENT = '203.0.113.9';

function testConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    ...authConfigFromEnv(),
    now: clock,
    rateLimit: LIMIT,
    rateWindowMs: WINDOW_MS,
    trustedProxies: [],
    ...overrides,
  };
}

/**
 * Die App des Testlaufs. async, weil createApp das Aufraeumen beim Start
 * abwartet (src/app.ts): der Startzustand soll feststehen, bevor die App steht.
 */
/**
 * Die App mit einer KONFIGURATION, deren Uhr die aktuelle Testuhr liest.
 *
 * now ruft die Modulvariable clock bei JEDEM Aufruf neu ab - eine Kopie der
 * Funktion (now: clock) wuerde die Uhr festhalten, die beim Bauen der
 * Konfiguration galt, und das Vorstellen der Uhr im Test bliebe wirkungslos.
 */
async function testApp(config: AuthConfig = testConfig()): Promise<TestApp> {
  const mitUhr: AuthConfig = { ...config, now: () => clock() };
  return createApp(sql, { auth: mitUhr, cleanupOnStart: async () => undefined });
}

/** Der Typ der App, wie createApp ihn liefert. */
type TestApp = Awaited<ReturnType<typeof createApp>>;

interface ChallengeBody {
  k1?: string;
  status?: string;
  reason?: string;
}

/** Ein Aufruf des Endpunkts, wie ihn ein Client schickt. */
/**
 * Die Bindung des Node-Adapters: daraus liest src/rateLimit.ts die Adresse der
 * VERBINDUNG (peerAddressOf). Ohne diese Angabe gibt es bei app.request()
 * keine Verbindung, und der Schluessel ist 'unknown'.
 */
function verbindung(peer: string): { incoming: { socket: { remoteAddress: string } } } {
  return { incoming: { socket: { remoteAddress: peer } } };
}

/**
 * Ein Aufruf des Endpunkts, wie ihn ein Client schickt.
 *
 * `peer` ist die Adresse der Verbindung (Vorgabe: der vertrauenswuerdige
 * Proxy). X-Forwarded-For kommt aus `headers`.
 */
async function challengeRequest(
  app: TestApp,
  headers: Record<string, string> = {},
  action?: string,
  peer: string = TRUSTED_PROXY,
): Promise<{ status: number; body: ChallengeBody; retryAfter: string | null }> {
  const antwort = await app.request(
    '/api/auth/challenge',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      // Ohne action gilt 'login' (die Vorgabe der Spezifikation) - wer ein Konto
      // anlegen will, muss 'register' schicken.
      body: action === undefined ? '{}' : JSON.stringify({ action }),
    },
    verbindung(peer),
  );
  return {
    status: antwort.status,
    body: (await antwort.json()) as ChallengeBody,
    retryAfter: antwort.headers.get('retry-after'),
  };
}

/**
 * Die Zahl der GEZAEHLTEN Aufrufe eines Schluessels - innerhalb des Fensters.
 *
 * Ausdruecklich mit Fenster: nach einem Uhrensprung liegen die alten Zeilen
 * noch in der Tabelle, zaehlen aber nicht mehr. Genau das ist der Unterschied
 * zwischen "gleitendes Fenster" und "Zaehler je Fenster", und er soll im Test
 * sichtbar sein.
 */
async function countRateRows(
  key: string = UNKNOWN_CLIENT_KEY,
  windowMs: number = WINDOW_MS,
  at: number = Date.now(),
): Promise<number> {
  const rows = await sql.unsafe<{ anzahl: string }[]>(
    'SELECT count(*)::text AS anzahl FROM auth_rate_events WHERE bucket = $1 AND key = $2 AND moment > $3',
    [CHALLENGE_RATE_BUCKET, key, new Date(at - windowMs)],
  );
  return Number(rows[0]?.anzahl ?? '0');
}

/** Alle Zeilen eines Schluessels, ohne Fenster - fuer die Aussage "geschrieben wurde nichts". */
async function countRateRowsTotal(key: string = UNKNOWN_CLIENT_KEY): Promise<number> {
  const rows = await sql.unsafe<{ anzahl: string }[]>(
    'SELECT count(*)::text AS anzahl FROM auth_rate_events WHERE bucket = $1 AND key = $2',
    [CHALLENGE_RATE_BUCKET, key],
  );
  return Number(rows[0]?.anzahl ?? '0');
}

async function countChallenges(k1: string): Promise<number> {
  const rows = await sql.unsafe<{ anzahl: string }[]>(
    'SELECT count(*)::text AS anzahl FROM auth_challenges WHERE k1 = $1',
    [k1],
  );
  return Number(rows[0]?.anzahl ?? '0');
}

/**
 * Eine Zeile in auth_rate_events setzen - fuer Schluessel, die ueber HTTP nicht
 * zu erreichen sind (eine bestimmte Client-Adresse).
 */
async function insertRateRow(key: string, moment: Date): Promise<void> {
  await sql.unsafe('INSERT INTO auth_rate_events (bucket, key, moment) VALUES ($1, $2, $3)', [
    CHALLENGE_RATE_BUCKET,
    key,
    moment,
  ]);
}

/**
 * Eine Herausforderung mit vorgegebenen Zeiten anlegen. Ueber die API ist das
 * nicht zu erreichen (sie erzeugt immer eine frische); die Zeiten sind deshalb
 * ausdrueckliche Parameter und werden in JavaScript gerechnet - nicht mit
 * Intervallen in SQL, damit die Testdaten nachvollziehbar bleiben.
 *
 * auth_challenges_expiry_check verlangt expires_at > created_at, deshalb ist
 * expiresAgoMs immer kleiner als createdAgoMs.
 */
async function insertChallenge(args: {
  readonly k1: string;
  readonly createdAgoMs: number;
  readonly expiresAgoMs: number;
  readonly usedAgoMs: number | null;
}): Promise<void> {
  const jetzt = Date.now();
  await sql.unsafe(
    'INSERT INTO auth_challenges (k1, action, created_at, expires_at, used_at) VALUES ($1, $2, $3, $4, $5)',
    [
      args.k1,
      'login',
      new Date(jetzt - args.createdAgoMs),
      new Date(jetzt - args.expiresAgoMs),
      args.usedAgoMs === null ? null : new Date(jetzt - args.usedAgoMs),
    ],
  );
  angelegteK1.push(args.k1);
}

/**
 * Eine k1 aus zwei Hexzeichen bauen: die ersten beiden Zeichen machen die Zeile
 * im Test wiederfindbar (das Aufraeumen loescht nach Praefix), der Rest ist
 * Fuellmaterial.
 *
 * Kein Number.toString(64): die Radix-Grenze von JavaScript ist 36.
 */
function testK1(praefix: string, fueller: string): string {
  return (praefix + fueller.repeat(64)).slice(0, 64);
}

const angelegteK1: string[] = [];

beforeEach(async () => {
  clock = () => Date.now();
  // Sauberer Anfang: die Zeilen der eigenen Schluessel weg. Die Tabellen sind
  // gemeinsam genutzt, ein Rest aus einem anderen Lauf waere ein Zufallsergebnis.
  await sql.unsafe('DELETE FROM auth_rate_events WHERE key = ANY($1::text[]) OR key LIKE $2', [
    [UNKNOWN_CLIENT_KEY, FREMDER_CLIENT, TRUSTED_PROXY, UNTRUSTED_PEER],
    '198.51.100.%',
  ]);
  await sql.unsafe("DELETE FROM auth_challenges WHERE k1 LIKE 'aa%' OR k1 LIKE 'bb%' OR k1 LIKE 'cc%' OR k1 LIKE 'dd%'");
  angelegteK1.length = 0;
});

afterAll(async () => {
  await sql.unsafe('DELETE FROM auth_rate_events WHERE key = ANY($1::text[]) OR key LIKE $2', [
    [UNKNOWN_CLIENT_KEY, FREMDER_CLIENT, TRUSTED_PROXY, UNTRUSTED_PEER],
    '198.51.100.%',
  ]);
  if (angelegteK1.length > 0) {
    await sql.unsafe('DELETE FROM auth_challenges WHERE k1 = ANY($1::text[])', [angelegteK1]);
  }
  await closeDb();
});
// -----------------------------------------------------------------------------
// 1. Die Begrenzung auf dem Endpunkt
// -----------------------------------------------------------------------------

describe('Ratenbegrenzung auf POST /api/auth/challenge', () => {
  it('laesst Aufrufe unterhalb der Grenze durch und zaehlt jeden davon', async () => {
    const app = await testApp();
    const k1s: string[] = [];

    for (let i = 0; i < LIMIT; i += 1) {
      const antwort = await challengeRequest(app);
      expect(antwort.status).toBe(200);
      k1s.push(antwort.body.k1 as string);
    }

    // Jede Herausforderung ist eigenstaendig - die Begrenzung verhindert keine
    // gueltigen Aufrufe.
    expect(new Set(k1s).size).toBe(LIMIT);
    expect(await countRateRows(TRUSTED_PROXY)).toBe(LIMIT);
  });

  it('weist den naechsten Aufruf mit 429 und der gemeinsamen Fehlerform ab', async () => {
    const app = await testApp();
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await challengeRequest(app)).status).toBe(200);
    }

    const abgewiesen = await challengeRequest(app);
    // Genau die Form der uebrigen Auth-Fehler ({ status: 'ERROR', reason }) -
    // ein Client soll nicht zwei Fehlerformate kennen muessen.
    expect(abgewiesen.status).toBe(429);
    expect(abgewiesen.body.status).toBe('ERROR');
    expect(abgewiesen.body.reason).toBe(RATE_LIMIT_REASON);
    expect(abgewiesen.body.k1).toBeUndefined();

    // Retry-After in Sekunden, ganzzahlig (RFC 9110) und nicht groesser als
    // das Fenster.
    expect(abgewiesen.retryAfter).not.toBeNull();
    const sekunden = Number(abgewiesen.retryAfter);
    expect(Number.isInteger(sekunden)).toBe(true);
    expect(sekunden).toBeGreaterThan(0);
    expect(sekunden).toBeLessThanOrEqual(Math.ceil(WINDOW_MS / 1000));

    // Und die abgewiesene Anfrage hat NICHTS geschrieben: sonst waere die
    // Tabelle selbst der Schreibverstaerker, den sie verhindern soll.
    expect(await countRateRows(TRUSTED_PROXY)).toBe(LIMIT);
  });

  it('weist auch den zweiten und dritten Aufruf ueber der Grenze ab', async () => {
    const app = await testApp();
    for (let i = 0; i < LIMIT; i += 1) {
      await challengeRequest(app);
    }
    for (let i = 0; i < 5; i += 1) {
      const abgewiesen = await challengeRequest(app);
      expect(abgewiesen.status).toBe(429);
      expect(abgewiesen.body.reason).toBe(RATE_LIMIT_REASON);
    }
    // Fuenf abgewiesene Aufrufe, kein einziger neuer Eintrag.
    expect(await countRateRows(TRUSTED_PROXY)).toBe(LIMIT);
  });

  it('erlaubt nach Ablauf des Fensters wieder Aufrufe - das Fenster ist gleitend', async () => {
    const app = await testApp();
    // Eigener leerer Topf: dieser Test stellt die Uhr vor, und Zeilen aus
    // frueheren Tests laegen danach an einer anderen Stelle im Fenster.
    await sql.unsafe('DELETE FROM auth_rate_events WHERE key = $1', [TRUSTED_PROXY]);

    // Die Uhr steht still und wird nur um je eine Millisekunde vorgestellt -
    // NICHT auf "jetzt": sonst haengt das Ergebnis davon ab, wie viel echte
    // Zeit zwischen dem Schreiben der Zeilen und der Pruefung vergeht, und die
    // Fenstergrenze waere Zufall statt Nachweis. Die Millisekunden sind noetig,
    // damit die Zeilen unterscheidbar sind: das Fenster ist (jetzt - Fenster,
    // jetzt], und eine Zeile GENAU auf der Grenze zaehlt nicht mehr mit.
    const basis = Date.now();
    let versatz = 0;
    clock = () => basis + versatz;

    for (let i = 0; i < LIMIT; i += 1) {
      versatz += 1;
      expect((await challengeRequest(app)).status).toBe(200);
    }
    versatz += 1;
    expect((await challengeRequest(app)).status).toBe(429);

    // Eine Fensterlaenge spaeter sind die ersten Aufrufe heraus - OHNE echte
    // Wartezeit, allein durch die injizierte Uhr. Das Fenster ist
    // (jetzt - Fenster, jetzt]; die alten Zeilen liegen jetzt genau auf oder
    // unter der unteren Grenze und zaehlen deshalb nicht mehr mit.
    versatz += 1;
    const vorgestellt = basis + versatz + WINDOW_MS;
    clock = () => vorgestellt;

    const nachFenster = await challengeRequest(app);
    expect(nachFenster.status).toBe(200);
    // Gezaehlt wird gegen die VORGESTELLTE Uhr - die alten Zeilen liegen noch
    // in der Tabelle (sie werden erst vom Aufraeumen entfernt), zaehlen aber
    // nicht mehr mit.
    // Die Zeilen sind noch da (das Aufraeumen entfernt sie erst spaeter), aber
    // ausserhalb des Fensters: gezaehlt wird jetzt EINE - die gerade
    // geschriebene. Genau das ist der Unterschied zwischen gleitendem Fenster
    // und Zaehler je Kalenderfenster.
    expect(await countRateRows(TRUSTED_PROXY, WINDOW_MS, vorgestellt)).toBe(1);
    expect(await countRateRowsTotal(TRUSTED_PROXY)).toBe(4);

    // Und die Grenze gilt weiter: eine volle Fensterlaenge nach dem Aufruf
    // ausserhalb des alten Fensters. Jetzt liegen genau drei Aufrufe im neuen
    // Fenster (der von gerade eben und die beiden folgenden) - der dritte ist
    // wieder zu viel. Ohne Nachweis waere das die Stelle, an der eine
    // Begrenzung still aufhoert zu greifen.
    versatz = WINDOW_MS + versatz + 1;
    clock = () => basis + versatz;
    expect((await challengeRequest(app)).status).toBe(200);
    versatz += 1;
    clock = () => basis + versatz;
    expect((await challengeRequest(app)).status).toBe(200);
    versatz += 1;
    clock = () => basis + versatz;
    expect((await challengeRequest(app)).status).toBe(429);
  });

  it('begrenzt je Client-Adresse, nicht global', async () => {
    const app = await testApp();
    for (let i = 0; i < LIMIT; i += 1) {
      await insertRateRow(FREMDER_CLIENT, new Date(clock()));
    }

    // Der fremde Schluessel ist voll, der eigene (TRUSTED_PROXY) nicht: die
    // Grenze gilt JE ADRESSE, nicht fuer die Anwendung als Ganzes.
    expect((await challengeRequest(app)).status).toBe(200);
    expect(await countRateRows(TRUSTED_PROXY)).toBe(1);
    expect(await countRateRows(FREMDER_CLIENT)).toBe(LIMIT);
  });

  it('greift NICHT auf anderen Endpunkten', async () => {
    const app = await testApp();
    for (let i = 0; i < LIMIT; i += 1) {
      await challengeRequest(app);
    }
    expect((await challengeRequest(app)).status).toBe(429);

    const vorher = await countRateRows();
    const ideen = await app.request('/api/ideas');
    expect(ideen.status).toBe(200);
    const gesundheit = await app.request('/health');
    expect([200, 503]).toContain(gesundheit.status);
    const abmelden = await app.request('/api/auth/logout', { method: 'POST' });
    expect(abmelden.status).toBe(200);
    const ohneSitzung = await app.request('/api/users/me');
    expect(ohneSitzung.status).toBe(401);
    // Die Parameter ueber URLSearchParams bauen: ein '+' in einer
    // Zeichenkette wird in einem Query sonst als Leerzeichen gelesen (und der
    // Schluessel waere dann kein Punkt mehr -> 400 statt 401).
    const callbackParams = new URLSearchParams({ k1: 'dd'.repeat(32), key: '02' + '1'.repeat(64), sig: '00' });
    const callback = await app.request('/api/auth/callback?' + callbackParams.toString());
    expect(callback.status).toBe(401);

    // Kein Aufruf eines anderen Endpunkts hat gezaehlt - und keiner wurde
    // abgewiesen, obwohl die Grenze fuer diesen Client erreicht ist.
    expect(await countRateRows()).toBe(vorher);
  });

  it('sperrt einen Nutzer mit mehreren Anmeldungen im Fenster nicht aus', async () => {
    const app = await testApp();
    const keypair = createKeypair();
    const userIds: string[] = [];

    // Drei vollstaendige Anmeldungen: Herausforderung holen, signieren,
    // Callback. Jede verbraucht genau EINEN Platz im Fenster - eine Anmeldung
    // ist ein Aufruf, kein Sonderfall.
    for (let i = 0; i < LIMIT; i += 1) {
      const antwort = await challengeRequest(app, {}, 'register');
      expect(antwort.status, 'Anmeldung ' + String(i + 1)).toBe(200);
      const k1 = antwort.body.k1 as string;
      const sig = signChallenge(k1, keypair.secretKeyHex);
      const params = new URLSearchParams({
        tag: 'login',
        k1,
        key: keypair.publicKeyHex,
        sig,
        action: 'register',
      });
      const callback = await app.request('/api/auth/callback?' + params.toString());
      expect(callback.status, 'Callback ' + String(i + 1)).toBe(200);
      const koerper = (await callback.json()) as { status: string; userId: string };
      expect(koerper.status).toBe('OK');
      userIds.push(koerper.userId);
    }

    // Derselbe Nutzer, dreimal angemeldet - kein Aussperren, kein zweites Konto.
    expect(new Set(userIds).size).toBe(1);
    expect(await countRateRows(TRUSTED_PROXY)).toBe(LIMIT);

    // Aufraeumen: der angelegte Nutzer verschwindet mit seiner Identitaet
    // (auth_identities haengt per ON DELETE CASCADE an users).
    await sql.unsafe('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  });
});

// -----------------------------------------------------------------------------
// 2. Die Client-Adresse: X-Forwarded-For nur aus vertrauenswuerdiger Verbindung
// -----------------------------------------------------------------------------

describe('Client-Adresse', () => {
  it('glaubt X-Forwarded-For NICHT, wenn die Verbindung von keinem Proxy kommt', async () => {
    const app = await testApp();
    for (let i = 0; i < LIMIT; i += 1) {
      // Jede Anfrage behauptet eine andere Adresse - genau der Versuch, die
      // Begrenzung zu umgehen.
      const antwort = await challengeRequest(
        app,
        { 'x-forwarded-for': '198.51.100.' + String(i + 1) },
        undefined,
        UNTRUSTED_PEER,
      );
      expect(antwort.status).toBe(200);
    }

    // Gezaehlt wurde unter dem Schluessel der VERBINDUNG (der Adresse des
    // Aufrufers, hier UNTRUSTED_PEER), nicht unter der behaupteten Adresse.
    expect(await countRateRows(UNTRUSTED_PEER)).toBe(LIMIT);
    expect(await countRateRows('198.51.100.1')).toBe(0);
    expect(await countRateRows('198.51.100.2')).toBe(0);

    // Und die Behauptung hilft nicht: der naechste Aufruf wird abgewiesen,
    // obwohl er eine neue Adresse behauptet.
    const abgewiesen = await challengeRequest(app, { 'x-forwarded-for': '198.51.100.99' }, undefined, UNTRUSTED_PEER);
    expect(abgewiesen.status).toBe(429);
  });

  it('glaubt X-Forwarded-For, wenn die Verbindung aus AUTH_TRUSTED_PROXIES kommt', async () => {
    const app = await testApp(testConfig({ trustedProxies: [TRUSTED_PROXY] }));
    const erster = '198.51.100.7';
    const zweiter = '198.51.100.8';
    // Eigene leere Toepfe: dieser Test rechnet mit genau LIMIT Aufrufen.
    await sql.unsafe('DELETE FROM auth_rate_events WHERE key = ANY($1::text[])', [[erster, zweiter]]);

    // Derselbe Proxy, verschiedene Clients: JEDER hat seine eigene Grenze.
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await challengeRequest(app, { 'x-forwarded-for': erster })).status).toBe(200);
    }
    expect((await challengeRequest(app, { 'x-forwarded-for': erster })).status).toBe(429);

    expect((await challengeRequest(app, { 'x-forwarded-for': zweiter })).status).toBe(200);
    // Bezugszeit der injizierten Uhr (die Zeilen wurden mit ihr geschrieben).
    expect(await countRateRows(erster, WINDOW_MS, clock())).toBe(LIMIT);
    expect(await countRateRows(zweiter, WINDOW_MS, clock())).toBe(1);
  });

  it('faellt ohne brauchbaren Kopf auf die Verbindungsadresse zurueck', async () => {
    const app = await testApp(testConfig({ trustedProxies: [TRUSTED_PROXY] }));
    const zuLang = 'a'.repeat(60);
    const faelle = ['', '   ', zuLang];

    for (const kopf of faelle) {
      // Der Proxy ist vertrauenswuerdig, der Kopf aber unbrauchbar: dann gilt
      // die Adresse der Verbindung, nicht der unsinnige Wert.
      expect((await challengeRequest(app, { 'x-forwarded-for': kopf })).status).toBe(200);
    }
    expect(await countRateRows(TRUSTED_PROXY)).toBe(faelle.length);
  });

  it('bildet den Schluessel nach der Regel: Proxy zuerst, sonst die Verbindung', () => {
    expect(clientAddress({ peer: '10.0.0.5', forwardedFor: '203.0.113.9', trustedProxies: [] })).toBe('10.0.0.5');
    expect(
      clientAddress({ peer: '10.0.0.5', forwardedFor: '203.0.113.9', trustedProxies: ['10.0.0.5'] }),
    ).toBe('203.0.113.9');
    expect(clientAddress({ peer: '10.0.0.5', forwardedFor: undefined, trustedProxies: ['10.0.0.5'] })).toBe('10.0.0.5');
    expect(clientAddress({ peer: undefined, forwardedFor: '203.0.113.9', trustedProxies: ['10.0.0.5'] })).toBe(
      UNKNOWN_CLIENT_KEY,
    );
    // Schreibweise und Gross-/Kleinschreibung duerfen den Vergleich nicht brechen:
    // der Schluessel wird klein geschrieben, die Liste ebenso verglichen.
    expect(clientAddress({ peer: '::1', forwardedFor: undefined, trustedProxies: ['::1'] })).toBe('::1');
    expect(clientAddress({ peer: '10.0.0.5', forwardedFor: undefined, trustedProxies: ['10.0.0.5'] })).toBe('10.0.0.5');
    expect(clientAddress({ peer: 'FF02::1', forwardedFor: undefined, trustedProxies: ['ff02::1'] })).toBe('ff02::1');
    expect(clientAddress({ peer: '203.0.113.9', forwardedFor: undefined, trustedProxies: ['203.0.113.9'] })).toBe(
      '203.0.113.9',
    );
  });

  it('zaehlt ohne feststellbare Verbindungsadresse unter EINEM Schluessel', async () => {
    const app = await testApp(testConfig({ trustedProxies: [TRUSTED_PROXY] }));
    const kopf: Record<string, string> = { 'x-forwarded-for': '198.51.100.7' };

    // Ohne Verbindungsadresse (kein Node-Adapter, etwa ein Testaufruf) gibt es
    // nichts zu vergleichen - dann gilt EIN Topf fuer alle. Der Fehler geht
    // damit in die strenge Richtung (frueher 429), nicht in die lasche.
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await challengeRequest(app, kopf, undefined, '')).status).toBe(200);
    }
    expect((await challengeRequest(app, kopf, undefined, '')).status).toBe(429);
    expect(await countRateRows(UNKNOWN_CLIENT_KEY)).toBe(LIMIT);
  });

  it('nimmt aus X-Forwarded-For den ERSTEN Eintrag der Kette', () => {
    expect(forwardedClientAddress('203.0.113.9, 10.0.0.5, 10.0.0.6')).toBe('203.0.113.9');
    expect(forwardedClientAddress(' 203.0.113.9 ')).toBe('203.0.113.9');
    expect(forwardedClientAddress('2001:DB8::1')).toBe('2001:db8::1');
    expect(forwardedClientAddress('')).toBeNull();
    expect(forwardedClientAddress('a'.repeat(46))).toBeNull();
  });

  it('liest die Verbindungsadresse aus der Anfrage des Node-Adapters', () => {
    expect(peerAddressOf({ incoming: { socket: { remoteAddress: '127.0.0.1' } } })).toBe('127.0.0.1');
    expect(peerAddressOf({ incoming: { connection: { remoteAddress: '127.0.0.2' } } })).toBe('127.0.0.2');
    // Ohne Adapter (app.request() im Test) gibt es keine Adresse - der Aufrufer
    // faellt dann auf 'unknown' zurueck, also auf strenger, nicht auf laxer.
    expect(peerAddressOf({})).toBeUndefined();
    expect(peerAddressOf(undefined)).toBeUndefined();
  });
});
// -----------------------------------------------------------------------------
// 3. Aufraeumen: abgelaufene und verbrauchte Herausforderungen, alte Ratenzeilen
// -----------------------------------------------------------------------------

describe('cleanupAuth', () => {
  const STUNDE = 60 * 60 * 1000;

  it('entfernt verbrauchte Herausforderungen und laesst gueltige unbenutzte stehen', async () => {
    // Vor 90 Minuten verbraucht (also aelter als die Nachfrist von einer
    // Stunde, siehe src/cleanup.ts): weg.
    // ACHTUNG auth_challenges_used_check: used_at >= created_at. Deshalb ist
    // created_at aelter als used_at.
    const verbraucht = testK1('aa', '1');
    await insertChallenge({ k1: verbraucht, createdAgoMs: 3 * 60 * 60 * 1000, expiresAgoMs: 150 * 60 * 1000, usedAgoMs: 90 * 60 * 1000 });

    // Gueltig und unbenutzt: BLEIBT. Das ist ein laufender Anmeldevorgang.
    const laufend = testK1('bb', '2');
    await insertChallenge({ k1: laufend, createdAgoMs: 1000, expiresAgoMs: -5 * 60 * 1000, usedAgoMs: null });

    const ergebnis = await cleanupAuth(sql);

    expect(ergebnis.usedChallenges).toBeGreaterThanOrEqual(1);
    expect(await countChallenges(verbraucht)).toBe(0);
    expect(await countChallenges(laufend)).toBe(1);
  });

  it('entfernt abgelaufene Herausforderungen erst nach der Nachfrist', async () => {
    // Vor einer Stunde abgelaufen: weg.
    const altAbgelaufen = testK1('cc', '3');
    await insertChallenge({ k1: altAbgelaufen, createdAgoMs: 2 * STUNDE, expiresAgoMs: 65 * 60 * 1000, usedAgoMs: null });

    // Vor 30 Minuten abgelaufen: bleibt noch (Nachfrist, siehe src/cleanup.ts).
    const frischAbgelaufen = testK1('cc', '4');
    await insertChallenge({ k1: frischAbgelaufen, createdAgoMs: 40 * 60 * 1000, expiresAgoMs: 30 * 60 * 1000, usedAgoMs: null });

    const ergebnis = await cleanupAuth(sql);

    expect(ergebnis.expiredChallenges).toBeGreaterThanOrEqual(1);
    expect(await countChallenges(altAbgelaufen)).toBe(0);
    expect(await countChallenges(frischAbgelaufen)).toBe(1);

    // Nach der Nachfrist ist auch diese Zeile dran.
    const spaeter = new Date(Date.now() + EXPIRED_CHALLENGE_GRACE_MS);
    await cleanupAuth(sql, spaeter);
    expect(await countChallenges(frischAbgelaufen)).toBe(0);
  });

  it('entfernt Ratenzeilen alter Fenster und laesst die des laufenden Fensters stehen', async () => {
    const alt = '198.51.100.7';
    const frisch = '198.51.100.8';
    await insertRateRow(alt, new Date(Date.now() - 2 * STUNDE));
    await insertRateRow(frisch, new Date(Date.now() - 10 * 60 * 1000));

    const ergebnis = await cleanupAuth(sql);

    expect(ergebnis.rateEvents).toBeGreaterThanOrEqual(1);
    expect(await countRateRowsTotal(alt)).toBe(0);
    // Die frische Zeile wurde vor 10 Minuten geschrieben und liegt ausserhalb
    // des Fensters von einer Minute - gezaehlt wird sie deshalb nicht mehr, sie
    // STEHT aber noch. Genau darum geht es hier.
    expect(await countRateRowsTotal(frisch)).toBe(1);
    expect(await countRateRows(frisch)).toBe(0);

    // Erst nach der Nachfrist ist auch die frische Zeile dran - sie zaehlt nur
    // innerhalb des Fensters.
    await cleanupAuth(sql, new Date(Date.now() + RATE_EVENT_GRACE_MS));
    expect(await countRateRowsTotal(frisch)).toBe(0);
  });

  it('ist zweimal hintereinander gefahrlos: der zweite Lauf findet nichts mehr', async () => {
    const verbraucht = testK1('dd', '5');
    await insertChallenge({ k1: verbraucht, createdAgoMs: 3 * 60 * 60 * 1000, expiresAgoMs: 150 * 60 * 1000, usedAgoMs: 90 * 60 * 1000 });
    await insertRateRow('198.51.100.7', new Date(Date.now() - 2 * STUNDE));

    const erster = await cleanupAuth(sql);
    expect(erster.usedChallenges).toBeGreaterThanOrEqual(1);
    expect(erster.rateEvents).toBeGreaterThanOrEqual(1);

    // Kein Fehler, keine Wirkung: die Zeilen gibt es nicht mehr, die Bedingung
    // trifft nichts.
    const zweiter = await cleanupAuth(sql);
    expect(zweiter.usedChallenges).toBe(0);
    expect(zweiter.expiredChallenges).toBe(0);
    expect(zweiter.rateEvents).toBe(0);
  });

  it('ist auch bei zwei gleichzeitigen Laeufen gefahrlos', async () => {
    const verbraucht = testK1('aa', '6');
    await insertChallenge({ k1: verbraucht, createdAgoMs: 3 * 60 * 60 * 1000, expiresAgoMs: 150 * 60 * 1000, usedAgoMs: 90 * 60 * 1000 });

    // Beide Laeufe wollen dieselbe Zeile loeschen. PostgreSQL laesst einen
    // gewinnen; der andere wartet und meldet danach 0. Kein Fehler, kein
    // doppelter Effekt.
    const [a, b] = await Promise.all([cleanupAuth(sql), cleanupAuth(sql)]);
    expect(a.usedChallenges + b.usedChallenges).toBe(1);
    expect(await countChallenges(verbraucht)).toBe(0);
  });

  it('nennt die Fristen und die Zahlen im Protokolltext', async () => {
    const ergebnis = await cleanupAuth(sql);
    const text = describeCleanup(ergebnis);
    expect(text).toContain('verbrauchte Herausforderungen');
    expect(text).toContain('Ratenzeilen');
    expect(ergebnis.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Die Fristen sind eine Stunde Nachfrist - die Zahl steht an einer Stelle
    // (src/cleanup.ts) und ist hier festgehalten, damit eine Aenderung auffaellt.
    expect(USED_CHALLENGE_GRACE_MS).toBe(STUNDE);
    expect(RATE_EVENT_GRACE_MS).toBe(STUNDE);
  });
});

// -----------------------------------------------------------------------------
// 4. Das Aufraeumen beim Start - fehlertolerant
// -----------------------------------------------------------------------------

describe('Aufraeumen beim Start der App', () => {
  it('ruft das Aufraeumen einmal auf und meldet das Ergebnis', async () => {
    const protokoll = vi.spyOn(console, 'log').mockImplementation(() => {});
    const rufe: number[] = [];
    try {
      // Gezaehlt wird der Aufruf; das Ergebnis ist ein ECHTES Ergebnis von
      // cleanupAuth mit einer Frist weit in der Zukunft (es loescht also
      // nichts), damit der Protokolltext wirklich entsteht.
      const fern = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
      await createApp(sql, {
        auth: testConfig(),
        cleanupOnStart: async (db) => {
          rufe.push(1);
          return cleanupAuth(db, fern);
        },
      });
      expect(rufe).toHaveLength(1);
      expect(protokoll.mock.calls.some((aufruf) => String(aufruf[0]).includes('Aufgeraeumt'))).toBe(true);
    } finally {
      protokoll.mockRestore();
    }
  });

  it('startet auch dann, wenn das Aufraeumen scheitert', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Ein Fehler beim Aufraeumen darf den Start NICHT verhindern: alte
      // Zeilen sind ein Schoenheitsfehler, ein Ausfall waere keiner.
      const app = await createApp(sql, {
        auth: testConfig(),
        cleanupOnStart: async () => {
          throw new Error('Datenbank nicht erreichbar (Testfall)');
        },
      });
      const antwort = await app.request('/health');
      expect([200, 503]).toContain(antwort.status);
      expect(warnung.mock.calls.some((aufruf) => String(aufruf[0]).includes('Aufraeumen beim Start fehlgeschlagen'))).toBe(true);
    } finally {
      warnung.mockRestore();
    }
  });
});
// -----------------------------------------------------------------------------
// 5. Die Konfiguration: Standardwerte und ueberschreibbare Grenzen
// -----------------------------------------------------------------------------

describe('Konfiguration der Ratenbegrenzung', () => {
  const basis = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', SESSION_SECRET: 'x'.repeat(40), AUTH_BASE_URL: 'https://auth.test.invalid' };

  it('hat grosszuegige Standardwerte - ohne Umgebungsvariable', () => {
    const env = loadEnv(basis);
    expect(env.AUTH_RATE_LIMIT).toBe(DEFAULT_AUTH_RATE_LIMIT);
    expect(env.AUTH_RATE_WINDOW_MS).toBe(DEFAULT_AUTH_RATE_WINDOW_MS);
    expect(env.AUTH_TRUSTED_PROXIES).toEqual([]);

    // Ein Nutzer, der sich mehrfach anmeldet, muss durchkommen: die Vorgabe
    // muss deutlich ueber dem liegen, was ein echter Anmeldeversuch braucht.
    expect(env.AUTH_RATE_LIMIT).toBeGreaterThanOrEqual(10);
    // Und klein genug gegen Missbrauch bleiben (eine Schleife soll nicht
    // hunderte Zeilen je Minute schreiben).
    expect(env.AUTH_RATE_LIMIT).toBeLessThanOrEqual(60);
  });

  it('laesst sich per Umgebungsvariable ueberschreiben', () => {
    const env = loadEnv({ ...basis, AUTH_RATE_LIMIT: '5', AUTH_RATE_WINDOW_MS: '30000', AUTH_TRUSTED_PROXIES: '127.0.0.1, ::1' });
    expect(env.AUTH_RATE_LIMIT).toBe(5);
    expect(env.AUTH_RATE_WINDOW_MS).toBe(30_000);
    expect(env.AUTH_TRUSTED_PROXIES).toEqual(['127.0.0.1', '::1']);
  });

  it('meldet unbrauchbare Werte, statt sie still zu ersetzen', () => {
    const faelle: Array<[string, Record<string, string>, string]> = [
      ['keine Zahl', { AUTH_RATE_LIMIT: 'dreissig' }, 'AUTH_RATE_LIMIT'],
      ['null', { AUTH_RATE_LIMIT: '0' }, 'AUTH_RATE_LIMIT'],
      ['negativ', { AUTH_RATE_LIMIT: '-5' }, 'AUTH_RATE_LIMIT'],
      ['zu gross', { AUTH_RATE_LIMIT: '300000' }, 'AUTH_RATE_LIMIT'],
      ['Fenster unter einer Sekunde', { AUTH_RATE_WINDOW_MS: '10' }, 'AUTH_RATE_WINDOW_MS'],
      ['Fenster ueber einem Tag', { AUTH_RATE_WINDOW_MS: '999999999' }, 'AUTH_RATE_WINDOW_MS'],
      ['kein Adresswert im Proxy', { AUTH_TRUSTED_PROXIES: 'proxy.example' }, 'AUTH_TRUSTED_PROXIES'],
      ['CIDR statt Adresse', { AUTH_TRUSTED_PROXIES: '10.0.0.0/8' }, 'AUTH_TRUSTED_PROXIES'],
    ];

    for (const [name, werte, erwartet] of faelle) {
      let fehler: unknown = null;
      try {
        loadEnv({ ...basis, ...werte });
      } catch (error) {
        fehler = error;
      }
      expect(fehler, name).toBeInstanceOf(EnvError);
      expect((fehler as EnvError).problems.join(' '), name).toContain(erwartet);
    }
  });

  it('liest die Grenze aus der Umgebung bis in die Laufzeitkonfiguration', () => {
    const vorherLimit = process.env.AUTH_RATE_LIMIT;
    const vorherFenster = process.env.AUTH_RATE_WINDOW_MS;
    process.env.AUTH_RATE_LIMIT = '7';
    process.env.AUTH_RATE_WINDOW_MS = '45000';
    try {
      const config = authConfigFromEnv();
      expect(config.rateLimit).toBe(7);
      expect(config.rateWindowMs).toBe(45_000);
    } finally {
      if (vorherLimit === undefined) delete process.env.AUTH_RATE_LIMIT; else process.env.AUTH_RATE_LIMIT = vorherLimit;
      if (vorherFenster === undefined) delete process.env.AUTH_RATE_WINDOW_MS; else process.env.AUTH_RATE_WINDOW_MS = vorherFenster;
    }
  });
});