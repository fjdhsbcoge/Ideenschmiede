/**
 * Ratenbegrenzung des oeffentlichen POST /api/auth/challenge - die Entscheidung.
 *
 * Der Zaehler liegt in der Datenbank (auth_rate_events, Migration 005), nicht im
 * Arbeitsspeicher: ein Zaehler im Speicher geht beim Neustart verloren und gilt
 * bei mehreren Instanzen (ADR-004) nur je Prozess. Die Begruendung im Einzelnen
 * steht in api/migrations/005_ratelimit.sql.
 *
 * Diese Datei entscheidet, WER gezaehlt wird (clientAddress) und WANN eine
 * Anfrage abgewiesen wird (enforceRateLimit). Gezaehlt wird ueber ein
 * GLEITENDES Fenster: zu jedem Zeitpunkt zaehlen die letzten
 * AUTH_RATE_WINDOW_MS - nicht das Kalenderfenster. Ein Zaehler je
 * Kalenderfenster haette am Fensterrand die doppelte Menge erlaubt (29 kurz
 * vor dem Wechsel, 30 direkt danach) und waere damit genau an der Stelle
 * umgehbar, an der jemand es versuchen wuerde.
 */
import type { ISql } from 'postgres';
import { AUTH_ERROR_REASONS, AuthError, type AuthConfig, type AuthErrorReason } from './auth.js';
import { countRecentEvents, recordRateEvent, type RateLimitPolicy } from './authStore.js';

/**
 * Der Name der Grenze in auth_rate_events.bucket. Heute gibt es genau eine;
 * die Spalte steht trotzdem da, damit spaetere Grenzen keine zweite Tabelle
 * brauchen und im Datenbestand sichtbar bleibt, welche Grenze gegriffen hat.
 */
export const CHALLENGE_RATE_BUCKET = 'auth.challenge';

/**
 * Die Begruendung, die eine abgewiesene Anfrage nach aussen traegt. Sie steht
 * hier und nicht im Aufrufer, damit Endpunkt und Text nicht auseinanderlaufen.
 *
 * ABSICHTLICH nicht Teil von AUTH_ERROR_REASONS: die Liste dort beschreibt die
 * Fehler des LNURL-auth-Protokolls (die Spezifikation nennt sie), und ein
 * Wallet hat mit einer Ratenbegrenzung nichts zu tun. Die Form der Antwort ist
 * trotzdem dieselbe wie bei jedem anderen Auth-Fehler.
 */
export const RATE_LIMIT_REASON: AuthErrorReason = AUTH_ERROR_REASONS.rateLimited;

/**
 * Der Schluessel, wenn keine Adresse feststellbar ist. Ein leerer Schluessel
 * waere ein Schluessel, den man versehentlich mit einem anderen verwechselt;
 * 'unknown' ist sichtbar und bedeutet: alle Aufrufer ohne feststellbare
 * Adresse teilen sich EINEN Topf.
 *
 * In dieser Anwendung kann das im Testbetrieb vorkommen (app.request() hat
 * keine Verbindung). Im echten Betrieb liefert der Node-Adapter die Adresse mit
 * (c.env.incoming.socket.remoteAddress); kommt sie trotzdem nicht an, ist die
 * Begrenzung strenger, nicht wirkungslos - der Fehler geht in die sichere
 * Richtung.
 */
export const UNKNOWN_CLIENT_KEY = 'unknown';

/**
 * Obergrenze fuer einen Adresswert. 45 Zeichen ist die laengste
 * IPv6-Schreibweise (IPv4-gemappt, mit Zone); alles darueber ist kein
 * Adresswert, sondern der Versuch, den Schluessel zu strecken.
 */
export const MAX_ADDRESS_LENGTH = 45;

/** Die Grenze, die der Konfiguration entspricht. Die Zuordnung steht an EINER Stelle. */
export function rateLimitPolicy(config: AuthConfig): RateLimitPolicy {
  return { limit: config.rateLimit, windowMs: config.rateWindowMs };
}

/**
 * Die Client-Adresse aus dem Kopf X-Forwarded-For - oder null, wenn der Kopf
 * keinen brauchbaren Eintrag hat.
 *
 * Warum der Kopf nur aus einer vertrauenswuerdigen Verbindung gelesen wird:
 * X-Forwarded-For ist ein GEWOEHNLICHER HTTP-Kopf, den jeder Aufrufer setzen
 * kann. Wuerde er immer gelesen, schriebe ein Angreifer in jede Anfrage eine
 * andere erfundene Adresse - und die Begrenzung liefe fuer ihn nie an. Ein
 * faelschbarer Kopf darf eine Schutzmassnahme nicht abschalten koennen; genau
 * das waere seine Wirkung, wenn man ihm unbedingt glaubte.
 *
 * Geglaubt wird er deshalb nur, wenn die Verbindung SELBST von einer Adresse
 * aus AUTH_TRUSTED_PROXIES kommt (siehe clientAddress). Dann ist die Kette
 * glaubwuerdig genug: der Proxy setzt oder ergaenzt den Kopf, und der Aufrufer
 * kommt nicht direkt an diesen Prozess.
 *
 * Genommen wird der ERSTE Eintrag der Liste. X-Forwarded-For ist die Kette
 * "Client, Proxy1, Proxy2"; der erste Eintrag ist der urspruengliche Client.
 * Der LETZTE Eintrag waere der naechste Proxy - dann landeten alle Nutzer
 * eines Proxys in einem Topf.
 *
 * Ein leerer oder unbrauchbar langer Eintrag gilt NICHT als Adresse: er wird
 * verworfen, nicht getrimmt und nicht abgeschnitten. Sonst waere eine
 * 4000-Zeichen-Zeichenkette ein gueltiger Schluessel.
 */
