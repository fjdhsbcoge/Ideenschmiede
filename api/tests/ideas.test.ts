import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDb } from '../src/db.js';
import {
  createTestIdea,
  createTestUser,
  removeTestIdea,
  removeTestUser,
  sql,
  type TestIdea,
  type TestUser,
} from './helpers.js';

const app = createApp(sql);

interface IdeasResponse {
  items: Record<string, unknown>[];
  count: number;
  limit: number;
  offset: number;
}

interface ErrorResponse {
  error: { code: string; message: string };
}

// Daten kommen per SQL in die Datenbank - nicht ueber die API. Damit prueft
// der Test die Lesestrecke und nicht sich selbst.
let user!: TestUser;
let idee!: TestIdea;
let zweiteIdee!: TestIdea;

beforeAll(async () => {
  user = await createTestUser();
  idee = await createTestIdea(user.id);
  zweiteIdee = await createTestIdea(user.id);
});

afterAll(async () => {
  await removeTestIdea(idee.id);
  await removeTestIdea(zweiteIdee.id);
  await removeTestUser(user.id);
  await closeDb();
});

describe('GET /api/ideas', () => {
  it('liefert die per SQL angelegte Idee zurueck - mit den Feldnamen aus CONTRACT.md', async () => {
    const response = await app.request('/api/ideas?limit=100');
    expect(response.status).toBe(200);

    const body = (await response.json()) as IdeasResponse;
    const gefunden = body.items.find((item) => item['id'] === idee.id);

    expect(gefunden).toBeDefined();
    expect(gefunden?.['title']).toBe(idee.title);
    expect(gefunden?.['author_id']).toBe(user.id);
    expect(gefunden?.['stage']).toBe('discussion');
    expect(gefunden?.['language']).toBe('de');
    expect(gefunden?.['tags']).toEqual(['test']);

    // Kanonische Zaehler, nicht die frueheren Arbeitsnamen.
    expect(gefunden?.['comment_count']).toBe(0);
    expect(gefunden?.['vote_up']).toBe(0);
    expect(gefunden?.['vote_down']).toBe(0);
    expect(gefunden?.['raised_sat']).toBe(0);
    expect(gefunden?.['investor_count']).toBe(0);
    expect(gefunden?.['creator_share_bp']).toBe(2000);
    expect(gefunden?.['funding_goal_sat']).toBeNull();

    // timestamptz wird als ISO-8601 mit Zeitzone ausgegeben, nie lokal.
    expect(String(gefunden?.['created_at'])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    expect(String(gefunden?.['discussion_opened_at'])).toMatch(/Z$/);

    // Die abgeloesten Bezeichner duerfen nicht mehr auftauchen.
    expect(gefunden).not.toHaveProperty('votes_up');
    expect(gefunden).not.toHaveProperty('votes_down');
    expect(gefunden).not.toHaveProperty('comments');
    expect(gefunden).not.toHaveProperty('raised');
  });

  it('blaettert mit limit und offset, ohne eine Zeile doppelt zu liefern', async () => {
    const seite1 = (await (await app.request('/api/ideas?limit=1&offset=0')).json()) as IdeasResponse;
    const seite2 = (await (await app.request('/api/ideas?limit=1&offset=1')).json()) as IdeasResponse;

    expect(seite1.limit).toBe(1);
    expect(seite1.offset).toBe(0);
    expect(seite1.items).toHaveLength(1);
    expect(seite1.count).toBe(seite1.items.length);

    expect(seite2.offset).toBe(1);
    expect(seite2.items).toHaveLength(1);
    expect(seite1.items[0]?.['id']).not.toBe(seite2.items[0]?.['id']);
  });

  it('weist limit=0 ab, statt eine leere Liste zu liefern', async () => {
    const response = await app.request('/api/ideas?limit=0');
    expect(response.status).toBe(400);

    const body = (await response.json()) as ErrorResponse;
    expect(body.error.code).toBe('invalid_query');
    expect(body.error.message).toContain('limit');
  });

  it.each([
    ['limit=abc', 'Text statt Zahl'],
    ['limit=1.5', 'Dezimalzahl'],
    ['limit=', 'leerer Wert'],
    ['limit=-1', 'negativ'],
    ['limit=101', 'ueber der Obergrenze'],
    ['offset=-1', 'negativer Offset'],
    ['offset=abc', 'Text statt Zahl'],
    ['offset=99999999', 'Offset ueber der Obergrenze'],
  ])('weist Unsinn ab: %s (%s)', async (query) => {
    const response = await app.request(`/api/ideas?${query}`);

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = (await response.json()) as ErrorResponse;
    expect(body.error.code).toBe('invalid_query');
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});

describe('Fehlerbehandlung', () => {
  it('antwortet auf unbekannte Endpunkte mit 404 als JSON, nicht als HTML', async () => {
    const response = await app.request('/gibt-es-nicht');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = (await response.json()) as ErrorResponse;
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toContain('/gibt-es-nicht');
  });
});
