/**
 * Team-Bewerbungen (Migration 006_team_applications.sql) gegen eine ECHTE
 * PostgreSQL-Datenbank.
 *
 * Der Kern dieser Datei sind die beiden Zugriffstests:
 *
 *   * ein FREMDER Nutzer bekommt die Bewerbungen eines Teams NICHT (403)
 *   * ein NICHT-Leiter kann keinen Status aendern (403)
 *
 * Ohne diese beiden Tests waere die Zugriffsregel nur behauptet. Sie werden
 * deshalb nicht nur an der Antwort, sondern auch IN DER DATENBANK geprueft:
 * eine abgewiesene Anfrage darf keine Zeile veraendert haben.
 *
 * Ebenso wichtig ist die Gegenprobe: die Regeln, die das SCHEMA durchsetzt
 * (UNIQUE, CHECK, Fremdschluessel), werden an der Anwendung vorbei geprueft -
 * mit reinem SQL. Ein Test, der nur ueber die API laeuft, wuerde beweisen, dass
 * die Anwendung sich selbst gleich ist.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { authConfigFromEnv, createSessionToken, type AuthConfig } from '../src/auth.js';
import { closeDb } from '../src/db.js';
import { createTestIdea, createTestUser, sql, type TestIdea, type TestUser } from './helpers.js';

const app = await createApp(sql, { cleanupOnStart: async () => undefined });
const config: AuthConfig = authConfigFromEnv();

// -----------------------------------------------------------------------------
// Aufraeumbuch
// -----------------------------------------------------------------------------

const angelegteNutzer: string[] = [];
const angelegteTeams: string[] = [];
const angelegteIdeen: string[] = [];

afterAll(async () => {
  // Reihenfolge nach den Fremdschluesseln: team_applications haengt an teams und
  // users (beide CASCADE), teams.idea_id ist CASCADE.
  for (const id of angelegteTeams) {
    await sql.unsafe('DELETE FROM teams WHERE id = $1', [id]);
  }
  for (const id of angelegteIdeen) {
    await sql.unsafe('DELETE FROM ideas WHERE id = $1', [id]);
  }
  for (const id of angelegteNutzer) {
    await sql.unsafe('DELETE FROM users WHERE id = $1', [id]);
  }
  await closeDb();
});

// -----------------------------------------------------------------------------
// Hilfen
// -----------------------------------------------------------------------------

interface Nutzer {
  id: string;
  username: string;
  token: string;
}

async function neuerNutzer(): Promise<Nutzer> {
  const nutzer: TestUser = await createTestUser();
  angelegteNutzer.push(nutzer.id);
  return { ...nutzer, token: createSessionToken(nutzer.id, config) };
}

/**
 * Ein Team mit einem Leiter. Das Team braucht eine Idee (teams.idea_id ist NOT
 * NULL) - sie gehoert hier dem Leiter, damit die Testdaten die Regeln des
 * Schemas erfuellen.
 */
async function neuesTeam(leaderId: string): Promise<string> {
  const idee: TestIdea = await createTestIdea(leaderId);
  angelegteIdeen.push(idee.id);
  const rows = await sql.unsafe<{ id: string }[]>(
    'INSERT INTO teams (idea_id, leader_id, name) VALUES ($1, $2, $3) RETURNING id',
    [idee.id, leaderId, 'Team ' + idee.title],
  );
  const id = rows[0]?.id as string;
  angelegteTeams.push(id);
  return id;
}

/** Ein Bewerbungstext mit genau n Zeichen (die Untergrenze ist 20). */
function textMit(zeichen: number): string {
  return 'B'.repeat(zeichen);
}

const GUELTIGER_TEXT = 'Ich baue seit Jahren Antriebe und habe Zeit.';

interface BewerbungBody {
  id: string;
  teamId: string;
  userId: string;
  status: string;
  message: string;
  createdAt: string;
  decidedAt: string | null;
  team?: { id: string; name: string };
  applicant?: { id: string; username: string; displayName: string };
}

interface EinzelAntwort {
  application?: BewerbungBody;
  error?: { code: string; message: string };
  status?: string;
  reason?: string;
}

interface ListenAntwort {
  items?: BewerbungBody[];
  count?: number;
  error?: { code: string; message: string };
}

