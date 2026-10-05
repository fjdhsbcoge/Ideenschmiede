/**
 * Aufraeumen der kurzlebigen Auth-Tabellen - als EIGENER, wiederholbarer Vorgang.
 *
 * Warum nicht im Anmeldepfad: der heisse Weg (POST /api/auth/challenge,
 * GET /api/auth/callback) soll nichts tun, was nicht zur Anmeldung gehoert. Ein
 * DELETE ueber eine wachsende Tabelle in jedem Aufruf waere Last ohne Nutzen -
 * die Anmeldung selbst braucht die alten Zeilen nicht; und bei zwei Aufrufern
 * gleichzeitig wuerden zwei Aufraeumlaeufe gegeneinander sperren.
 *
 * Aufgerufen wird diese Datei an zwei Stellen:
 *
 *   1. api/scripts/cleanup-auth.mjs - von Hand oder per Cron (der eigentliche
 *      Weg; die Fristen sind so gewaehlt, dass ein stuendlicher Lauf reicht).
 *   2. src/server.ts beim Start - fehlertolerant. Ohne diesen Aufruf bliebe die
 *      Tabelle nach einem Neustart genau so lange liegen, bis jemand das
 *      Skript von Hand startet; mit ihm ist der Zustand nach dem Start
 *      mindestens so gut wie vor dem letzten Lauf. Ein Fehler beim Aufraeumen
 *      beendet den Start NICHT (siehe server.ts): dass alte Zeilen liegen
 *      bleiben, ist ein Schoenheitsfehler, dass die API nicht startet, ein
 *      Ausfall.
 *
 * Was NICHT hierher gehoert: das Loeschen offener Herausforderungen. Eine
 * Herausforderung, die noch gueltig und unbenutzt ist, ist ein laufender
 * Anmeldevorgang - wer sie wegraeumt, laesst den QR-Code im Nichts enden.
 */
import type { Sql } from 'postgres';
import { deleteStaleAuthRows, type CleanupCounts } from './authStore.js';

/**
 * Frist fuer VERBRAUCHTE Herausforderungen: eine Stunde.
 *
 * Die Zusage aus api/README.md lautet: verbraucht heisst sofort nicht mehr
 * verwendbar - das entscheidet used_at, nicht das Vorhandensein der Zeile. Ein
 * Loeschen kann diese Zusage also nicht brechen.
 *
 * Warum trotzdem nicht sofort: used_at ist der Nachweis, dass eine k1 benutzt
 * und danach abgewiesen wurde (Replay-Schutz). Bleibt die Zeile eine Stunde
 * stehen, laesst sich ein gemeldeter Vorfall in diesem Fenster noch
 * nachvollziehen - MISSBRAUCH und Betrieb koennen nachsehen, wer wann
 * hereinkam. Laenger aufzubewahren hat keinen Zweck: nach CHALLENGE_TTL_MS
 * (5 Minuten) traegt die Zeile keine Information mehr, die die Anmeldung
 * betrifft.
 */
export const USED_CHALLENGE_GRACE_MS = 60 * 60 * 1000;

/**
 * Frist fuer ABGELAUFENE Herausforderungen: eine Stunde nach expires_at.
 *
 * Ein Aufraeumen mit dem Zeitpunkt expires_at selbst waere schon korrekt -
 * abgelaufen ist abgelaufen, und der Callback prueft expires_at ohnehin gegen
 * die eigene Uhr. Die Stunde Nachfrist steht aus zwei Gruenden da:
 *
 *   1. Sie deckt den Unterschied zwischen der Uhr der Anwendung und der Uhr der
 *      Datenbank ab. Die Frist einer Herausforderung entsteht aus
 *      AuthConfig.now, die Ablehnung vergleicht mit now() der Datenbank. Gehen
 *      die beiden Uhren einige Sekunden auseinander, koennte ein Aufraeumen
 *      ohne Nachfrist eine Zeile loeschen, die nach der Uhr der Anwendung noch
 *      gueltig ist - der Nutzer saehe "Unknown k1" statt "Challenge expired".
 *   2. Eine abgelaufene, nie benutzte Herausforderung ist die Spur eines
 *      QR-Codes, der erzeugt und nie gescannt wurde. Eine Stunde davon zu sehen
 *      hilft bei der Frage "kommt der Anmeldeweg ueberhaupt an?" - laenger
 *      braucht es nicht.
 */
