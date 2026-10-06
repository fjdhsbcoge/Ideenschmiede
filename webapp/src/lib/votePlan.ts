/**
 * Welche Stimme wohin geht - die Entscheidung, EINE Stelle.
 *
 * WARUM DIESE DATEI EXISTIERT
 * castVote im Store kennt VIER Werte ('up', 'down', 'yes', 'no'), die API nur
 * zwei ('up', 'down'). Und der Store SCHALTET UM (derselbe Wert erneut loescht
 * die Stimme), waehrend die API dafuer ein eigenes DELETE braucht. Eine naive
 * Verdrahtung schickt deshalb entweder eine Meilenstein-Stimme an
 * /api/ideas/:id/vote (Antwort 404) oder sie laesst eine Stimme stehen, die
 * der Nutzer zuruecknehmen wollte.
 *
 * Beides ist hier entschieden - und zwar rein, ohne Netz und ohne React, damit
 * es geprueft werden kann, statt im Browser ausprobiert zu werden.
 */

/** Die vier Werte, die die Oberflaeche kennt. */
export type VoteValue = 'up' | 'down' | 'yes' | 'no';

/** Die zwei, die die API kennt (idea_votes_direction_check). */
export type ApiVoteDirection = 'up' | 'down';

/**
 * Eine Kennung, die eine IDEE bezeichnet: eine UUID.
 *
 * Bewusst nicht 'sieht aus wie eine Kennung': die Meilenstein-Stimmen heissen
 * 'ms-<teamId>-<index>' und wuerden bei einer laxen Pruefung als Idee gelten.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIdeaKey(key: string): boolean {
  return UUID.test(key);
}

/**
 * Uebersetzt einen Wert der Oberflaeche in eine Richtung der API - oder null,
 * wenn es keine gibt.
 *
 * null ist die Antwort fuer 'yes' und 'no': das sind MEILENSTEIN-Stimmen, und
 * dafuer gibt es im Backend keinen Endpunkt. Sie bleiben deshalb im Browser.
 * Das ist keine Endlosloesung, sondern der heutige Stand - und er steht hier
 * ausdruecklich, damit er nicht als Versehen durchgeht.
 */
export function toApiDirection(value: VoteValue): ApiVoteDirection | null {
  if (value === 'up' || value === 'down') return value;
  return null;
}

/** Was zu tun ist, wenn der Nutzer diesen Wert waehlt. */
export type VoteAction =
  | { kind: 'none' }
  | { kind: 'local' }
  | { kind: 'api'; direction: ApiVoteDirection; withdraw: boolean };

/**
 * Die Entscheidung.
 *
 * Reihenfolge, und jede Zeile hat einen Grund:
 *
 *   1. Kein API-Betrieb -> 'local'. Die oeffentliche Seite ohne Backend muss
 *      sich genau wie vorher verhalten; sie kennt keinen Server.
 *   2. Der Schluessel ist keine Idee (Meilenstein) -> 'local'.
 *   3. yes/no -> 'local'. Es gibt keinen Endpunkt (siehe toApiDirection).
 *   4. Derselbe Wert erneut -> 'api' MIT withdraw: die Oberflaeche meint
 *      Umschalten, die API braucht DELETE.
 *   5. Sonst -> 'api' ohne withdraw.
 *
 * Der bereits gewaehlte Wert kommt als `current` herein und NICHT aus dem
 * Speicher: diese Funktion liest nichts, sie entscheidet nur.
 */
export function planVote(options: {
  apiMode: boolean;
  key: string;
  value: VoteValue;
  current: VoteValue | undefined;
}): VoteAction {
  if (!options.apiMode) return { kind: 'local' };
  if (!isIdeaKey(options.key)) return { kind: 'local' };
  const direction = toApiDirection(options.value);
  if (direction === null) return { kind: 'local' };
  return { kind: 'api', direction, withdraw: options.current === options.value };
}
