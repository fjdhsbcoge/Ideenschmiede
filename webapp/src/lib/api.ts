/**
 * Die Grenze zum Backend.
 *
 * Diese Datei ist die EINZIGE Stelle, an der eine API-Antwort zu Frontend-Daten
 * wird. Sie prueft, was ankommt, und wirft bei unerwarteter Form einen Fehler
 * mit Pfad und Fundstelle. Nichts wird still durchgereicht.
 *
 * Warum ueberhaupt geprueft wird, obwohl TypeScript Typen hat: Typen gelten nur
 * fuer den eigenen Code. Was `fetch` liefert, ist zur Laufzeit `unknown` - ein
 * `as ApiIdea` waere eine Behauptung, keine Pruefung. Genau daran ist die
 * Stufen-Anzeige vorher gescheitert: ein Wert, den das Frontend nicht kannte,
 * wurde uebernommen und ergab ein leeres Badge (class="badge undefined") statt
 * einer Meldung. Deshalb steht die Stufenpruefung hier und nicht erst in der
 * Oberflaeche.
 *
 * Vertrag: ARCHITECTURE.md Anhang 5.2 (interface Idea) und die Umsetzung in
 * api/src/app.ts. Die Endpunkte dieser API tragen kein `/v1`-Praefix:
 * GET /api/ideas?limit=&offset= und GET /api/users/me.
 *
 * Dieser Teil ist bewusst NOCH NICHT in den Store eingebaut - er wird erst
 * angelegt und geprueft; der Umbau des Stores ist ein eigener Schritt.
 */
import { IDEA_STAGES, isIdeaStage, type IdeaStage } from '@/lib/data';

// ---------------------------------------------------------------------------
// Basis-URL
// ---------------------------------------------------------------------------

/**
 * Standard: ein RELATIVER Pfad, kein absoluter.
 *
 * Warum relativ: damit stimmt der Standard in beiden Umgebungen.
 *   - Entwicklung: der Vite-Dev-Server leitet /api an die API weiter
 *     (vite.config.ts, server.proxy). Der Browser spricht nur mit dem
 *     Dev-Server, also gleicher Ursprung - und CORS entfaellt.
 *   - Betrieb: Frontend und API liegen hinter demselben Reverse Proxy
 *     (Roadmap Phase 3, Hosting per nginx), also ebenfalls ein Ursprung.
 * Ein absoluter Standard auf 127.0.0.1 waere im Betrieb falsch und wuerde
 * dort zu Ursprungsfehlern fuehren, die wie Netzwerkfehler aussehen.
 *
 * VITE_API_BASE_URL bleibt als Ueberschreibung fuer den Fall, dass Frontend
 * und API bewusst auf verschiedenen Hosts liegen.
 */
export const DEFAULT_API_BASE_URL = '/api';

/**
 * Liest die Basis-URL aus der Vite-Umgebungsvariable VITE_API_BASE_URL.
 *
 * Der Zugriff auf `import.meta.env` ist absichtlich defensiv: in einem reinen
 * Node-Lauf (Test, Skript) gibt es das Objekt nicht. Ein fehlender Wert fuehrt
 * dann zum Entwicklungs-Standard, nicht zu einem Absturz.
 */
export function apiBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  const raw = env?.VITE_API_BASE_URL;
  const base = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Fehler
// ---------------------------------------------------------------------------

