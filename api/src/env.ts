/**
 * Konfiguration der API aus Umgebungsvariablen - an EINER Stelle.
 *
 * Grundsatz: fehlende Pflichtwerte werden beim Start GEMELDET, nicht
 * stillschweigend durch einen Standardwert ersetzt. Ein geratener
 * Datenbankname faellt erst beim ersten Schreibvorgang auf - und dann in einer
 * Datenbank, die niemand erwartet hat.
 *
 * `dotenv/config` liest api/.env, falls die Datei existiert. Bereits gesetzte
 * Umgebungsvariablen haben Vorrang (dotenv ueberschreibt nichts).
 */
import 'dotenv/config';

export interface Env {
  /** Verbindungszeichenfolge zum PostgreSQL - Pflichtwert, kein Standardwert. */
  readonly DATABASE_URL: string;
  /**
   * Geheimnis der Sitzungs-Token (HS256) - Pflichtwert, kein Standardwert.
   * Ein geratenes Geheimnis bedeutet: jeder kann sich ein gueltiges Token
   * ausstellen. Deshalb dieselbe Regel wie bei DATABASE_URL: fehlt es, startet
   * die API nicht.
   */
  readonly SESSION_SECRET: string;
  /**
   * Basis-URL dieser Instanz fuer LNURL-auth - Pflichtwert, kein Standardwert.
   * Sie bestimmt den Domainnamen, den das Wallet in den linkingKey einrechnet
   * (siehe api/README.md, "Domainbindung"). Ein Standardwert waere hier
   * besonders schaedlich: localhost waere eine Domain, an die sich Nutzer
   * binden und die es spaeter nicht mehr gibt.
   */
  readonly AUTH_BASE_URL: string;
  /**
   * Geheimnis des BTCPay-Webhooks - Pflichtwert fuer den BETRIEB, kein
   * Standardwert. Ohne ihn koennte jede beliebige Stelle Zahlungen gutschreiben;
   * ein Standardwert stuende ausserdem in der Versionsverwaltung.
   *
   * Warum die Pruefung hier trotzdem NICHT hart ist: dieses Feld wird erst
   * gebraucht, wenn der Webhook-Endpunkt existiert. Ein Test, der nur
   * GET /api/ideas prueft, soll nicht an einer Variable scheitern, die er nicht
   * benutzt. Verbindlich ist der Wert in src/server.ts: der START bricht ohne ihn
   * ab (Phase 3.3, ADR-003) - siehe missingWebhookSecretMessage().
   */
  readonly BTCPAY_WEBHOOK_SECRET: string;
  /**
   * Ratenbegrenzung des oeffentlichen POST /api/auth/challenge:
   * erlaubte Aufrufe je Quelle und Fenster. Standard: 30.
   *
   * Hier ist ein Standardwert RICHTIG - anders als bei den Pflichtwerten oben.
   * Eine fehlende Begrenzung waere der gefaehrlichere Zustand (ein Aufrufer
   * ohne Konto kann die Tabelle unbegrenzt wachsen lassen), deshalb ist der
   * sichere Wert die Vorgabe und nicht der Abbruch.
   */
  readonly AUTH_RATE_LIMIT: number;
  /** Laenge des gleitenden Fensters in Millisekunden. Standard: 60000 (1 Minute). */
  readonly AUTH_RATE_WINDOW_MS: number;
  /**
   * Adressen von Reverse Proxies, deren X-Forwarded-For geglaubt wird -
   * kommasepariert, Standard: leer (kein Proxy).
   *
   * Warum die Vorgabe leer ist: X-Forwarded-For ist ein gewoehnlicher
   * HTTP-Kopf und damit von jedem Aufrufer setzbar. Wuerde er immer gelesen,
   * koennte ein Angreifer mit jeder Anfrage eine andere erfundene Adresse
   * schicken und die Begrenzung waere wirkungslos. Geglaubt wird der Kopf
   * deshalb nur, wenn die Verbindung selbst von einem eingetragenen Proxy
   * kommt.
   */
  readonly AUTH_TRUSTED_PROXIES: readonly string[];
  /** Port der HTTP-Schnittstelle. Standard: 3000. */
  readonly PORT: number;
  /** Adresse, auf der gelauscht wird. Standard: 127.0.0.1 (nicht oeffentlich). */
  readonly HOST: string;
  readonly NODE_ENV: 'development' | 'test' | 'production';
}

