/**
 * LNURL-auth (LUD-01/LUD-04) - Herausforderung, Signaturpruefung, Sitzung.
 *
 * Der Ablauf in vier Schritten:
 *
 *   1. POST /api/auth/challenge   erzeugt 32 zufaellige Byte (k1) und legt sie
 *      in auth_challenges ab. Die Antwort enthaelt die fertige LNURL (bech32).
 *   2. Das Wallet liest den QR-Code, leitet aus dem VOLLEN Domainnamen einen
 *      secp256k1-Schluessel ab, signiert die k1-Bytes (DER) und ruft die
 *      Callback-URL auf.
 *   3. GET  /api/auth/callback    prueft: k1 bekannt? nicht abgelaufen? nicht
 *      benutzt? Signatur gueltig? key passt zur Signatur? Erst danach wird die
 *      Herausforderung verbraucht (used_at) und der Nutzer gefunden oder
 *      angelegt.
 *   4. Die Antwort setzt ein Sitzungs-Cookie mit einem HS256-JWT.
 *
 * Was hier NICHT passiert: eigene Krypto. secp256k1 stammt aus @noble/curves,
 * HMAC-SHA256 aus node:crypto - beides gepruefte Implementierungen. Eigener
 * Code ist nur die Reihenfolge der Pruefungen und die Frage, wer eine
 * Herausforderung verbrauchen darf.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import type { ISql, Sql } from 'postgres';
import { encodeLnurl } from './bech32.js';
import { consumeChallenge, findUserIdByLinkingKey, insertAuthIdentity, insertUserForLinkingKey, touchLastLogin } from './authStore.js';
import { loadEnv } from './env.js';

// -----------------------------------------------------------------------------
// Zeitraeume
// -----------------------------------------------------------------------------

/**
 * Lebensdauer der k1-Herausforderung. Die Spezifikation nennt keine Frist; sie
 * begrenzt, wie lange eine abgefangene (oder im QR-Code fotografierte) k1 noch
 * brauchbar waere. Fuenf Minuten reichen fuer "QR-Code scannen und bestaetigen"
 * mit Reserve und sind kurz genug, dass ein Screenshot spaeter nichts mehr wert
 * ist.
 */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Lebensdauer der Sitzung (JWT exp). Bewusst kurz: es gibt keine Tabelle, in
 * der Sitzungen widerrufen werden koennten (die Vorgabe will das ausdruecklich
 * nicht), also ist der Ablauf der einzige Mechanismus, der eine einmal
 * ausgestellte Sitzung wieder beendet.
 */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Die vier erlaubten Werte des action-Parameters (Spezifikation). */
export const AUTH_ACTIONS = ['register', 'login', 'link', 'auth'] as const;
export type AuthAction = (typeof AUTH_ACTIONS)[number];

export const CHALLENGE_TAG = 'login';
export const CALLBACK_PATH = '/api/auth/callback';
export const SESSION_COOKIE_NAME = 'session';

/**
 * Die Reihenfolge der Pruefungen ist Teil der Zusage, nicht Zufall:
 *
 *   - "unbekannt" vor "abgelaufen" vor "verbraucht" vor "Signatur", damit die
 *     Fehlermeldung die Ursache benennt und nicht die letzte Stufe.
 *   - Die Herausforderung wird ZULETZT verbraucht. Wuerde sie vor der
 *     Signaturpruefung verbraucht, koennte ein Angreifer mit geratenen
 *     Signaturen fremde Herausforderungen verbrennen (Denial of Service).
 *   - Umgekehrt gilt: eine gueltige Signatur auf eine bereits verbrauchte k1
 *     wird abgewiesen - Replay ist damit unmoeglich, auch wenn dieselbe
 *     Signatur ein zweites Mal abgefangen wurde.
 */
