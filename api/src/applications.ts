/**
 * Bewerbungen auf ein Team - die Endpunkte aus Migration 006.
 *
 *   POST   /api/teams/:id/applications   bewerben (Sitzung noetig) { message }
 *   GET    /api/users/me/applications    die eigenen Bewerbungen (Sitzung noetig)
 *   GET    /api/teams/:id/applications   die Bewerbungen eines Teams (NUR der Teamleiter)
 *   PATCH  /api/applications/:id         entscheiden (NUR der Teamleiter) { status }
 *   DELETE /api/applications/:id         zuruecknehmen (NUR der Bewerber, nur solange offen)
 *
 * Warum diese Datei getrennt von app.ts steht: app.ts wird parallel bearbeitet
 * (Abstimmungen). Die Bewerbungen bringen ihre Routen deshalb selbst mit und
 * werden in app.ts mit EINER Zeile eingehaengt:
 *
 *     app.route('/', createApplicationsApp({ db, auth }));
 *
 * Der Unterbau (Postgres-Pool, Auth-Konfiguration) kommt als Parameter herein,
 * nicht aus dem Kontext: damit haengt diese Datei an KEINEM Variablensatz von
 * app.ts und kann nicht brechen, wenn dort eine Variable hinzukommt.
 *
 * -----------------------------------------------------------------------------
 * Die Zugriffsregel ist der Kern dieser Datei
 * -----------------------------------------------------------------------------
 * Eine Bewerbung ist ein Text ueber eine Person. Wer ihn lesen darf, ist
 * deshalb nicht Geschmackssache:
 *
 *   * lesen (eigene Liste)  - der Bewerber selbst (Sitzung, sonst 401)
 *   * lesen (Teamliste)     - NUR teams.leader_id (sonst 403)
 *   * entscheiden           - NUR teams.leader_id (sonst 403)
 *   * zuruecknehmen         - NUR der Bewerber, und nur solange 'offen' (403/409)
 *
 * Die Regel steht in der Datenbank (teams.leader_id) und wird bei JEDER Anfrage
 * neu gelesen - nicht aus dem Token. Ein Token, das Rechte mitschleppt, waere
 * nach einem Leiterwechsel veraltet, ohne dass es auffiele.
 *
 * -----------------------------------------------------------------------------
 * Namensform (api/CONTRACT.md)
 * -----------------------------------------------------------------------------
 * Gelesen wird snake_case, ausgeliefert wird camelCase und verschachtelt:
 *
 *   team_applications.id         -> application.id
 *   team_applications.status     -> application.status
 *   teams.name                   -> application.team.name
 *   users.username/display_name  -> application.applicant.username/displayName
 *
 * Die drei Statuswerte sind die des Frontends und werden NICHT uebersetzt:
 * 'offen' | 'angenommen' | 'abgelehnt' (webapp/src/lib/store.tsx,
 * webapp/src/lib/i18n/de.ts, pages.common.applicationStatus).
 */
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Sql } from 'postgres';
import {
  AUTH_ERROR_REASONS,
  SESSION_COOKIE_NAME,
  parseSessionToken,
  type AuthConfig,
} from './auth.js';
import { findUserById, type UserRecord } from './authStore.js';

// -----------------------------------------------------------------------------
// Der Wertebereich - die drei Werte des Frontends
// -----------------------------------------------------------------------------

/** Genau die Werte aus team_applications_status_check (Migration 006). */
export const APPLICATION_STATUSES = ['offen', 'angenommen', 'abgelehnt'] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Der Einstieg: jede Bewerbung beginnt unbeantwortet. */
export const INITIAL_APPLICATION_STATUS: ApplicationStatus = 'offen';

/**
 * Die Entscheidungen, die der Teamleiter treffen kann - NICHT 'offen'.
 * "Offen" ist der Ausgangszustand, keine Entscheidung: eine entschiedene
 * Bewerbung wieder aufzumachen wuerde decided_at loeschen und damit den Beleg
 * der Entscheidung (team_applications_decided_at_check).
 */
export const DECIDABLE_APPLICATION_STATUSES = ['angenommen', 'abgelehnt'] as const;

