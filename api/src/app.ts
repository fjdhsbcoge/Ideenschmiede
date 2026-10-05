/**
 * Die Hono-App. Bewusst klein: keine Authentifizierung, keine Geschaeftslogik -
 * nur der Nachweis, dass die Kette Repository -> Hono -> PostgreSQL traegt.
 *
 * Zwei Endpunkte:
 *   GET /health      -> { status, db, version }   (db kommt aus SELECT 1)
 *   GET /api/ideas   -> { items, count, limit, offset }
 *
 * GET /api/ideas liefert die DOKUMENTIERTE Antwortform aus ARCHITECTURE.md
 * Anhang 5.2 (interface Idea): camelCase und verschachtelt. Die API ist die
 * Uebersetzungsschicht zwischen den flachen snake_case-Spalten und dem
 * Frontend-Vertrag (CONTRACT.md, "Namensform je Schicht").
 *
 * Gelesen wird ueber die beiden Views idea_discussion und idea_marketplace -
 * sie wurden genau dafuer gebaut (api/migrations/README.md, "Warum discussion
 * und marketplace Spalten sind"). Sie liefern die Werte und entscheiden, ob es
 * eine Marktplatzphase gibt; in TypeScript wird daraus nur noch die
 * verschachtelte Form (siehe toIdea). Die Zuordnung camelCase <-> snake_case
 * steht dort als Tabelle.
 *
 * Unveraendert bleiben die kanonischen Bezeichner aus api/CONTRACT.md - sie
 * gelten fuer die DATENBANK. Was hier passiert, ist reine Namensform, keine
 * Umbenennung von Bedeutung.
 */
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Sql } from 'postgres';
import {
  AUTH_ERROR_REASONS,
  AuthError,
  authConfigFromEnv,
  completeAuth,
  createChallenge,
  createSessionToken,
  findChallenge,
  isAuthAction,
  isK1,
  isLinkingKey,
  parseSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  verifySignature,
  type AuthAction,
  type AuthConfig,
  type AuthErrorReason,
  type AuthResult,
} from './auth.js';
import { findUserById, toPublicUser, type UserRecord } from './authStore.js';
import { getDb, pingDb } from './db.js';
import { API_VERSION } from './version.js';

/** Paginierung: Grenzen, nicht Wunschwerte. */
export const DEFAULT_LIMIT = 20;
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const MAX_OFFSET = 1_000_000;

interface AppEnv {
  Variables: { db: Sql; auth: AuthConfig };
}

/**
 * Die Lebensdauer des Sitzungs-Cookies entspricht dem JWT (exp). Zwei
 * verschiedene Fristen waeren ein Cookie, das noch mitgeschickt wird, obwohl
 * das Token laengst abgelaufen ist - oder umgekehrt eines, das zu frueh
 * verschwindet.
 */
const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;

// -----------------------------------------------------------------------------
// Die dokumentierte Antwortform (ARCHITECTURE.md Anhang 5.2, interface Idea)
// -----------------------------------------------------------------------------

/** Basispunkte: 10000 = 100 Prozent. Kein Geldbetrag, deshalb kein `_sat`. */
export interface Marketplace {
  /** ISO-8601 mit Z, wie jeder Zeitstempel dieser API. */
  openedAt: string;
  closesAt: string;
  /** Satoshi. Als Zahl, solange sie unter 2^53-1 liegt - darueber als Text. */
  fundingGoal: number | string;
  raised: number | string;
  investors: number;
  /** Basispunkte, 10000 = 100 Prozent. */
  creatorShareBp: number;
}

export interface Discussion {
  openedAt: string;
  comments: number;
  votes: { up: number; down: number };
}

/**
 * Ein Idea in der Form, in der er das Haus verlaesst.
 *
 * `marketplace` ist OPTIONAL - genau wie im Interface aus Anhang 5.2. Es fehlt
 * bei jeder Idee, deren Marktplatzphase nicht eroeffnet ist; die View
 * `idea_marketplace` liefert dafuer schlicht keine Zeile.
 *
 * `creatorShareBp` liegt INNERHALB von `marketplace`: die Zuordnungstabelle in
 * api/migrations/README.md fuehrt `ideas.creator_share_bp` unter
 * `marketplace`, und `idea_marketplace` ist die einzige View, die die Spalte
 * fuehrt. Beides zusammen heisst: die Marktplatzphase ist ihr Ort. Einzelheiten
 * und die gemeldete Abweichung zum Auftragstext: api/README.md, Punkt 10.
 */