export const AUTH_ERROR_REASONS = {
  invalidRequest: 'Invalid request',
  unknownChallenge: 'Unknown k1',
  expiredChallenge: 'Challenge expired',
  usedChallenge: 'Challenge already used',
  invalidSignature: 'Invalid signature',
  unknownKey: 'Unknown linking key',
  linkNotSupported: 'Action link requires an authenticated session',
  unauthorized: 'Unauthorized',
  internal: 'Internal error',
  /**
   * Die Ratenbegrenzung (src/rateLimit.ts). Sie steht in DIESER Liste, weil
   * AuthError.reason ein AuthErrorReason ist und die Antwort dieselbe Form
   * traegt - NICHT, weil die Spezifikation sie nennt: LNURL-auth kennt keine
   * Ratenbegrenzung, und ein Wallet soll diesen Wert nicht auswerten muessen.
   */
  rateLimited: 'Too many requests',
} as const;
export type AuthErrorReason = (typeof AUTH_ERROR_REASONS)[keyof typeof AUTH_ERROR_REASONS];

/** Fehler mit der nach aussen sichtbaren Begruendung ("reason"). */
export class AuthError extends Error {
  readonly reason: AuthErrorReason;

  constructor(reason: AuthErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'AuthError';
    this.reason = reason;
  }
}

// -----------------------------------------------------------------------------
// Konfiguration
// -----------------------------------------------------------------------------

export interface AuthConfig {
  /** HS256-Geheimnis aus SESSION_SECRET. */
  readonly secret: string;
  /** Kanonische Basis-URL aus AUTH_BASE_URL, ohne Schraegstrich am Ende. */
  readonly baseUrl: string;
  /** Injizierbare Uhr - damit der Ablauf pruefbar ist und nicht nur behauptet. */
  readonly now: () => number;
  /**
   * Ratenbegrenzung des oeffentlichen POST /api/auth/challenge: erlaubte
   * Aufrufe je Client-Adresse und Fenster (AUTH_RATE_LIMIT, Standard 30).
   *
   * Sie steht in DIESER Konfiguration, weil sie mit derselben Uhr rechnen muss
   * wie die Herausforderung: die Fenster liegen in der Datenbank, und eine
   * zweite Zeitquelle waere eine zweite Wahrheit.
   */
  readonly rateLimit: number;
  /** Laenge des gleitenden Fensters in Millisekunden (AUTH_RATE_WINDOW_MS, Standard 60000). */
  readonly rateWindowMs: number;
  /**
   * Adressen, deren X-Forwarded-For geglaubt wird (AUTH_TRUSTED_PROXIES,
   * Standard leer). Leer heisst: der Kopf wird NIE gelesen - er ist von jedem
   * Aufrufer setzbar und darf eine Schutzmassnahme nicht abschalten koennen.
   */
  readonly trustedProxies: readonly string[];
}

/**
 * Konfiguration aus der Umgebung. Wirft EnvError, wenn SESSION_SECRET oder
 * AUTH_BASE_URL fehlen - genau wie DATABASE_URL beim Start. Ein Standardwert
 * waere hier die gefaehrlichste Variante: ein fest eingebautes Geheimnis macht
 * jedes Token faelschbar, und eine geratene Domain bindet alle Nutzer an eine
 * Adresse, die es spaeter nicht mehr gibt.
 */
export function authConfigFromEnv(source: NodeJS.ProcessEnv = process.env): AuthConfig {
  const env = loadEnv(source);
  return {
    secret: env.SESSION_SECRET,
    baseUrl: env.AUTH_BASE_URL,
    now: Date.now,
    rateLimit: env.AUTH_RATE_LIMIT,
    rateWindowMs: env.AUTH_RATE_WINDOW_MS,
    trustedProxies: env.AUTH_TRUSTED_PROXIES,
  };
}

/** Die Callback-URL aus AUTH_BASE_URL - nie aus dem Host der Anfrage. */
export function callbackUrl(config: AuthConfig): string {
  return config.baseUrl + CALLBACK_PATH;
}

// -----------------------------------------------------------------------------
// Parameterpruefung
// -----------------------------------------------------------------------------

const HEX_64 = /^[0-9a-fA-F]{64}$/;
/** secp256k1-Punkt, compressed: 33 Byte, erstes Byte 0x02 oder 0x03. */
const LINKING_KEY_HEX = /^0[23][0-9a-fA-F]{64}$/;

export function isAuthAction(value: unknown): value is AuthAction {
  return typeof value === 'string' && (AUTH_ACTIONS as readonly string[]).includes(value);
}

