/**
 * Gemeinsame Helfer der Integrationstests.
 *
 * Die Tests laufen gegen eine ECHTE PostgreSQL-Datenbank. Es gibt keine
 * Attrappe und kein Mocking: /health soll nachweislich SELECT 1 ausfuehren,
 * und /api/ideas soll eine Zeile zurueckliefern, die per SQL entstanden ist.
 */
import type { Sql } from 'postgres';
import { getDb } from '../src/db.js';

export const databaseUrl = (process.env.DATABASE_URL ?? '').trim();

if (databaseUrl === '') {
  throw new Error(
    [
      'DATABASE_URL ist nicht gesetzt - die Tests brauchen eine echte PostgreSQL-Datenbank.',
      'Es gibt bewusst keinen Standardwert: still auf eine geratene Datenbank zu zeigen',
      'waere genau der Fehler, den diese Tests ausschliessen sollen.',
      '',
      'PowerShell:  $env:DATABASE_URL="postgres://postgres:test@localhost:55454/ideenschmiede"; npm test',
      'bash:        DATABASE_URL="postgres://postgres:test@localhost:55454/ideenschmiede" npm test',
      '',
      'Aufsetzen der Datenbank: siehe api/README.md, Abschnitt "Datenbank aufsetzen".',
    ].join('\n'),
  );
}

/** Verbindungspool der Tests - dieselbe eine Stelle wie in der Anwendung. */
export const sql: Sql = getDb();

export function first<T>(rows: readonly T[], was: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Erwartet: ${was} - die Datenbank hat keine Zeile geliefert.`);
  }
  return row;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface TestUser {
  id: string;
  username: string;
}

/**
 * Legt einen Nutzer per SQL an. Der Name ist eindeutig, damit parallele Laeufe
 * und Reste frueherer Laeufe nicht kollidieren.
 * Beachtet users_username_format_check: ^[a-z0-9_]{3,30}$
 */
export async function createTestUser(): Promise<TestUser> {
  const username = `t_${uniqueSuffix()}`;
  const rows = await sql<{ id: string }[]>`
    INSERT INTO users (username, display_name, email, language)
    VALUES (${username}, ${'Testnutzer'}, ${`${username}@example.invalid`}, 'de')
    RETURNING id`;
  return { id: first(rows, 'angelegter Nutzer').id, username };
}

export interface TestIdea {
  id: string;
  title: string;
}

/**
 * Legt eine Idee per SQL an - mit Beschreibung deutlich ueber 20 Zeichen,
 * damit die Testdaten nicht an einer Laengenpruefung scheitern.
 */
export async function createTestIdea(authorId: string): Promise<TestIdea> {
  const title = `Testidee ${uniqueSuffix()}`;
  const rows = await sql<{ id: string }[]>`
    INSERT INTO ideas (author_id, title, description, tags, language, stage)
    VALUES (
      ${authorId},
      ${title},
      ${'Beschreibung fuer den Integrationstest der Ideenliste (weit mehr als zwanzig Zeichen).'},
      ${['test']},
      'de',
      'discussion'
    )
    RETURNING id`;
  return { id: first(rows, 'angelegte Idee').id, title };
}

/** Aufraeumen in der Reihenfolge, die der Fremdschluessel verlangt: Idee vor Nutzer (ON DELETE RESTRICT). */
export async function removeTestIdea(id: string): Promise<void> {
  await sql`DELETE FROM ideas WHERE id = ${id}`;
}

export async function removeTestUser(id: string): Promise<void> {
  await sql`DELETE FROM users WHERE id = ${id}`;
}
