/**
 * Stimmen auf Ideen (ADR-003) - die Datenbankseite.
 *
 * Diese Datei enthaelt KEINEN HTTP-Kram: sie kennt nur die Datenbank und die
 * Fehler, die aus ihr kommen. Die drei Routen stehen in src/app.ts, weil dort
 * auch die Sitzung gelesen wird (currentUser, genau wie GET /api/users/me).
 *
 * -----------------------------------------------------------------------------
 * Was hier NICHT passiert
 * -----------------------------------------------------------------------------
 * Die Zaehler ideas.vote_up / ideas.vote_down werden NIRGENDS in dieser Datei
 * geschrieben. Sie sind eine Ableitung aus idea_votes, und der einzige Schreiber
 * ist der Trigger idea_votes_sync_counters_trg (001_init.sql ab Zeile 805): er
 * zaehlt nach jedem INSERT/UPDATE/DELETE die betroffene Idee vollstaendig neu.
 * Eine Anwendung, die dieselben Zahlen selbst fortschreibt, haette zwei
 * Wahrheiten und damit frueher oder spaeter eine falsche.
 *
 * Gelesen werden die Zaehler dagegen sehr wohl - aber erst NACH dem Schreiben
 * und aus ideas. Die Antwort ist damit eine Tatsache ueber die Datenbank und
 * nicht die Behauptung der Anwendung, was sie gerade getan habe.
 *
 * -----------------------------------------------------------------------------
 * Warum eine Aenderung ein UPDATE ist und kein zweiter INSERT (Frage A)
 * -----------------------------------------------------------------------------
 * idea_votes_one_per_user_key UNIQUE (idea_id, user_id) laesst je Nutzer genau
 * EINE Zeile zu. "Anders abstimmen" kann deshalb nur heissen: dieselbe Zeile
 * bekommt eine andere direction. Die Alternative - die zweite Stimme mit 409
 * abweisen - waere ein Endpunkt, der etwas verweigert, was das Schema
 * ausdruecklich erlaubt: der BEFORE-Trigger idea_votes_assign_subscription kehrt
 * im UPDATE-Zweig ausdruecklich frueh zurueck (001_init.sql ab Zeile 756,
 * "'direction' umzudrehen ist erlaubt").
 *
 * Der Beleg subscription_id bleibt dabei UNVERAENDERT: der Trigger weist jede
 * Aenderung daran mit 23514 ab. Die Stimme bleibt also auf das Abonnement
 * bezogen, das sie gedeckt hat - auch wenn dieses laengst abgelaufen ist. Genau
 * das macht sie nachpruefbar (Entscheidung 2: subscriptions behaelt Historie).
 *
 * -----------------------------------------------------------------------------
 * Warum hier zwei Anweisungen stehen und nicht ein Upsert (gemessen, nicht geraten)
 * -----------------------------------------------------------------------------
 * Der naheliegende Weg waere
 *     INSERT ... ON CONFLICT (idea_id, user_id) DO UPDATE SET direction = ...
 * Er ist FALSCH. PostgreSQL fuehrt den BEFORE-INSERT-Trigger aus, BEVOR es den
 * Konflikt feststellt (deshalb sind die Werte aus EXCLUDED auch die vom Trigger
 * veraenderten). Bei abgelaufenem Abonnement wirft
 * idea_votes_assign_subscription daher schon fuer die INSERT-Haelfte:
 *
 *     gemessen: INSERT ... ON CONFLICT DO UPDATE bei abgelaufenem Abo
 *               -> 23514 'ADR-003: Stimmrecht erfordert ein aktives Abonnement'
 *
 * Obwohl die Aenderung selbst erlaubt waere (der UPDATE-Zweig des Triggers
 * prueft kein Abonnement), waere sie ueber diesen Weg unmoeglich. Deshalb wird
 * der UPDATE-Zweig AUSDRUECKLICH zuerst gegangen - und nur, wenn es wirklich
 * noch keine Zeile gibt, wird eingefuegt. Dort greift die Abo-Pruefung, und dort
 * gehoert sie hin: eine NEUE Stimme braucht ein Stimmrecht.
 */