/**
 * Ein Fehler an der Grenze zum Backend - Netzwerk, HTTP-Status oder Form.
 *
 * `status` ist null, wenn es keine Antwort gab (Netzwerkfehler) oder wenn die
 * Antwort kein JSON war. `url` steht immer dabei: ohne die angefragte Adresse
 * ist eine Fehlermeldung aus dem Browser kaum zu gebrauchen.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly url: string;

  constructor(message: string, options: { status?: number; url?: string; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status ?? null;
    this.url = options.url ?? '';
  }
}

// ---------------------------------------------------------------------------
// Die Form der API
// ---------------------------------------------------------------------------

/**
 * Ein Betrag in satoshi, wie er ueber die Leitung kommt.
 *
 * Zahl ODER Text: api/src/app.ts serialisiert `bigint` ueber toJsonSafe() als
 * Zahl, solange sie exakt in eine double passt, und darueber als
 * Dezimalzahl-Text. Ein Typ, der hier nur `number` zuliesse, wuerde eine
 * gueltige Antwort als Fehler melden - die Pruefung akzeptiert deshalb beide
 * Formen und `satToNumber()` rechnet sie zusammen.
 */
export type SatAmount = number | string;

export interface ApiMarketplace {
  openedAt: string;
  closesAt: string;
  fundingGoal: SatAmount;
  raised: SatAmount;
  investors: number;
  /** Basispunkte: 10000 = 100 Prozent. */
  creatorShareBp: number;
}

export interface ApiDiscussion {
  openedAt: string;
  comments: number;
  votes: { up: number; down: number };
}

/** Ein Idea in der Form der API. */
export interface ApiIdea {
  id: string;
  authorId: string;
  title: string;
  description: string;
  tags: string[];
  language: string;
  /** Geprueft gegen IDEA_STAGES - ein Fremdwert kommt hier nicht durch. */
  stage: IdeaStage;
  discussion: ApiDiscussion;
  createdAt: string;
  /** Fehlt, solange die Marktplatzphase nicht eroeffnet ist. */
  marketplace?: ApiMarketplace;
}

/** Antwort von GET /api/ideas. */
export interface ApiIdeaPage {
  items: ApiIdea[];
  count: number;
  limit: number;
  offset: number;
}

/** Der angemeldete Nutzer, wie ihn GET /api/users/me liefert. */
export interface ApiUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  language: string;
  role: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Pruefungen
// ---------------------------------------------------------------------------

/** Kurzbeschreibung eines Werts fuer Fehlermeldungen - ohne Riesentexte. */
function describe(value: unknown): string {
  if (value === undefined) return 'nichts (Feld fehlt)';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'eine Liste';
  if (typeof value === 'string') {
    return `der Text "${value.length > 60 ? value.slice(0, 57) + '...' : value}"`;
  }
  if (typeof value === 'object') return 'ein Objekt';
  return `${typeof value} ${String(value)}`;
}

function fail(path: string, expected: string, value: unknown): never {
  throw new ApiError(`Unerwartete API-Antwort: ${path} - erwartet ${expected}, bekommen ${describe(value)}.`);
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'ein Objekt', value);
  }
  return value as Record<string, unknown>;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'einen Text', value);
  return value;
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'eine Zahl', value);
  return value;
}

function expectStringList(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'eine Liste von Texten', value);
  return value.map((entry, i) => expectString(entry, `${path}[${i}]`));
}

/** Ein Betrag: Zahl oder Ziffernfolge (siehe SatAmount). */
function expectSat(value: unknown, path: string): SatAmount {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return value;
  fail(path, 'eine Zahl oder eine Ziffernfolge in satoshi', value);
}

/**
 * Die Stufe - die eine Stelle, an der ein unbekannter Wert auffallen MUSS.
 *
 * Die erlaubten Werte kommen aus IDEA_STAGES, nicht aus einer zweiten Liste
 * hier: sonst gaebe es zwei Wahrheiten, die auseinanderlaufen koennen.
 */
export function parseStage(value: unknown, path = 'stage'): IdeaStage {
  if (!isIdeaStage(value)) {
    fail(path, `eine der Stufen ${IDEA_STAGES.join(', ')}`, value);
  }
  return value;
}

export function parseDiscussion(value: unknown, path = 'discussion'): ApiDiscussion {
  const raw = expectObject(value, path);
  const votes = expectObject(raw.votes, `${path}.votes`);
  return {
    openedAt: expectString(raw.openedAt, `${path}.openedAt`),
    comments: expectNumber(raw.comments, `${path}.comments`),
    votes: {
      up: expectNumber(votes.up, `${path}.votes.up`),
      down: expectNumber(votes.down, `${path}.votes.down`),
    },
  };
}

