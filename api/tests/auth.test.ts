/**
 * LNURL-auth (Roadmap Phase 3.2) gegen eine ECHTE PostgreSQL-Datenbank.
 *
 * Die Signaturen entstehen mit einem echten secp256k1-Schluesselpaar und werden
 * ueber die echte HTTP-Strecke der App geprueft. Kein Mocking: der Beweis, dass
 * eine k1 nur einmal gilt, haengt an der Datenbank und wird auch dort
 * nachgesehen (used_at).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  AUTH_ERROR_REASONS,
  CHALLENGE_TTL_MS,
  authConfigFromEnv,
  type AuthConfig,
} from '../src/auth.js';
import { closeDb } from '../src/db.js';
import { EnvError, loadEnv } from '../src/env.js';
import { decodeBech32, utf8FromBytes, wordsToBytes } from './auth.helpers.js';
import {
  challengeRow,
  countIdentities,
  createKeypair,
  createUserWithIdentity,
  deleteChallenge,
  forgeToken,
  insertExpiredChallenge,
  mutateHex,
  signChallenge,
  signWithWrongKey,
  type TestKeypair,
} from './auth.helpers.js';
import { sql } from './helpers.js';

const SESSION_SECRET = process.env.SESSION_SECRET as string;
const AUTH_BASE_URL = (process.env.AUTH_BASE_URL as string).replace(/\/+$/, '');

/** Die Konfiguration, mit der die App im Test laeuft (Uhr injizierbar). */
let config: AuthConfig = authConfigFromEnv();
/**
 * Die App dieses Testlaufs.
 *
 * Sie entsteht in beforeAll, NICHT als const auf Modulebene: createApp ist
 * async, weil es das Aufraeumen beim Start abwartet (src/app.ts), und ein
 * await auf Modulebene waere hier ein zweiter Mechanismus fuer dieselbe Sache.
 *
 * Die Ratenbegrenzung wird fuer diesen Lauf ausdruecklich hoch gesetzt: dieser
 * Test prueft die ANMELDUNG, nicht die Begrenzung. Er ruft den Endpunkt
 * vielfach auf - mit der Vorgabe von 30 Aufrufen je Minute wuerde er sich
 * selbst aussperren, und der Fehler saehe wie ein Fehler der Anmeldung aus.
 * Die Begrenzung selbst hat eine eigene Datei (tests/ratelimit.test.ts).
 */
let app: Awaited<ReturnType<typeof createApp>>;

/**
 * Aufraeumbuch: jede angelegte k1 wird am Ende geloescht, ebenso die Nutzer,
 * die der Test ueber die API erzeugt hat. auth_identities haengt per ON DELETE
 * CASCADE an users.
 */
const benutzteK1: string[] = [];
const angelegteSchluessel: string[] = [];

interface ChallengeBody {
  k1: string;
  lnurl: string;
  expiresAt: string;
}

interface CallbackBody {
  status: string;
  reason?: string;
  token?: string;
  userId?: string;
  user?: { id: string; username: string; displayName: string; email: string; role: string };
}

interface MeBody {
  user: { id: string; username: string; email: string; role: string; createdAt: string };
}

// -----------------------------------------------------------------------------
// Hilfen
// -----------------------------------------------------------------------------

async function challenge(action?: string): Promise<ChallengeBody> {
  const antwort = await app.request('/api/auth/challenge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: action === undefined ? '{}' : JSON.stringify({ action }),
  });
  expect(antwort.status).toBe(200);
  const body = (await antwort.json()) as ChallengeBody;
  benutzteK1.push(body.k1);
  return body;
}

function callbackUrlFor(k1: string, key: string, sig: string, action?: string): string {
  const params = new URLSearchParams({ tag: 'login', k1, key, sig });
  if (action !== undefined) {
    params.set('action', action);
  }
  return '/api/auth/callback?' + params.toString();
}

