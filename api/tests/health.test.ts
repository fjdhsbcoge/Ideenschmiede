import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDb, dbVersion, pingDb } from '../src/db.js';
import { databaseUrl, sql } from './helpers.js';

const app = createApp(sql);

describe('GET /health', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('antwortet mit 200 und db: true', async () => {
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = (await response.json()) as { status: string; db: boolean; version: string };
    expect(body.status).toBe('ok');
    expect(body.db).toBe(true);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prueft die Datenbank wirklich - SELECT 1 gegen genau diese Testdatenbank', async () => {
    expect(await pingDb(sql)).toBe(true);

    // Der Beweis, dass es PostgreSQL ist und nicht ein Ersatz: Version und
    // Datenbankname kommen aus der laufenden Instanz.
    expect(await dbVersion(sql)).toMatch(/^16\./);

    const rows = await sql<{ db: string }[]>`SELECT current_database() AS db`;
    const erwarteteDatenbank = new URL(databaseUrl).pathname.replace(/^\//, '');
    expect(rows[0]?.db).toBe(erwarteteDatenbank);
  });

  it('meldet db: false und 503, wenn die Datenbank nicht erreichbar ist', async () => {
    // Port 1: dort hoert nichts zu, die Abfrage scheitert sofort. Damit ist
    // belegt, dass "db" aus einer echten Abfrage stammt und nicht fest
    // verdrahtet ist.
    const unerreichbar = postgres('postgres://postgres:test@127.0.0.1:1/ideenschmiede', {
      max: 1,
      connect_timeout: 2,
      onnotice: () => {},
    });

    try {
      const response = await createApp(unerreichbar).request('/health');
      expect(response.status).toBe(503);

      const body = (await response.json()) as { status: string; db: boolean };
      expect(body.db).toBe(false);
      expect(body.status).toBe('degraded');
    } finally {
      await unerreichbar.end({ timeout: 5 });
    }
  });
});
