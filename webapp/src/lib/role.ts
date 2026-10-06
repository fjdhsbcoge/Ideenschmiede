/**
 * Die Rolle eines Nutzers - die eine Stelle, an der sie entsteht.
 *
 * WARUM DIESE DATEI EXISTIERT
 * Der Store las die Rolle bisher aus localStorage ('ideenschmiede_role').
 * Diesen Wert kann JEDER im Browser setzen: die Pruefung, wer kommentieren,
 * abstimmen und investieren darf, war damit eine Bitte und keine Regel.
 * Nach ADR-003 haengt das Stimmrecht an einem aktiven Abonnement; der Server
 * setzt das durch (gemessen: neue Stimme ohne Abo ergibt HTTP 403
 * vote_requires_subscription). Das Frontend muss dieselbe Antwort geben.
 *
 * WARUM NICHT EINFACH DURCHREICHEN
 * Die API liefert `role` als Zeichenkette. Waere sie frei, machte ein Tippfehler
 * im Backend aus 'subscriber' ein 'Subscriber' - und das Frontend zeigte
 * stillschweigend einen Besucher, ohne dass etwas fehlschlaegt. Ein unbekannter
 * Wert ergibt deshalb 'visitor', also die Rechte des Geringsten.
 *
 * WAS DAS BACKEND WIRKLICH LIEFERT (nachgemessen am 06.10.2026, nicht geraten):
 *   frischer Nutzer ohne Abonnement        -> visitor
 *   aktives Abonnement                     -> subscriber
 *   Abonnement inaktiv oder abgelaufen     -> user
 * Der Trigger users_derive_role_trg setzt das; die Anwendung schreibt die
 * Spalte nie selbst.
 */

/** Dieselben drei Werte wie in lib/store.tsx. */
export type Role = 'visitor' | 'user' | 'subscriber';

/** Ist das eine der drei Rollen? */
export function isRole(value: unknown): value is Role {
  return value === 'visitor' || value === 'user' || value === 'subscriber';
}

/**
 * Die Rolle aus der Antwort der API.
 *
 * Ein unbekannter oder fehlender Wert ergibt 'visitor' - die sichere Richtung.
 * Eine Ausnahme mit Meldung waere hier falsch: eine Anmeldung soll nicht daran
 * scheitern, dass das Backend eine Rolle kennt, die das Frontend noch nicht
 * kennt. Die Anzeige ist dann zu streng, nicht zu lax.
 */
export function roleFromApi(value: unknown): Role {
  return isRole(value) ? value : 'visitor';
}

/**
 * Darf diese Rolle die Handlung? - dieselbe Regel wie can() im Store.
 *
 * Steht hier und nicht mehr nur im Store, weil sie die zweite Haelfte derselben
 * Entscheidung ist: die Rolle kommt vom Server, und was sie darf, muss dazu
 * passen. Getrennt liessen sich beide aendern, ohne dass es auffiele.
 */
export function canRole(role: Role, action: string): boolean {
  switch (action) {
    case 'read':
      return true;
    case 'post':
    case 'comment':
      return role === 'user' || role === 'subscriber';
    case 'vote':
    case 'invest':
    case 'teams':
    case 'marketplace':
      return role === 'subscriber';
    default:
      // Unbekannte Handlung: Nein. Wer eine neue Handlung einfuehrt, muss sie
      // hier eintragen - sonst ist sie versehentlich fuer alle gesperrt, und
      // das faellt beim Ausprobieren sofort auf.
      return false;
  }
}
