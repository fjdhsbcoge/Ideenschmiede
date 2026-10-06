/**
 * Stimmen auf Ideen (ADR-003) gegen eine ECHTE PostgreSQL-Datenbank.
 *
 * Kein Parser, keine Attrappe: jede Zusage dieses Tests wird in der Datenbank
 * nachgezaehlt. Die API-Antwort ist die Behauptung, SELECT vote_up, vote_down
 * FROM ideas ist die Tatsache. Beides wird geprueft - und zwar in dieser
 * Reihenfolge: erst die Antwort, dann die Zeile.
 *
 * Die drei offenen Punkte A, B und C sind eigene Testfaelle (siehe unten):
 *
 *   A  Eine geaenderte Stimme ist ein UPDATE derselben Zeile - keine zweite
 *      Zeile, kein 409. Begruendung in src/votes.ts.
 *   B  Ohne aktives Abonnement: 403 mit dem Code vote_requires_subscription.
 *   C  Aenderung bei abgelaufenem Abonnement: erlaubt. Das ist GEMESSEN, nicht
 *      angenommen - und der naheliegende Upsert (INSERT ... ON CONFLICT DO
 *      UPDATE) scheitert an genau dieser Stelle, weil PostgreSQL den
 *      BEFORE-INSERT-Trigger vor der Konflikterkennung ausfuehrt. Auch das
 *      wird hier gemessen.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AUTH_ERROR_REASONS, authConfigFromEnv, createSessionToken, type AuthConfig } from '../src/auth.js';
import { closeDb } from '../src/db.js';
import { createTestIdea, createTestUser, first, sql, type TestIdea } from './helpers.js';

const app = await createApp(sql, { cleanupOnStart: async () => undefined });
const config: AuthConfig = authConfigFromEnv();

interface VoteCountsBody {
  voteUp: number;
  voteDown: number;
}

interface ErrorBody {
  error: { code: string; message: string };
}

interface AuthErrorBody {
  status: string;
  reason: string;
}

// -----------------------------------------------------------------------------
// Aufraeumbuch: alles, was dieser Test anlegt, raeumt er wieder ab.
// -----------------------------------------------------------------------------

const angelegteNutzer: string[] = [];
const angelegteIdeen: string[] = [];

afterAll(async () => {
  // Reihenfolge nach den Fremdschluesseln: Ideen zuerst (ON DELETE CASCADE
  // nimmt die Stimmen mit), danach die Abonnements (idea_votes.subscription_id
  // steht auf ON DELETE RESTRICT - solange eine Stimme zeigt, ist das
  // Abonnement nicht loeschbar), zuletzt die Nutzer.
  for (const id of angelegteIdeen) {
    await sql`DELETE FROM ideas WHERE id = ${id}`;
  }
  for (const id of angelegteNutzer) {
    await sql`DELETE FROM idea_votes WHERE user_id = ${id}`;
    await sql`DELETE FROM subscriptions WHERE user_id = ${id}`;
    await sql`DELETE FROM subscription_intents WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
  await closeDb();
});

// -----------------------------------------------------------------------------
// Hilfen
// -----------------------------------------------------------------------------

function zufallsTxid(): string {
  let hex = '';
  while (hex.length < 64) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

/** Nutzer samt Sitzung - das Token entsteht genau wie in subscriptions.test.ts. */
async function neuerNutzer(): Promise<{ id: string; token: string }> {
  const nutzer = await createTestUser();
  angelegteNutzer.push(nutzer.id);
  return { id: nutzer.id, token: createSessionToken(nutzer.id, config) };
}

async function neueIdee(authorId: string): Promise<TestIdea> {
  const idee = await createTestIdea(authorId);
  angelegteIdeen.push(idee.id);
  return idee;
}

/**
 * Ein AKTIVES Abonnement. started_at liegt in der Vergangenheit, damit
 * subscriptions_period_check (expires_at > started_at) auch dann noch erfuellt
 * ist, wenn der Test das Abonnement spaeter ablaufen laesst.
 */