import type { Sql } from 'postgres';

/** Die beiden erlaubten Richtungen - dieselben Werte wie idea_votes_direction_check. */
export const VOTE_DIRECTIONS = ['up', 'down'] as const;
export type VoteDirection = (typeof VOTE_DIRECTIONS)[number];

export function isVoteDirection(value: unknown): value is VoteDirection {
  return value === 'up' || value === 'down';
}

/**
 * Die Zahl der Stimmen einer Idee - genau die Form, in der
 * GET /api/ideas/:id/votes antwortet. Zwei Zahlen, sonst nichts; verschachtelt
 * ist hier nichts zu verschachteln.
 */
export interface VoteCounts {
  voteUp: number;
  voteDown: number;
}

/**
 * Die Fehler, die diese Datei nach aussen kennt. Jeder traegt seinen HTTP-Status
 * MIT sich: die Entscheidung "welcher Status" gehoert zur Ursache und nicht in
 * die Route, wo sie bei der naechsten Aenderung auseinanderliefe.
 */
export type VoteErrorCode = 'invalid_id' | 'idea_not_found' | 'vote_requires_subscription';

export class VoteError extends Error {
  readonly code: VoteErrorCode;
  readonly status: 400 | 403 | 404;

  constructor(code: VoteErrorCode, status: 400 | 403 | 404, message: string) {
    super(message);
    this.name = 'VoteError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Der Wortlaut des Triggers (001_init.sql, Zeile 783). Er wird hier NICHT
 * erfunden, sondern abgeglichen: 23514 ist die Klasse "check_violation", und die
 * traegt in dieser Tabelle ZWEI Bedeutungen - die fehlende Stimmberechtigung und
 * den unveraenderlichen Beleg. Nur die erste ist eine Auskunft an den Nutzer;
 * die zweite waere ein Fehler UNSERES Codes und muss als 500 herauskommen.
 */
const NO_SUBSCRIPTION_MESSAGE = 'ADR-003: Stimmrecht erfordert ein aktives Abonnement';

/** SQLSTATE der verletzten CHECK-Regel (so wirft der Trigger: USING ERRCODE). */
const CHECK_VIOLATION = '23514';
/** SQLSTATE des verletzten UNIQUE-Index (idea_votes_one_per_user_key). */
const UNIQUE_VIOLATION = '23505';
/** SQLSTATE des verletzten Fremdschluessels (Idee gibt es nicht oder nicht mehr). */
const FOREIGN_KEY_VIOLATION = '23503';

/** Ein Fehler des Treibers mit SQLSTATE - die Form, die postgres.js wirft. */
function sqlStateOf(error: unknown): string | null {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * "Dieser Nutzer hat kein aktives Abonnement" - erkannt an SQLSTATE UND
 * Wortlaut. Beides zusammen, weil 23514 in dieser Tabelle auch der
 * unveraenderliche Beleg ist (siehe oben): ein Muster wie /ADR-003/ allein
 * wuerde beide Faelle zu einem 403 machen und einen Fehler in unserem Code als
 * Auskunft an den Nutzer ausgeben.
 */
function isMissingSubscription(error: unknown): boolean {
  return sqlStateOf(error) === CHECK_VIOLATION && messageOf(error).includes(NO_SUBSCRIPTION_MESSAGE);
}

function isUniqueViolation(error: unknown): boolean {
  return sqlStateOf(error) === UNIQUE_VIOLATION;
}

function isForeignKeyViolation(error: unknown): boolean {
  return sqlStateOf(error) === FOREIGN_KEY_VIOLATION;
}

/**
 * Eine UUID, wie PostgreSQL sie schreibt. Geprueft wird VOR der Abfrage: ein
 * ungueltiger uuid-Wert liesse PostgreSQL mit 22P02 scheitern, und das waere ein
 * 500 fuer einen Aufruferfehler. 400 ist die richtige Auskunft.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

/** Gibt es diese Idee? Eine Abfrage auf den Primaerschluessel, sonst nichts. */
async function ideaExists(db: Sql, ideaId: string): Promise<boolean> {
  const rows = await db<{ id: string }[]>`SELECT id FROM ideas WHERE id = ${ideaId}`;
  return rows.length > 0;
}

/**
 * Die Zaehler, wie sie in der Datenbank STEHEN - nicht, wie sie stehen sollten.
 * Quelle ist ideas (vom Trigger gepflegt), nicht die Antwort des Schreibbefehls.
 */
async function countsOf(db: Sql, ideaId: string): Promise<VoteCounts> {
  const rows = await db<{ voteUp: number; voteDown: number }[]>`
    SELECT vote_up AS "voteUp", vote_down AS "voteDown" FROM ideas WHERE id = ${ideaId}`;
  const row = rows[0];
  if (row === undefined) {
    // Zwischen Schreiben und Lesen geloescht (ON DELETE CASCADE nimmt die Stimme
    // mit). Kein 500: die Idee gibt es nicht mehr, und das ist ein 404.
    throw new VoteError('idea_not_found', 404, 'Diese Idee gibt es nicht.');
  }
  return { voteUp: row.voteUp, voteDown: row.voteDown };
}

/**
 * Schreibt die Stimme: erst die bestehende aendern, sonst eine neue anlegen.
 *
 * Die Reihenfolge ist der Kern dieser Datei (siehe Kopfkommentar): der
 * UPDATE-Zweig ist der einzige, der bei abgelaufenem Abonnement noch durchgeht.
 */
async function writeVote(
  db: Sql,
  ideaId: string,
  userId: string,
  direction: VoteDirection,
): Promise<void> {
  // 1. Bestehende Stimme auf eine ANDERE Richtung umschreiben. Die Bedingung
  //    direction <> ${direction} haelt updated_at ehrlich: wer dieselbe Stimme
  //    zweimal abgibt, aendert nichts - dann soll auch kein Zeitstempel
  //    behaupten, es sei etwas geschehen.
  const geaendert = await db<{ id: string }[]>`
    UPDATE idea_votes
       SET direction = ${direction}, updated_at = now()
     WHERE idea_id = ${ideaId} AND user_id = ${userId} AND direction <> ${direction}
    RETURNING id`;
  if (geaendert.length > 0) {
    return;
  }

  // 2. Nichts geaendert: entweder steht die Stimme schon genau so da, oder es
  //    gibt noch keine. Das muss unterschieden werden, BEVOR eingefuegt wird -
  //    ein INSERT auf eine vorhandene Zeile liefe zuerst in den
  //    BEFORE-INSERT-Trigger (siehe Kopfkommentar) und scheiterte bei
  //    abgelaufenem Abonnement mit 403, obwohl die Stimme laengst existiert.
  if (await voteExists(db, ideaId, userId)) {
    return;
  }

  // 3. Erste Stimme dieses Nutzers auf diese Idee. Hier - und nur hier - prueft
  //    der Trigger das Stimmrecht (ADR-003).
  try {
    await db`
      INSERT INTO idea_votes (idea_id, user_id, direction)
      VALUES (${ideaId}, ${userId}, ${direction})`;
  } catch (error) {
    // Wettlauf: zwei Anfragen desselben Nutzers waren gleichzeitig hier. Der
    // Verlierer zieht dieselbe Aenderung nach - die Zeile gibt es ja jetzt.
    if (isUniqueViolation(error)) {
      await db`
        UPDATE idea_votes SET direction = ${direction}, updated_at = now()
         WHERE idea_id = ${ideaId} AND user_id = ${userId}`;
      return;
    }
    throw error;
  }
}

/** Hat dieser Nutzer schon eine Stimme auf diese Idee? */
async function voteExists(db: Sql, ideaId: string, userId: string): Promise<boolean> {
  const rows = await db<{ id: string }[]>`
    SELECT id FROM idea_votes WHERE idea_id = ${ideaId} AND user_id = ${userId}`;
  return rows.length > 0;
}

/**
 * POST /api/ideas/:id/vote - Stimme abgeben oder aendern.
 *
 * Idempotent in beide Richtungen: zweimal 'up' ist dieselbe Stimme, und 'up'
 * nach 'down' ist eine Aenderung, keine zweite Zeile.
 *
 * Gibt die Zaehler zurueck, wie sie danach in ideas stehen.
 */
export async function castVote(
  db: Sql,
  ideaId: string,
  userId: string,
  direction: VoteDirection,
): Promise<VoteCounts> {
  if (!isUuid(ideaId)) {
    throw new VoteError('invalid_id', 400, 'Die Idee-ID muss eine UUID sein.');
  }
  if (!(await ideaExists(db, ideaId))) {
    throw new VoteError('idea_not_found', 404, 'Diese Idee gibt es nicht.');
  }

  try {
    await writeVote(db, ideaId, userId, direction);
  } catch (error) {
    if (isMissingSubscription(error)) {
      throw new VoteError(
        'vote_requires_subscription',
        403,
        'Stimmrecht erfordert ein aktives Abonnement (ADR-003).',
      );
    }
    // Die Idee wurde zwischen Pruefung und Schreiben geloescht.
    if (isForeignKeyViolation(error)) {
      throw new VoteError('idea_not_found', 404, 'Diese Idee gibt es nicht.');
    }
    throw error;
  }

  return countsOf(db, ideaId);
}

/**
 * DELETE /api/ideas/:id/vote - eigene Stimme zuruecknehmen.
 *
 * Ohne eigene Stimme ist das KEIN Fehler: der gewuenschte Zustand - dieser
 * Nutzer hat hier nicht gestimmt - ist danach erreicht, einerlei ob er vorher
 * bestand. Ein 404 waere eine Auskunft ueber die Vergangenheit, die der
 * Aufrufer nicht erfragt hat.
 *
 * Ein Abonnement braucht die Ruecknahme nicht: der Trigger hat keinen
 * BEFORE-DELETE-Zweig (001_init.sql ab Zeile 742, "DELETE bleibt frei"). Wer
 * sein Abonnement verliert, verliert damit nicht das Recht, seine Stimme
 * zurueckzuziehen.
 */
export async function withdrawVote(db: Sql, ideaId: string, userId: string): Promise<VoteCounts> {
  if (!isUuid(ideaId)) {
    throw new VoteError('invalid_id', 400, 'Die Idee-ID muss eine UUID sein.');
  }
  if (!(await ideaExists(db, ideaId))) {
    throw new VoteError('idea_not_found', 404, 'Diese Idee gibt es nicht.');
  }

  await db`DELETE FROM idea_votes WHERE idea_id = ${ideaId} AND user_id = ${userId}`;
  return countsOf(db, ideaId);
}

/**
 * GET /api/ideas/:id/votes - oeffentlich. null heisst: diese Idee gibt es nicht
 * (die Route macht daraus ein 404, damit "keine Stimmen" und "keine Idee" nicht
 * dieselbe Antwort bekommen).
 */
export async function readVotes(db: Sql, ideaId: string): Promise<VoteCounts | null> {
  if (!isUuid(ideaId)) {
    throw new VoteError('invalid_id', 400, 'Die Idee-ID muss eine UUID sein.');
  }
  const rows = await db<{ voteUp: number; voteDown: number }[]>`
    SELECT vote_up AS "voteUp", vote_down AS "voteDown" FROM ideas WHERE id = ${ideaId}`;
  const row = rows[0];
  return row === undefined ? null : { voteUp: row.voteUp, voteDown: row.voteDown };
}