function authKopf(token: string): Record<string, string> {
  return { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
}

async function bewerben(token: string, teamId: string, message: unknown) {
  const antwort = await app.request('/api/teams/' + teamId + '/applications', {
    method: 'POST',
    headers: authKopf(token),
    body: JSON.stringify({ message }),
  });
  return { status: antwort.status, body: (await antwort.json()) as EinzelAntwort };
}

async function entscheiden(token: string, id: string, status: unknown) {
  const antwort = await app.request('/api/applications/' + id, {
    method: 'PATCH',
    headers: authKopf(token),
    body: JSON.stringify({ status }),
  });
  return { status: antwort.status, body: (await antwort.json()) as EinzelAntwort };
}

async function zuruecknehmen(token: string, id: string) {
  const antwort = await app.request('/api/applications/' + id, {
    method: 'DELETE',
    headers: { authorization: 'Bearer ' + token },
  });
  return { status: antwort.status, text: await antwort.text() };
}

async function teamListe(token: string, teamId: string) {
  const antwort = await app.request('/api/teams/' + teamId + '/applications', {
    headers: { authorization: 'Bearer ' + token },
  });
  return { status: antwort.status, body: (await antwort.json()) as ListenAntwort };
}

async function meineListe(token: string) {
  const antwort = await app.request('/api/users/me/applications', {
    headers: { authorization: 'Bearer ' + token },
  });
  return { status: antwort.status, body: (await antwort.json()) as ListenAntwort };
}

/** Die Zeile, wie sie WIRKLICH in der Datenbank steht - nicht wie die API sie meldet. */
async function zeileInDerDatenbank(id: string) {
  const rows = await sql.unsafe<{ status: string; decided_at: Date | null; message: string }[]>(
    'SELECT status, decided_at, message FROM team_applications WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

/** Wie viele Bewerbungen stehen in der Datenbank - wahlweise je Team oder je Nutzer. */
async function zaehleBewerbungen(filter: { teamId?: string; userId?: string }): Promise<number> {
  const rows = await sql.unsafe<{ anzahl: string }[]>(
    'SELECT count(*)::text AS anzahl FROM team_applications' +
      ' WHERE ($1::uuid IS NULL OR team_id = $1::uuid)' +
      '   AND ($2::uuid IS NULL OR user_id = $2::uuid)',
    [filter.teamId ?? null, filter.userId ?? null],
  );
  return Number(rows[0]?.anzahl ?? '0');
}

// -----------------------------------------------------------------------------
// Bewerben
// -----------------------------------------------------------------------------

describe('POST /api/teams/:id/applications', () => {
  let teamId!: string;
  let leiter!: Nutzer;
  let bewerber!: Nutzer;

  beforeAll(async () => {
    leiter = await neuerNutzer();
    bewerber = await neuerNutzer();
    teamId = await neuesTeam(leiter.id);
  });

  it('ohne Sitzung 401 - und keine Zeile', async () => {
    const antwort = await app.request('/api/teams/' + teamId + '/applications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: GUELTIGER_TEXT }),
    });
    expect(antwort.status).toBe(401);
    expect(await zaehleBewerbungen({ teamId })).toBe(0);
  });

  it('legt die Bewerbung an: Status offen, decidedAt null, Text unveraendert', async () => {
    const { status, body } = await bewerben(bewerber.token, teamId, GUELTIGER_TEXT);
    expect(status).toBe(201);

    const bewerbung = body.application as BewerbungBody;
    expect(bewerbung.teamId).toBe(teamId);
    expect(bewerbung.userId).toBe(bewerber.id);
    expect(bewerbung.status).toBe('offen');
    expect(bewerbung.decidedAt).toBeNull();
    expect(bewerbung.message).toBe(GUELTIGER_TEXT);
    expect(bewerbung.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    // Und die Zeile steht wirklich in der Datenbank - nicht nur in der Antwort.
    const zeile = await zeileInDerDatenbank(bewerbung.id);
    expect(zeile?.status).toBe('offen');
    expect(zeile?.decided_at).toBeNull();
    expect(zeile?.message).toBe(GUELTIGER_TEXT);
    expect(await zaehleBewerbungen({ teamId })).toBe(1);
  });

  it('ein zu kurzer Text -> 400, und keine Zeile (die Grenze des Formulars)', async () => {
    const fremd = await neuerNutzer();
    const { status, body } = await bewerben(fremd.token, teamId, textMit(19));
    expect(status).toBe(400);
    expect(body.error?.code).toBe('invalid_message');
    // Die gemessene Laenge steht in der Antwort.
    expect(body.error?.message).toContain('erhalten: 19');
    expect(await zaehleBewerbungen({ teamId, userId: fremd.id })).toBe(0);
  });

  it('genau 20 Zeichen -> 201 (die Grenze ist gueltig, nicht nur die Naehe dazu)', async () => {
    const fremd = await neuerNutzer();
    const { status } = await bewerben(fremd.token, teamId, textMit(20));
    expect(status).toBe(201);
  });

  it('fehlender Text -> 400', async () => {
    const fremd = await neuerNutzer();
    const { status, body } = await bewerben(fremd.token, teamId, undefined);
    expect(status).toBe(400);
    expect(body.error?.code).toBe('invalid_message');
  });

  it('unbekanntes Team -> 404 (und keine Zeile)', async () => {
    const fremd = await neuerNutzer();
    const { status, body } = await bewerben(
      fremd.token,
      '00000000-0000-4000-8000-000000000000',
      GUELTIGER_TEXT,
    );
    expect(status).toBe(404);
    expect(body.error?.code).toBe('team_not_found');
    expect(await zaehleBewerbungen({ userId: fremd.id })).toBe(0);
  });

  it('eine Kennung, die keine uuid ist -> 400 statt 500', async () => {
    const fremd = await neuerNutzer();
    const antwort = await app.request('/api/teams/keine-uuid/applications', {
      method: 'POST',
      headers: authKopf(fremd.token),
      body: JSON.stringify({ message: GUELTIGER_TEXT }),
    });
    expect(antwort.status).toBe(400);
    expect(((await antwort.json()) as EinzelAntwort).error?.code).toBe('invalid_id');
  });

  // ---------------------------------------------------------------------------
  // Entscheidung B: eine Bewerbung je Nutzer und Team
  // ---------------------------------------------------------------------------
  it('die ZWEITE Bewerbung auf dasselbe Team -> 409, und es bleibt bei EINER Zeile', async () => {
    const einmalig = await neuerNutzer();
    const erste = await bewerben(einmalig.token, teamId, GUELTIGER_TEXT);
    expect(erste.status).toBe(201);

    const zweite = await bewerben(einmalig.token, teamId, 'Zweiter Versuch mit anderem Text, lang genug.');
    expect(zweite.status).toBe(409);
    expect(zweite.body.error?.code).toBe('application_exists');

    // Die Messung: genau EINE Zeile, und ihr Text ist der der ERSTEN Bewerbung.
    expect(await zaehleBewerbungen({ teamId, userId: einmalig.id })).toBe(1);
    const zeile = await zeileInDerDatenbank((erste.body.application as BewerbungBody).id);
    expect(zeile?.message).toBe(GUELTIGER_TEXT);
    expect(zeile?.status).toBe('offen');
  });

  it('auch nach einer Ablehnung bleibt es bei 409 (kein stilles Zuruecksetzen)', async () => {
    const einmalig = await neuerNutzer();
    const erste = await bewerben(einmalig.token, teamId, GUELTIGER_TEXT);
    const id = (erste.body.application as BewerbungBody).id;
    expect((await entscheiden(leiter.token, id, 'abgelehnt')).status).toBe(200);

    const zweite = await bewerben(einmalig.token, teamId, 'Neuer Versuch nach der Ablehnung, lang genug.');
    expect(zweite.status).toBe(409);
    // Die Ablehnung ist NICHT verschwunden - sie steht noch genau so da.
    const zeile = await zeileInDerDatenbank(id);
    expect(zeile?.status).toBe('abgelehnt');
    expect(zeile?.decided_at).not.toBeNull();
    expect(await zaehleBewerbungen({ teamId, userId: einmalig.id })).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// Die eigenen Bewerbungen
// -----------------------------------------------------------------------------

describe('GET /api/users/me/applications', () => {
  it('ohne Sitzung 401', async () => {
    const antwort = await app.request('/api/users/me/applications');
    expect(antwort.status).toBe(401);
  });

  it('liefert NUR die eigenen Bewerbungen, mit dem Team als verschachteltem Feld', async () => {
    const leiter = await neuerNutzer();
    const teamA = await neuesTeam(leiter.id);
    const teamB = await neuesTeam(leiter.id);
    const bewerber = await neuerNutzer();
    const fremd = await neuerNutzer();

    await bewerben(bewerber.token, teamA, GUELTIGER_TEXT);
    await bewerben(bewerber.token, teamB, 'Bewerbung auf ein zweites Team, ebenfalls lang genug.');
    const fremde = await bewerben(fremd.token, teamA, 'Die Bewerbung eines anderen Nutzers, lang genug.');

    const { status, body } = await meineListe(bewerber.token);
    expect(status).toBe(200);
    expect(body.count).toBe(2);
    const items = body.items ?? [];
    expect(items.map((i) => i.teamId).sort()).toEqual([teamA, teamB].sort());
    for (const item of items) {
      expect(item.userId).toBe(bewerber.id);
      expect(item.team?.id).toBe(item.teamId);
      expect(item.team?.name).toBeTruthy();
      // Die Bewerbung eines FREMDEN ist nicht dabei - auch nicht ihre Kennung.
      expect(item.id).not.toBe((fremde.body.application as BewerbungBody).id);
      // Der Bewerber selbst braucht seine eigene Kennung nicht doppelt.
      expect(item.applicant).toBeUndefined();
    }

    // Und der fremde Nutzer sieht genau seine eine.
    const fremdeListe = await meineListe(fremd.token);
    expect(fremdeListe.body.count).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// ZUGRIFFSREGEL 1: die Bewerbungen eines Teams sieht nur der Teamleiter
// -----------------------------------------------------------------------------

describe('Zugriffsregel: GET /api/teams/:id/applications', () => {
  let teamId!: string;
  let leiter!: Nutzer;
  let bewerber!: Nutzer;

  beforeAll(async () => {
    leiter = await neuerNutzer();
    bewerber = await neuerNutzer();
    teamId = await neuesTeam(leiter.id);
    await bewerben(bewerber.token, teamId, 'Ich habe Lust auf dieses Team und bringe Erfahrung mit.');
  });

  it('ohne Sitzung 401', async () => {
    const antwort = await app.request('/api/teams/' + teamId + '/applications');
    expect(antwort.status).toBe(401);
  });

  it('ein FREMDER Nutzer bekommt 403 - und keinen einzigen Bewerbungstext', async () => {
    const fremd = await neuerNutzer();
    const { status, body } = await teamListe(fremd.token, teamId);
    expect(status).toBe(403);
    expect(body.error?.code).toBe('not_team_leader');
    // Kein items-Feld, kein Text: die Antwort verraet nichts ueber die Bewerbung.
    expect(body.items).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Ich habe Lust');
  });

  it('auch der BEWERBER SELBST bekommt 403 (die Liste ist keine oeffentliche Auskunft)', async () => {
    const { status, body } = await teamListe(bewerber.token, teamId);
    expect(status).toBe(403);
    expect(body.error?.code).toBe('not_team_leader');
  });

  it('der Teamleiter bekommt 200 und sieht den Bewerber - ohne dessen E-Mail', async () => {
    const { status, body } = await teamListe(leiter.token, teamId);
    expect(status).toBe(200);
    expect(body.count).toBeGreaterThanOrEqual(1);

    const items = body.items ?? [];
    const eigene = items.find((i) => i.userId === bewerber.id) as BewerbungBody;
    expect(eigene).toBeDefined();
    expect(eigene.status).toBe('offen');
    expect(eigene.applicant?.username).toBe(bewerber.username);
    expect(eigene.applicant?.displayName).toBeTruthy();
    // Die Antwort ist eine Tatsache ueber die Datenbank - und keine Spalte mehr.
    expect(JSON.stringify(body)).not.toContain('@example.invalid');
  });

  it('unbekanntes Team -> 404', async () => {
    const { status } = await teamListe(leiter.token, '00000000-0000-4000-8000-000000000000');
    expect(status).toBe(404);
  });
});

// -----------------------------------------------------------------------------
// ZUGRIFFSREGEL 2: entscheiden darf nur der Teamleiter
// -----------------------------------------------------------------------------

describe('Zugriffsregel: PATCH /api/applications/:id', () => {
  let teamId!: string;
  let leiter!: Nutzer;
  let bewerber!: Nutzer;
  let bewerbungId!: string;

  beforeAll(async () => {
    leiter = await neuerNutzer();
    bewerber = await neuerNutzer();
    teamId = await neuesTeam(leiter.id);
    const angelegt = await bewerben(bewerber.token, teamId, 'Ich bewerbe mich hiermit um einen Platz im Team.');
    bewerbungId = (angelegt.body.application as BewerbungBody).id;
  });

  it('ohne Sitzung 401', async () => {
    const antwort = await app.request('/api/applications/' + bewerbungId, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'angenommen' }),
    });
    expect(antwort.status).toBe(401);
    expect((await zeileInDerDatenbank(bewerbungId))?.status).toBe('offen');
  });

  it('ein NICHT-Leiter kann den Status NICHT aendern (403) - und die Zeile bleibt offen', async () => {
    const fremd = await neuerNutzer();
    const { status, body } = await entscheiden(fremd.token, bewerbungId, 'angenommen');
    expect(status).toBe(403);
    expect(body.error?.code).toBe('not_team_leader');
    // DER Nachweis: die Datenbank steht unveraendert da.
    const zeile = await zeileInDerDatenbank(bewerbungId);
    expect(zeile?.status).toBe('offen');
    expect(zeile?.decided_at).toBeNull();
  });

  it('auch der BEWERBER SELBST kann seinen Status nicht setzen (403)', async () => {
    const { status, body } = await entscheiden(bewerber.token, bewerbungId, 'angenommen');
    expect(status).toBe(403);
    expect(body.error?.code).toBe('not_team_leader');
    expect((await zeileInDerDatenbank(bewerbungId))?.status).toBe('offen');
  });

  it('der Leiter eines ANDEREN Teams kann nicht entscheiden (403)', async () => {
    const andererLeiter = await neuerNutzer();
    await neuesTeam(andererLeiter.id);
    const { status } = await entscheiden(andererLeiter.token, bewerbungId, 'angenommen');
    expect(status).toBe(403);
    expect((await zeileInDerDatenbank(bewerbungId))?.status).toBe('offen');
  });

  it("'offen' ist keine Entscheidung -> 400", async () => {
    const { status, body } = await entscheiden(leiter.token, bewerbungId, 'offen');
    expect(status).toBe(400);
    expect(body.error?.code).toBe('invalid_status');
    expect((await zeileInDerDatenbank(bewerbungId))?.status).toBe('offen');
  });

  it('ein unbekannter Status -> 400', async () => {
    const { status, body } = await entscheiden(leiter.token, bewerbungId, 'vielleicht');
    expect(status).toBe(400);
    expect(body.error?.code).toBe('invalid_status');
  });

  it('unbekannte Bewerbung -> 404', async () => {
    const { status, body } = await entscheiden(
      leiter.token,
      '00000000-0000-4000-8000-000000000000',
      'angenommen',
    );
    expect(status).toBe(404);
    expect(body.error?.code).toBe('application_not_found');
  });

  it('der Teamleiter entscheidet: 200, Status und Zeitpunkt stehen in der Datenbank', async () => {
    const { status, body } = await entscheiden(leiter.token, bewerbungId, 'angenommen');
    expect(status).toBe(200);
    const entschieden = body.application as BewerbungBody;
    expect(entschieden.status).toBe('angenommen');
    expect(entschieden.decidedAt).not.toBeNull();

    const zeile = await zeileInDerDatenbank(bewerbungId);
    expect(zeile?.status).toBe('angenommen');
    expect(zeile?.decided_at).not.toBeNull();
  });

  it('eine zweite Entscheidung -> 409, und die ERSTE bleibt stehen', async () => {
    const { status, body } = await entscheiden(leiter.token, bewerbungId, 'abgelehnt');
    expect(status).toBe(409);
    expect(body.error?.code).toBe('application_decided');
    expect((await zeileInDerDatenbank(bewerbungId))?.status).toBe('angenommen');
  });

  it('der Bewerber sieht die Entscheidung in seiner eigenen Liste', async () => {
    const { body } = await meineListe(bewerber.token);
    const items = body.items ?? [];
    const eigene = items.find((i) => i.id === bewerbungId) as BewerbungBody;
    expect(eigene.status).toBe('angenommen');
    expect(eigene.decidedAt).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Entscheidung A: 'angenommen' erzeugt KEINE Mitgliedschaft
  // ---------------------------------------------------------------------------
  it("'angenommen' aendert die Bewerbung - und sonst nichts (es gibt keine Mitgliedertabelle)", async () => {
    const tabellen = await sql.unsafe<{ anzahl: string }[]>(
      "SELECT count(*)::text AS anzahl FROM information_schema.tables" +
        " WHERE table_schema = 'public'" +
        "   AND table_name IN ('team_members', 'team_member', 'members', 'team_memberships')",
      [],
    );
    // Die Messung zu A: es gibt keine zweite Wahrheit "Mitgliedschaft".
    expect(Number(tabellen[0]?.anzahl)).toBe(0);

    // Das Team selbst ist unveraendert: der Leiter bleibt der Leiter.
    const team = await sql.unsafe<{ leader_id: string }[]>(
      'SELECT leader_id FROM teams WHERE id = $1',
      [teamId],
    );
    expect(team[0]?.leader_id).toBe(leiter.id);

    // Die Entscheidung hat genau EINE Zeile in genau EINER Tabelle geaendert.
    expect(await zaehleBewerbungen({ teamId, userId: bewerber.id })).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// Zuruecknehmen (Entscheidung C)
// -----------------------------------------------------------------------------

describe('DELETE /api/applications/:id', () => {
  let teamId!: string;
  let leiter!: Nutzer;

  beforeAll(async () => {
    leiter = await neuerNutzer();
    teamId = await neuesTeam(leiter.id);
  });

  it('ohne Sitzung 401', async () => {
    const bewerber = await neuerNutzer();
    const angelegt = await bewerben(bewerber.token, teamId, GUELTIGER_TEXT);
    const id = (angelegt.body.application as BewerbungBody).id;
    const antwort = await app.request('/api/applications/' + id, { method: 'DELETE' });
    expect(antwort.status).toBe(401);
    expect(await zeileInDerDatenbank(id)).not.toBeNull();
  });

  it('der Bewerber nimmt zurueck: 204, die Zeile ist weg', async () => {
    const bewerber = await neuerNutzer();
    const angelegt = await bewerben(bewerber.token, teamId, GUELTIGER_TEXT);
    const id = (angelegt.body.application as BewerbungBody).id;

    const { status } = await zuruecknehmen(bewerber.token, id);
    expect(status).toBe(204);
    expect(await zeileInDerDatenbank(id)).toBeNull();
    expect(await zaehleBewerbungen({ teamId, userId: bewerber.id })).toBe(0);
  });

  it('nach dem Zuruecknehmen ist der Platz frei - eine NEUE Bewerbung gelingt (201)', async () => {
    const bewerber = await neuerNutzer();
    const erste = await bewerben(bewerber.token, teamId, GUELTIGER_TEXT);
    const id = (erste.body.application as BewerbungBody).id;
    expect((await zuruecknehmen(bewerber.token, id)).status).toBe(204);

    const zweite = await bewerben(bewerber.token, teamId, 'Zweite Bewerbung nach dem Zuruecknehmen, lang.');
    expect(zweite.status).toBe(201);
    expect(await zaehleBewerbungen({ teamId, userId: bewerber.id })).toBe(1);
  });

  it('ein FREMDER kann die Bewerbung nicht zuruecknehmen (403)', async () => {
    const bewerber = await neuerNutzer();
    const fremd = await neuerNutzer();
    const angelegt = await bewerben(bewerber.token, teamId, GUELTIGER_TEXT);
    const id = (angelegt.body.application as BewerbungBody).id;

    const { status } = await zuruecknehmen(fremd.token, id);
    expect(status).toBe(403);
    expect(await zeileInDerDatenbank(id)).not.toBeNull();
  });

  it('auch der TEAMLEITER kann eine fremde Bewerbung nicht loeschen (403)', async () => {
    const bewerber = await neuerNutzer();
    const angelegt = await bewerben(bewerber.token, teamId, GUELTIGER_TEXT);
    const id = (angelegt.body.application as BewerbungBody).id;

    const { status } = await zuruecknehmen(leiter.token, id);
    expect(status).toBe(403);
    expect(await zeileInDerDatenbank(id)).not.toBeNull();
  });

  it('eine ENTSCCHIEDENE Bewerbung ist nicht zuruecknehmbar (409)', async () => {
    const bewerber = await neuerNutzer();
    const angelegt = await bewerben(bewerber.token, teamId, GUELTIGER_TEXT);
    const id = (angelegt.body.application as BewerbungBody).id;
    expect((await entscheiden(leiter.token, id, 'abgelehnt')).status).toBe(200);

    const { status } = await zuruecknehmen(bewerber.token, id);
    expect(status).toBe(409);
    // Der Beleg der Entscheidung steht noch.
    const zeile = await zeileInDerDatenbank(id);
    expect(zeile?.status).toBe('abgelehnt');
    expect(zeile?.decided_at).not.toBeNull();
  });

  it('unbekannte Bewerbung -> 404', async () => {
    const { status } = await zuruecknehmen(leiter.token, '00000000-0000-4000-8000-000000000000');
    expect(status).toBe(404);
  });
});

// -----------------------------------------------------------------------------
// Die Regeln des SCHEMAS - an der Anwendung vorbei geprueft
// -----------------------------------------------------------------------------

describe('Die Regeln liegen im Schema, nicht nur in der Anwendung', () => {
  let teamId!: string;

  beforeAll(async () => {
    const leiter = await neuerNutzer();
    teamId = await neuesTeam(leiter.id);
  });

  it('ein zweiter INSERT per SQL -> 23505 (UNIQUE je Nutzer und Team)', async () => {
    const doppelt = await neuerNutzer();
    await sql.unsafe('INSERT INTO team_applications (team_id, user_id, message) VALUES ($1, $2, $3)', [
      teamId,
      doppelt.id,
      GUELTIGER_TEXT,
    ]);
    await expect(
      sql.unsafe('INSERT INTO team_applications (team_id, user_id, message) VALUES ($1, $2, $3)', [
        teamId,
        doppelt.id,
        'Ein zweiter Text, ebenfalls lang genug fuer den CHECK.',
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('ein unbekannter Status per SQL -> 23514 (CHECK)', async () => {
    const nutzer = await neuerNutzer();
    await expect(
      sql.unsafe('INSERT INTO team_applications (team_id, user_id, message, status) VALUES ($1, $2, $3, $4)', [
        teamId,
        nutzer.id,
        GUELTIGER_TEXT,
        'vielleicht',
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('ein zu kurzer Text per SQL -> 23514 (dieselbe Grenze wie im Formular)', async () => {
    const nutzer = await neuerNutzer();
    await expect(
      sql.unsafe('INSERT INTO team_applications (team_id, user_id, message) VALUES ($1, $2, $3)', [
        teamId,
        nutzer.id,
        textMit(19),
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('Status und Entscheidungszeitpunkt gehoeren zusammen - in beide Richtungen', async () => {
    const einer = await neuerNutzer();
    // offen MIT Zeitpunkt.
    await expect(
      sql.unsafe(
        'INSERT INTO team_applications (team_id, user_id, message, status, decided_at) VALUES ($1, $2, $3, $4, now())',
        [teamId, einer.id, GUELTIGER_TEXT, 'offen'],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    // entschieden OHNE Zeitpunkt.
    const anderer = await neuerNutzer();
    await expect(
      sql.unsafe('INSERT INTO team_applications (team_id, user_id, message, status) VALUES ($1, $2, $3, $4)', [
        teamId,
        anderer.id,
        GUELTIGER_TEXT,
        'angenommen',
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('ein unbekanntes Team per SQL -> 23503 (Fremdschluessel)', async () => {
    const nutzer = await neuerNutzer();
    await expect(
      sql.unsafe('INSERT INTO team_applications (team_id, user_id, message) VALUES ($1, $2, $3)', [
        '00000000-0000-4000-8000-000000000000',
        nutzer.id,
        GUELTIGER_TEXT,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('das Loeschen eines Nutzers nimmt seine Bewerbungen mit (ON DELETE CASCADE)', async () => {
    const vergaenglich = await neuerNutzer();
    const angelegt = await bewerben(vergaenglich.token, teamId, GUELTIGER_TEXT);
    const id = (angelegt.body.application as BewerbungBody).id;

    await sql.unsafe('DELETE FROM users WHERE id = $1', [vergaenglich.id]);
    expect(await zeileInDerDatenbank(id)).toBeNull();
  });
});