export function isK1(value: unknown): value is string {
  return typeof value === 'string' && HEX_64.test(value);
}

export function isLinkingKey(value: unknown): value is string {
  return typeof value === 'string' && LINKING_KEY_HEX.test(value);
}

/**
 * "32 bytes of data" aus der Spezifikation: 32 Byte aus dem CSPRNG des
 * Betriebssystems (node:crypto), als Hex geschrieben. Nicht Math.random -
 * vorhersagbare Herausforderungen waeren der Anfang jedes Replays.
 */
export function generateK1(): string {
  return randomBytes(32).toString('hex');
}

// -----------------------------------------------------------------------------
// Herausforderung
// -----------------------------------------------------------------------------

export interface Challenge {
  k1: string;
  action: AuthAction;
  expiresAt: Date;
}

export interface CreatedChallenge extends Challenge {
  /** Die vollstaendige LNURL fuer den QR-Code (bech32, Grossschreibung). */
  lnurl: string;
}

/** Die Zeile, wie die Abfrage sie liefert (snake_case aus der Datenbank). */
export interface ChallengeRow {
  k1: string;
  action: string;
  expires_at: Date;
}

/** Die Zeile in die Form bringen, mit der der Rest dieser Datei arbeitet. */
export function toChallenge(row: ChallengeRow): Challenge {
  return {
    k1: row.k1,
    action: isAuthAction(row.action) ? row.action : 'login',
    expiresAt: row.expires_at,
  };
}

/**
 * Erzeugt eine Herausforderung und die zugehoerige LNURL.
 *
 * Der Eindeutigkeitskonflikt auf k1 wird abgefangen und EINMAL wiederholt: 32
 * zufaellige Byte kollidieren praktisch nie, aber "praktisch nie" ist keine
 * Zusage, und ein 500er waere die falsche Antwort auf ein Wuergen des Zufalls.
 * Die Wiederholung ist billig, die Annahme waere es nicht.
 */
export async function createChallenge(
  db: Sql,
  action: AuthAction,
  config: AuthConfig,
): Promise<CreatedChallenge> {
  const expiresAt = new Date(config.now() + CHALLENGE_TTL_MS);

  for (let versuch = 0; versuch < 2; versuch += 1) {
    const k1 = generateK1();
    const rows = await db<{ k1: string }[]>`
      INSERT INTO auth_challenges (k1, action, expires_at)
      VALUES (${k1}, ${action}, ${expiresAt})
      ON CONFLICT (k1) DO NOTHING
      RETURNING k1`;

    if (rows.length > 0) {
      // Die LNURL traegt die VOLLSTAENDIGE Callback-URL. Genau diese URL (mit
      // diesem Domainnamen) sieht das Wallet - und aus ihr leitet es den
      // linkingKey ab. Waere hier der Host der Anfrage verwendet worden, haette
      // derselbe Nutzer je nach Aufrufweg einen anderen Schluessel.
      const url = callbackUrl(config) + '?' + buildCallbackParams(k1, action);
      return { k1, action, expiresAt, lnurl: encodeLnurl(url) };
    }
  }

  throw new AuthError(AUTH_ERROR_REASONS.internal, 'k1-Kollision zweimal hintereinander');
}

/** Die Parameter der Callback-URL, in der Reihenfolge der Spezifikation. */
export function buildCallbackParams(k1: string, action: AuthAction): string {
  return new URLSearchParams({ tag: CHALLENGE_TAG, k1, action }).toString();
}

/** Die Herausforderung zur k1, oder null. Abfrage ueber den PRIMARY KEY. */
export async function findChallenge(db: Sql, k1: string): Promise<Challenge | null> {
  const rows = await db<ChallengeRow[]>`
    SELECT k1, action, expires_at FROM auth_challenges WHERE k1 = ${k1}`;
  const row = rows[0];
  return row === undefined ? null : toChallenge(row);
}

// -----------------------------------------------------------------------------
// Signaturpruefung (secp256k1, DER)
// -----------------------------------------------------------------------------