export function parseMarketplace(value: unknown, path = 'marketplace'): ApiMarketplace {
  const raw = expectObject(value, path);
  return {
    openedAt: expectString(raw.openedAt, `${path}.openedAt`),
    closesAt: expectString(raw.closesAt, `${path}.closesAt`),
    fundingGoal: expectSat(raw.fundingGoal, `${path}.fundingGoal`),
    raised: expectSat(raw.raised, `${path}.raised`),
    investors: expectNumber(raw.investors, `${path}.investors`),
    creatorShareBp: expectNumber(raw.creatorShareBp, `${path}.creatorShareBp`),
  };
}

/**
 * Prueft ein Idea.
 *
 * Zusaetzliche Felder werden ignoriert - die API darf spaeter etwas
 * hinzufuegen, ohne dass das Frontend bricht. Fehlende Pflichtfelder und
 * falsche Typen sind dagegen Fehler, und `marketplace` wird nur geprueft,
 * wenn es da ist (es ist optional, siehe Anhang 5.2).
 */
export function parseIdea(value: unknown, path = 'idea'): ApiIdea {
  const raw = expectObject(value, path);
  const idea: ApiIdea = {
    id: expectString(raw.id, `${path}.id`),
    authorId: expectString(raw.authorId, `${path}.authorId`),
    title: expectString(raw.title, `${path}.title`),
    description: expectString(raw.description, `${path}.description`),
    tags: expectStringList(raw.tags, `${path}.tags`),
    language: expectString(raw.language, `${path}.language`),
    stage: parseStage(raw.stage, `${path}.stage`),
    discussion: parseDiscussion(raw.discussion, `${path}.discussion`),
    createdAt: expectString(raw.createdAt, `${path}.createdAt`),
  };
  if (raw.marketplace !== undefined && raw.marketplace !== null) {
    idea.marketplace = parseMarketplace(raw.marketplace, `${path}.marketplace`);
  }
  return idea;
}

/** Antwort von GET /api/ideas: { items, count, limit, offset }. */
export function parseIdeaPage(value: unknown, path = 'antwort'): ApiIdeaPage {
  const raw = expectObject(value, path);
  if (!Array.isArray(raw.items)) fail(`${path}.items`, 'eine Liste von Ideen', raw.items);
  return {
    items: raw.items.map((entry, i) => parseIdea(entry, `${path}.items[${i}]`)),
    count: expectNumber(raw.count, `${path}.count`),
    limit: expectNumber(raw.limit, `${path}.limit`),
    offset: expectNumber(raw.offset, `${path}.offset`),
  };
}

/** Antwort von GET /api/users/me: { user }. */
export function parseUser(value: unknown, path = 'antwort'): ApiUser {
  const raw = expectObject(value, path);
  const user = expectObject(raw.user, `${path}.user`);
  return {
    id: expectString(user.id, `${path}.user.id`),
    username: expectString(user.username, `${path}.user.username`),
    displayName: expectString(user.displayName, `${path}.user.displayName`),
    email: expectString(user.email, `${path}.user.email`),
    language: expectString(user.language, `${path}.user.language`),
    role: expectString(user.role, `${path}.user.role`),
    createdAt: expectString(user.createdAt, `${path}.user.createdAt`),
  };
}

/**
 * Rechnet einen Betrag aus der API in eine Zahl um.
 *
 * Noetig, weil ein Betrag als Text ankommen kann, sobald er nicht mehr exakt in
 * eine double passt. Statt still zu runden, ist ein solcher Betrag hier ein
 * Fehler: eine Anzeige, die um Satoshis danebenliegt, ist schlimmer als eine
 * Meldung.
 */