/** Eine Herausforderung holen und gueltig signieren - der Regelfall. */
async function signierteHerausforderung(
  keypair: TestKeypair,
  action?: string,
): Promise<{ k1: string; url: string }> {
  const erzeugt = await challenge(action);
  const sig = signChallenge(erzeugt.k1, keypair.secretKeyHex);
  return { k1: erzeugt.k1, url: callbackUrlFor(erzeugt.k1, keypair.publicKeyHex, sig, action) };
}

async function callback(url: string): Promise<{ status: number; body: CallbackBody; setCookie: string | null }> {
  const antwort = await app.request(url);
  const body = (await antwort.json()) as CallbackBody;
  return { status: antwort.status, body, setCookie: antwort.headers.get('set-cookie') };
}

beforeAll(async () => {
  // Die Uhr wird erst hier festgelegt, damit der Ablauf-Test sie verschieben
  // kann, ohne die uebrigen Faelle zu beruehren.
  config = authConfigFromEnv();

  // Eigener Anfangszustand: Zeilen aus einem frueheren Lauf wuerden sonst
  // mitgezaehlt und der erste Aufruf koennte 429 statt 200 ergeben.
  await sql.unsafe('DELETE FROM auth_rate_events WHERE key = ANY($1::text[])', [
    ['unknown', '127.0.0.1'],
  ]);

  app = await createApp(sql, {
    auth: { ...config, rateLimit: 10_000, rateWindowMs: 60_000, trustedProxies: [] },
    // cleanupOnStart als Attrappe: das Aufraeumen beim Start braucht eine
    // eigene, vollstaendige Pruefung (tests/ratelimit.test.ts) und soll hier
    // keine Zeilen anfassen, die dieser Test gerade untersucht.
    cleanupOnStart: async () => undefined,
  });
});

afterAll(async () => {
  for (const k1 of benutzteK1) {
    await deleteChallenge(k1);
  }
  for (const key of angelegteSchluessel) {
    await sql.unsafe('DELETE FROM users WHERE id IN (SELECT user_id FROM auth_identities WHERE lower(linking_key) = lower($1))', [key]);
    await sql.unsafe('DELETE FROM auth_identities WHERE lower(linking_key) = lower($1)', [key]);
  }
  // Und die Ratenzeilen dieses Laufs - sie gehoeren diesem Test, nicht der
  // Datenbank. Sonst waeren sie der Anfangszustand des naechsten.
  await sql.unsafe('DELETE FROM auth_rate_events WHERE key = ANY($1::text[])', [
    ['unknown', '127.0.0.1'],
  ]);
  await closeDb();
});

// -----------------------------------------------------------------------------
// 1. Herausforderung
// -----------------------------------------------------------------------------