/**
 * Prueft die DER-kodierte Signatur ueber die k1-Bytes gegen den linkingKey.
 *
 * Drei Entscheidungen, die hier bewusst so stehen:
 *
 *   1. prehash: true (Vorgabe von @noble/curves) - LNURL-auth laesst die
 *      k1-BYTES signieren, das Wallet hasht sie mit SHA-256. Genau das tut
 *      noble mit dieser Einstellung: kein zweiter Hash, kein anderer Hash.
 *   2. format: 'der' - die Spezifikation nennt eine "DER-encoded sig". Geprueft
 *      wird also das DER-Blob, nicht die 64-Byte-Kompaktform.
 *   3. lowS: false - noble lehnt mit der Vorgabe Signaturen mit hohem S
 *      (BIP-62) ab. Das ist eine Bitcoin-Regel fuer Transaktionen; LNURL-auth
 *      verlangt sie nicht, und ein Wallet, das aus seiner Bibliothek eine
 *      high-S-Signatur liefert, wuerde hier ohne Grund abgewiesen. Beide
 *      Schreibweisen derselben Signatur sind gleichwertig; ein Replay
 *      ermoeglicht das nicht, weil die k1 danach verbraucht ist.
 *
 * Alle Fehlerquellen - falsches Hex, kein Punkt auf der Kurve, kaputtes DER,
 * fremder Schluessel, gefaelschte Signatur - enden in DERSELBEN Ausnahme. Nach
 * aussen ist das ein Fall; was genau misslang, gehoert nicht in die Antwort.
 */
export function verifySignature(k1: string, linkingKeyHex: string, sigHex: string): void {
  if (!isK1(k1) || !isLinkingKey(linkingKeyHex) || !isHex(sigHex)) {
    throw new AuthError(AUTH_ERROR_REASONS.invalidSignature);
  }

  const message = hexToBytes(k1);
  const publicKey = hexToBytes(linkingKeyHex);
  const signature = hexToBytes(sigHex);

  let valid = false;
  try {
    valid = secp256k1.verify(signature, message, publicKey, { format: 'der', lowS: false });
  } catch {
    // noble wirft bei kaputtem DER oder ungueltigem Punkt. Fuer den Aufrufer
    // ist das dasselbe wie eine falsche Signatur.
    valid = false;
  }
  if (!valid) {
    throw new AuthError(AUTH_ERROR_REASONS.invalidSignature);
  }
}

function isHex(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value)
  );
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

// -----------------------------------------------------------------------------
// Sitzung (JWT, HS256)
// -----------------------------------------------------------------------------

export interface SessionToken {
  /** Der Nutzer (JWT "sub"). */
  userId: string;
  /** Ablauf in Sekunden seit der Epoche. */
  exp: number;
  iat: number;
  jti: string;
}

interface JwtPayload {
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  jti?: unknown;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signHs256(secret: string, data: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

/**
 * Stellt ein Sitzungs-Token aus.
 *
 * Das Token traegt nur die Nutzerkennung und die Zeiten - keine Rolle, keine
 * E-Mail. Was ein Nutzer darf, wird bei jeder Anfrage aus der Datenbank
 * gelesen; ein Token, das Rechte mitschleppt, waere nach einer Aenderung
 * veraltet, ohne dass es auffiele.
 */
export function createSessionToken(
  userId: string,
  config: AuthConfig,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): string {
  const iat = Math.floor(config.now() / 1000);
  const exp = iat + ttlSeconds;
  const payload = { sub: userId, iat, exp, jti: randomUUID() };
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const data = header + '.' + body;
  return data + '.' + base64url(signHs256(config.secret, data));
}

/**
 * Liest ein Sitzungs-Token. Liefert null, wenn irgendetwas nicht stimmt:
 * Aufbau, Algorithmus, Signatur, Ablauf.
 *
 * Geprueft wird mit timingSafeEqual, damit sich der Vergleich nicht Byte fuer
 * Byte messen laesst. Und der Kopf wird geprueft, obwohl "alg: none" hier gar
 * nicht durchkaeme: eine Bibliothek, die den Algorithmus aus dem Token
 * uebernimmt, ist der klassische JWT-Fehler - diese kennt nur HS256, und das
 * steht hier ausdruecklich.
 */
export function parseSessionToken(token: string, config: AuthConfig): SessionToken | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const header = parts[0] as string;
  const body = parts[1] as string;
  const signature = parts[2] as string;

  let parsedHeader: unknown;
  try {
    parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    typeof parsedHeader !== 'object' ||
    parsedHeader === null ||
    (parsedHeader as { alg?: unknown }).alg !== 'HS256'
  ) {
    return null;
  }

  const expected = signHs256(config.secret, header + '.' + body);
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.exp !== 'number' ||
    typeof payload.iat !== 'number' ||
    typeof payload.jti !== 'string'
  ) {
    return null;
  }
  if (payload.exp * 1000 <= config.now()) {
    return null;
  }

