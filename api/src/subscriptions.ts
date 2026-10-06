/**
 * BTCPay-Webhook (Roadmap Phase 3.3) - Signaturpruefung, Ereignisauswertung,
 * Gutschrift.
 *
 * Warum das eine eigene Datei ist: app.ts ist die Verdrahtung der Endpunkte
 * (Routen, Antwortformen), authStore.ts sind die Schreibvorgaenge des Logins.
 * Hier steht die Fachlichkeit des Bezahlvorgangs - und sie ist ohne HTTP pruefbar.
 *
 * -----------------------------------------------------------------------------
 * Die Signatur laeuft ueber die ROHEN BYTES
 * -----------------------------------------------------------------------------
 * Die Referenzimplementierung von BTCPay liest den Koerper ungeparst
 * (file_get_contents('php://input')) und rechnet
 * hash_hmac('sha256', $raw_post_data, $secret). Genau so hier:
 *
 *     roh      = der UNVERAENDERTE Request-Body als Bytes
 *     erwartet = hex(hmac_sha256(BTCPAY_WEBHOOK_SECRET, roh))
 *     gesendet = Kopf 'BTCPay-Sig' (Gross-/Kleinschreibung egal)
 *
 * Wer den Koerper parst und wieder serialisiert, rechnet ueber ANDERE Bytes.
 * Schon ein Leerzeichen, das der Serialisierer weglaesst, oder eine andere
 * Schluesselreihenfolge ergibt eine andere Signatur - die Pruefung schluege fehl,
 * obwohl die Zustellung echt ist. Deshalb wird der Koerper EINMAL roh gelesen
 * (readRawBody) und DIESELBEN Bytes werden fuer Pruefung UND Auswertung
 * verwendet: die Signatur bindet damit genau die Bytes, die ausgewertet werden.
 *
 * Verglichen wird zeitkonstant (timingSafeEqual, wie parseSessionToken in
 * auth.ts). Sonst liesse sich das Geheimnis Byte fuer Byte ertasten.
 *
 * -----------------------------------------------------------------------------
 * Drei Schutzschichten der Idempotenz
 * -----------------------------------------------------------------------------
 * BTCPay wiederholt Zustellungen planmaessig. Alle drei Schichten greifen:
 *
 *   1. is_redelivery aus dem Payload - ein HINWEIS, nicht die Absicherung: das
 *      Feld kann fehlen, und wer sich darauf verlaesst, hat keine Zusage.
 *   2. lower(payment_txid) UNIQUE in subscriptions (Migration 001) - dieselbe
 *      Bitcoin-Transaktion ist nur einmal ein Abonnement, unabhaengig von der
 *      Schreibweise.
 *   3. Status der Absicht: nur 'open' -> 'settled', bedingt im UPDATE. Die
 *      Datenbank entscheidet, wer von zwei gleichzeitigen Zustellungen gewinnt.
 *
 * Keine der drei ersetzt die anderen: (3) haelt die Wiederholung auf, (2) haelt
 * auch eine zweite Rechnung mit derselben Zahlung auf, (1) ist nur die Auskunft
 * des Absenders.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ISql, Sql } from 'postgres';

/** Kopfzeile der Signatur. Gross-/Kleinschreibung spielt keine Rolle. */
export const BTCPAY_SIGNATURE_HEADER = 'BTCPay-Sig';

/** Die Ereignistypen, die BTCPay fuer Rechnungen zustellt. */
export const BTCPAY_EVENT_TYPES = [
  'InvoiceCreated',
  'InvoiceReceivedPayment',
  'InvoiceProcessing',
  'InvoiceExpired',
  'InvoiceSettled',
  'InvoiceInvalid',
  'InvoicePaymentSettled',
] as const;
export type BTCPayEventType = (typeof BTCPAY_EVENT_TYPES)[number];

/** Nur dieses eine Ereignis fuehrt zu einer Gutschrift. */
export const SETTLING_EVENT: BTCPayEventType = 'InvoiceSettled';

