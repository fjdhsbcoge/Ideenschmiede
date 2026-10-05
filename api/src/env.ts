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
    PORT: port,
    HOST: host,
    NODE_ENV: nodeEnv,
  };
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