describe('POST /api/auth/challenge', () => {
  it('erzeugt eine k1 aus 32 Byte und eine LNURL, die genau die Callback-URL traegt', async () => {
    const erzeugt = await challenge();

    // "randomly generated 32 bytes of data" - als Hex also 64 Zeichen.
    expect(erzeugt.k1).toMatch(/^[0-9a-f]{64}$/);
    expect(Buffer.from(erzeugt.k1, 'hex')).toHaveLength(32);

    // Die LNURL ist bech32 mit dem Prefix lnurl, in Grossschreibung.
    expect(erzeugt.lnurl.startsWith('LNURL1')).toBe(true);
    const dekodiert = decodeBech32(erzeugt.lnurl);
    expect(dekodiert.prefix).toBe('lnurl');

    const url = utf8FromBytes(wordsToBytes(dekodiert.words));
    const params = new URL(url).searchParams;
    expect(url.startsWith(AUTH_BASE_URL + '/api/auth/callback?')).toBe(true);
    expect(params.get('tag')).toBe('login');
    expect(params.get('k1')).toBe(erzeugt.k1);
    expect(params.get('action')).toBe('login');

    // expiresAt ist ISO-8601 mit Z, wie jeder Zeitstempel dieser API.
    expect(erzeugt.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const frist = new Date(erzeugt.expiresAt).getTime();
    expect(frist).toBeGreaterThan(Date.now());
    expect(frist - Date.now()).toBeLessThanOrEqual(CHALLENGE_TTL_MS + 1000);

    // Die Herausforderung liegt wirklich in der Datenbank - nicht im Speicher.
    const zeile = await challengeRow(erzeugt.k1);
    expect(zeile).not.toBeNull();
    expect(zeile?.used_at).toBeNull();
    expect(zeile?.action).toBe('login');
  });

  it('nimmt jede k1 nur einmal an (Eindeutigkeit im Schema)', async () => {
    const a = await challenge();
    const b = await challenge();
    expect(a.k1).not.toBe(b.k1);

    // Der Primaerschluessel auf k1 laesst dieselbe Herausforderung kein
    // zweites Mal entstehen - die Zusage steht im Schema, nicht im Code.
    await expect(
      sql.unsafe('INSERT INTO auth_challenges (k1, action, expires_at) VALUES ($1, $2, $3)', [
        a.k1,
        'login',
        new Date(Date.now() + 60_000),
      ]),
    ).rejects.toThrow(/duplicate key|auth_challenges_pkey/i);
  });

  it('weist eine unbekannte action ab, statt still login anzunehmen', async () => {
    const antwort = await app.request('/api/auth/challenge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'admin' }),
    });
    expect(antwort.status).toBe(400);
    const body = (await antwort.json()) as CallbackBody;
    expect(body.status).toBe('ERROR');
    expect(body.reason).toBe(AUTH_ERROR_REASONS.invalidRequest);
  });

  it('verlangt fuer action=link eine Sitzung', async () => {
    const antwort = await app.request('/api/auth/challenge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'link' }),
    });
    expect(antwort.status).toBe(401);
    const body = (await antwort.json()) as CallbackBody;
    expect(body.reason).toBe(AUTH_ERROR_REASONS.linkNotSupported);
  });
});

// -----------------------------------------------------------------------------
// 2. Der erfolgreiche Login
// -----------------------------------------------------------------------------

describe('GET /api/auth/callback - Erfolg', () => {
  it('meldet mit gueltiger Signatur OK und setzt ein Sitzungs-Cookie', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);
    const { k1, url } = await signierteHerausforderung(keypair, 'register');

    const ergebnis = await callback(url);

    // Die dokumentierte Erfolgsantwort der Spezifikation.
    expect(ergebnis.status).toBe(200);
    expect(ergebnis.body.status).toBe('OK');
    expect(ergebnis.body.userId).toMatch(/^[0-9a-f-]{36}$/);

    // Cookie gesetzt (httpOnly, damit JavaScript es nicht lesen kann) und
    // zusaetzlich das Token im Koerper - fuer Clients ohne Cookie-Speicher.
    expect(ergebnis.setCookie).toContain('session=');
    expect(ergebnis.setCookie).toContain('HttpOnly');
    expect(ergebnis.setCookie).toContain('SameSite=Lax');
    expect(ergebnis.body.token).toBeTypeOf('string');

    // Nutzer und Identitaet sind wirklich entstanden.
    expect(ergebnis.body.user?.id).toBe(ergebnis.body.userId);
    expect(await countIdentities(keypair.publicKeyHex)).toBe(1);

    // Und die Herausforderung ist verbraucht.
    const zeile = await challengeRow(k1);
    expect(zeile?.used_at).not.toBeNull();

    // last_login_at ist gesetzt - auch beim allerersten Login. Sonst saehe ein
    // frisch angelegtes Konto aus wie "nie angemeldet".
    const identitaet = await sql.unsafe<{ last_login_at: Date | null }[]>(
      'SELECT last_login_at FROM auth_identities WHERE lower(linking_key) = lower($1)',
      [keypair.publicKeyHex],
    );
    expect(identitaet[0]?.last_login_at).toBeInstanceOf(Date);
  });

  it('akzeptiert eine Signatur ueber die k1-Bytes unabhaengig von der Schreibweise des Schluessels', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);
    const erzeugt = await challenge('register');
    const sig = signChallenge(erzeugt.k1, keypair.secretKeyHex);

    // Der Schluessel kommt GROSS geschrieben herein - die Eindeutigkeit und die
    // Suche laufen ueber lower(linking_key).
    const ergebnis = await callback(
      callbackUrlFor(erzeugt.k1, keypair.publicKeyHex.toUpperCase(), sig, 'register'),
    );
    expect(ergebnis.body.status).toBe('OK');
  });

  it('findet beim zweiten Login denselben Nutzer statt einen zweiten anzulegen', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);

    const erster = await callback((await signierteHerausforderung(keypair, 'register')).url);
    expect(erster.body.status).toBe('OK');

    const zweiter = await callback((await signierteHerausforderung(keypair, 'login')).url);
    expect(zweiter.body.status).toBe('OK');
    expect(zweiter.body.userId).toBe(erster.body.userId);

    // Genau EIN Konto und EINE Identitaet - kein zweites Konto fuer denselben
    // Schluessel.
    expect(await countIdentities(keypair.publicKeyHex)).toBe(1);
  });

  it('meldet einen bereits bekannten Schluessel bei action=register trotzdem an (idempotent)', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);

    const erster = await callback((await signierteHerausforderung(keypair, 'register')).url);
    const zweiter = await callback((await signierteHerausforderung(keypair, 'register')).url);

    expect(zweiter.body.status).toBe('OK');
    expect(zweiter.body.userId).toBe(erster.body.userId);
  });

  it('meldet einen vorhandenen Schluessel mit action=login an', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);
    const userId = await createUserWithIdentity(keypair.publicKeyHex);

    const ergebnis = await callback((await signierteHerausforderung(keypair, 'login')).url);
    expect(ergebnis.body.status).toBe('OK');
    expect(ergebnis.body.userId).toBe(userId);
  });
});

