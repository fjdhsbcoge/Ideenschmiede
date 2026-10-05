/**
 * Verbindungspool zum PostgreSQL - die EINZIGE Stelle, an der eine Verbindung
 * entsteht. app.ts und tests/ bekommen den Pool uebergeben bzw. holen ihn hier.
 *
 * Treiber: `postgres` (postgres.js). Die Verbindung ist faul: getDb() baut
 * keinen Kontakt auf, das passiert erst bei der ersten Abfrage. Deshalb kann
 * /health eine tote Datenbank melden (db: false), statt beim Import zu sterben.
 */
import postgres, { type Sql } from 'postgres';
import { loadEnv } from './env.js';

export const POOL_MAX = 10;
export const CONNECT_TIMEOUT_S = 5;

let pool: Sql | undefined;

/** Der Pool der Anwendung. Beim ersten Aufruf aus DATABASE_URL gebaut. */
export function getDb(): Sql {
  if (pool === undefined) {
    const { DATABASE_URL } = loadEnv();
    pool = postgres(DATABASE_URL, {
      max: POOL_MAX,
      idle_timeout: 30,
      connect_timeout: CONNECT_TIMEOUT_S,
      // NOTICE-Meldungen (z.B. "extension already exists") nicht auf stdout.
      onnotice: () => {},
      // OHNE diese Zeile liefert der Treiber int8 als STRING ("0" statt 0) -
      // nachgemessen, nicht vermutet. Geldspalten wie raised_sat oder
      // funding_goal_sat kaemen dann als Text in der JSON-Antwort an, obwohl
      // CONTRACT.md sie als bigint fuehrt. postgres.BigInt parst int8 zu
      // BigInt: exakt, ohne Umweg ueber Gleitkomma. app.ts macht daraus beim
      // Serialisieren eine JSON-Zahl, solange sie in 2^53-1 passt.
      types: { bigint: postgres.BigInt },
    });
  }
  return pool;
}

/**
 * Echte Abfrage gegen die Datenbank. Wirft, wenn keine Verbindung zustande
 * kommt - der Aufrufer entscheidet, was daraus folgt. `true` heisst: die
 * Datenbank hat geantwortet, es ist nicht geraten.
 */
export async function pingDb(db: Sql = getDb()): Promise<boolean> {
  const rows = await db<{ ok: number }[]>`SELECT 1 AS ok`;
  return rows[0]?.ok === 1;
}

/** Serverversion des verbundenen PostgreSQL - nur fuer Protokoll und Diagnose. */
export async function dbVersion(db: Sql = getDb()): Promise<string | null> {
  const rows = await db<{ version: string }[]>`SELECT current_setting('server_version') AS version`;
  return rows[0]?.version ?? null;
}

/** Pool schliessen (Serverende, Testende). Mehrfach aufrufbar. */
export async function closeDb(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current !== undefined) {
    await current.end({ timeout: 5 });
  }
}
