import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, toJsonSafe } from '../src/app.js';
import { closeDb } from '../src/db.js';
import {
  createTestIdea,
  createTestUser,
  removeTestIdea,
  removeTestUser,
  setRaisedSat,
  sql,
  type TestIdea,
  type TestUser,
} from './helpers.js';

const app = createApp(sql);

/** Die dokumentierte Antwortform (ARCHITECTURE.md Anhang 5.2, interface Idea). */
interface MarketplaceBody {
  openedAt: string;
  closesAt: string;
  fundingGoal: number | string;
  raised: number | string;
  investors: number;
  creatorShareBp: number;
}

interface IdeaBody {
  id: string;
  authorId: string;
  title: string;
  description: string;
  tags: string[];
  language: string;
  stage: string;
  discussion: {
    openedAt: string;
    comments: number;
    votes: { up: number; down: number };
  };
  marketplace?: MarketplaceBody;
  createdAt: string;
}

interface IdeasResponse {
  items: IdeaBody[];
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
/** Idee OHNE Marktplatzphase. */
let idee!: TestIdea;
/** Idee MIT eroeffneter Marktplatzphase. */
let marktIdee!: TestIdea;
/** Idee, deren Marktplatzphase einen Betrag ueber 2^53-1 traegt. */
let grosseIdee!: TestIdea;

/** 9007199254740993 = 2^53 + 1: als double nicht mehr darstellbar. */
const UEBER_MAX_SAFE = '9007199254740993';
const MARKT_EROEFFNET = '2026-05-01T10:00:00Z';
const MARKT_SCHLIESST = '2026-08-01T10:00:00Z';
const FUNDING_GOAL_SAT = 12_000_000;

beforeAll(async () => {
  user = await createTestUser();
  idee = await createTestIdea(user.id);
  marktIdee = await createTestIdea(user.id, {
    openedAt: MARKT_EROEFFNET,
    closesAt: MARKT_SCHLIESST,
    fundingGoalSat: FUNDING_GOAL_SAT,
  });
  grosseIdee = await createTestIdea(user.id, {
    openedAt: MARKT_EROEFFNET,
    closesAt: MARKT_SCHLIESST,
    fundingGoalSat: FUNDING_GOAL_SAT,
  });
  await setRaisedSat(grosseIdee.id, 9_007_199_254_740_993n);
});

afterAll(async () => {
  await removeTestIdea(idee.id);
  await removeTestIdea(marktIdee.id);
  await removeTestIdea(grosseIdee.id);
  await removeTestUser(user.id);
  await closeDb();
});

describe('GET /api/ideas - dokumentierte Antwortform', () => {
  it('liefert camelCase und verschachtelt statt der flachen Spaltennamen', async () => {
    const response = await app.request('/api/ideas?limit=100');
    expect(response.status).toBe(200);

    const body = (await response.json()) as IdeasResponse;
    const gefunden = body.items.find((item) => item.id === idee.id);

    expect(gefunden).toBeDefined();
    expect(gefunden?.title).toBe(idee.title);
    expect(gefunden?.authorId).toBe(user.id);
    expect(gefunden?.stage).toBe('discussion');
    expect(gefunden?.language).toBe('de');
    expect(gefunden?.tags).toEqual(['test']);
    expect(typeof gefunden?.description).toBe('string');

    // discussion ist NICHT optional (Anhang 5.2) und traegt die drei Felder.
    expect(gefunden?.discussion).toEqual({
      openedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/),
      comments: 0,
      votes: { up: 0, down: 0 },
    });

    // timestamptz wird als ISO-8601 mit Zeitzone ausgegeben, nie lokal.
    expect(gefunden?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);

    // Die flachen Namen der alten Form duerfen nirgends mehr auftauchen.
    for (const alt of [
      'author_id',
      'created_at',
      'discussion_opened_at',
      'marketplace_opened_at',
      'marketplace_closes_at',
      'funding_goal_sat',
      'raised_sat',
      'investor_count',
      'creator_share_bp',
      'comment_count',
      'vote_up',
      'vote_down',
      'votes_up',
      'votes_down',
      'comments',
      'raised',
      'investors',
      'funding_goal',
      'updated_at',
    ]) {
      expect(gefunden, `Feld "${alt}" ist durchgesickert`).not.toHaveProperty(alt);
    }
  });

  it('laesst marketplace bei einer Idee OHNE Marktplatzphase weg', async () => {
    const body = (await (await app.request('/api/ideas?limit=100')).json()) as IdeasResponse;
    const gefunden = body.items.find((item) => item.id === idee.id);

    expect(gefunden).toBeDefined();
    // "weglassen" heisst: der Schluessel existiert nicht - nicht null.
    expect(gefunden).not.toHaveProperty('marketplace');
    expect('marketplace' in (gefunden as object)).toBe(false);
    expect(gefunden?.marketplace).toBeUndefined();
  });

  it('liefert marketplace verschachtelt, wenn die Marktplatzphase eroeffnet ist', async () => {
    const body = (await (await app.request('/api/ideas?limit=100')).json()) as IdeasResponse;
    const gefunden = body.items.find((item) => item.id === marktIdee.id);

    expect(gefunden).toBeDefined();
    expect(gefunden?.stage).toBe('marketplace');
    expect(gefunden?.marketplace).toBeDefined();

    const markt = gefunden?.marketplace as MarketplaceBody;
    expect(Object.keys(markt).sort()).toEqual(
      ['closesAt', 'creatorShareBp', 'fundingGoal', 'investors', 'openedAt', 'raised'].sort(),
    );
    // Zeitstempel als ISO-8601 mit Z, nicht lokal.
    expect(markt.openedAt).toBe('2026-05-01T10:00:00.000Z');
    expect(markt.closesAt).toBe('2026-08-01T10:00:00.000Z');
    // Geldbetraege in Satoshi, als JSON-Zahl.
    expect(markt.fundingGoal).toBe(FUNDING_GOAL_SAT);
    expect(typeof markt.fundingGoal).toBe('number');
    expect(markt.raised).toBe(0);
    expect(typeof markt.raised).toBe('number');
    expect(markt.investors).toBe(0);
    // Basispunkte: 10000 = 100 Prozent. Default der Spalte sind die 20 Prozent.
    expect(markt.creatorShareBp).toBe(2000);
  });

  it('gibt einen Betrag ueber 2^53-1 als String aus, damit nichts gerundet wird', async () => {
    const body = (await (await app.request('/api/ideas?limit=100')).json()) as IdeasResponse;
    const gefunden = body.items.find((item) => item.id === grosseIdee.id);

    expect(gefunden?.marketplace?.raised).toBe(UEBER_MAX_SAFE);

    // Der Beweis, dass die Zahl wirklich exakt ist: als JSON-Zahl waere sie
    // 9007199254740992 - also um 1 zu klein. Der Text ist die einzige Form,
    // in der der Wert unveraendert durchkommt.
    const roh = await (await app.request('/api/ideas?limit=100')).text();
    expect(roh).toContain(`"raised":"${UEBER_MAX_SAFE}"`);
    expect(roh).not.toContain('"raised":9007199254740993');

    // Und die Datenbank selbst fuehrt den Wert exakt - der String ist also
    // nicht der Fehler, sondern seine Vermeidung.
    const rows = await sql<{ raised_sat: bigint }[]>`
      SELECT raised_sat FROM ideas WHERE id = ${grosseIdee.id}`;
    expect(rows[0]?.raised_sat).toBe(9_007_199_254_740_993n);
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
    expect(seite1.items[0]?.id).not.toBe(seite2.items[0]?.id);
  });

  it('wirft auch beim Blaettern keine Idee ohne Marktplatzphase aus der Liste', async () => {
    // Der LEFT JOIN auf idea_marketplace ist der Grund: ein INNER JOIN haette
    // jede Idee ohne Marktphase verschwinden lassen - und zwar still.
    const body = (await (await app.request('/api/ideas?limit=100')).json()) as IdeasResponse;
    const ids = body.items.map((item) => item.id);

    expect(ids).toContain(idee.id);
    expect(ids).toContain(marktIdee.id);
  });
});