// -----------------------------------------------------------------------------
// 3. Die Einmaligkeit der k1 - der Replay-Schutz
// -----------------------------------------------------------------------------

describe('Einmaligkeit der k1', () => {
  it('weist DIESELBE Herausforderung beim zweiten Mal ab und laesst die Signatur gueltig', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);
    const { k1, url } = await signierteHerausforderung(keypair, 'register');

    const erster = await callback(url);
    expect(erster.body.status).toBe('OK');

    // Derselbe Aufruf, dieselbe (gueltige!) Signatur, dieselbe k1 - ein
    // abgefangener Aufruf, Wort fuer Wort wiederholt.
    const zweiter = await callback(url);
    expect(zweiter.status).toBe(401);
    expect(zweiter.body.status).toBe('ERROR');
    expect(zweiter.body.reason).toBe(AUTH_ERROR_REASONS.usedChallenge);
    expect(zweiter.body.token).toBeUndefined();

    // Das Token des ersten Aufrufs bleibt gueltig - abgewiesen wird der
    // zweite LOGIN, nicht die erste Sitzung.
    expect(erster.body.token).toBeTypeOf('string');

    // Und die Datenbank zeigt den Grund: used_at ist gesetzt.
    const zeile = await challengeRow(k1);
    expect(zeile?.used_at).not.toBeNull();
    expect(await countIdentities(keypair.publicKeyHex)).toBe(1);
  });

  it('erzeugt fuer jede Herausforderung eine eigene k1 - Wiederholung ist nicht vorhersagbar', async () => {
    const k1s = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      k1s.add((await challenge()).k1);
    }
    expect(k1s.size).toBe(20);
  });

  it('weist eine abgelaufene Herausforderung ab - auch mit gueltiger Signatur', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);

    // Der Schluessel ist bereits bekannt - am Schluessel kann die Ablehnung
    // also nicht liegen. Auch die Signatur ist gueltig. Es bleibt genau ein
    // Grund: die Frist.
    await createUserWithIdentity(keypair.publicKeyHex);

    // Eine abgelaufene Herausforderung entsteht ueber die API nicht (sie
    // erzeugt immer eine frische) - sie wird direkt angelegt. created_at liegt
    // mit in der Vergangenheit, sonst greift auth_challenges_expiry_check
    // (expires_at > created_at): eine Herausforderung, die abgelaufen ist,
    // muss auch erzeugt worden sein, bevor sie ablief.
    const k1 = 'e'.repeat(64);
    benutzteK1.push(k1);
    await insertExpiredChallenge(k1, 'login');
    const sig = signChallenge(k1, keypair.secretKeyHex);

    const ergebnis = await callback(callbackUrlFor(k1, keypair.publicKeyHex, sig, 'login'));
    expect(ergebnis.status).toBe(401);
    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.expiredChallenge);
    expect(ergebnis.body.token).toBeUndefined();

    // Abgelaufen heisst NICHT verbraucht: die Herausforderung bleibt als
    // Nachweis stehen, dass sie nie benutzt wurde.
    const zeile = await challengeRow(k1);
    expect(zeile?.used_at).toBeNull();
  });

  it('weist eine abgelaufene Herausforderung auch dann ab, wenn sie nie signiert wurde', async () => {
    const k1 = ('a' + Math.random().toString(16).slice(2)).padEnd(64, 'f').slice(0, 64);
    benutzteK1.push(k1);
    await insertExpiredChallenge(k1, 'login');
    const keypair = createKeypair();

    const ergebnis = await callback(callbackUrlFor(k1, keypair.publicKeyHex, 'deadbeef'));
    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.expiredChallenge);
  });

  it('weist ein nie erzeugtes k1 ab', async () => {
    const keypair = createKeypair();
    const fremd = 'f'.repeat(64);
    const sig = signChallenge(fremd, keypair.secretKeyHex);

    const ergebnis = await callback(callbackUrlFor(fremd, keypair.publicKeyHex, sig, 'register'));
    expect(ergebnis.status).toBe(401);
    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.unknownChallenge);
    expect(await countIdentities(keypair.publicKeyHex)).toBe(0);
  });

  it('setzt used_at in der Datenbank - der Verbrauch ist keine Behauptung der Anwendung', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);
    const { k1, url } = await signierteHerausforderung(keypair, 'register');

    expect((await challengeRow(k1))?.used_at).toBeNull();
    await callback(url);
    const zeile = await challengeRow(k1);
    expect(zeile?.used_at).toBeInstanceOf(Date);
  });
});