export const EXPIRED_CHALLENGE_GRACE_MS = 60 * 60 * 1000;

/**
 * Frist fuer Ratenzeilen: das Fenster, plus eine Stunde.
 *
 * Ratenzeilen sind keine Nachweise, sondern Messwerte mit Verfallsdatum: sie
 * zaehlen nur innerhalb von AUTH_RATE_WINDOW_MS. Aeltere Zeilen koennten sofort
 * weg.
 *
 * Die zusaetzliche Stunde ist eine Versicherung gegen eine Konfigurationsaenderung:
 * wird AUTH_RATE_WINDOW_MS SPAETER erhoeht, sind die Zeilen der letzten Stunde
 * noch da und zaehlen wieder mit. Wuerde nur das aktuelle Fenster aufbewahrt,
 * waere die Begrenzung nach dem Hochsetzen fuer ein Fenster lang zu lax - die
 * eine Richtung, in der ein Fehler hier nicht passieren darf. Der Preis ist eine
 * Stunde Zeilen, die niemand mehr liest (bei 30 Aufrufen je Minute und Quelle
 * sind das hoechstens 1800 Zeilen je Quelle).
 */
export const RATE_EVENT_GRACE_MS = 60 * 60 * 1000;

/** Das Ergebnis einer Aufraeumrunde: die Fristen, die galten, und was weg ist. */
export interface CleanupResult extends CleanupCounts {
  readonly usedChallengesBefore: string;
  readonly expiredChallengesBefore: string;
  readonly rateEventsBefore: string;
  /** Zeitpunkt der Runde - fuer das Protokoll des Skripts und des Starts. */
  readonly at: string;
}

/**
 * Raeumt auf: abgelaufene und verbrauchte Herausforderungen, alte Ratenzeilen.
 *
 * Die Uhr ist injizierbar - wie in AuthConfig. Ohne Angabe gilt die echte Zeit;
 * ein Test kann damit "eine Stunde spaeter" rechnen, ohne zu warten.
 *
 * Gefahrlos mehrfach ausfuehrbar: siehe deleteStaleAuthRows() in authStore.ts.
 * Der zweite Lauf findet nichts mehr und meldet Nullen.
 */
export async function cleanupAuth(db: Sql, now: Date = new Date()): Promise<CleanupResult> {
  const t = now.getTime();
  const counts = await deleteStaleAuthRows(db, {
    usedBefore: new Date(t - USED_CHALLENGE_GRACE_MS),
    expiredBefore: new Date(t - EXPIRED_CHALLENGE_GRACE_MS),
    rateBefore: new Date(t - RATE_EVENT_GRACE_MS),
  });

  return {
    ...counts,
    usedChallengesBefore: new Date(t - USED_CHALLENGE_GRACE_MS).toISOString(),
    expiredChallengesBefore: new Date(t - EXPIRED_CHALLENGE_GRACE_MS).toISOString(),
    rateEventsBefore: new Date(t - RATE_EVENT_GRACE_MS).toISOString(),
    at: now.toISOString(),
  };
}

/** Eine Zeile fuer das Protokoll - Zahlen, keine Tabelleninhalte. */
export function describeCleanup(result: CleanupResult): string {
  return (
    'Aufgeraeumt: ' + result.usedChallenges + ' verbrauchte Herausforderungen, ' +
    result.expiredChallenges + ' abgelaufene Herausforderungen, ' +
    result.rateEvents + ' Ratenzeilen (Stand ' + result.at + ')'
  );
}