export function forwardedClientAddress(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  const erster = header.split(',')[0]?.trim() ?? '';
  if (erster === '' || erster.length > MAX_ADDRESS_LENGTH) {
    return null;
  }
  return erster.toLowerCase();
}

/** Die Adresse der VERBINDUNG - so, wie der Betriebssystem-Socket sie kennt. */
export interface SocketLike {
  readonly remoteAddress?: string | undefined;
}

/**
 * Der Schluessel, unter dem eine Anfrage gezaehlt wird.
 *
 * Reihenfolge der Entscheidung - sie ist der Kern des Ganzen:
 *
 *   1. Kommt die Verbindung von einem eingetragenen Proxy UND ist
 *      X-Forwarded-For gesetzt und plausibel, gilt der Kopf. Das ist der
 *      einzige Fall, in dem ein Aufrufer den Topf mitbestimmt.
 *   2. Sonst gilt die Adresse der Verbindung. Sie ist nicht faelschbar.
 *   3. Ist auch die nicht feststellbar, gilt UNKNOWN_CLIENT_KEY.
 *
 * Ohne eingetragene Proxies (Vorgabe: AUTH_TRUSTED_PROXIES ist leer) wird der
 * Kopf NIE gelesen. Die Kehrseite steht in api/README.md: hinter einem Reverse
 * Proxy ohne Eintrag teilen sich alle Nutzer einen Topf.
 */
export function clientAddress(req: {
  readonly peer: string | undefined;
  readonly forwardedFor: string | undefined;
  readonly trustedProxies: readonly string[];
}): string {
  const peer = req.peer === undefined ? '' : req.peer.trim().toLowerCase();
  if (peer !== '' && req.trustedProxies.includes(peer)) {
    const ausKopf = forwardedClientAddress(req.forwardedFor);
    if (ausKopf !== null) {
      return ausKopf;
    }
  }
  return peer === '' ? UNKNOWN_CLIENT_KEY : peer;
}

/**
 * Die Adresse der Verbindung aus der Anfrage holen.
 *
 * Der Node-Adapter (@hono/node-server) legt die rohe eingehende Nachricht unter
 * c.env.incoming ab. Fehlt sie - etwa bei app.request() im Test -, gibt es
 * keine Adresse, und der Aufrufer faellt auf UNKNOWN_CLIENT_KEY zurueck.
 *
 * `connection` steht neben `socket`, weil aeltere Node-Fassungen die Adresse
 * dort fuehren; beide koennen fehlen (HTTP/2, synthetische Anfragen).
 */
export function peerAddressOf(env: unknown): string | undefined {
  if (typeof env !== 'object' || env === null) {
    return undefined;
  }
  const incoming = (env as { incoming?: unknown }).incoming;
  if (typeof incoming !== 'object' || incoming === null) {
    return undefined;
  }
  const verbindung = incoming as { socket?: SocketLike; connection?: SocketLike };
  const socket = verbindung.socket ?? verbindung.connection;
  const adresse = socket?.remoteAddress;
  return adresse === undefined || adresse === '' ? undefined : adresse;
}

/**
 * Die Begrenzung durchsetzen: zaehlen, entscheiden, erst dann erlauben.
 *
 * Drei Schritte, und die Reihenfolge ist die Zusage:
 *
 *   1. Zaehlen, wie viele Aufrufe dieses Schluessels im Fenster liegen.
 *   2. Ist die Grenze erreicht, wird ABGEWIESEN - und nichts geschrieben.
 *      Wuerde auch der abgewiesene Aufruf gezaehlt, waere die Tabelle selbst
 *      der Schreibverstaerker, den sie verhindern soll: eine Schleife ohne Ende
 *      erzeugte Zeilen ohne Ende, nur mit kleinerer Rate.
 *   3. Ist sie nicht erreicht, wird der Aufruf GEZAEHLT und erlaubt.
 *
 * Zwischen Schritt 1 und 3 liegt ein Fenster, in dem zwei gleichzeitige Aufrufe
 * beide "noch erlaubt" sehen und beide schreiben. Die Folge ist eine Grenze,
 * die bei paralleler Last um wenige Aufrufe ueberschritten wird - bei 30 ist
 * das unerheblich, und der Fehler geht in die RICHTIGE Richtung: abgewiesene
 * Aufrufe schreiben nichts, die Grenze wird also nie zu lax.
 *
 * Was diese Begrenzung ausdruecklich NICHT ist: ein Schutz gegen verteilte
 * Angriffe aus vielen Adressen. Sie begrenzt, was EINE Quelle anrichten kann.
 *
 * Wirft AuthError mit der Begruendung RATE_LIMIT_REASON. Die Antwort baut der
 * Aufrufer (src/app.ts) in derselben Form wie jeder andere Auth-Fehler:
 * { status: 'ERROR', reason }.
 */
export async function enforceRateLimit(
  db: ISql,
  key: string,
  config: AuthConfig,
  bucket: string = CHALLENGE_RATE_BUCKET,
): Promise<void> {
  const policy = rateLimitPolicy(config);
  const jetzt = new Date(config.now());

  const bisher = await countRecentEvents(db, bucket, key, jetzt, policy.windowMs);
  if (bisher >= policy.limit) {
    throw new AuthError(
      RATE_LIMIT_REASON,
      'Ratenbegrenzung: mehr als ' + policy.limit + ' Aufrufe von "' + key + '" in ' + policy.windowMs + ' ms',
    );
  }

  await recordRateEvent(db, bucket, key, jetzt);
}

/** Ist das der Fehler der Ratenbegrenzung? */
export function isRateLimitError(error: unknown): error is AuthError {
  return error instanceof AuthError && error.reason === RATE_LIMIT_REASON;
}