// -----------------------------------------------------------------------------
// 4. Signaturpruefung
// -----------------------------------------------------------------------------

describe('Signaturpruefung', () => {
  it('weist eine gefaelschte Signatur ab', async () => {
    const keypair = createKeypair();
    const erzeugt = await challenge('register');
    const echt = signChallenge(erzeugt.k1, keypair.secretKeyHex);

    // Ein Zeichen am Ende umgedreht: die Signatur sieht aus wie eine, ist aber
    // keine. (Ein kaputtes DER oder ein falscher Punkt enden in derselben
    // Antwort - das ist Absicht.)
    const gefaelscht = mutateHex(echt);
    const ergebnis = await callback(callbackUrlFor(erzeugt.k1, keypair.publicKeyHex, gefaelscht, 'register'));

    expect(ergebnis.status).toBe(401);
    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.invalidSignature);
    expect(await countIdentities(keypair.publicKeyHex)).toBe(0);

    // Wichtig: die Herausforderung ist NICHT verbraucht. Ein Angreifer mit
    // geratenen Signaturen darf fremde Herausforderungen nicht verbrennen.
    expect((await challengeRow(erzeugt.k1))?.used_at).toBeNull();
  });

  it('weist eine Signatur ab, die zu einem anderen Schluessel gehoert', async () => {
    const keypair = createKeypair();
    const erzeugt = await challenge('register');
    const fremd = signWithWrongKey(erzeugt.k1);

    // Gueltige Signatur - aber der angegebene Schluessel ist ein anderer.
    const ergebnis = await callback(
      callbackUrlFor(erzeugt.k1, keypair.publicKeyHex, fremd.sig, 'register'),
    );
    expect(ergebnis.status).toBe(401);
    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.invalidSignature);
    expect(await countIdentities(keypair.publicKeyHex)).toBe(0);

    // Der umgekehrte Fall: der Schluessel passt zur Signatur, aber es ist nicht
    // der, auf den signiert wurde - hier ist die signaturfremde Schluesselseite
    // der Punkt.
    const zweiterVersuch = await callback(
      callbackUrlFor(erzeugt.k1, fremd.publicKeyHex, signChallenge(erzeugt.k1, keypair.secretKeyHex), 'register'),
    );
    expect(zweiterVersuch.body.reason).toBe(AUTH_ERROR_REASONS.invalidSignature);
  });

  it('weist eine Signatur ab, die zu einer ANDEREN k1 gehoert', async () => {
    const keypair = createKeypair();
    const erste = await challenge('register');
    const zweite = await challenge('register');

    // Die Signatur der ersten Herausforderung auf die zweite anwenden.
    const sig = signChallenge(erste.k1, keypair.secretKeyHex);
    const ergebnis = await callback(callbackUrlFor(zweite.k1, keypair.publicKeyHex, sig, 'register'));

    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.invalidSignature);
    // Und beide Herausforderungen sind unverbraucht - abgewiesen bleibt
    // abgewiesen.
    expect((await challengeRow(zweite.k1))?.used_at).toBeNull();
    expect((await challengeRow(erste.k1))?.used_at).toBeNull();
  });

  it('weist unbrauchbare Parameter mit 400 ab, ohne die Signatur zu pruefen', async () => {
    const faelle = [
      ['k1 fehlt', '/api/auth/callback?key=' + '02'.padEnd(66, 'a') + '&sig=00'],
      ['k1 zu kurz', '/api/auth/callback?k1=abcd&key=' + '02'.padEnd(66, 'a') + '&sig=00'],
      ['key fehlt', '/api/auth/callback?k1=' + 'a'.repeat(64) + '&sig=00'],
      ['key ist kein Punkt (04-Praefix)', '/api/auth/callback?k1=' + 'a'.repeat(64) + '&key=' + '04'.padEnd(66, 'a') + '&sig=00'],
      ['sig fehlt', '/api/auth/callback?k1=' + 'a'.repeat(64) + '&key=' + '02'.padEnd(66, 'a')],
    ] as const;

    for (const [name, url] of faelle) {
      const ergebnis = await callback(url);
      expect(ergebnis.status, name).toBe(400);
      expect(ergebnis.body.status, name).toBe('ERROR');
      expect(ergebnis.body.reason, name).toBe(AUTH_ERROR_REASONS.invalidRequest);
    }
  });
});

