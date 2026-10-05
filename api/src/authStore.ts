/**
 * Datenbankzugriffe des LNURL-auth - eine Stelle, damit auth.ts die Pruefungen
 * und diese Datei die Schreibvorgaenge haelt.
 *
 * Die zentrale Zusage steht in consumeChallenge(): die Herausforderung wird per
 * UPDATE verbraucht, und zwar BEDINGT (WHERE used_at IS NULL AND expires_at >
 * now()). Wer keine Zeile zurueckbekommt, hat sie nicht verbraucht - damit
 * entscheidet die Datenbank, wer von zwei gleichzeitigen Aufrufen gewinnt, und
 * nicht die Anwendung. Zwei Prozesse koennen dieselbe k1 nicht beide benutzen,
 * auch nicht bei paralleler Ausfuehrung.
 */
import type { ISql } from 'postgres';
import { AuthError, AUTH_ERROR_REASONS, type AuthAction } from './auth.js';

/** Eine Zeile aus `users`, unter den Namen, die die API ausliefert. */
interface UserRow {
  id: string;
  username: string;
  displayName: string;
  email: string;
  language: string;
  role: string;
  createdAt: Date;
}

// -----------------------------------------------------------------------------
// Nutzer
// -----------------------------------------------------------------------------

/** Der angemeldete Nutzer, wie ihn die API ausliefert (camelCase). */
export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  language: string;
  role: string;
  createdAt: Date;
}

/**
 * Es gibt keinen Avatar - also auch kein Feld dafuer. Ein avatarUrl: null waere
 * eine zweite Schreibweise fuer "gibt es nicht".
 */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  language: string;
  role: string;
  createdAt: string;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    language: user.language,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Die Spaltenliste steht einmal - ausdruecklich, nicht als SELECT *. */
const USER_COLUMNS = [
  'id,',
  'username,',
  'display_name AS "displayName",',
  'email,',
  'language,',
  'role,',
  'created_at AS "createdAt"',
].join(' ');