export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = '127.0.0.1';
export const MIN_PORT = 1;
export const MAX_PORT = 65_535;
/**
 * Untergrenze fuer SESSION_SECRET. HMAC-SHA256 selbst nimmt beliebig lange
 * Schluessel, aber ein kurzes Geheimnis ist der schwaechste Teil der Kette und
 * faellt bei einer Online-Woerterbuchsuche zuerst. 32 Zeichen sind keine
 * kryptografische Grenze, sondern eine Untergrenze gegen "geheim" und "test".
 */
export const MIN_SESSION_SECRET_LENGTH = 32;
export const DEFAULT_AUTH_RATE_LIMIT = 30;
/**
 * Obergrenze der einstellbaren Grenze. Keine Sicherheitsgrenze, sondern ein
 * Schutz gegen einen Vertipper mit Wirkung: "300000" waere eine Begrenzung,
 * die nie greift - und damit genau der Zustand, den dieser Schritt behebt.
 */
export const MAX_AUTH_RATE_LIMIT = 10_000;
export const DEFAULT_AUTH_RATE_WINDOW_MS = 60_000;
/**
 * Untergrenze des Fensters. Ein Fenster von wenigen Millisekunden waere keine
 * Begrenzung, sondern eine Bremse mit Zufallsergebnis; darunter ist der Wert
 * mit Sicherheit ein Vertipper (Sekunden statt Millisekunden).
 */
export const MIN_AUTH_RATE_WINDOW_MS = 1_000;
/** Obergrenze des Fensters: ein Tag. Wer laenger begrenzen will, will sperren - das ist etwas anderes. */
export const MAX_AUTH_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const NODE_ENVS = ['development', 'test', 'production'] as const;

/** Wird geworfen, wenn die Umgebung nicht benutzbar ist. Die Meldung nennt jeden Mangel einzeln. */
export class EnvError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(
      [
        'Ungueltige Konfiguration - die API startet nicht:',
        ...problems.map((problem) => `  - ${problem}`),
        'Vorlage mit allen Variablen: api/.env.example',
      ].join('\n'),
    );
    this.name = 'EnvError';
    this.problems = problems;
  }
}

type EnvSource = Record<string, string | undefined>;

/**
 * Liest und prueft die Konfiguration. Wirft EnvError, sobald etwas fehlt oder
 * unbrauchbar ist - es gibt keinen stillen Rueckfall auf einen Standardwert.
 * `source` ist injizierbar, damit die Pruefung ohne Prozessumgebung testbar ist.
 */