// -----------------------------------------------------------------------------
// 5. action register / login
// -----------------------------------------------------------------------------

describe('action register und login', () => {
  it('weist action=login mit unbekanntem Schluessel ab und legt kein Konto an', async () => {
    const keypair = createKeypair();
    const { k1, url } = await signierteHerausforderung(keypair, 'login');

    const ergebnis = await callback(url);
    expect(ergebnis.status).toBe(401);
    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.unknownKey);
    expect(await countIdentities(keypair.publicKeyHex)).toBe(0);

    // Die abgewiesene Herausforderung bleibt unverbraucht - der Nutzer darf es
    // mit action=register erneut versuchen.
    expect((await challengeRow(k1))?.used_at).toBeNull();
  });

  it('legt mit action=register ein Konto an und findet es beim naechsten Login wieder', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);

    const registriert = await callback((await signierteHerausforderung(keypair, 'register')).url);
    expect(registriert.body.status).toBe('OK');
    const userId = registriert.body.userId as string;

    // Der Nutzer existiert wirklich in der Datenbank.
    const zeilen = await sql.unsafe<{ username: string; role: string }[]>(
      'SELECT username, role FROM users WHERE id = $1',
      [userId],
    );
    expect(zeilen[0]?.username).toMatch(/^[a-z0-9_]{3,30}$/);
    expect(zeilen[0]?.role).toBe('visitor');

    // Zweite Anmeldung mit action=login - derselbe Nutzer.
    const angemeldet = await callback((await signierteHerausforderung(keypair, 'login')).url);
    expect(angemeldet.body.status).toBe('OK');
    expect(angemeldet.body.userId).toBe(userId);
    expect(await countIdentities(keypair.publicKeyHex)).toBe(1);
  });

  it('verhaelt sich bei action=auth wie register (der uebliche LNURL-auth-Fall)', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);

    const erster = await callback((await signierteHerausforderung(keypair, 'auth')).url);
    expect(erster.body.status).toBe('OK');
    const zweiter = await callback((await signierteHerausforderung(keypair, 'auth')).url);
    expect(zweiter.body.userId).toBe(erster.body.userId);
  });

  it('nimmt ohne action den Standard login an und legt nichts an', async () => {
    const keypair = createKeypair();
    const { url } = await signierteHerausforderung(keypair);

    const ergebnis = await callback(url);
    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.unknownKey);
    expect(await countIdentities(keypair.publicKeyHex)).toBe(0);
  });

  it('ignoriert eine action aus der URL - massgeblich ist die gespeicherte', async () => {
    const keypair = createKeypair();
    // Die Herausforderung wurde fuer login erzeugt; die URL behauptet register.
    const { url } = await signierteHerausforderung(keypair, 'login');
    const manipuliert = url + '&action=register';

    const ergebnis = await callback(manipuliert);
    expect(ergebnis.body.reason).toBe(AUTH_ERROR_REASONS.unknownKey);
    expect(await countIdentities(keypair.publicKeyHex)).toBe(0);
  });

  it('erzeugt verschiedene k1 fuer register und login', async () => {
    const a = await challenge('register');
    const b = await challenge('login');
    expect(a.k1).not.toBe(b.k1);
    expect((await challengeRow(a.k1))?.action).toBe('register');
    expect((await challengeRow(b.k1))?.action).toBe('login');
  });
});