export interface Idea {
  id: string;
  authorId: string;
  title: string;
  description: string;
  tags: string[];
  language: string;
  stage: string;
  discussion: Discussion;
  marketplace?: Marketplace;
  createdAt: string;
}

/**
 * Eine Zeile, wie die Abfrage sie liefert: flach, aber schon unter den Namen,
 * die aus der View kommen - die Spaltennamen sind hier die WHITELIST.
 *
 * `marketplaceOpenedAt === null` ist das einzige Merkmal dafuer, ob es
 * ueberhaupt eine Marktplatzphase gibt: der LEFT JOIN auf `idea_marketplace`
 * liefert dafuer keine Zeile, und `ideas_marketplace_all_or_nothing_check`
 * stellt sicher, dass dann auch alle uebrigen Marktspalten leer sind.
 *
 * Die Betraege kommen als `bigint` an (src/db.ts stellt das ein). Sie werden
 * NICHT in SQL in JSON gepackt - siehe toJsonSafe().
 */
interface IdeaRow {
  id: string;
  authorId: string;
  title: string;
  description: string;
  tags: string[];
  language: string;
  stage: string;
  /** idea_discussion.opened_at */
  discussionOpenedAt: Date;
  /** idea_discussion.comment_count */
  comments: number;
  /** idea_discussion.vote_up */
  votesUp: number;
  /** idea_discussion.vote_down */
  votesDown: number;
  /** idea_marketplace.opened_at - null heisst: keine Marktplatzphase. */
  marketplaceOpenedAt: Date | null;
  marketplaceClosesAt: Date | null;
  fundingGoalSat: bigint | number | null;
  raisedSat: bigint | number;
  investors: number;
  creatorShareBp: number;
  createdAt: Date;
}

/**
 * Setzt eine Zeile in die dokumentierte Form aus Anhang 5.2 um.
 *
 * Zwei Dinge passieren hier, und nur diese zwei:
 *
 * 1. **Gruppierung.** `discussion` und `marketplace` sind Werteobjekte des
 *    Ideas; die Felder kommen flach aus den beiden Views und werden hier
 *    zusammengefasst. Die Views liefern genau die Spalten, aber ein
 *    relationales Ergebnis kennt keine verschachtelten Objekte - das
 *    Zusammensetzen ist Namensform, keine neue Information.
 * 2. **Weglassen.** Ist `marketplaceOpenedAt` null, faellt der Schluessel
 *    ganz weg. Anhang 5.2 fuehrt `marketplace?` als optional; `null` waere
 *    eine zweite Schreibweise fuer denselben Sachverhalt.
 *
 * Warum das nicht in SQL passiert (und damit anders als die urspruengliche
 * Absicht, die Verschachtelung komplett in den Views zu lassen): `timestamptz`
 * kommt aus `json_build_object` als Postgres-Schreibweise
 * ("2026-05-01T10:00:00+00:00") und nicht als ISO-8601 mit "Z" - also anders
 * als jeder andere Zeitstempel dieser API. Und ein `bigint` kommt als
 * JSON-Zahl heraus, die der Treiber als double liest: 9007199254740993 wurde
 * dabei nachgemessen zu ...992. Beides verschwindet, wenn die Spalten als
 * Spalten gelesen werden.
 */