export function loadEnv(source: EnvSource = process.env): Env {
  const problems: string[] = [];

  // DATABASE_URL hat BEWUSST keinen Standardwert: jeder geratene Wert zeigt auf
  // eine Datenbank, die der Aufrufer nicht gemeint hat.
  const databaseUrl = (source.DATABASE_URL ?? '').trim();
  if (databaseUrl === '') {
    problems.push(
      'DATABASE_URL fehlt (Pflichtwert ohne Standardwert), z.B. postgres://benutzer:passwort@localhost:5432/ideenschmiede',
    );
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push(
      `DATABASE_URL muss mit postgres:// oder postgresql:// beginnen (erhalten: "${redactDatabaseUrl(databaseUrl)}")`,
    );
  }

  // SESSION_SECRET ebenfalls ohne Standardwert - aus demselben Grund wie oben.
  // Zusaetzlich geprueft wird nur die LAENGE, nicht der Inhalt: ob ein Geheimnis
  // wirklich geheim ist, kann diese Funktion nicht wissen.
  const sessionSecret = (source.SESSION_SECRET ?? '').trim();
  if (sessionSecret === '') {
    problems.push(
      `SESSION_SECRET fehlt (Pflichtwert ohne Standardwert), mindestens ${MIN_SESSION_SECRET_LENGTH} Zeichen - z.B. mit \`node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"\` erzeugen`,
    );
  } else if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    problems.push(
      `SESSION_SECRET ist zu kurz (${sessionSecret.length} Zeichen, mindestens ${MIN_SESSION_SECRET_LENGTH} noetig)`,
    );
  }

  // AUTH_BASE_URL bestimmt den Domainnamen, an den sich Wallets binden. Sie muss
  // absolut sein: aus "auth.example.com" laesst sich kein Callback bauen, und
  // aus einer relativen Angabe wuerde stillschweigend der Host der Anfrage -
  // genau die Abhaengigkeit, die hier ausgeschlossen werden soll.
  const authBaseUrl = (source.AUTH_BASE_URL ?? '').trim();
  if (authBaseUrl === '') {
    problems.push(
      'AUTH_BASE_URL fehlt (Pflichtwert ohne Standardwert), z.B. https://auth.ideenschmiede.example - sie bestimmt die Domain, an die Wallets den linkingKey binden',
    );
  } else {
    const problem = validateAuthBaseUrl(authBaseUrl);
    if (problem !== null) {
      problems.push(problem);
    }
  }

  // BTCPAY_WEBHOOK_SECRET: siehe die Anmerkung am Feld. Hier wird nur gelesen und
  // getrimmt - die Pflichtpruefung steht in src/server.ts, damit ein Testlauf,
  // der den Webhook gar nicht anfasst, nicht an diesem Wert scheitert.
  const btcpayWebhookSecret = (source.BTCPAY_WEBHOOK_SECRET ?? '').trim();

  const rawPort = (source.PORT ?? '').trim();
  let port = DEFAULT_PORT;
  if (rawPort !== '') {
    if (!/^\d+$/.test(rawPort)) {
      problems.push(`PORT="${rawPort}" ist keine ganze Zahl`);
    } else {
      const parsed = Number(rawPort);
      if (parsed < MIN_PORT || parsed > MAX_PORT) {
        problems.push(`PORT=${parsed} liegt ausserhalb von ${MIN_PORT}..${MAX_PORT}`);
      } else {
        port = parsed;
      }
    }
  }

  // Ratenbegrenzung: beide Werte haben einen Standardwert (siehe die Anmerkung
  // am Feld). Ein unbrauchbarer Wert ist trotzdem ein Fehler und keine stille
  // Korrektur: "AUTH_RATE_LIMIT= dreissig" soll nicht heimlich 30 bedeuten.
  const authRateLimit = parsePositiveInteger({
    raw: (source.AUTH_RATE_LIMIT ?? '').trim(),
    name: 'AUTH_RATE_LIMIT',
    fallback: DEFAULT_AUTH_RATE_LIMIT,
    min: 1,
    max: MAX_AUTH_RATE_LIMIT,
    problems,
  });
  const authRateWindowMs = parsePositiveInteger({
    raw: (source.AUTH_RATE_WINDOW_MS ?? '').trim(),
    name: 'AUTH_RATE_WINDOW_MS',
    fallback: DEFAULT_AUTH_RATE_WINDOW_MS,
    min: MIN_AUTH_RATE_WINDOW_MS,
    max: MAX_AUTH_RATE_WINDOW_MS,
    problems,
  });
  const authTrustedProxies = parseTrustedProxies((source.AUTH_TRUSTED_PROXIES ?? '').trim(), problems);

  const host = (source.HOST ?? '').trim() || DEFAULT_HOST;

  const rawNodeEnv = (source.NODE_ENV ?? '').trim();
  let nodeEnv: Env['NODE_ENV'] = 'development';
  if (rawNodeEnv !== '') {
    if ((NODE_ENVS as readonly string[]).includes(rawNodeEnv)) {
      nodeEnv = rawNodeEnv as Env['NODE_ENV'];
    } else {
      problems.push(`NODE_ENV="${rawNodeEnv}" ist unbekannt (erlaubt: ${NODE_ENVS.join(', ')})`);
    }
  }

  if (problems.length > 0) {
    throw new EnvError(problems);
  }

  return {
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: sessionSecret,
    AUTH_BASE_URL: normalizeAuthBaseUrl(authBaseUrl),
    BTCPAY_WEBHOOK_SECRET: btcpayWebhookSecret,
    AUTH_RATE_LIMIT: authRateLimit,
    AUTH_RATE_WINDOW_MS: authRateWindowMs,
    AUTH_TRUSTED_PROXIES: authTrustedProxies,
    PORT: port,
    HOST: host,
    NODE_ENV: nodeEnv,
  };
}

/**
 * Eine ganze Zahl aus einer Umgebungsvariablen, mit Standardwert.
 *
 * Leer heisst "nicht gesetzt" und ergibt den Standardwert. Ein gesetzter, aber
 * unbrauchbarer Wert wird GEMELDET und nicht stillschweigend ersetzt - sonst
 * fiele ein Tippfehler in der Konfiguration nie auf, und das Ergebnis waere
 * eine Begrenzung, die anders arbeitet als eingestellt.
 */