// -----------------------------------------------------------------------------
// 6. Sitzung: /api/users/me und logout
// -----------------------------------------------------------------------------

describe('GET /api/users/me', () => {
  it('antwortet ohne Sitzung mit 401', async () => {
    const antwort = await app.request('/api/users/me');
    expect(antwort.status).toBe(401);
    const body = (await antwort.json()) as CallbackBody;
    expect(body.status).toBe('ERROR');
    expect(body.reason).toBe(AUTH_ERROR_REASONS.unauthorized);
  });

  it('antwortet mit einem gefaelschten Cookie mit 401', async () => {
    const gefaelscht = forgeToken({ sub: '00000000-0000-0000-0000-000000000000', exp: 9999999999, iat: 1, jti: 'x' }, 'falsches-geheimnis');
    const antwort = await app.request('/api/users/me', { headers: { cookie: 'session=' + gefaelscht } });
    expect(antwort.status).toBe(401);
  });

  it('antwortet mit einem abgelaufenen Token mit 401 - auch wenn die Signatur stimmt', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);
    const login = await callback((await signierteHerausforderung(keypair, 'register')).url);
    const userId = login.body.userId as string;

    const abgelaufen = forgeToken(
      { sub: userId, exp: Math.floor(Date.now() / 1000) - 60, iat: Math.floor(Date.now() / 1000) - 120, jti: 'x' },
      SESSION_SECRET,
    );
    const antwort = await app.request('/api/users/me', { headers: { cookie: 'session=' + abgelaufen } });
    expect(antwort.status).toBe(401);
  });

  it('liefert mit dem Token aus dem Login den angemeldeten Nutzer', async () => {
    const keypair = createKeypair();
    angelegteSchluessel.push(keypair.publicKeyHex);
    const login = await callback((await signierteHerausforderung(keypair, 'register')).url);
    const token = login.body.token as string;

    // Einmal ueber den Koerper-Token...
    const ueberToken = await app.request('/api/users/me', { headers: { authorization: 'Bearer ' + token } });
    expect(ueberToken.status).toBe(200);
    const body = (await ueberToken.json()) as MeBody;
    expect(body.user.id).toBe(login.body.userId);
    expect(body.user.username).toMatch(/^[a-z0-9_]{3,30}$/);
    expect(body.user.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // ...und einmal ueber das Cookie aus dem Login (der Weg des Browsers).
    const ueberCookie = await app.request('/api/users/me', { headers: { cookie: 'session=' + token } });
    expect(ueberCookie.status).toBe(200);
    const ueberCookieBody = (await ueberCookie.json()) as MeBody;
    expect(ueberCookieBody.user.id).toBe(login.body.userId);
  });

  it('behandelt den Authorization-Kopf nicht als Sitzung, wenn er kein Bearer-Token ist', async () => {
    const antwort = await app.request('/api/users/me', { headers: { authorization: 'Basic irgendwas' } });
    expect(antwort.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('loescht das Sitzungs-Cookie', async () => {
    const antwort = await app.request('/api/auth/logout', { method: 'POST' });
    expect(antwort.status).toBe(200);
    const body = (await antwort.json()) as CallbackBody;
    expect(body.status).toBe('OK');

    const cookie = antwort.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('session=');
    // Ein geloeschtes Cookie hat einen leeren Wert und maxAge 0.
    expect(cookie).toMatch(/session=;|session=""/);
    expect(cookie.toLowerCase()).toContain('max-age=0');
  });
});

// -----------------------------------------------------------------------------
// 7. Konfiguration: fehlendes SESSION_SECRET
// -----------------------------------------------------------------------------

describe('Konfiguration', () => {
  it('bricht ohne SESSION_SECRET ab - kein Standardwert', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgres://u:p@localhost:5432/db', AUTH_BASE_URL })).toThrow(EnvError);

    try {
      loadEnv({ DATABASE_URL: 'postgres://u:p@localhost:5432/db', AUTH_BASE_URL });
    } catch (error) {
      expect((error as EnvError).problems.join(' ')).toContain('SESSION_SECRET');
    }
  });

  it('bricht ohne AUTH_BASE_URL ab', () => {
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgres://u:p@localhost:5432/db', SESSION_SECRET: 'x'.repeat(40) }),
    ).toThrow(EnvError);
  });

  it('bricht bei einer relativen AUTH_BASE_URL ab', () => {
    try {
      loadEnv({
        DATABASE_URL: 'postgres://u:p@localhost:5432/db',
        SESSION_SECRET: 'x'.repeat(40),
        AUTH_BASE_URL: 'auth.example.com',
      });
      throw new Error('Erwartet: EnvError');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect((error as EnvError).problems.join(' ')).toContain('AUTH_BASE_URL');
    }
  });

  it('bricht auch createApp ab, wenn die Umgebung kein SESSION_SECRET hat', async () => {
    // createApp ohne injizierte Konfiguration liest die Umgebung. Fehlt dort
    // etwas, startet die API nicht - wie bei DATABASE_URL.
    const vorher = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      await expect(createApp(sql)).rejects.toThrow(EnvError);
    } finally {
      process.env.SESSION_SECRET = vorher;
    }
  });

  it('baut aus SESSION_SECRET und AUTH_BASE_URL genau die konfigurierte Callback-Adresse', async () => {
    const erzeugt = await challenge();
    const url = utf8FromBytes(wordsToBytes(decodeBech32(erzeugt.lnurl).words));
    // Der Host kommt aus AUTH_BASE_URL, nicht aus dem Request. Genau daran
    // haengt die Schluesselableitung im Wallet (Spezifikation: der volle
    // Domainname ist das Material).
    expect(new URL(url).origin).toBe(AUTH_BASE_URL);
  });
});