/**
 * Die Laengengrenzen des Bewerbungstextes. Sie stehen hier UND als CHECK in der
 * Datenbank (team_applications_message_check) - hier, damit der Aufrufer eine
 * Begruendung bekommt (400) statt eines Datenbankfehlers, dort, damit die Regel
 * auch fuer jeden Schreibvorgang gilt, der nicht durch diese Datei laeuft.
 *
 * Die Untergrenze ist die Regel des Formulars: JoinTeamModal prueft
 * message.trim().length >= 20, bevor der Knopf aktiv wird.
 */
export const MIN_MESSAGE_LENGTH = 20;
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Die Form einer uuid. Der Ausdruck steht hier, weil dieser Endpunkt die
 * Kennung im PFAD traegt: ohne diese Pruefung wirft PostgreSQL bei "abc" einen
 * Eingabefehler (22P02), und der Aufrufer bekaeme einen 500 fuer einen Fehler,
 * den er selbst gemacht hat.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// -----------------------------------------------------------------------------
// Die ausgelieferte Form
// -----------------------------------------------------------------------------

/**
 * Eine Bewerbung, wie sie die API verlaesst.
 *
 * team und applicant sind OPTIONAL und kommen je Endpunkt hinzu - sie
 * beantworten die Frage, die der jeweilige Leser hat:
 *
 *   * GET /api/users/me/applications  -> team      ("auf welches Team?")
 *   * GET /api/teams/:id/applications -> applicant ("wer bewirbt sich hier?")
 *
 * Der Bewerber erscheint dabei als { id, username, displayName } und NICHT als
 * voller Nutzer: die E-Mail-Adresse geht den Teamleiter nichts an. Eine Antwort
 * ist eine Tatsache ueber die Datenbank - hier die Tatsache, die der Empfaenger
 * zur Entscheidung braucht, und keine Spalte mehr.
 */
export interface TeamApplication {
  id: string;
  teamId: string;
  userId: string;
  status: string;
  message: string;
  /** ISO-8601 mit Z, wie jeder Zeitstempel dieser API. */
  createdAt: string;
  /** ISO-8601 mit Z, oder null solange die Bewerbung offen ist. */
  decidedAt: string | null;
  team?: { id: string; name: string };
  applicant?: { id: string; username: string; displayName: string };
}

/** Die Zeile, wie die Abfragen sie liefern - flach, unter ihren Endnamen. */
interface ApplicationRow {
  id: string;
  teamId: string;
  userId: string;
  status: string;
  message: string;
  createdAt: Date;
  decidedAt: Date | null;
  teamName: string | null;
  applicantUsername: string | null;
  applicantDisplayName: string | null;
}

/** Die Spaltenliste steht einmal - ausdruecklich, nicht als SELECT *. */
const APPLICATION_COLUMNS = [
  'a.id,',
  'a.team_id      AS "teamId",',
  'a.user_id      AS "userId",',
  'a.status,',
  'a.message,',
  'a.created_at   AS "createdAt",',
  'a.decided_at   AS "decidedAt",',
  't.name         AS "teamName",',
  'u.username     AS "applicantUsername",',
  'u.display_name AS "applicantDisplayName"',
].join(' ');

/**
 * Setzt eine Zeile in die ausgelieferte Form um.
 *
 * Zwei Dinge passieren hier, und nur diese zwei: die Zeitstempel werden zu
 * ISO-8601 (Date -> Text, wie toPublicUser in authStore.ts), und die
 * verschachtelten Teile werden zusammengesetzt - aber nur, wenn sie gelesen
 * wurden. Ein team: null waere eine zweite Schreibweise fuer "hier nicht
 * gefragt"; die Felder fehlen deshalb ganz, wie marketplace bei einem Idea ohne
 * Marktplatzphase (app.ts, toIdea).
 */
function toApplication(row: ApplicationRow, mitTeam: boolean, mitBewerber: boolean): TeamApplication {
  const application: TeamApplication = {
    id: row.id,
    teamId: row.teamId,
    userId: row.userId,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
  };

  if (mitTeam) {
    application.team = { id: row.teamId, name: row.teamName ?? '' };
  }
  if (mitBewerber) {
    application.applicant = {
      id: row.userId,
      username: row.applicantUsername ?? '',
      displayName: row.applicantDisplayName ?? '',
    };
  }

  return application;
}

// -----------------------------------------------------------------------------
// Die Routen
// -----------------------------------------------------------------------------

export interface ApplicationsDeps {
  /** Der Verbindungspool (src/db.ts). */
  readonly db: Sql;
  /** Geheimnis und Uhr der Sitzungspruefung (src/auth.ts). */
  readonly auth: AuthConfig;
}

