/**
 * Bewerbungen: die Formen der API und die der Ansicht - und die Uebersetzung.
 *
 * WARUM DIESE DATEI EXISTIERT
 * Die beiden Formen unterscheiden sich an vier Stellen, und jede ist eine
 * stille Falle:
 *
 *   API                          Ansicht (MyApplication)
 *   team.name                    teamName
 *   createdAt (ISO)              date (YYYY-MM-TT)
 *   status (frei)                status (drei Werte)
 *   -                            ideaTitle: die API kennt sie NICHT
 *
 * Wer die API-Antwort ungeprueft in die Ansicht schreibt, bekommt kein
 * Fehlersignal, sondern leere Felder - die Bewerbungsliste zeigt dann keinen
 * Teamnamen mehr, ohne dass etwas fehlschlaegt. Deshalb steht die Uebersetzung
 * hier, rein und geprueft.
 */
import type { ApiApplication } from '@/lib/api';
import type { MyApplication } from '@/lib/store';

/** Die drei Werte, die die Oberflaeche kennt (de.ts, pages.common.applicationStatus). */
export const APPLICATION_STATUSES = ['offen', 'angenommen', 'abgelehnt'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return value === 'offen' || value === 'angenommen' || value === 'abgelehnt';
}

/**
 * Der Tag aus einem Zeitstempel der API.
 *
 * Ein unbrauchbarer Wert ergibt '', nicht 'Invalid Date' und nicht den heutigen
 * Tag: ein erfundenes Datum waere schlimmer als ein fehlendes, weil es wie eine
 * Angabe aussieht.
 */
export function isoDay(iso: string): string {
  const tag = iso.slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(tag) ? tag : '';
}

/**
 * Uebersetzt eine Bewerbung der API in die Form der Ansicht.
 *
 * `ideaTitle` und die beiden Formularfelder `skills`/`hours` werden NICHT
 * erfunden: die API traegt sie nicht, und ein Platzhalter waere eine Behauptung
 * ueber eine Angabe, die es nicht gibt. Sie bleiben leer.
 */
export function toMyApplication(api: ApiApplication): MyApplication {
  return {
    id: api.id,
    teamId: api.teamId,
    teamName: api.team?.name ?? '',
    ideaTitle: '',
    skills: '',
    hours: 0,
    message: api.message,
    date: isoDay(api.createdAt),
    status: isApplicationStatus(api.status) ? api.status : 'offen',
  };
}

/**
 * Uebersetzt eine Liste - und laesst dabei nichts durchfallen.
 *
 * Eine Bewerbung ohne Teamnamen wird uebernommen, nicht verworfen: sie ist im
 * Zweifel lieber sichtbar als verschwunden.
 */
export function toMyApplications(list: readonly ApiApplication[]): MyApplication[] {
  return list.map(toMyApplication);
}

/**
 * Welche Bewerbung des Nutzers gehoert zu diesem Team?
 *
 * Die Oberflaeche fragt das an zwei Stellen (Teams.tsx, TeamDetail.tsx) und
 * beide Male mit demselben Zweck: den Knopf 'Bewerben' ausgrauen. Steht hier,
 * damit die beiden Stellen nicht auseinanderlaufen.
 */
export function findApplicationForTeam(
  list: readonly MyApplication[],
  teamId: string,
): MyApplication | undefined {
  return list.find((a) => a.teamId === teamId);
}

/**
 * Was ein Klick auf 'Bewerbung zuruecknehmen' bewirkt - oder warum nicht.
 *
 * Die API nimmt eine Bewerbung NUR zurueck, solange sie offen ist; danach
 * antwortet sie mit 409 (nachgemessen). Eine entschiedene Bewerbung ist der
 * Beleg der Entscheidung. Die Oberflaeche zeigt den Knopf heute nur bei 'offen'
 * (Teams.tsx) - der Fall wird hier trotzdem benannt, damit er nicht als
 * Versehen durchgeht, wenn die Anzeige sich einmal aendert.
 */
export type WithdrawPlan = { kind: 'api' } | { kind: 'local' } | { kind: 'refused'; reason: string };

export function planWithdraw(options: {
  apiMode: boolean;
  status: ApplicationStatus;
}): WithdrawPlan {
  if (!options.apiMode) return { kind: 'local' };
  if (options.status !== 'offen') {
    return {
      kind: 'refused',
      reason: 'Eine entschiedene Bewerbung kann nicht zurueckgenommen werden.',
    };
  }
  return { kind: 'api' };
}