export function satToNumber(value: SatAmount, path = 'Betrag'): number {
  const zahl = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(zahl)) {
    throw new ApiError(`${path}: ${String(value)} ist keine exakt darstellbare Zahl (groesser als 2^53-1).`);
  }
  return zahl;
}

// ---------------------------------------------------------------------------
// Anfragen
// ---------------------------------------------------------------------------

interface RawResponse {
  ok: boolean;
  status: number;
  url: string;
  payload: unknown;
}

/** Was die API zu einem Fehlerstatus selbst sagt - falls sie etwas sagt. */
function serverHint(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const body = payload as Record<string, unknown>;
  const hint = body.error ?? body.reason ?? body.message;
  return typeof hint === 'string' && hint !== '' ? ` Meldung der API: ${hint}` : '';
}

/**
 * Eine Anfrage, drei moegliche Fehler - und keiner davon still:
 * kein Netz, keine JSON-Antwort, oder ein Fehlerstatus.
 */
async function performRequest(path: string, signal?: AbortSignal): Promise<RawResponse> {
  const url = `${apiBaseUrl()}${path}`;
  let response: Response;
  try {
    // credentials: 'include' - die Sitzung dieser API haengt an einem Cookie
    // (SESSION_COOKIE_NAME). Ohne das kaeme /api/users/me nie als angemeldet an.
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      credentials: 'include',
      signal,
    });
  } catch (cause) {
    throw new ApiError(`Die API ist nicht erreichbar: ${url}.`, { url, cause });
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text !== '') {
    try {
      payload = JSON.parse(text) as unknown;
    } catch (cause) {
      throw new ApiError(
        `Die Antwort von ${url} ist kein JSON (HTTP ${response.status}).`,
        { status: response.status, url, cause },
      );
    }
  }

  return { ok: response.ok, status: response.status, url, payload };
}

async function requestJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const { ok, status, url, payload } = await performRequest(path, signal);
  if (!ok) {
    throw new ApiError(`${path} wurde mit HTTP ${status} abgelehnt.${serverHint(payload)}`, { status, url });
  }
  return payload;
}

// Grenzen der API (api/src/app.ts): limit 1..100, offset 0..1000000.
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const MAX_OFFSET = 1_000_000;

export interface ListIdeasParams {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

/**
 * GET /api/ideas?limit=&offset=
 *
 * Die Grenzen werden hier geprueft, nicht der API ueberlassen: ein
 * ungueltiger Wert waere dort ein HTTP 400, und die Meldung "abgelehnt"
 * verschwiege, welcher Parameter gemeint war.
 */
export async function listIdeas(params: ListIdeasParams = {}): Promise<ApiIdeaPage> {
  const limit = params.limit ?? DEFAULT_LIMIT;
  const offset = params.offset ?? 0;
  if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
    throw new ApiError(`listIdeas: limit muss eine ganze Zahl zwischen ${MIN_LIMIT} und ${MAX_LIMIT} sein, war ${String(limit)}.`);
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new ApiError(`listIdeas: offset muss eine ganze Zahl zwischen 0 und ${MAX_OFFSET} sein, war ${String(offset)}.`);
  }

  const payload = await requestJson(`/api/ideas?limit=${limit}&offset=${offset}`, params.signal);
  return parseIdeaPage(payload);
}

/**
 * GET /api/users/me
 *
 * `null` bedeutet "nicht angemeldet" - die API antwortet dann mit HTTP 401,
 * und das ist ein erwarteter Zustand, kein Fehler. Alles andere (Netz,
 * kein JSON, unerwartete Form) wirft.
 */
export async function getCurrentUser(options: { signal?: AbortSignal } = {}): Promise<ApiUser | null> {
  const { ok, status, url, payload } = await performRequest('/api/users/me', options.signal);
  if (status === 401) return null;
  if (!ok) {
    throw new ApiError(`/api/users/me wurde mit HTTP ${status} abgelehnt.${serverHint(payload)}`, { status, url });
  }
  return parseUser(payload);
}
