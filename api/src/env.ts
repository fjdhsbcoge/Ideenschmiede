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

  return { DATABASE_URL: databaseUrl, PORT: port, HOST: host, NODE_ENV: nodeEnv };
}

/** Zugangsdaten gehoeren nicht in Logs, Fehlermeldungen oder HTTP-Antworten. */
export function redactDatabaseUrl(url: string): string {
  return url.replace(/\/\/[^@/]*@/, '//***:***@');
}