describe('GET /api/ideas - Fehlerfaelle', () => {
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

describe('toJsonSafe - die Regel fuer Betraege, einzeln geprueft', () => {
  it('macht aus einem Text-Betrag unter 2^53-1 eine JSON-Zahl', () => {
    expect(toJsonSafe('0')).toBe(0);
    expect(toJsonSafe('8940000')).toBe(8_940_000);
    expect(toJsonSafe('9007199254740991')).toBe(9_007_199_254_740_991);
    expect(typeof toJsonSafe('9007199254740991')).toBe('number');
  });

  it('laesst einen Text-Betrag ab 2^53-1 als String stehen', () => {
    expect(toJsonSafe('9007199254740993')).toBe('9007199254740993');
    expect(typeof toJsonSafe('9007199254740993')).toBe('string');
    expect(toJsonSafe('18446744073709551615')).toBe('18446744073709551615');
  });

  it('behandelt bigint genauso', () => {
    expect(toJsonSafe(12n)).toBe(12);
    expect(toJsonSafe(9_007_199_254_740_993n)).toBe('9007199254740993');
  });

  it('entscheidet fuer Text und bigint gleich - zwei Wege, eine Regel', () => {
    // Die Abfrage liest die Betraege als bigint (Spalte), der Text-Zweig deckt
    // den Fall ab, dass ein Betrag ueber ::text hereinkommt. Beide Wege enden
    // bei demselben Wert; sonst waere die Zusage von der Schreibweise der
    // Abfrage abhaengig.
    for (const betrag of [0n, 1n, 8_940_000n, 9_007_199_254_740_991n, 9_007_199_254_740_993n]) {
      expect(toJsonSafe(betrag.toString())).toEqual(toJsonSafe(betrag));
    }
  });

  it('macht aus einem Datum ISO-8601 mit Z', () => {
    expect(toJsonSafe(new Date('2026-05-01T10:00:00Z'))).toBe('2026-05-01T10:00:00.000Z');
  });

  it('rührt Zeichenketten nicht an, die keine Zahl sind', () => {
    expect(toJsonSafe('Reparaturcafe fuer Elektronik')).toBe('Reparaturcafe fuer Elektronik');
    expect(toJsonSafe('de')).toBe('de');
    expect(toJsonSafe('123e4567-e89b-12d3-a456-426614174000')).toBe(
      '123e4567-e89b-12d3-a456-426614174000',
    );
    expect(toJsonSafe('12.5')).toBe('12.5');
  });

  it('legt den Betrag nicht in SQL in JSON - nachgemessene Falle, nicht Vermutung', async () => {
    // Der naheliegende Weg waere gewesen, marketplace in SQL mit
    // json_build_object zu bauen. Genau das darf nicht passieren: to_jsonb
    // schreibt ein bigint als JSON-Zahl, und die liest der Treiber als double.
    const rows = await sql<{ durch_json: { raised: number }; als_spalte: bigint }[]>`
      SELECT json_build_object('raised', raised_sat) AS durch_json,
             raised_sat                              AS als_spalte
        FROM ideas WHERE id = ${grosseIdee.id}`;

    // PostgreSQL selbst rechnet exakt: im JSON steht die richtige Ziffernfolge.
    expect(rows[0]?.durch_json.raised).toBe(9_007_199_254_740_993);
    // Der Verlust entsteht beim Lesen: der Treiber liest die JSON-Zahl als
    // double, und aus 9007199254740993 wird dabei 9007199254740992.
    expect(JSON.stringify(rows[0]?.durch_json)).toBe('{"raised":9007199254740992}');
    // Als Spalte gelesen bleibt der Wert bigint und exakt - deshalb liest
    // IDEAS_QUERY die Betraege als Spalten und nicht aus einem JSON-Ausdruck.
    expect(rows[0]?.als_spalte).toBe(9_007_199_254_740_993n);
  });

  it('geht durch verschachtelte Werte hindurch, ohne die Struktur zu aendern', () => {
    // Die Verschachtelung entsteht in SQL - diese Funktion formt nur Werte um.
    expect(
      toJsonSafe({
        discussion: { openedAt: new Date('2026-05-01T10:00:00Z'), comments: 0, votes: { up: 3, down: 1 } },
        marketplace: { fundingGoal: '12000000', raised: '9007199254740993', investors: 2 },
      }),
    ).toEqual({
      discussion: { openedAt: '2026-05-01T10:00:00.000Z', comments: 0, votes: { up: 3, down: 1 } },
      marketplace: { fundingGoal: 12_000_000, raised: '9007199254740993', investors: 2 },
    });
  });
});