/**
 * Ereignisse, die die Absicht ABSCHLIESSEN, ohne gutzuschreiben. Sie buchen
 * nichts - die Absicht ist danach aber nicht mehr offen, und eine verspaetete
 * Zahlung auf dieselbe Rechnung begruendet kein Abonnement mehr.
 *
 * Ohne diese Zuordnung waeren die beiden Status 'expired' und 'invalid' aus
 * subscription_intents_status_check nie erreichbar: eine Aufzaehlung, deren
 * Werte niemand schreiben kann, ist eine Behauptung. Der Status der Absicht ist
 * ausserdem die dritte Schutzschicht der Idempotenz - er soll den Zustand
 * widerspiegeln, der wirklich gilt.
 */
export const CLOSING_EVENTS: { readonly [typ: string]: 'expired' | 'invalid' } = {
  InvoiceExpired: 'expired',
  InvoiceInvalid: 'invalid',
};

const HMAC_HEX_LENGTH = 64;
const HEX_64 = /^[0-9a-f]{64}$/;

/** Laenge des Abonnements: ein Jahr, in Millisekunden. */
export const SUBSCRIPTION_PERIOD_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Frist einer Absicht. Die Rechnung bei BTCPay laeuft ueblicherweise nach 15
 * Minuten ab; die Absicht darf laenger offen stehen, damit ein spaet
 * eintreffender InvoiceExpired-Webhook noch zugeordnet werden kann. 24 Stunden
 * sind lang genug dafuer und kurz genug, dass eine uralte Zahlung nicht mehr als
 * Gutschrift durchgeht.
 */
export const INTENT_TTL_MS = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// Rohe Bytes
// -----------------------------------------------------------------------------

/**
 * Der UNVERAENDERTE Koerper als Bytes. Genau diese Bytes werden signiert.
 *
 * Liefert null, wenn der Koerper nicht gelesen werden kann. Ein leerer Koerper
 * ist ein leeres Buffer - die Signatur darueber ist der HMAC ueber nichts und
 * damit berechenbar; er ist kein Sonderfall, sondern ein Koerper.
 */