function parsePositiveInteger(args: {
  readonly raw: string;
  readonly name: string;
  readonly fallback: number;
  readonly min: number;
  readonly max: number;
  readonly problems: string[];
}): number {
  const { raw, name, fallback, min, max, problems } = args;
  if (raw === '') {
    return fallback;
  }
  if (!/^\d+$/.test(raw)) {
    problems.push(`${name}="${raw}" ist keine ganze Zahl`);
    return fallback;
  }
  const parsed = Number(raw);
  if (parsed < min || parsed > max) {
    problems.push(`${name}=${parsed} liegt ausserhalb von ${min}..${max}`);
    return fallback;
  }
  return parsed;
}

/**
 * Die Adressen, deren X-Forwarded-For geglaubt wird.
 *
 * Bewusst nur EINZELADRESSEEN und keine CIDR-Bereiche: ein Bereich (10.0.0.0/8)
 * laedt dazu ein, ihn weit zu fassen - und je weiter er ist, desto mehr
 * Aufrufer duerfen ihren eigenen Kopf bestimmen. Wer einen Proxy betreibt, kann
 * dessen Adresse eintragen; ein zweiter Proxy ist ein zweiter Eintrag.
 *
 * Doppelte Eintraege werden entfernt, damit die Pruefung nicht von der
 * Schreibweise der Liste abhaengt.
 */
function parseTrustedProxies(raw: string, problems: string[]): readonly string[] {
  if (raw === '') {
    return [];
  }
  const adressen = raw
    .split(',')
    .map((eintrag) => eintrag.trim().toLowerCase())
    .filter((eintrag) => eintrag !== '');
  for (const adresse of adressen) {
    if (!istIpAdresse(adresse)) {
      problems.push(
        `AUTH_TRUSTED_PROXIES enthaelt "${adresse}", was keine IPv4- oder IPv6-Adresse ist (erwartet z.B. 127.0.0.1, 10.0.0.5, ::1)`,
      );
    }
  }
  return [...new Set(adressen)];
}

/**
 * Grobe Formpruefung einer IP-Adresse. Sie entscheidet nicht ueber Gueltigkeit
 * (das tut der Vergleich mit der Verbindungsadresse), sondern darueber, ob der
 * Eintrag ueberhaupt eine Adresse sein KANN. Ein Hostname oder ein CIDR-Bereich
 * wird damit abgewiesen, statt still nie zu passen.
 */
export function istIpAdresse(value: string): boolean {
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
  // IPv6 enthaelt immer einen Doppelpunkt; die genaue Form prueft diese
  // Anwendung nicht nach - sie vergleicht die Adresse nur mit der Adresse der
  // Verbindung, und die kommt vom Betriebssystem.
  const ipv6 = value.includes(':') && /^[0-9a-f:.]+$/.test(value);
  return ipv4 || ipv6;
}

/**
 * Prueft die Basis-URL. Liefert die Mangelbeschreibung oder null.
 *
 * Bewusst streng: nur http(s), kein Query, kein Fragment, kein Benutzer/Passwort.
 * Ein Query-Teil waere ein Zeichen dafuer, dass hier eine fertige Callback-URL
 * steht - die Anhaengsel (tag, k1, action) haengt diese API selbst an.
 */
export function validateAuthBaseUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return `AUTH_BASE_URL ist keine gueltige absolute URL: "${value}" - erwartet z.B. https://auth.ideenschmiede.example`;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return `AUTH_BASE_URL muss mit http:// oder https:// beginnen (erhalten: "${parsed.protocol}//")`;
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return 'AUTH_BASE_URL darf keine Zugangsdaten enthalten';
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    return 'AUTH_BASE_URL darf keinen Query- und keinen Fragment-Teil enthalten (tag, k1 und action haengt die API selbst an)';
  }
  return null;
}

/**
 * Kanonische Form der Basis-URL: ohne Schraegstrich am Ende. Damit entsteht der
 * Callback immer aus derselben Zeichenkette - zwei Schreibweisen derselben
 * Domain ("...example" und "...example/") wuerden sonst zwei verschiedene
 * LNURLs ergeben, obwohl sie dieselbe Domain meinen.
 */
export function normalizeAuthBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Zugangsdaten gehoeren nicht in Logs, Fehlermeldungen oder HTTP-Antworten. */
export function redactDatabaseUrl(url: string): string {
  return url.replace(/\/\/[^@/]*@/, '//***:***@');
}