export function toIdea(row: IdeaRow): Idea {
  // Die `as unknown as`-Umformungen sind die Naht zwischen Datenbank und JSON:
  // hier stehen noch Date und bigint, in der Antwort stehen ISO-Text und Zahl.
  // Umgerechnet wird eine Zeile spaeter, in toJsonSafe(). Beide Stellen sind
  // noetig und beide sind klein - eine zweite Typfamilie fuer dieselbe Form
  // waere mehr Code als Nutzen.
  const discussion: Discussion = {
    openedAt: row.discussionOpenedAt as unknown as string,
    comments: row.comments,
    votes: { up: row.votesUp, down: row.votesDown },
  };

  const idea: Idea = {
    id: row.id,
    authorId: row.authorId,
    title: row.title,
    description: row.description,
    tags: row.tags,
    language: row.language,
    stage: row.stage,
    discussion,
    createdAt: row.createdAt as unknown as string,
  };

  if (row.marketplaceOpenedAt !== null) {
    idea.marketplace = {
      openedAt: row.marketplaceOpenedAt as unknown as string,
      closesAt: row.marketplaceClosesAt as unknown as string,
      fundingGoal: row.fundingGoalSat as unknown as number,
      raised: row.raisedSat as unknown as number,
      investors: row.investors,
      creatorShareBp: row.creatorShareBp,
    };
  }

  return idea;
}

/**
 * Die Abfrage steht als Ganzes an EINER Stelle: ausdrueckliche Spaltenliste
 * (kein SELECT *, damit das Schema nicht durchsickert), die Verschachtelung
 * kommt aus den dafuer gebauten Views (siehe oben), und die Reihenfolge ist
 * stabil (created_at DESC, id DESC), damit Blaettern mit limit/offset keine
 * Zeile doppelt oder gar nicht liefert, wenn zwei Ideen denselben Zeitstempel
 * haben. limit und offset sind Parameter - kein Zusammenbauen von SQL-Text.
 *
 * Die Spalten kommen unter den Namen heraus, unter denen sie in die Antwort
 * gehen; `vote_up` heisst hier `votesUp`, weil es in Anhang 5.2 unter
 * `votes.up` steht. Zweimal umbenennen - in SQL auf etwas anderes und in
 * TypeScript wieder zurueck - waere eine Umbenennung ohne Zweck.
 *
 * Der LEFT JOIN auf idea_marketplace ist bewusst: ein INNER JOIN wuerde jede
 * Idee ohne Marktplatzphase aus der Liste werfen.
 */
const IDEAS_QUERY = (db: Sql, limit: number, offset: number) =>
  db<IdeaRow[]>`
    SELECT i.id,
           i.author_id             AS "authorId",
           i.title,
           i.description,
           i.tags,
           i.language,
           i.stage,
           d.opened_at             AS "discussionOpenedAt",
           d.comment_count         AS "comments",
           d.vote_up               AS "votesUp",
           d.vote_down             AS "votesDown",
           m.opened_at             AS "marketplaceOpenedAt",
           m.closes_at             AS "marketplaceClosesAt",
           m.funding_goal_sat      AS "fundingGoalSat",
           m.raised_sat            AS "raisedSat",
           m.investor_count        AS "investors",
           m.creator_share_bp      AS "creatorShareBp",
           i.created_at            AS "createdAt"
      FROM ideas i
      JOIN idea_discussion  d ON d.idea_id = i.id
      LEFT JOIN idea_marketplace m ON m.idea_id = i.id
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT ${limit} OFFSET ${offset}`;

export interface CreateAppOptions {
  /**
   * Geheimnis und Basis-URL. Ohne Angabe aus der Umgebung; fehlt dort etwas,
   * wirft schon createApp - die API startet dann gar nicht erst (siehe
   * src/server.ts).
   */
  auth?: AuthConfig;
}