/** Eine Zeile aus teams, soweit sie hier gebraucht wird. */
interface TeamRow {
  id: string;
  leaderId: string;
}

export function createApplicationsApp(deps: ApplicationsDeps): Hono {
  const { db, auth } = deps;
  const app = new Hono();

  // ---------------------------------------------------------------------------
  // POST /api/teams/:id/applications - bewerben
  // ---------------------------------------------------------------------------
  // Rumpf: { "message": "..." }. Die Sitzung ist Pflicht: ohne sie gaebe es
  // keinen Bewerber, und eine Bewerbung ohne Bewerber ist keine.
  //
  // Eine ZWEITE Bewerbung auf dasselbe Team ist nicht moeglich - die
  // UNIQUE-Constraint team_applications_one_per_user_key laesst nur eine Zeile
  // zu. Der Versuch endet mit 409 und NICHT mit einem stillen Zuruecksetzen der
  // bestehenden Zeile: das Frontend deaktiviert den Knopf, sobald eine Bewerbung
  // existiert (TeamDetail.tsx: disabled={!!myApp}), und ein Zuruecksetzen wuerde
  // die Ablehnung des Teamleiters loeschen, ohne dass das jemand entschieden
  // haette. Wer wieder bewerben will, nimmt die bestehende zurueck (DELETE).
  //
  // Den Konflikt entscheidet die DATENBANK: ON CONFLICT ... DO NOTHING ist
  // dieselbe Haltung wie insertAuthIdentity() in authStore.ts. Ein vorheriges
  // SELECT haette ein Zeitfenster, in dem zwei gleichzeitige Aufrufe beide
  // "frei" sehen.
  app.post('/api/teams/:id/applications', async (c) => {
    const nutzer = await currentUser(c, db, auth);
    if (nutzer === null) {
      return unauthorized(c);
    }

    const teamId = c.req.param('id');
    if (!UUID_PATTERN.test(teamId)) {
      return fail(c, 400, 'invalid_id', 'Die Team-Kennung ist keine uuid.');
    }

    // Der Koerper kommt VOR dem Schreiben: eine Bewerbung ohne Text ist keine.
    let body: Record<string, unknown>;
    try {
      body = await readJsonObject(c.req.raw);
    } catch (error) {
      return fail(c, 400, 'invalid_body', error instanceof Error ? error.message : String(error));
    }

    const message = typeof body.message === 'string' ? body.message : '';
    const laenge = message.trim().length;
    if (laenge < MIN_MESSAGE_LENGTH || laenge > MAX_MESSAGE_LENGTH) {
      // Die gemessene Laenge steht in der Antwort: der Aufrufer soll nicht
      // raten muessen, warum seine Bewerbung abgewiesen wurde.
      return fail(
        c,
        400,
        'invalid_message',
        'Der Bewerbungstext muss ' +
          MIN_MESSAGE_LENGTH +
          ' bis ' +
          MAX_MESSAGE_LENGTH +
          ' Zeichen enthalten (erhalten: ' +
          laenge +
          ').',
      );
    }

    // Die Teamzeile wird gelesen, damit "unbekanntes Team" eine eigene Antwort
    // bekommt (404) statt eines Fremdschluesselfehlers (23503 -> 500). Der
    // Leiter wird hier NICHT geprueft: bewerben darf sich jeder.
    const teams = await db<TeamRow[]>`
        SELECT id, leader_id AS "leaderId" FROM teams WHERE id = ${teamId}
    `;
    if (teams[0] === undefined) {
      return fail(c, 404, 'team_not_found', 'Es gibt kein Team mit dieser Kennung.');
    }

    const rows = await db<ApplicationRow[]>`
        INSERT INTO team_applications (team_id, user_id, message, status)
        VALUES (${teamId}, ${nutzer.id}, ${message}, ${INITIAL_APPLICATION_STATUS})
        ON CONFLICT (team_id, user_id) DO NOTHING
        RETURNING id,
                  team_id      AS "teamId",
                  user_id      AS "userId",
                  status,
                  message,
                  created_at   AS "createdAt",
                  decided_at   AS "decidedAt",
                  NULL::text   AS "teamName",
                  NULL::text   AS "applicantUsername",
                  NULL::text   AS "applicantDisplayName"
    `;

    const zeile = rows[0];
    if (zeile === undefined) {
      // Kein Fehler, sondern ein Ergebnis: es gibt bereits eine Bewerbung
      // dieses Nutzers auf dieses Team.
      return fail(
        c,
        409,
        'application_exists',
        'Fuer dieses Team liegt bereits eine Bewerbung vor. Sie kann zurueckgenommen und danach neu gestellt werden.',
      );
    }

    return c.json({ application: toApplication(zeile, false, false) }, 201);
  });

  // ---------------------------------------------------------------------------
  // GET /api/users/me/applications - die eigenen Bewerbungen
  // ---------------------------------------------------------------------------
  // Ohne limit/offset: die Liste ist durch die Zahl der Teams begrenzt, auf die
  // sich EIN Nutzer beworben haben kann (eine Zeile je Nutzer und Team). Eine
  // Blattform waere hier eine zweite Form derselben vollstaendigen Liste.
  app.get('/api/users/me/applications', async (c) => {
    const nutzer = await currentUser(c, db, auth);
    if (nutzer === null) {
      return unauthorized(c);
    }

    const rows = await db<ApplicationRow[]>`
        SELECT ${db.unsafe(APPLICATION_COLUMNS)}
          FROM team_applications a
          JOIN teams t ON t.id = a.team_id
          LEFT JOIN users u ON u.id = a.user_id
         WHERE a.user_id = ${nutzer.id}
         ORDER BY a.created_at DESC, a.id DESC
    `;

    const items = rows.map((row) => toApplication(row, true, false));
    return c.json({ items, count: items.length });
  });

  // ---------------------------------------------------------------------------
  // GET /api/teams/:id/applications - die Bewerbungen eines Teams
  // ---------------------------------------------------------------------------
  // NUR der Teamleiter (teams.leader_id). Alle anderen bekommen 403 - auch
  // Mitglieder, auch Abonnenten, auch der Bewerber selbst. Eine Bewerbung ist
  // ein Text ueber eine Person; die Liste ist keine oeffentliche Auskunft.
  app.get('/api/teams/:id/applications', async (c) => {
    const nutzer = await currentUser(c, db, auth);
    if (nutzer === null) {
      return unauthorized(c);
    }

    const teamId = c.req.param('id');
    if (!UUID_PATTERN.test(teamId)) {
      return fail(c, 400, 'invalid_id', 'Die Team-Kennung ist keine uuid.');
    }

    const teams = await db<TeamRow[]>`
        SELECT id, leader_id AS "leaderId" FROM teams WHERE id = ${teamId}
    `;
    const team = teams[0];
    if (team === undefined) {
      return fail(c, 404, 'team_not_found', 'Es gibt kein Team mit dieser Kennung.');
    }
    if (team.leaderId !== nutzer.id) {
      return fail(c, 403, 'not_team_leader', 'Nur der Teamleiter sieht die Bewerbungen seines Teams.');
    }

    const rows = await db<ApplicationRow[]>`
        SELECT ${db.unsafe(APPLICATION_COLUMNS)}
          FROM team_applications a
          JOIN teams t ON t.id = a.team_id
          LEFT JOIN users u ON u.id = a.user_id
         WHERE a.team_id = ${teamId}
         ORDER BY a.created_at DESC, a.id DESC
    `;

    const items = rows.map((row) => toApplication(row, false, true));
    return c.json({ items, count: items.length });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/applications/:id - entscheiden
  // ---------------------------------------------------------------------------
  // Rumpf: { "status": "angenommen" | "abgelehnt" }. Nur der Teamleiter.
  //
  // Entschieden wird GENAU EINMAL: der Uebergang ist 'offen' -> 'angenommen'
  // oder 'offen' -> 'abgelehnt', und er steht als Bedingung IM UPDATE
  // (WHERE status = 'offen') - dieselbe Haltung wie der Statuswechsel der
  // Zahlungsabsicht in Migration 003 und wie consumeChallenge() in
  // authStore.ts. Wer keine Zeile zurueckbekommt, hat nicht entschieden; bei
  // zwei gleichzeitigen Aufrufen gewinnt die Datenbank, nicht die Anwendung.
  //
  // Eine bereits entschiedene Bewerbung umzustimmen ist damit ebenfalls
  // ausgeschlossen (409): eine Entscheidung ist ein Vorgang mit Zeitpunkt
  // (decided_at), kein Schalter. Auch das Frontend kennt nur diesen einen
  // Schritt - es zeigt die beiden Knoepfe nur bei status 'offen'.
  app.patch('/api/applications/:id', async (c) => {
    const nutzer = await currentUser(c, db, auth);
    if (nutzer === null) {
      return unauthorized(c);
    }

    const id = c.req.param('id');
    if (!UUID_PATTERN.test(id)) {
      return fail(c, 400, 'invalid_id', 'Die Bewerbungs-Kennung ist keine uuid.');
    }

    let body: Record<string, unknown>;
    try {
      body = await readJsonObject(c.req.raw);
    } catch (error) {
      return fail(c, 400, 'invalid_body', error instanceof Error ? error.message : String(error));
    }

    const status = body.status;
    if (!istEntscheidung(status)) {
      return fail(
        c,
        400,
        'invalid_status',
        'Erlaubt sind ' +
          DECIDABLE_APPLICATION_STATUSES.join(' und ') +
          " - 'offen' ist der Ausgangszustand, keine Entscheidung.",
      );
    }

    // Erst lesen, dann entscheiden: 404 (gibt es nicht) und 403 (geht dich
    // nichts an) sind verschiedene Auskuenfte, und die Zugriffspruefung darf
    // nicht von der Reihenfolge der Schreibvorgaenge abhaengen.
    const vorhanden = await db<{ id: string; status: string; leaderId: string }[]>`
        SELECT a.id, a.status, t.leader_id AS "leaderId"
          FROM team_applications a
          JOIN teams t ON t.id = a.team_id
         WHERE a.id = ${id}
    `;
    const bewerbung = vorhanden[0];
    if (bewerbung === undefined) {
      return fail(c, 404, 'application_not_found', 'Es gibt keine Bewerbung mit dieser Kennung.');
    }
    if (bewerbung.leaderId !== nutzer.id) {
      // WICHTIG: vor der Statuspruefung. Ein Fremder soll nicht einmal
      // erfahren, ob die Bewerbung noch offen ist.
      return fail(c, 403, 'not_team_leader', 'Nur der Teamleiter entscheidet ueber Bewerbungen seines Teams.');
    }

    const aktualisiert = await db<ApplicationRow[]>`
        UPDATE team_applications
           SET status = ${status}, decided_at = now()
         WHERE id = ${id} AND status = ${INITIAL_APPLICATION_STATUS}
        RETURNING id,
                  team_id      AS "teamId",
                  user_id      AS "userId",
                  status,
                  message,
                  created_at   AS "createdAt",
                  decided_at   AS "decidedAt",
                  NULL::text   AS "teamName",
                  NULL::text   AS "applicantUsername",
                  NULL::text   AS "applicantDisplayName"
    `;

    const zeile = aktualisiert[0];
    if (zeile === undefined) {
      return fail(
        c,
        409,
        'application_decided',
        'Diese Bewerbung ist bereits entschieden (Status: ' + bewerbung.status + ').',
      );
    }

    return c.json({ application: toApplication(zeile, false, false) });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/applications/:id - zuruecknehmen
  // ---------------------------------------------------------------------------
  // Nur der Bewerber selbst - und nur, solange die Bewerbung offen ist. Das
  // Frontend bietet den Knopf genau dann an (Teams.tsx: a.status === 'offen'),
  // und er entfernt die Zeile ganz (store.tsx, withdrawApplication). Danach ist
  // der Platz aus team_applications_one_per_user_key wieder frei.
  //
  // Eine entschiedene Bewerbung ist NICHT zuruecknehmbar (409): sie ist das
  // Ergebnis der Entscheidung des Teamleiters, und dieses Ergebnis darf der
  // Bewerber nicht loeschen. Der Teamleiter darf sie ebenfalls nicht loeschen -
  // er entscheidet, er raeumt nicht auf (403).
  app.delete('/api/applications/:id', async (c) => {
    const nutzer = await currentUser(c, db, auth);
    if (nutzer === null) {
      return unauthorized(c);
    }

    const id = c.req.param('id');
    if (!UUID_PATTERN.test(id)) {
      return fail(c, 400, 'invalid_id', 'Die Bewerbungs-Kennung ist keine uuid.');
    }

    const vorhanden = await db<{ id: string; userId: string; status: string }[]>`
        SELECT id, user_id AS "userId", status FROM team_applications WHERE id = ${id}
    `;
    const bewerbung = vorhanden[0];
    if (bewerbung === undefined) {
      return fail(c, 404, 'application_not_found', 'Es gibt keine Bewerbung mit dieser Kennung.');
    }
    if (bewerbung.userId !== nutzer.id) {
      return fail(c, 403, 'not_applicant', 'Nur der Bewerber selbst kann seine Bewerbung zuruecknehmen.');
    }

    // Bedingtes DELETE statt DELETE: der Status ist Teil der Bedingung, damit
    // eine Entscheidung, die zwischen Lesen und Loeschen faellt, nicht
    // mitgeloescht wird.
    const geloescht = await db<{ id: string }[]>`
        DELETE FROM team_applications
         WHERE id = ${id}
           AND user_id = ${nutzer.id}
           AND status = ${INITIAL_APPLICATION_STATUS}
        RETURNING id
    `;
    if (geloescht[0] === undefined) {
      return fail(
        c,
        409,
        'application_decided',
        'Eine entschiedene Bewerbung (Status: ' + bewerbung.status + ') kann nicht zurueckgenommen werden.',
      );
    }

    return c.body(null, 204);
  });

  return app;
}

// -----------------------------------------------------------------------------
// Sitzung und Antwortformen
// -----------------------------------------------------------------------------

/**
 * Der angemeldete Nutzer, oder null.
 *
 * Genau wie currentUser() in app.ts (GET /api/users/me): das Token kommt aus
 * dem Cookie ODER aus dem Authorization-Kopf, wird gegen das Geheimnis geprueft
 * (Signatur UND Ablauf, parseSessionToken), und der Nutzer wird danach aus der
 * DATENBANK gelesen. Ein geloeschter Nutzer hat damit sofort keine Sitzung
 * mehr - das Token allein genuegt nicht.
 */
async function currentUser(c: Context, db: Sql, auth: AuthConfig): Promise<UserRecord | null> {
  const ausCookie = getCookie(c, SESSION_COOKIE_NAME);
  let token = ausCookie !== undefined && ausCookie !== '' ? ausCookie : null;

  if (token === null) {
    const kopf = c.req.header('authorization');
    if (kopf !== undefined && kopf.startsWith('Bearer ')) {
      const rest = kopf.slice('Bearer '.length).trim();
      token = rest === '' ? null : rest;
    }
  }
  if (token === null) {
    return null;
  }

  const session = parseSessionToken(token, auth);
  if (session === null) {
    return null;
  }
  return findUserById(db, session.userId);
}

/**
 * 401 in der Form der Anmeldung: { status: 'ERROR', reason } - dieselbe Antwort
 * wie GET /api/users/me ohne Sitzung (authFailure in app.ts). Die uebrigen
 * Fehler dieser Datei tragen die Form der Geschaeftsfehler,
 * { error: { code, message } } (wie der Webhook und der 404-Handler in app.ts).
 * Zwei Formen, weil zwei Leser: ein Client, der die Sitzung erneuern soll,
 * erkennt den Auth-Fall am reason - ein Client, der einen Konflikt aufloesen
 * soll, am code.
 */
function unauthorized(c: Context): Response {
  return c.json({ status: 'ERROR', reason: AUTH_ERROR_REASONS.unauthorized }, 401);
}

function fail(c: Context, status: ContentfulStatusCode, code: string, message: string): Response {
  return c.json({ error: { code, message } }, status);
}

/** Ist der Wert eine Entscheidung des Teamleiters? */
function istEntscheidung(value: unknown): value is (typeof DECIDABLE_APPLICATION_STATUSES)[number] {
  return (DECIDABLE_APPLICATION_STATUSES as readonly unknown[]).includes(value);
}

/**
 * Der Anfragekoerper als JSON-Objekt. Ein leerer Koerper ist hier ein Fehler
 * (anders als bei POST /api/auth/challenge, wo action=login die Vorgabe ist):
 * ohne Text gibt es nichts zu bewerben, ohne status nichts zu entscheiden.
 */
async function readJsonObject(req: globalThis.Request): Promise<Record<string, unknown>> {
  const text = (await req.text()).trim();
  if (text === '') {
    throw new Error('Es wird ein JSON-Objekt erwartet.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Der Anfragekoerper ist kein gueltiges JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Der Anfragekoerper muss ein JSON-Objekt sein.');
  }
  return parsed as Record<string, unknown>;
}