  return { userId: payload.sub, exp: payload.exp, iat: payload.iat, jti: payload.jti };
}

// -----------------------------------------------------------------------------
// Der Callback in einem Vorgang
// -----------------------------------------------------------------------------

export interface AuthResult {
  userId: string;
  action: AuthAction;
  /** true, wenn in diesem Aufruf ein Konto entstanden ist. */
  neuerNutzer: boolean;
  /** true, wenn in diesem Aufruf ein Schluessel neu gebunden wurde. */
  neueIdentitaet: boolean;
}

/**
 * Der erfolgreiche Login - alles ab dem Verbrauch der Herausforderung laeuft in
 * EINER Transaktion.
 *
 * Warum das noetig ist: ein neu angelegter Nutzer ohne gebundenen Schluessel
 * waere ein Konto, in das niemand mehr hineinkommt (der Schluessel ist die
 * einzige Tuer). Bricht der Vorgang zwischen beiden Schreibvorgaengen ab, macht
 * der Rollback auch die Nutzerzeile rueckgaengig - es bleibt kein Konto zurueck,
 * das niemand benutzen kann.
 *
 * Der Verbrauch steht VOR dem Anlegen: consumeChallenge() ist die Stelle, die
 * bei zwei gleichzeitigen Aufrufen entscheidet (bedingtes UPDATE). Verliert der
 * Aufruf dort, wirft er - und der Rollback macht ein eventuell angelegtes Konto
 * wieder weg. Die Reihenfolge ist damit: erst gewinnen, dann schreiben.
 */
export async function completeAuth(
  db: Sql,
  k1: string,
  linkingKeyHex: string,
  config: AuthConfig,
): Promise<AuthResult> {
  const usedAt = new Date(config.now());
  const key = linkingKeyHex.toLowerCase();

  return db.begin(async (tx) => {
    // tx ist eine TransactionSql - sie teilt die Abfrage-Schnittstelle ISql mit
    // dem Pool, hat nur kein eigenes begin().
    const q: ISql = tx;
    const challenge = await consumeChallenge(q, k1, usedAt);
    const action = challenge.action;

    let userId = await findUserIdByLinkingKey(q, key);
    let neuerNutzer = false;
    let neueIdentitaet = false;

    if (userId === null) {
      if (action === 'login') {
        // Die Spezifikation unterscheidet register und login genau hier: mit
        // 'login' wird ein unbekannter Schluessel NICHT angelegt. Der Rollback
        // gibt die Herausforderung dabei wieder frei - abgewiesen bleibt
        // abgewiesen, ohne die k1 zu verbrennen.
        throw new AuthError(AUTH_ERROR_REASONS.unknownKey);
      }
      const nutzer = await insertUserForLinkingKey(q, key);
      userId = nutzer.id;
      neuerNutzer = true;
      neueIdentitaet = await insertAuthIdentity(q, userId, key);
    }

    // last_login_at wird in BEIDEN Faellen gesetzt: ein neu angelegtes Konto ist
    // in diesem Moment angemeldet. Bliebe die Spalte beim Anlegen NULL, saehe
    // der erste Login aus wie "nie angemeldet" - und eine Anzeige "zuletzt
    // angemeldet" waere fuer neue Nutzer dauerhaft leer.
    await touchLastLogin(q, key, usedAt);

    return { userId, action, neuerNutzer, neueIdentitaet };
  });
}