export function createApp(db: Sql = getDb(), options: CreateAppOptions = {}): Hono<AppEnv> {
  // Bewusst OHNE Standardwert: ein fest eingebautes SESSION_SECRET waere ein
  // Geheimnis, das in der Versionsverwaltung steht, und eine geratene
  // AUTH_BASE_URL wuerde alle Nutzer an eine fremde Domain binden. Fehlt einer
  // der Werte, bricht der Start mit Klartext ab - genau wie bei DATABASE_URL.
  const auth = options.auth ?? authConfigFromEnv();
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('auth', auth);
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

    // Zwei Schritte, klar getrennt: toIdea() stellt die dokumentierte Form her,
    // toJsonSafe() macht sie serialisierbar (bigint -> Zahl oder Text,
    // Date -> ISO-8601 mit Z). Keiner der beiden erfindet ein Feld.
    const items = rows.map((row) => toJsonSafe(toIdea(row)) as Idea);
    return c.json({ items, count: items.length, limit, offset });
  });

  // ---------------------------------------------------------------------------
  // LNURL-auth (Roadmap Phase 3.2)
  // ---------------------------------------------------------------------------
  // Pfade ohne Versionspraefix - wie die bestehenden Endpunkte dieser API
  // (/health, /api/ideas). ARCHITECTURE.md Anhang 6.1 nennt /api/v1/...; die
  // Abweichung ist im README unter "Entscheidungen und offene Punkte"
  // festgehalten und gemeldet, nicht stillschweigend gemacht.
  //
  // POST /api/auth/challenge
  //
  // Erzeugt die k1 und liefert die fertige LNURL fuer den QR-Code. Der
  // Aufrufer schickt KEINE URL und keine Domain: die Callback-Adresse kommt
  // ausschliesslich aus AUTH_BASE_URL. Wuerde der Host der Anfrage verwendet,
  // haette derselbe Nutzer je nach Aufrufweg einen anderen linkingKey - und
  // damit ein anderes Konto (Spezifikation: "if auth.site.com was initially
  // chosen then changing it to login.site.com will result in different account
  // for each user").
  app.post('/api/auth/challenge', async (c) => {
    const config = authOf(c);
    let action: AuthAction = 'login';
    const body = await readJsonBody(c.req.raw);
    if (body !== null && body.action !== undefined) {
      if (!isAuthAction(body.action)) {
        return authFailure(c, 400, AUTH_ERROR_REASONS.invalidRequest, `Unbekannte action: ${JSON.stringify(body.action)}`);
      }
      action = body.action;
    }

    // action=link haengt einen WEITEREN Schluessel an ein BESTEHENDES Konto.
    // Ohne Sitzung gibt es kein Konto - die Herausforderung entsteht deshalb
    // gar nicht erst. Der Wert bleibt trotzdem im Enum (Spezifikation) und in
    // der Datenbank erlaubt; der Ablauf selbst ist nicht Teil dieses Schritts.
    if (action === 'link') {
      const nutzer = await currentUser(c);
      if (nutzer === null) {
        return authFailure(c, 401, AUTH_ERROR_REASONS.linkNotSupported);
      }
      return authFailure(c, 501, AUTH_ERROR_REASONS.linkNotSupported);
    }

    const challenge = await createChallenge(c.get('db'), action, config);

    // expiresAt als ISO-8601 mit Z - dieselbe Zeitform wie jeder andere
    // Zeitstempel dieser API (toJsonSafe).
    return c.json({
      k1: challenge.k1,
      lnurl: challenge.lnurl,
      expiresAt: challenge.expiresAt.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/auth/callback?tag=login&k1=&key=&sig=&action=
  // ---------------------------------------------------------------------------
  // Die Spezifikation nennt k1, key und sig. `tag` und `action` sind Teil der
  // URL, damit ein Wallet, das die LNURL zerlegt, den Standardfall erkennt;
  // massgeblich fuer die Pruefung ist der action-Wert aus der DATENBANK, nicht
  // der aus der URL. Ein Aufrufer, der die action nachtraeglich aendert, kann
  // damit nichts erreichen.
  app.get('/api/auth/callback', async (c) => {
    const config = authOf(c);
    const k1 = c.req.query('k1');
    const key = c.req.query('key');
    const sig = c.req.query('sig');

    if (!isK1(k1) || !isLinkingKey(key) || sig === undefined || sig === '') {
      return authFailure(c, 400, AUTH_ERROR_REASONS.invalidRequest, 'Erwartet werden k1 (64 Hexzeichen), key (33 Byte compressed, hex) und sig (DER, hex).');
    }

    const challenge = await findChallenge(c.get('db'), k1);
    if (challenge === null) {
      return authFailure(c, 401, AUTH_ERROR_REASONS.unknownChallenge);
    }
    if (challenge.expiresAt.getTime() <= config.now()) {
      return authFailure(c, 401, AUTH_ERROR_REASONS.expiredChallenge);
    }

    // Erst die Signatur, dann wird verbraucht. Umgekehrt koennte jeder mit
    // geratenen Signaturen fremde Herausforderungen verbrennen.
    try {
      verifySignature(k1, key, sig);
    } catch (error) {
      if (error instanceof AuthError) {
        return authFailure(c, 401, error.reason);
      }
      throw error;
    }

    let result: AuthResult;
    try {
      result = await completeAuth(c.get('db'), k1, key, config);
    } catch (error) {
      if (error instanceof AuthError) {
        return authFailure(c, 401, error.reason);
      }
      throw error;
    }

    const token = createSessionToken(result.userId, config);
    const nutzer = await findUserById(c.get('db'), result.userId);

    setCookie(c, SESSION_COOKIE_NAME, token, sessionCookieOptions(secureCookies()));

    // Die dokumentierte Erfolgsantwort der Spezifikation ist { status: 'OK' }.
    // Sie bleibt genau so - und traegt zusaetzlich das Token und den Nutzer,
    // damit ein Client, der keine Cookies haelt (CLI, spaetere App), sich die
    // Sitzung nicht aus dem Set-Cookie-Kopf zusammensuchen muss.
    return c.json({
      status: 'OK',
      token,
      userId: result.userId,
      user: nutzer === null ? null : toPublicUser(nutzer),
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/logout
  // ---------------------------------------------------------------------------
  // Verwirft die Sitzung. Das Token wird nicht widerrufen - es gibt keine
  // Sitzungstabelle (Vorgabe) -, sondern geloescht: danach schickt der Client
  // es nicht mehr mit. Die kurze Lebensdauer aus SESSION_TTL_SECONDS begrenzt,
  // wie lange ein bereits kopiertes Token noch gilt.
  app.post('/api/auth/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE_NAME, sessionCookieOptions(secureCookies()));
    return c.json({ status: 'OK' });
  });

  // ---------------------------------------------------------------------------
  // GET /api/users/me
  // ---------------------------------------------------------------------------
  // Der angemeldete Nutzer. Ohne gueltige Sitzung: 401.
  app.get('/api/users/me', async (c) => {
    const nutzer = await currentUser(c);
    if (nutzer === null) {
      return authFailure(c, 401, AUTH_ERROR_REASONS.unauthorized);
    }
    return c.json({ user: toPublicUser(nutzer) });
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
// Hilfsfunktionen fuer die Auth-Routen
// -----------------------------------------------------------------------------

function authOf(c: Context<AppEnv>): AuthConfig {
  return c.get('auth');
}

/**
 * Die dokumentierte Fehlerform der Spezifikation: { status: 'ERROR', reason }.
 * Sie unterscheidet sich bewusst von der Fehlerform der uebrigen Endpunkte
 * ({ error: { code, message } }): LNURL-auth-Clients (Wallets) werten die
 * Antwort aus, und die Spezifikation schreibt diese Form vor. Ein Wallet soll
 * nicht gezwungen sein, eine API-eigene Huelle zu verstehen.
 */
function authFailure(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  reason: AuthErrorReason,
  detail?: string,
): Response {
  // Die Ursache bleibt im Serverprotokoll, wenn sie ueber die Standardantwort
  // hinausgeht - nach aussen geht eine knappe, feste Begruendung.
  if (detail !== undefined) {
    console.warn(`[auth] ${reason}: ${detail}`);
  }
  return c.json({ status: 'ERROR', reason }, status);
}

/**
 * JSON-Koerper, oder null. Ein leerer Koerper ist kein Fehler (die Vorgabe
 * action=login greift), ungueltiges JSON schon - stillschweigend darauf zu
 * verzichten hiesse, eine kaputte Anfrage als gueltige zu behandeln.
 */
async function readJsonBody(req: globalThis.Request): Promise<Record<string, unknown> | null> {
  const text = (await req.text()).trim();
  if (text === '') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new HTTPException(400, { message: 'Der Anfragekoerper muss ein JSON-Objekt sein.' });
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(400, { message: 'Der Anfragekoerper ist kein gueltiges JSON.' });
  }
}

/**
 * Der angemeldete Nutzer, oder null.
 *
 * Zwei Wege zum selben Token, weil es zwei Arten von Clients gibt:
 *   - Cookie: der Browser (das Cookie setzt der Callback selbst).
 *   - Authorization: Bearer <token>: CLI und spaetere App, die keine Cookies
 *     halten; das Token kommt aus der Antwort des Callbacks.
 *
 * Das Token wird gegen das Geheimnis geprueft (Signatur UND Ablauf) und der
 * Nutzer danach aus der Datenbank gelesen. Ein geloeschter Nutzer hat damit
 * sofort keine Sitzung mehr - das Token allein genuegt nicht.
 */
async function currentUser(c: Context<AppEnv>): Promise<UserRecord | null> {
  const token = readToken(c);
  if (token === null) {
    return null;
  }
  const session = parseSessionToken(token, authOf(c));
  if (session === null) {
    return null;
  }
  return findUserById(c.get('db'), session.userId);
}

/** Das Sitzungs-Token aus Cookie oder Authorization-Kopf - sonst null. */
function readToken(c: Context<AppEnv>): string | null {
  const ausCookie = getCookie(c, SESSION_COOKIE_NAME);
  if (ausCookie !== undefined && ausCookie !== '') {
    return ausCookie;
  }
  const kopf = c.req.header('authorization');
  if (kopf !== undefined && kopf.startsWith('Bearer ')) {
    const token = kopf.slice('Bearer '.length).trim();
    return token === '' ? null : token;
  }
  return null;
}

/**
 * secure nur in production. Im Entwicklungsbetrieb laeuft die API ueber http;
 * ein secure-Cookie wuerde der Browser dann verwerfen, und die Anmeldung waere
 * scheinbar erfolgreich, ohne zu wirken.
 */
function secureCookies(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Die Attribute, die ein Sitzungs-Cookie tragen muss. */
interface SessionCookieOptions {
  httpOnly: boolean;
  sameSite: 'Lax';
  path: string;
  maxAge: number;
  secure: boolean;
}

function sessionCookieOptions(secure: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE,
    secure,
  };
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
 *
 * Ein Detail, das eine Falle war: die Betraege duerfen NICHT in SQL in JSON
 * gepackt werden. `json_build_object` schreibt ein bigint als JSON-Zahl, und
 * die liest der Treiber als double - nachgemessen an 9007199254740993, das
 * dabei zu 9007199254740992 wurde, also um 1 zu klein. Deshalb liest
 * IDEAS_QUERY die Betragsspalten als Spalten; hier greift der bigint-Zweig.
 *
 * Der zweite Zweig fuer reine Ziffernfolgen bleibt trotzdem stehen: Betraege
 * koennen auch als Text ankommen (etwa aus einer Abfrage mit `::text`), und
 * dann gilt dieselbe Regel. Eng heisst eng - nur `^-?\d+$` wird betrachtet.
 * Titel, Beschreibung und id bleiben unberuehrt: eine Idee mit dem Titel
 * "1984" behaelt ihren Titel als Zeichenkette.
 *
 * Exportiert und damit einzeln pruefbar: die Regel ist eine Zusage nach aussen,
 * keine innere Hilfsfunktion.
 */
export function toJsonSafe(value: unknown): unknown {
  // bigint: als Zahl, solange exakt darstellbar - sonst als Dezimalzahl-Text.
  if (typeof value === 'bigint') {
    return value >= -MAX_SAFE_BIGINT && value <= MAX_SAFE_BIGINT ? Number(value) : value.toString();
  }
  // Text-Betrag aus der Abfrage (siehe IDEAS_QUERY): dieselbe Regel. Die
  // musterbasierte Pruefung grenzt den Zweig auf Ziffernfolgen ein.
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const exact = BigInt(value);
    return exact >= -MAX_SAFE_BIGINT && exact <= MAX_SAFE_BIGINT ? Number(exact) : value;
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