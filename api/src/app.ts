/**
 * Die Hono-App. Bewusst klein: keine Authentifizierung, keine Geschaeftslogik -
 * nur der Nachweis, dass die Kette Repository -> Hono -> PostgreSQL traegt.
 *
 * Zwei Endpunkte:
 *   GET /health      -> { status, db, version }   (db kommt aus SELECT 1)
 *   GET /api/ideas   -> { items, count, limit, offset }
 *
 * Feldnamen sind die kanonischen Bezeichner aus api/CONTRACT.md in snake_case,
 * also genau die Spaltennamen aus api/migrations/001_init.sql. Es wird nichts
 * umbenannt und nichts erfunden.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Sql } from 'postgres';
import { getDb, pingDb } from './db.js';
import { API_VERSION } from './version.js';

/** Paginierung: Grenzen, nicht Wunschwerte. */
export const DEFAULT_LIMIT = 20;
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const MAX_OFFSET = 1_000_000;

interface AppEnv {
  Variables: { db: Sql };
}

/** Eine Zeile aus `ideas`, unveraendert benannt wie im Schema (CONTRACT.md). */
export interface IdeaRow {
  id: string;
  author_id: string;
  title: string;
  description: string;
  tags: string[];
  language: string;
  stage: string;
  discussion_opened_at: Date;
  comment_count: number;
  vote_up: number;
  vote_down: number;
  marketplace_opened_at: Date | null;
  marketplace_closes_at: Date | null;
  funding_goal_sat: bigint | number | string | null;
  raised_sat: bigint | number | string;
  investor_count: number;
  creator_share_bp: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Die Abfrage steht als Ganzes an EINER Stelle: ausdrueckliche Spaltenliste
 * (kein SELECT *, damit das Schema nicht durchsickert) und stabile Reihenfolge
 * (created_at DESC, id DESC), damit Blaettern mit limit/offset keine Zeile
 * doppelt oder gar nicht liefert, wenn zwei Ideen denselben Zeitstempel haben.
 * limit und offset sind Parameter - kein Zusammenbauen von SQL-Text.
 */
const IDEAS_QUERY = (db: Sql, limit: number, offset: number) =>
  db<IdeaRow[]>`
    SELECT id, author_id, title, description, tags, language, stage,
           discussion_opened_at, comment_count, vote_up, vote_down,
           marketplace_opened_at, marketplace_closes_at, funding_goal_sat,
           raised_sat, investor_count, creator_share_bp, created_at, updated_at
      FROM ideas
     ORDER BY created_at DESC, id DESC
     LIMIT ${limit} OFFSET ${offset}`;

export function createApp(db: Sql = getDb()): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('db', db);
    await next();
  });

  // ---------------------------------------------------------------------------
  // GET /health - ist die API da UND antwortet die Datenbank?
  // ---------------------------------------------------------------------------
  // `db` wird durch eine echte Abfrage geprueft (SELECT 1), nicht geraten.
  // Antwortet die Datenbank nicht, ist das ein 503: der Prozess laeuft, ist aber
  // nicht gesund. Das ist die einzige Stelle, an der eine ausbleibende
  // DB-Antwort nicht als Fehler nach aussen schlaegt.
  app.get('/health', async (c) => {
    let dbOk = false;
    try {
      dbOk = await pingDb(c.get('db'));
    } catch (error) {
      console.warn(`[health] Datenbankpruefung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }

    return c.json(
      { status: dbOk ? 'ok' : 'degraded', db: dbOk, version: API_VERSION },
      dbOk ? 200 : 503,
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/ideas?limit=&offset=
  // ---------------------------------------------------------------------------
  app.get('/api/ideas', async (c) => {
    const limit = parseIntegerParam(c.req.query('limit'), 'limit', {
      fallback: DEFAULT_LIMIT,
      min: MIN_LIMIT,
      max: MAX_LIMIT,
    });
    const offset = parseIntegerParam(c.req.query('offset'), 'offset', {
      fallback: 0,
      min: 0,
      max: MAX_OFFSET,
    });

    const rows = await IDEAS_QUERY(c.get('db'), limit, offset);

    const items = rows.map((row) => toJsonSafe(row) as Record<string, unknown>);
    return c.json({ items, count: items.length, limit, offset });
  });

  // ---------------------------------------------------------------------------
  // Fehler als JSON, nicht als HTML-Stacktrace
  // ---------------------------------------------------------------------------
  app.notFound((c) =>
    c.json(
      { error: { code: 'not_found', message: `Unbekannter Endpunkt: ${c.req.method} ${c.req.path}` } },
      404,
    ),
  );

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      const status = error.status as ContentfulStatusCode;
      return c.json(
        { error: { code: status === 400 ? 'invalid_query' : 'http_error', message: error.message } },
        status,
      );
    }

    // Der Stacktrace bleibt im Serverprotokoll. Nach aussen geht nur die
    // Auskunft, dass etwas schiefging - keine Tabellennamen, keine Pfade.
    console.error('[api] Unerwarteter Fehler:', error);
    return c.json({ error: { code: 'internal_error', message: 'Interner Fehler.' } }, 500);
  });

  return app;
}

// -----------------------------------------------------------------------------
// Hilfsfunktionen
// -----------------------------------------------------------------------------

interface IntParamOptions {
  fallback: number;
  min: number;
  max: number;
}

/**
 * Liest einen ganzzahligen Abfrageparameter. Fehlend -> Standardwert.
 * Vorhanden, aber unbrauchbar (leer, Text, Dezimalzahl, negativ, zu gross) ->
 * HTTP 400. Bewusst kein stilles Zurechtbiegen: "limit=0" ist keine Anfrage
 * nach null Eintraegen, sondern ein Fehler des Aufrufers.
 */
function parseIntegerParam(raw: string | undefined, name: string, options: IntParamOptions): number {
  if (raw === undefined) {
    return options.fallback;
  }
  if (!/^\d+$/.test(raw)) {
    throw new HTTPException(400, {
      message: `Ungueltiger Parameter "${name}": ganze Zahl erwartet (erhalten: "${raw}")`,
    });
  }
  const value = Number(raw);
  if (value < options.min || value > options.max) {
    throw new HTTPException(400, {
      message: `Ungueltiger Parameter "${name}": erlaubt sind ${options.min}..${options.max} (erhalten: ${value})`,
    });
  }
  return value;
}

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * JSON kennt kein bigint (JSON.stringify wirft darauf). Geldbetraege sind laut
 * CONTRACT.md bigint - bis 2^53-1 (etwa 90 Billionen Satoshi, das 400.000-fache
 * des Bitcoin-Bestands) ist die Zahl als JSON-number exakt. Darueber wird die
 * Dezimalzahl als String ausgegeben, damit nichts gerundet wird.
 */
function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value >= -MAX_SAFE_BIGINT && value <= MAX_SAFE_BIGINT ? Number(value) : value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = toJsonSafe(entry);
    }
    return out;
  }
  return value;
}