export async function readRawBody(req: Request): Promise<Buffer | null> {
  try {
    return Buffer.from(await req.arrayBuffer());
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Signatur
// -----------------------------------------------------------------------------

/** Der erwartete Wert des Kopfes: hex(hmac_sha256(secret, roh)). */
export function computeSignatureHex(secret: string, raw: Buffer): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

/**
 * Prueft die Signatur zeitkonstant.
 *
 * Zuerst die LAENGE, dann timingSafeEqual: die Funktion wirft bei
 * unterschiedlich langen Buffern, und ein Werfen waere hier ein 500 statt eines
 * 401. Eine falsche Laenge ist ohnehin kein gueltiger HMAC.
 */
export function verifyWebhookSignature(
  secret: string,
  raw: Buffer,
  header: string | undefined,
): boolean {
  if (header === undefined || header.length !== HMAC_HEX_LENGTH) {
    return false;
  }
  const gesendet = Buffer.from(header.toLowerCase(), 'utf8');
  const erwartet = Buffer.from(computeSignatureHex(secret, raw), 'utf8');
  return gesendet.length === erwartet.length && timingSafeEqual(gesendet, erwartet);
}

// -----------------------------------------------------------------------------
// Fehler
// -----------------------------------------------------------------------------

export const WEBHOOK_ERRORS = {
  missingSecret: 'BTCPAY_WEBHOOK_SECRET ist nicht gesetzt',
  invalidSignature: 'Die Signatur des Webhooks ist ungueltig',
  malformedBody: 'Der Webhook-Koerper ist kein JSON-Objekt',
} as const;

export class WebhookError extends Error {
  readonly status: 401 | 400;
  readonly code: string;

  constructor(status: 401 | 400, code: string, message: string) {
    super(message);
    this.name = 'WebhookError';
    this.status = status;
    this.code = code;
  }
}

// -----------------------------------------------------------------------------
// Auswertung des Ereignisses
// -----------------------------------------------------------------------------

export interface BTCPayWebhookEvent {
  /** z.B. 'InvoiceSettled'. Fehlt der Wert, ist er null - nicht geraten. */
  type: string | null;
  deliveryId: string | null;
  webhookId: string | null;
  originalDeliveryId: string | null;
  /** Hinweis des Absenders. NICHT die Absicherung gegen Doppelbuchung. */
  isRedelivery: boolean;
  /** Zeitstempel der Zustellung, oder null. */
  timestamp: Date | null;
  storeId: string | null;
  invoiceId: string | null;
  /** Nur bei InvoiceSettled: von Hand als bezahlt markiert. */
  manuallyMarked: boolean;
  overPaid: boolean;
  /** Die rohe Nutzlast - fuer die Diagnose, nicht fuer Entscheidungen. */
  payload: Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asDate(value: unknown): Date | null {
  const text = asString(value);
  if (text === null) {
    return null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Liest die Felder, die die Zustellung traegt. Fehlende Felder werden zu null -
 * es wird nichts geraten und nichts ersetzt.
 */
export function parseEvent(body: Record<string, unknown>): BTCPayWebhookEvent {
  return {
    type: asString(body.type),
    deliveryId: asString(body.delivery_id),
    webhookId: asString(body.webhook_id),
    originalDeliveryId: asString(body.original_delivery_id),
    isRedelivery: body.is_redelivery === true,
    timestamp: asDate(body.timestamp),
    storeId: asString(body.store_id),
    invoiceId: asString(body.invoice_id),
    manuallyMarked: body.manually_marked === true,
    overPaid: body.over_paid === true,
    payload: body,
  };
}

/**
 * Die Zahlungsart der Kette - nur sie zaehlt als Beleg.
 *
 * Eine Lightning-Zahlung liefert KEINEN Beleg im Sinne dieses Systems: sie hat
 * keine Transaktionskennung auf der Kette. Ihr payment_hash ist ebenfalls 64
 * Hex-Zeichen lang - eine Pruefung auf die FORM der Kennung kann eine
 * Blitz-Zahlung also nicht von einer Ketten-Zahlung unterscheiden. Der
 * Unterschied steht allein in der Zahlungsart.
 *
 * BTCPay gibt sie als paymentMethod mit. Alles, was 'lightning' enthaelt
 * ('BTC-LightningLike', 'BTC-LightningNetwork'), ist deshalb kein Beleg - auch
 * dann nicht, wenn das Feld transactionId gefuellt ist.
 */
const LIGHTNING_METHOD = /lightning/i;

/**
 * Ist diese Zahlung ein Beleg auf der Kette?
 *
 * Unbekannte Zahlungsarten werden angenommen, wenn sie eine Kennung tragen:
 * eine kuenftige Umbenennung soll den Zahlungsweg nicht stillschweigend
 * verstopfen. Blitz wird dagegen ausdruecklich abgelehnt.
 */
function istKettenZahlung(methode: string | null): boolean {
  return methode === null || !LIGHTNING_METHOD.test(methode);
}

/**
 * Die Transaktionskennung der Zahlung, die die Rechnung beglichen hat.
 *
 * Eine Rechnung kann MEHRERE Zahlungen tragen (Teilzahlungen, mehrere
 * Bestaetigungen). Genommen wird die groesste bestaetigte, sonst die groesste
 * ueberhaupt - die Zahlung also, die die Rechnung gedeckt hat.
 *
 * Wird KEINE gueltige Transaktionskennung gefunden, liefert die Funktion null.
 * Der Aufrufer bucht dann nicht: eine Zeile in subscriptions ohne Beleg waere
 * genau die zweite Wahrheit, die CONTRACT.md ausschliesst (die Belegspalte ist
 * die Spur des Geldes, nicht Zierde).
 */
export function extractPaymentTxid(body: Record<string, unknown>): string | null {
  const kandidaten: string[] = [];

  const direkt = asString(body.txid);
  if (direkt !== null) {
    kandidaten.push(direkt);
  }

  const payments = body.payments;
  if (Array.isArray(payments)) {
    const sortiert = payments
      .map((eintrag) => asRecord(eintrag))
      .filter((eintrag): eintrag is Record<string, unknown> => eintrag !== null)
      .map((eintrag) => ({
        methode: asString(eintrag.paymentMethod),
        txid: asString(eintrag.transactionId) ?? asString(eintrag.txid),
        bestaetigt: eintrag.confirmed === true,
        betrag: Number(eintrag.amount ?? 0),
      }))
      // Die Zahlungsart entscheidet, nicht die Form der Kennung: der
      // payment_hash einer Blitz-Zahlung ist ebenfalls 64 Hex-Zeichen lang.
      .filter((eintrag) => istKettenZahlung(eintrag.methode))
      .filter((eintrag) => eintrag.txid !== null)
      .sort((a, b) => Number(b.bestaetigt) - Number(a.bestaetigt) || b.betrag - a.betrag);

    for (const eintrag of sortiert) {
      if (eintrag.txid !== null) {
        kandidaten.push(eintrag.txid);
      }
    }
  }

  for (const kandidat of kandidaten) {
    const klein = kandidat.toLowerCase();
    if (HEX_64.test(klein)) {
      return klein;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// Schreiben
// -----------------------------------------------------------------------------

/** Die Zeile aus subscription_intents, wie die Abfragen sie liefern. */
interface IntentRow {
  id: string;
  user_id: string;
  invoice_id: string;
  status: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * Die Nutzlast, die der Client beim Anlegen der Rechnung bei BTCPay mitgibt.
 *
 * Sie traegt BEIDES: den Nutzer und die Absicht. Der Nutzer, damit der Webhook
 * notfalls auch ohne die Absicht sagen kann, wem die Zahlung gilt; die Absicht,
 * damit die Zuordnung eindeutig ist und nicht ueber den Nutzer laufen muss.
 * camelCase, weil BTCPay die Nutzlast unveraendert zurueckliefert und sie im
 * Frontend gelesen wird (CONTRACT.md, Namensform je Schicht: API und Frontend
 * camelCase, Datenbank snake_case).
 */
export interface SubscriptionIntentMetadata {
  userId: string;
  intentId: string;
}

export interface CreatedIntent {
  id: string;
  userId: string;
  invoiceId: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  /** Die Nutzlast fuer die Rechnung bei BTCPay. Enthaelt userId und intentId. */
  metadata: SubscriptionIntentMetadata;
}

function toIntent(row: IntentRow): CreatedIntent {
  return {
    id: row.id,
    userId: row.user_id,
    invoiceId: row.invoice_id,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    metadata: { userId: row.user_id, intentId: row.id },
  };
}

/**
 * Findet die offene Absicht des Nutzers oder legt eine neue an.
 *
 * Die Wiederverwendung ist Absicht: die Nutzlast (userId, intentId) geht in die
 * Rechnung bei BTCPay ein und ist dort unveraenderlich. Legte jeder Aufruf eine
 * neue Absicht an, zeigte die alte Rechnung auf eine Absicht, die niemand mehr
 * bedient - und eine Zahlung darauf waere nicht mehr zuordenbar. Deshalb gilt
 * innerhalb der Frist: EINE offene Absicht je Nutzer.
 *
 * Die Zeile wird mit FOR UPDATE gelesen: zwei gleichzeitige Aufrufe sollen nicht
 * beide keine offene Absicht finden und dann zwei anlegen.
 */
export async function findOrCreateIntent(
  db: Sql,
  userId: string,
  now: Date,
  ttlMs: number = INTENT_TTL_MS,
): Promise<CreatedIntent> {
  return db.begin(async (tx) => {
    const q = tx as unknown as ISql;

    const offen = await q<IntentRow[]>`
        SELECT id, user_id, invoice_id, status, created_at, expires_at
          FROM subscription_intents
         WHERE user_id = ${userId}
           AND status = 'open'
           AND expires_at > ${now}
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE
    `;
    const vorhanden = offen[0];
    if (vorhanden !== undefined) {
      return toIntent(vorhanden);
    }

    // invoice_id kommt aus randomUUID() (gen_random_uuid() in der Datenbank hat
    // dieselbe Form). Der Wert ist die Kennung, unter der die Rechnung bei BTCPay
    // angelegt wird und unter der der Webhook sie wiederfindet.
    const rows = await q<IntentRow[]>`
        INSERT INTO subscription_intents (user_id, invoice_id, expires_at)
        VALUES (${userId}, ${globalThis.crypto.randomUUID()}, ${new Date(now.getTime() + ttlMs)})
        RETURNING id, user_id, invoice_id, status, created_at, expires_at
    `;
    const zeile = rows[0];
    if (zeile === undefined) {
      throw new Error('subscription_intents: INSERT hat keine Zeile geliefert');
    }
    return toIntent(zeile);
  });
}

export { type IntentRow };

/** Die Absicht zur Rechnung, oder null. Indexzugriff ueber UNIQUE(invoice_id). */
export async function findIntentByInvoiceId(db: ISql, invoiceId: string): Promise<IntentRow | null> {
  const rows = await db<IntentRow[]>`
      SELECT id, user_id, invoice_id, status, created_at, expires_at
        FROM subscription_intents
       WHERE invoice_id = ${invoiceId}
  `;
  return rows[0] ?? null;
}

export interface SettleResult {
  /** true, wenn in DIESEM Aufruf gebucht wurde. */
  settled: boolean;
  subscriptionId: string | null;
  userId: string;
  /** true, wenn die Absicht schon vorher 'settled' war (Schicht 3). */
  alreadySettled: boolean;
  expiresAt: Date | null;
}

/** Innerer Abbruch: dieselbe Zahlung traegt schon ein Abonnement (Schicht 2). */
export class DuplicatePaymentError extends Error {
  readonly paymentTxid: string;

  constructor(paymentTxid: string) {
    super('Zu dieser Transaktion existiert bereits ein Abonnement: ' + paymentTxid);
    this.name = 'DuplicatePaymentError';
    this.paymentTxid = paymentTxid;
  }
}

/**
 * Verbucht die Zahlung: Abonnement anlegen UND Absicht schliessen - in EINER
 * Transaktion.
 *
 * Die Reihenfolge ist der Kern der Idempotenz (Schicht 3): erst der bedingte
 * Uebergang 'open' -> 'settled' (WHERE status = 'open'), dann das Abonnement.
 * Wer keine Zeile zurueckbekommt, hat nicht gebucht und legt auch kein Abonnement
 * an. Genau wie consumeChallenge() in authStore.ts entscheidet damit die
 * DATENBANK, wer von zwei gleichzeitigen Zustellungen gewinnt - und nicht die
 * Anwendung, die zwischen SELECT und UPDATE ein Zeitfenster haette.
 *
 * Bricht das INSERT am partiellen UNIQUE-Index auf lower(payment_txid) ab
 * (Schicht 2), wirft die Transaktion DuplicatePaymentError - der Rollback macht
 * dann auch den Statuswechsel rueckgaengig. Es entsteht keine halbe Buchung, und
 * eine Wiederholung ist kein Fehlerfall, sondern der Normalfall.
 *
 * Die Rolle wird hier NICHT gesetzt: subscriptions_sync_user_role_trg und
 * users_derive_role_trg leiten sie in der Datenbank ab (ADR-003). Ein zweiter
 * Schreiber waere eine zweite Wahrheit.
 */
export async function settleIntent(
  db: Sql,
  intent: IntentRow,
  paymentTxid: string,
  settledAt: Date | null,
): Promise<SettleResult> {
  return db.begin(async (tx) => {
    const q = tx as unknown as ISql;

    const uebergang = await q<{ id: string; user_id: string }[]>`
        UPDATE subscription_intents
           SET status = 'settled',
               settled_at = COALESCE(${settledAt}, now())
         WHERE id = ${intent.id}
           AND status = 'open'
        RETURNING id, user_id
    `;
    const gewonnen = uebergang[0];
    if (gewonnen === undefined) {
      // Schicht 3: die Absicht ist nicht mehr offen - eine zweite Zustellung
      // derselben Rechnung, oder eine, die auf eine abgelaufene Absicht kommt.
      return {
        settled: false,
        subscriptionId: null,
        userId: intent.user_id,
        alreadySettled: intent.status === 'settled',
        expiresAt: null,
      };
    }

    // Das Fenster des Abonnements rechnet ab dem Zeitpunkt der ZAHLUNG, nicht ab
    // dem Zeitpunkt der Zustellung: eine Wiederholung Tage spaeter darf das
    // Abonnement nicht verlaengern. started_at kommt aus dem Zeitstempel der
    // Zustellung, ersatzweise aus now() der Datenbank.
    const start = settledAt ?? new Date();
    const expiresAt = new Date(start.getTime() + SUBSCRIPTION_PERIOD_MS);

    // ON CONFLICT DO NOTHING trifft den partiellen Ausdrucksindex
    // subscriptions_payment_txid_key. Die Alternative waere, den Fehler 23505
    // abzufangen; hier ist der Konflikt ein ERGEBNIS (keine zweite Gutschrift),
    // kein Ausnahmefall - und die Absicht darf dabei nicht als eingeloest
    // stehenbleiben.
    const anlegen = await q<{ id: string; expires_at: Date }[]>`
        INSERT INTO subscriptions (user_id, type, active, started_at, expires_at, payment_txid)
        VALUES (${gewonnen.user_id}, 'annual', true, ${start}, ${expiresAt}, ${paymentTxid})
        ON CONFLICT DO NOTHING
        RETURNING id, expires_at
    `;
    const abo = anlegen[0];
    if (abo === undefined) {
      throw new DuplicatePaymentError(paymentTxid);
    }

    return {
      settled: true,
      subscriptionId: abo.id,
      userId: gewonnen.user_id,
      alreadySettled: false,
      expiresAt: abo.expires_at,
    };
  });
}

/** Setzt die Absicht auf 'expired' oder 'invalid' - nur aus 'open' heraus. */
export async function closeIntent(
  db: ISql,
  intentId: string,
  status: 'expired' | 'invalid',
): Promise<boolean> {
  const rows = await db<{ id: string }[]>`
      UPDATE subscription_intents
         SET status = ${status}
       WHERE id = ${intentId}
         AND status = 'open'
      RETURNING id
  `;
  return rows.length > 0;
}

// -----------------------------------------------------------------------------
// Der ganze Vorgang
// -----------------------------------------------------------------------------

/** Warum eine Zustellung nichts gebucht hat - oder dass sie es getan hat. */
export type WebhookResult =
  | 'settled'
  | 'already_settled'
  | 'intent_not_open'
  | 'unknown_invoice'
  | 'ignored_event'
  | 'expired_intent'
  | 'duplicate_payment'
  | 'no_payment_txid';

export interface WebhookOutcome {
  status: 200;
  /**
   * true = diese Zustellung hat ein Abonnement gebucht.
   * false = bestaetigt, aber nichts gebucht (unbekannt, Wiederholung, anderes
   * Ereignis). Beides wird mit 200 beantwortet: jede andere Antwort liesse BTCPay
   * endlos wiederholen.
   */
  processed: boolean;
  result: WebhookResult;
  event: string | null;
  invoiceId: string | null;
  intentId: string | null;
  userId: string | null;
  subscriptionId: string | null;
  isRedelivery: boolean;
  manuallyMarked: boolean;
  /**
   * true, wenn DIESE Zustellung die Absicht geschlossen hat (InvoiceExpired
   * oder InvoiceInvalid). Ein geschlossener Vorgang ist kein gebuchter: es gibt
   * kein Abonnement, aber die Absicht ist auch nicht mehr offen.
   */
  closedIntent: boolean;
}

/**
 * Prueft die Signatur und verarbeitet die Zustellung, oder wirft WebhookError.
 *
 * raw sind die Bytes, ueber die signiert wurde - DIESELBEN Bytes werden
 * ausgewertet (JSON.parse(raw)). Es gibt keinen zweiten Weg in diese Funktion,
 * der einen bereits geparsten Koerper entgegennimmt: das ist die Zusage.
 */
export async function processWebhook(
  db: Sql,
  secret: string,
  raw: Buffer,
  signatureHeader: string | undefined,
): Promise<WebhookOutcome> {
  if (secret === '') {
    throw new WebhookError(401, 'missing_secret', WEBHOOK_ERRORS.missingSecret);
  }

  // 1. Signatur - VOR allem anderen. Ohne gueltige Signatur wird nichts
  //    ausgewertet und nichts geschrieben.
  if (!verifyWebhookSignature(secret, raw, signatureHeader)) {
    throw new WebhookError(401, 'invalid_signature', WEBHOOK_ERRORS.invalidSignature);
  }

  // 2. Auswertung - aus DENSELBEN Bytes.
  let body: unknown;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new WebhookError(400, 'malformed_body', WEBHOOK_ERRORS.malformedBody);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new WebhookError(400, 'malformed_body', WEBHOOK_ERRORS.malformedBody);
  }

  const event = parseEvent(body as Record<string, unknown>);
  // Die Felder, die JEDE Antwort traegt. closedIntent steht hier und nicht in
  // den einzelnen Zweigen: nur der Zweig der abschliessenden Ereignisse setzt es
  // auf true.
  const basis = {
    event: event.type,
    invoiceId: event.invoiceId,
    isRedelivery: event.isRedelivery,
    manuallyMarked: event.manuallyMarked,
    closedIntent: false,
  };

  // 3. Nur InvoiceSettled fuehrt zu einer Gutschrift. Alle anderen Ereignisse
  //    werden bestaetigt und nicht verarbeitet - sonst wiederholt BTCPay endlos.
  //
  //    Zwei davon schliessen die Absicht trotzdem: InvoiceExpired und
  //    InvoiceInvalid. Das ist keine Gutschrift und aendert an der Antwort
  //    nichts ausser dem Vermerk closedIntent - es haelt den Status der Absicht
  //    aber an der Wirklichkeit, und genau dieser Status ist eine der
  //    Schutzschichten gegen die Doppelbuchung.
  if (event.type !== SETTLING_EVENT) {
    const schliessenderStatus = event.type === null ? undefined : CLOSING_EVENTS[event.type];
    let geschlossen = false;
    if (schliessenderStatus !== undefined) {
      const betroffene = await findIntentByInvoiceId(db, event.invoiceId ?? '');
      if (betroffene !== null) {
        geschlossen = await closeIntent(db, betroffene.id, schliessenderStatus);
      }
    }
    return {
      status: 200,
      processed: false,
      result: 'ignored_event',
      intentId: null,
      userId: null,
      subscriptionId: null,
      ...basis,
      closedIntent: geschlossen,
    };
  }

  // 4. Die Absicht zur Rechnung. Unbekannt -> 200 mit Vermerk, NICHT 404: eine
  //    404 liesse BTCPay endlos wiederholen, und die Rechnung wird davon nicht
  //    bekannter.
  const invoiceId = event.invoiceId;
  const intent = invoiceId === null ? null : await findIntentByInvoiceId(db, invoiceId);
  if (intent === null) {
    return {
      status: 200,
      processed: false,
      result: 'unknown_invoice',
      intentId: null,
      userId: null,
      subscriptionId: null,
      ...basis,
    };
  }

  const gemeinsame = { status: 200 as const, intentId: intent.id, userId: intent.user_id, ...basis };

  // Eine Absicht, deren Frist abgelaufen ist, wird nicht mehr bedient. Sie wird
  // hier NICHT auf 'expired' gesetzt: die Frist der Absicht und der Ablauf der
  // RECHNUNG sind zwei verschiedene Dinge, und den Rechnungszustand meldet
  // BTCPay selbst (InvoiceExpired, siehe oben - dort wird die Absicht
  // geschlossen). Hier geht es nur darum, dass eine verspaetete Zahlung kein
  // Abonnement mehr begruendet.
  if (intent.status === 'open' && intent.expires_at.getTime() <= Date.now()) {
    console.warn(
      '[webhook] Absicht ' + intent.id + ' ist abgelaufen (expires_at=' + intent.expires_at.toISOString() + ') - keine Gutschrift',
    );
    return { ...gemeinsame, processed: false, result: 'expired_intent', subscriptionId: null };
  }

  // Schon eingeloest: Schicht 3 hat bereits gegriffen (oder ein paralleler
  // Aufruf war schneller).
  if (intent.status !== 'open') {
    return { ...gemeinsame, processed: false, result: 'intent_not_open', subscriptionId: null };
  }

  // 5. Die Zahlung. Ohne gueltige Transaktionskennung wird NICHT gebucht - eine
  //    Zeile in subscriptions ohne Beleg waere ein Stimmrecht ohne Deckung.
  const paymentTxid = extractPaymentTxid(event.payload);
  if (paymentTxid === null) {
    console.warn(
      '[webhook] InvoiceSettled ohne verwertbare Transaktionskennung (invoice_id=' +
        String(invoiceId) +
        ') - keine Gutschrift',
    );
    return { ...gemeinsame, processed: false, result: 'no_payment_txid', subscriptionId: null };
  }

  // 6./7. Abonnement anlegen und Absicht schliessen. Die Rolle leitet die
  //        Datenbank daraus ab (ADR-003) - sie wird hier nicht gesetzt.
  let ergebnis: SettleResult;
  try {
    ergebnis = await settleIntent(db, intent, paymentTxid, event.timestamp);
  } catch (error) {
    if (error instanceof DuplicatePaymentError) {
      console.warn(
        '[webhook] Transaktion ' + error.paymentTxid + ' traegt bereits ein Abonnement - keine zweite Gutschrift',
      );
      return { ...gemeinsame, processed: false, result: 'duplicate_payment', subscriptionId: null };
    }
    throw error;
  }

  if (!ergebnis.settled) {
    return {
      ...gemeinsame,
      processed: false,
      result: ergebnis.alreadySettled ? 'already_settled' : 'intent_not_open',
      subscriptionId: null,
    };
  }

  return {
    ...gemeinsame,
    processed: true,
    result: 'settled',
    closedIntent: false,
    userId: ergebnis.userId,
    subscriptionId: ergebnis.subscriptionId,
  };
}

/** Die Schluessel, die die Antwort traegt - in beiden Faellen dieselben. */
export function webhookResponse(outcome: WebhookOutcome): Record<string, unknown> {
  return {
    status: 'OK',
    processed: outcome.processed,
    result: outcome.result,
    event: outcome.event,
    invoiceId: outcome.invoiceId,
    intentId: outcome.intentId,
    userId: outcome.userId,
    subscriptionId: outcome.subscriptionId,
    isRedelivery: outcome.isRedelivery,
    // manually_marked aus der Zustellung. Es meldet nur, WIE die Zahlung
    // festgestellt wurde (von Hand oder automatisch) - die Buchung haengt nicht
    // daran, siehe api/README.md. In der Antwort steht es, damit ein Betreiber
    // eine von Hand markierte Zahlung im Protokoll und in der Antwort erkennt.
    manuallyMarked: outcome.manuallyMarked,
    closedIntent: outcome.closedIntent,
  };
}

// -----------------------------------------------------------------------------
// Konfiguration
// -----------------------------------------------------------------------------

export const WEBHOOK_SECRET_ENV = 'BTCPAY_WEBHOOK_SECRET';

/**
 * Das Geheimnis kommt aus BTCPAY_WEBHOOK_SECRET - Pflichtwert ohne Standardwert,
 * genauso wie SESSION_SECRET und DATABASE_URL. Ein Standardwert waere hier
 * besonders schaedlich: er stuende in der Versionsverwaltung, und wer ihn kennt,
 * koennte Zahlungen gutschreiben und damit Stimmrecht verleihen (ADR-003).
 *
 * Erzeugt wird der Wert von BTCPay Server selbst (Store -> Webhooks -> Secret)
 * und ist die Grundlage der HMAC-Signatur ueber den rohen Koerper.
 */
export function webhookSecretFromEnv(source: Record<string, string | undefined> = process.env): string {
  return (source[WEBHOOK_SECRET_ENV] ?? '').trim();
}

/**
 * Die Meldung, wenn das Geheimnis fehlt. Sie nennt nur den NAMEN der Variable und
 * nie einen Wert - und sagt, woher der Wert kommt.
 */
export function missingWebhookSecretMessage(): string {
  return [
    'Ungueltige Konfiguration - die API startet nicht:',
    '  - ' + WEBHOOK_SECRET_ENV + ' fehlt (Pflichtwert ohne Standardwert)',
    '    Ohne dieses Geheimnis laesst sich die Signatur des BTCPay-Webhooks nicht',
    '    pruefen - jede beliebige Stelle koennte dann Zahlungen gutschreiben und',
    '    damit Stimmrecht verleihen (ADR-003). Der Wert steht in BTCPay Server',
    '    unter Store -> Webhooks.',
    '    Vorlage mit allen Variablen: api/.env.example',
  ].join('\n');
}