/** Den Nutzer zur Kennung lesen. null, wenn es ihn nicht (mehr) gibt. */
export async function findUserById(db: ISql, userId: string): Promise<UserRecord | null> {
  const rows: UserRow[] = await db`
      SELECT ${db.unsafe(USER_COLUMNS)} FROM users WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

// -----------------------------------------------------------------------------
// Identitaet (auth_identities)
// -----------------------------------------------------------------------------

/**
 * Der Nutzer zu einem linkingKey, oder null.
 *
 * Die Abfrage lautet lower(linking_key) = lower($1) - NICHT linking_key = $1.
 * Der Eindeutigkeitsindex ist ein Ausdrucksindex ueber lower(linking_key); nur
 * diese Form benutzt ihn als Suche statt als Filter (CONTRACT.md, "Folge fuer
 * Abfragen"). Dass hier zusaetzlich klein geschrieben wird, macht das Ergebnis
 * unabhaengig von der Schreibweise im Aufruf.
 */
export async function findUserIdByLinkingKey(db: ISql, linkingKeyHex: string): Promise<string | null> {
  const rows: { user_id: string }[] = await db`
      SELECT user_id FROM auth_identities WHERE lower(linking_key) = lower(${linkingKeyHex})
  `;
  const row = rows[0];
  return row === undefined ? null : row.user_id;
}

/**
 * Legt die Identitaet an. Liefert false, wenn sie schon existiert (dann hat ein
 * paralleler Aufruf gewonnen) - kein Fehler, sondern ein Ergebnis: der Aufrufer
 * liest den vorhandenen Nutzer.
 *
 * ON CONFLICT nennt den Ausdrucksindex (lower(linking_key)); die Spalte selbst
 * hat keinen eigenen UNIQUE-Index, ueber den der Konflikt laufen koennte.
 */
export async function insertAuthIdentity(
  db: ISql,
  userId: string,
  linkingKeyHex: string,
): Promise<boolean> {
  const rows: { id: string }[] = await db`
      INSERT INTO auth_identities (user_id, linking_key)
      VALUES (${userId}, ${linkingKeyHex.toLowerCase()})
      ON CONFLICT (lower(linking_key)) DO NOTHING
      RETURNING id
  `;
  return rows.length > 0;
}

export async function touchLastLogin(db: ISql, linkingKeyHex: string, now: Date): Promise<void> {
  await db`
      UPDATE auth_identities SET last_login_at = ${now}
       WHERE lower(linking_key) = lower(${linkingKeyHex})
  `;
}

// -----------------------------------------------------------------------------
// Neuer Nutzer ohne E-Mail
// -----------------------------------------------------------------------------

/** users.username: ^[a-z0-9_]{3,30}$ (users_username_format_check). */
const MAX_USERNAME_LENGTH = 30;

/** Aus dem Schluessel einen Namen machen, der die Formatpruefung erfuellt. */
export function usernameBase(linkingKeyHex: string): string {
  return ('ln_' + linkingKeyHex.toLowerCase()).slice(0, MAX_USERNAME_LENGTH);
}

/** Den Namen um eine laufende Nummer kuerzen, damit er in 30 Zeichen passt. */
export function usernameCandidate(linkingKeyHex: string, versuch: number): string {
  if (versuch === 0) {
    return usernameBase(linkingKeyHex);
  }
  const suffix = '_' + String(versuch);
  return usernameBase(linkingKeyHex).slice(0, MAX_USERNAME_LENGTH - suffix.length) + suffix;
}

export async function usernameIsFree(db: ISql, username: string): Promise<boolean> {
  const rows: { vorhanden: boolean }[] = await db`
      SELECT EXISTS (SELECT 1 FROM users WHERE lower(username) = lower(${username})) AS vorhanden
  `;
  return rows[0]?.vorhanden === false;
}

/**
 * Legt einen Nutzer an und gibt seine Kennung zurueck.
 *
 * Es gibt keine E-Mail-Adresse, die hier ehrlich stehen koennte: LNURL-auth
 * uebermittelt keine, und die Spezifikation sieht keine vor. Die Spalte ist aber
 * NOT NULL mit Formatpruefung, also steht dort ein aus dem Schluessel
 * abgeleiteter Platzhalter auf der reservierten Domain .invalid (RFC 2606 - die
 * kann nie jemandem gehoeren). Er ist als Platzhalter erkennbar und
 * ueberschreibbar; eine erfundene echte Adresse waere schlimmer, weil sie
 * jemandem gehoeren koennte.
 *
 * display_name und username kommen ebenfalls aus dem Schluessel: der Nutzer kann
 * beide spaeter aendern, aber ein leeres Feld waere ein Konto, das in jeder
 * Liste als leerer Eintrag erscheint.
 */
export async function insertUserForLinkingKey(
  db: ISql,
  linkingKeyHex: string,
): Promise<{ id: string; username: string }> {
  const key = linkingKeyHex.toLowerCase();
  for (let versuch = 0; versuch < 5; versuch += 1) {
    const username = usernameCandidate(key, versuch);
    if (!(await usernameIsFree(db, username))) {
      continue;
    }
  const rows: { id: string; username: string }[] = await db`
      INSERT INTO users (username, display_name, email, language)
      VALUES (
        ${username},
        ${'LNURL-Nutzer ' + key.slice(0, 10)},
        ${username + '@lnurl.invalid'},
        'de'
      )
      RETURNING id, username
  `;
    const row = rows[0];
    if (row !== undefined) {
      return row;
    }
  }
  throw new AuthError(
    AUTH_ERROR_REASONS.internal,
    'Kein freier Benutzername aus dem linkingKey ableitbar',
  );
}

// -----------------------------------------------------------------------------
// Herausforderung verbrauchen
// -----------------------------------------------------------------------------

export interface ConsumedChallenge {
  k1: string;
  action: AuthAction;
}

/**
 * Verbraucht die Herausforderung - die eine Stelle, an der Replay verhindert
 * wird.
 *
 * Die Bedingung steht IM UPDATE, nicht davor: ein vorheriges SELECT mit
 * anschliessendem UPDATE haette ein Zeitfenster, in dem zwei Aufrufe dieselbe
 * k1 als unverbraucht sehen. So entscheidet die Zeilensperre von PostgreSQL.
 *
 * Abgelaufene Herausforderungen werden hier ebenfalls abgewiesen - aber OHNE
 * sie zu verbrauchen: sie bleiben als Nachweis stehen, dass sie erzeugt und nie
 * benutzt wurden.
 *
 * Die Frist kommt aus der Datenbank (now()), nicht aus der Anwendung: sie soll
 * nicht davon abhaengen, wie die Uhr des Anwendungsrechners steht.
 */
export async function consumeChallenge(
  db: ISql,
  k1: string,
  usedAt: Date,
): Promise<ConsumedChallenge> {
  const verbraucht: { k1: string; action: string }[] = await db`
      UPDATE auth_challenges
         SET used_at = ${usedAt}
       WHERE k1 = ${k1}
         AND used_at IS NULL
         AND expires_at > now()
      RETURNING k1, action
  `;
  const row = verbraucht[0];
  if (row !== undefined) {
    return { k1: row.k1, action: row.action as AuthAction };
  }

  // Keine Zeile: unbekannt, abgelaufen oder schon verbraucht. Die Ursache wird
  // nachgeschlagen, damit die Antwort sie benennen kann - die Entscheidung ist
  // trotzdem schon gefallen.
  const vorhanden: { used_at: Date | null; abgelaufen: boolean }[] = await db`
      SELECT used_at, (expires_at <= now()) AS abgelaufen
        FROM auth_challenges WHERE k1 = ${k1}
  `;
  const zeile = vorhanden[0];
  if (zeile === undefined) {
    throw new AuthError(AUTH_ERROR_REASONS.unknownChallenge);
  }
  if (zeile.used_at !== null) {
    throw new AuthError(AUTH_ERROR_REASONS.usedChallenge);
  }
  if (zeile.abgelaufen) {
    throw new AuthError(AUTH_ERROR_REASONS.expiredChallenge);
  }
  // Weder abgelaufen noch verbraucht, und trotzdem keine Zeile: ein paralleler
  // Aufruf war schneller. Fuer den Aufrufer ist das dieselbe Auskunft.
  throw new AuthError(AUTH_ERROR_REASONS.usedChallenge);
}