async function aktivesAbo(userId: string): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO subscriptions (user_id, type, active, started_at, expires_at, payment_txid)
    VALUES (${userId}, 'annual', true, now() - interval '1 day',
            now() + make_interval(days => ${365}), ${zufallsTxid()})
    RETURNING id`;
  return first(rows, 'angelegtes Abonnement').id;
}

/** Laesst ein Abonnement ablaufen: active = false, expires_at in der Vergangenheit. */
async function ablaufenLassen(subscriptionId: string): Promise<void> {
  await sql`
    UPDATE subscriptions
       SET active = false, expires_at = now() - interval '1 hour'
     WHERE id = ${subscriptionId}`;
}

/** Die Zaehler, wie sie in der DATENBANK stehen - nicht wie die API sie meldet. */
async function zaehlerInDb(ideaId: string): Promise<VoteCountsBody> {
  const rows = await sql<{ vote_up: number; vote_down: number }[]>`
    SELECT vote_up, vote_down FROM ideas WHERE id = ${ideaId}`;
  const row = first(rows, 'Ideenzeile');
  return { voteUp: row.vote_up, voteDown: row.vote_down };
}

/** Dieselben Zahlen, aus den EINZELSTIMMEN nachgezaehlt (Entscheidung 4). */
async function ausStimmenGezaehlt(ideaId: string): Promise<VoteCountsBody> {
  const rows = await sql<{ hoch: string; runter: string }[]>`
    SELECT count(*) FILTER (WHERE direction = 'up')::text   AS hoch,
           count(*) FILTER (WHERE direction = 'down')::text AS runter
      FROM idea_votes WHERE idea_id = ${ideaId}`;
  const row = first(rows, 'gezaehlte Stimmen');
  return { voteUp: Number(row.hoch), voteDown: Number(row.runter) };
}

interface VoteRow {
  direction: string;
  subscription_id: string | null;
  updated_at: Date;
}

async function stimmenInDb(ideaId: string, userId: string): Promise<VoteRow[]> {
  return sql<VoteRow[]>`
    SELECT direction, subscription_id, updated_at
      FROM idea_votes WHERE idea_id = ${ideaId} AND user_id = ${userId}`;
}

async function zaehleStimmen(ideaId: string, userId: string): Promise<number> {
  const rows = await sql<{ anzahl: string }[]>`
    SELECT count(*)::text AS anzahl FROM idea_votes
     WHERE idea_id = ${ideaId} AND user_id = ${userId}`;
  return Number(first(rows, 'Stimmenzahl').anzahl);
}

/**
 * Prueft die Zaehler dreifach: die Antwort der API, die Zeile in ideas und die
 * Nachzaehlung aus idea_votes. Die drei muessen uebereinstimmen - sonst haette
 * die Anwendung einen Zaehler selbst geschrieben und der Trigger haette ihn
 * hinterher wieder ueberschrieben.
 */
async function erwarteZaehler(ideaId: string, erwartet: VoteCountsBody): Promise<void> {
  expect(await zaehlerInDb(ideaId)).toEqual(erwartet);
  expect(await ausStimmenGezaehlt(ideaId)).toEqual(erwartet);
}

// --- Aufrufe durch die echten Routen -----------------------------------------

interface Antwort {
  status: number;
  body: unknown;
}

function kopf(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== undefined) {
    headers.authorization = 'Bearer ' + token;
  }
  return headers;
}

async function antwortAls(response: Response): Promise<Antwort> {
  return { status: response.status, body: await response.json() };
}

/** POST /api/ideas/:id/vote */
async function abstimmen(ideaId: string, direction: unknown, token?: string): Promise<Antwort> {
  return antwortAls(
    await app.request(`/api/ideas/${ideaId}/vote`, {
      method: 'POST',
      headers: kopf(token),
      body: JSON.stringify({ direction }),
    }),
  );
}

/** POST mit rohem Koerper - fuer den kaputten JSON-Fall. */
async function abstimmenRoh(ideaId: string, roh: string, token?: string): Promise<Antwort> {
  return antwortAls(
    await app.request(`/api/ideas/${ideaId}/vote`, { method: 'POST', headers: kopf(token), body: roh }),
  );
}

/** DELETE /api/ideas/:id/vote */
async function zuruecknehmen(ideaId: string, token?: string): Promise<Antwort> {
  return antwortAls(
    await app.request(`/api/ideas/${ideaId}/vote`, { method: 'DELETE', headers: kopf(token) }),
  );
}

/** GET /api/ideas/:id/votes - oeffentlich, deshalb ohne Token. */
async function stimmenLesen(ideaId: string): Promise<Antwort> {
  return antwortAls(await app.request(`/api/ideas/${ideaId}/votes`));
}

function alsZahlen(antwort: Antwort): VoteCountsBody {
  return antwort.body as VoteCountsBody;
}

function alsFehler(antwort: Antwort): ErrorBody {
  return antwort.body as ErrorBody;
}

// =============================================================================
// A - Stimme abgeben und aendern
// =============================================================================

describe('POST /api/ideas/:id/vote - abgeben und aendern (Frage A)', () => {
  it('erste Stimme: 200, eine Zeile in idea_votes, Zaehler in ideas nachgezaehlt', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    const abo = await aktivesAbo(nutzer.id);

    const antwort = await abstimmen(idee.id, 'up', nutzer.token);
    expect(antwort.status).toBe(200);
    expect(alsZahlen(antwort)).toEqual({ voteUp: 1, voteDown: 0 });

    // Die Tatsache, nicht die Behauptung: die Zeile steht in der Datenbank.
    const zeilen = await stimmenInDb(idee.id, nutzer.id);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.direction).toBe('up');
    // Der Beleg: welches Abonnement dieses Stimmrecht verliehen hat.
    expect(zeilen[0]?.subscription_id).toBe(abo);

    await erwarteZaehler(idee.id, { voteUp: 1, voteDown: 0 });
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(1);
  });

  it('dieselbe Richtung zweimal: keine zweite Zeile und kein neuer Zeitstempel', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);

    await abstimmen(idee.id, 'up', nutzer.token);
    const vorher = first(await stimmenInDb(idee.id, nutzer.id), 'Stimme').updated_at.getTime();

    const zweite = await abstimmen(idee.id, 'up', nutzer.token);
    expect(zweite.status).toBe(200);
    expect(alsZahlen(zweite)).toEqual({ voteUp: 1, voteDown: 0 });

    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(1);
    const nachher = first(await stimmenInDb(idee.id, nutzer.id), 'Stimme').updated_at.getTime();
    expect(nachher).toBe(vorher);
    await erwarteZaehler(idee.id, { voteUp: 1, voteDown: 0 });
  });

  it('A: eine ANDERE Richtung ist ein UPDATE derselben Zeile - kein 409', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    const abo = await aktivesAbo(nutzer.id);

    await abstimmen(idee.id, 'up', nutzer.token);
    const wechsel = await abstimmen(idee.id, 'down', nutzer.token);

    expect(wechsel.status).toBe(200);
    expect(alsZahlen(wechsel)).toEqual({ voteUp: 0, voteDown: 1 });

    // UNIQUE (idea_id, user_id): es bleibt bei EINER Zeile je Nutzer und Idee.
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(1);

    const zeile = first(await stimmenInDb(idee.id, nutzer.id), 'Stimme');
    expect(zeile.direction).toBe('down');
    // Der Beleg ist unveraendert: dieselbe Stimme, dasselbe Abonnement.
    expect(zeile.subscription_id).toBe(abo);

    await erwarteZaehler(idee.id, { voteUp: 0, voteDown: 1 });
  });

  it('zwei Nutzer stimmen verschieden - die Zaehler sind die Summe der Einzelstimmen', async () => {
    const a = await neuerNutzer();
    const b = await neuerNutzer();
    const idee = await neueIdee(a.id);
    await aktivesAbo(a.id);
    await aktivesAbo(b.id);

    await abstimmen(idee.id, 'up', a.token);
    const zweite = await abstimmen(idee.id, 'down', b.token);

    expect(alsZahlen(zweite)).toEqual({ voteUp: 1, voteDown: 1 });
    await erwarteZaehler(idee.id, { voteUp: 1, voteDown: 1 });

    // Die oeffentliche Auskunft sagt dasselbe.
    expect(alsZahlen(await stimmenLesen(idee.id))).toEqual({ voteUp: 1, voteDown: 1 });
  });

  it('gleichzeitige Stimmen desselben Nutzers: eine Zeile, Zaehler stimmen', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);

    const [eine, andere] = await Promise.all([
      abstimmen(idee.id, 'up', nutzer.token),
      abstimmen(idee.id, 'down', nutzer.token),
    ]);

    expect(eine.status).toBe(200);
    expect(andere.status).toBe(200);
    // Welche Richtung gewinnt, entscheidet die Datenbank - geprueft wird, dass
    // es ueberhaupt nur EINE Stimme gibt und die Zaehler dazu passen.
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(1);
    const zahlen = await zaehlerInDb(idee.id);
    expect(zahlen.voteUp + zahlen.voteDown).toBe(1);
    await erwarteZaehler(idee.id, zahlen);
  });
});

// =============================================================================
// B - ohne aktives Abonnement
// =============================================================================

describe('Frage B: ohne aktives Abonnement', () => {
  it('ohne jedes Abonnement: 403 vote_requires_subscription, und nichts wird geschrieben', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);

    const antwort = await abstimmen(idee.id, 'up', nutzer.token);

    expect(antwort.status).toBe(403);
    expect(alsFehler(antwort).error.code).toBe('vote_requires_subscription');
    expect(alsFehler(antwort).error.message).toContain('Abonnement');

    // Der Beweis, dass der Trigger abgewiesen hat und nicht die Anwendung:
    // es steht KEINE Zeile in idea_votes, und die Zaehler sind unveraendert.
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);
    await erwarteZaehler(idee.id, { voteUp: 0, voteDown: 0 });
  });

  it('abgelaufenes Abonnement (active = false): ebenfalls 403', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    const abo = await aktivesAbo(nutzer.id);
    await ablaufenLassen(abo);

    const antwort = await abstimmen(idee.id, 'up', nutzer.token);
    expect(antwort.status).toBe(403);
    expect(alsFehler(antwort).error.code).toBe('vote_requires_subscription');
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);
  });

  it('aktives Abonnement, aber abgelaufen ist es nicht: 200 (die Gegenprobe)', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);

    const antwort = await abstimmen(idee.id, 'up', nutzer.token);
    expect(antwort.status).toBe(200);
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(1);
  });
});

// =============================================================================
// C - Aenderung bei abgelaufenem Abonnement
// =============================================================================

describe('Frage C: Aenderung bei abgelaufenem Abonnement', () => {
  it('die Aenderung ist erlaubt - dieselbe Zeile, derselbe Beleg', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    const abo = await aktivesAbo(nutzer.id);

    await abstimmen(idee.id, 'up', nutzer.token);
    await ablaufenLassen(abo);

    // Das Abonnement ist wirklich abgelaufen - gemessen, nicht angenommen.
    const abos = await sql<{ active: boolean; abgelaufen: boolean }[]>`
      SELECT active, expires_at <= now() AS abgelaufen FROM subscriptions WHERE id = ${abo}`;
    expect(first(abos, 'Abonnement')).toEqual({ active: false, abgelaufen: true });

    const wechsel = await abstimmen(idee.id, 'down', nutzer.token);
    expect(wechsel.status).toBe(200);
    expect(alsZahlen(wechsel)).toEqual({ voteUp: 0, voteDown: 1 });

    const zeile = first(await stimmenInDb(idee.id, nutzer.id), 'Stimme');
    expect(zeile.direction).toBe('down');
    expect(zeile.subscription_id).toBe(abo);
    await erwarteZaehler(idee.id, { voteUp: 0, voteDown: 1 });
  });

  it('gemessen: der naheliegende Upsert scheitert genau hier (BEFORE INSERT feuert vor der Konflikterkennung)', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    const abo = await aktivesAbo(nutzer.id);
    await abstimmen(idee.id, 'up', nutzer.token);
    await ablaufenLassen(abo);

    // Derselbe Schreibvorgang, wie ihn ein INSERT ... ON CONFLICT DO UPDATE
    // ausfuehren wuerde. Er muss scheitern, OBWOHL die Aenderung erlaubt ist -
    // und genau deshalb geht src/votes.ts den UPDATE-Zweig zuerst.
    await expect(
      sql`
        INSERT INTO idea_votes (idea_id, user_id, direction)
        VALUES (${idee.id}, ${nutzer.id}, 'down')
        ON CONFLICT (idea_id, user_id) DO UPDATE SET direction = EXCLUDED.direction`,
    ).rejects.toThrow(/ADR-003: Stimmrecht erfordert ein aktives Abonnement/);

    // Und die Stimme ist unveraendert geblieben: der abgewiesene Vorgang hat
    // nichts geschrieben.
    expect(first(await stimmenInDb(idee.id, nutzer.id), 'Stimme').direction).toBe('up');
    await erwarteZaehler(idee.id, { voteUp: 1, voteDown: 0 });
  });

  it('eine NEUE Stimme nach der Ruecknahme braucht trotzdem ein aktives Abonnement', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    const abo = await aktivesAbo(nutzer.id);
    await abstimmen(idee.id, 'up', nutzer.token);
    await ablaufenLassen(abo);

    // Ruecknahme ist frei (kein BEFORE-DELETE-Zweig im Trigger) ...
    const weg = await zuruecknehmen(idee.id, nutzer.token);
    expect(weg.status).toBe(200);
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);

    // ... aber die Rueckkehr an die Urne nicht: das waere eine neue Stimme.
    const neu = await abstimmen(idee.id, 'up', nutzer.token);
    expect(neu.status).toBe(403);
    expect(alsFehler(neu).error.code).toBe('vote_requires_subscription');
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);
    await erwarteZaehler(idee.id, { voteUp: 0, voteDown: 0 });
  });

  it('der unveraenderliche Beleg: ein UPDATE auf subscription_id wird abgewiesen', async () => {
    // Nur zur Dokumentation der Regel, gegen die src/votes.ts absichtlich nicht
    // verstoesst: die Anwendung fasst diese Spalte nie an.
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);
    await abstimmen(idee.id, 'up', nutzer.token);

    await expect(
      sql`UPDATE idea_votes SET subscription_id = NULL WHERE idea_id = ${idee.id} AND user_id = ${nutzer.id}`,
    ).rejects.toThrow(/unveraenderliche[r]? Beleg/);
  });
});

// =============================================================================
// DELETE - eigene Stimme zuruecknehmen
// =============================================================================

describe('DELETE /api/ideas/:id/vote', () => {
  it('nimmt die eigene Stimme zurueck; die Zaehler in ideas fallen mit', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);
    await abstimmen(idee.id, 'up', nutzer.token);

    const antwort = await zuruecknehmen(idee.id, nutzer.token);
    expect(antwort.status).toBe(200);
    expect(alsZahlen(antwort)).toEqual({ voteUp: 0, voteDown: 0 });

    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);
    await erwarteZaehler(idee.id, { voteUp: 0, voteDown: 0 });
  });

  it('ist idempotent: ohne eigene Stimme ist die Ruecknahme kein Fehler', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);

    const erste = await zuruecknehmen(idee.id, nutzer.token);
    const zweite = await zuruecknehmen(idee.id, nutzer.token);

    expect(erste.status).toBe(200);
    expect(zweite.status).toBe(200);
    expect(alsZahlen(zweite)).toEqual({ voteUp: 0, voteDown: 0 });
    await erwarteZaehler(idee.id, { voteUp: 0, voteDown: 0 });
  });

  it('laesst fremde Stimmen unberuehrt', async () => {
    const a = await neuerNutzer();
    const b = await neuerNutzer();
    const idee = await neueIdee(a.id);
    await aktivesAbo(a.id);
    await aktivesAbo(b.id);
    await abstimmen(idee.id, 'up', a.token);
    await abstimmen(idee.id, 'up', b.token);

    const antwort = await zuruecknehmen(idee.id, a.token);
    expect(alsZahlen(antwort)).toEqual({ voteUp: 1, voteDown: 0 });
    expect(await zaehleStimmen(idee.id, b.id)).toBe(1);
    await erwarteZaehler(idee.id, { voteUp: 1, voteDown: 0 });
  });

  it('braucht keine Sitzung zu haben ... aber sehr wohl eine', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);

    const antwort = await zuruecknehmen(idee.id);
    expect(antwort.status).toBe(401);
    expect((antwort.body as AuthErrorBody).reason).toBe(AUTH_ERROR_REASONS.unauthorized);
  });
});

// =============================================================================
// GET /api/ideas/:id/votes - oeffentlich
// =============================================================================

describe('GET /api/ideas/:id/votes', () => {
  it('ist oeffentlich und liefert genau { voteUp, voteDown }', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);
    await abstimmen(idee.id, 'down', nutzer.token);

    const antwort = await stimmenLesen(idee.id);
    expect(antwort.status).toBe(200);
    expect(alsZahlen(antwort)).toEqual({ voteUp: 0, voteDown: 1 });
    // Kein Durchsickern von Spaltennamen: die Antwort hat genau zwei Schluessel.
    expect(Object.keys(antwort.body as object).sort()).toEqual(['voteDown', 'voteUp']);

    await erwarteZaehler(idee.id, { voteUp: 0, voteDown: 1 });
  });

  it('eine Idee ohne Stimmen hat 0 und 0 - nicht 404', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);

    const antwort = await stimmenLesen(idee.id);
    expect(antwort.status).toBe(200);
    expect(alsZahlen(antwort)).toEqual({ voteUp: 0, voteDown: 0 });
  });

  it('unbekannte Idee -> 404 not_found', async () => {
    const antwort = await stimmenLesen('00000000-0000-4000-8000-000000000000');
    expect(antwort.status).toBe(404);
    expect(alsFehler(antwort).error.code).toBe('not_found');
  });

  it('unbrauchbare ID -> 400, kein 500 aus dem Treiber', async () => {
    const antwort = await stimmenLesen('nicht-ganz-eine-uuid');
    expect(antwort.status).toBe(400);
    expect(alsFehler(antwort).error.code).toBe('invalid_id');
  });
});

// =============================================================================
// Sitzung und Eingaben
// =============================================================================

describe('Sitzung und Eingaben', () => {
  it('ohne Sitzung: 401 in derselben Form wie GET /api/users/me', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);

    const antwort = await abstimmen(idee.id, 'up');
    expect(antwort.status).toBe(401);
    const koerper = antwort.body as AuthErrorBody;
    expect(koerper.status).toBe('ERROR');
    expect(koerper.reason).toBe(AUTH_ERROR_REASONS.unauthorized);

    // Und es wurde nichts geschrieben.
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);
  });

  it('unbrauchbares Token: 401', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);

    const antwort = await abstimmen(idee.id, 'up', 'kein-gueltiges-token');
    expect(antwort.status).toBe(401);
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);
  });

  it.each([
    ['up', 'gueltig'],
    ['down', 'gueltig'],
  ])('Richtung %s ist erlaubt (%s)', async (direction) => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);

    const antwort = await abstimmen(idee.id, direction, nutzer.token);
    expect(antwort.status).toBe(200);
    expect(first(await stimmenInDb(idee.id, nutzer.id), 'Stimme').direction).toBe(direction);
  });

  it.each([
    ['sideways', 'unbekannte Richtung'],
    ['UP', 'falsche Schreibweise'],
    ['', 'leere Richtung'],
    [null, 'null'],
    [1, 'Zahl'],
  ])('weist %s ab (%s): 400 invalid_request', async (direction: unknown, _fall: string) => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);

    const antwort = await abstimmen(idee.id, direction, nutzer.token);
    expect(antwort.status).toBe(400);
    expect(alsFehler(antwort).error.code).toBe('invalid_request');
    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);
  });

  it('weist einen fehlenden Koerper und kaputtes JSON ab', async () => {
    const nutzer = await neuerNutzer();
    const idee = await neueIdee(nutzer.id);
    await aktivesAbo(nutzer.id);

    const leer = await abstimmenRoh(idee.id, '', nutzer.token);
    expect(leer.status).toBe(400);
    expect(alsFehler(leer).error.code).toBe('invalid_request');

    const kaputt = await abstimmenRoh(idee.id, '{direction:', nutzer.token);
    expect(kaputt.status).toBe(400);
    expect(alsFehler(kaputt).error.code).toBe('invalid_request');

    // Ein JSON-Array ist kein Objekt - readJsonBody lehnt es ab.
    const liste = await abstimmenRoh(idee.id, '["up"]', nutzer.token);
    expect(liste.status).toBe(400);
    expect(alsFehler(liste).error.code).toBe('invalid_request');

    expect(await zaehleStimmen(idee.id, nutzer.id)).toBe(0);
  });

  it('unbekannte Idee -> 404 idea_not_found, unbrauchbare ID -> 400 invalid_id', async () => {
    const nutzer = await neuerNutzer();
    await aktivesAbo(nutzer.id);

    const unbekannt = await abstimmen('00000000-0000-4000-8000-000000000000', 'up', nutzer.token);
    expect(unbekannt.status).toBe(404);
    expect(alsFehler(unbekannt).error.code).toBe('idea_not_found');

    const unsinn = await abstimmen('nicht-ganz-eine-uuid', 'up', nutzer.token);
    expect(unsinn.status).toBe(400);
    expect(alsFehler(unsinn).error.code).toBe('invalid_id');

    const loeschen = await zuruecknehmen('nicht-ganz-eine-uuid', nutzer.token);
    expect(loeschen.status).toBe(400);
  });
});
