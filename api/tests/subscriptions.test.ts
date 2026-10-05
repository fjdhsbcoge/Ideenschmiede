/**
 * BTCPay-Webhook (Roadmap Phase 3.3) gegen eine ECHTE PostgreSQL-Datenbank.
 *
 * Zwei Dinge werden hier absichtlich NICHT abgekuerzt:
 *
 *   * Die Signatur laeuft ueber die ROHEN BYTES. Die Tests bauen den Koerper
 *     deshalb mit Buffer.byteLength/tatsaechlichen Bytes und signieren GENAU
 *     diese Bytes mit createHmac - nicht eine JSON.stringify-Variante. Ein Test,
 *     der eine andere Fassung signiert als die, die er sendet, prueft nicht,
 *     was er soll: er prueft dann nur, dass irgendetwas 401 ergibt.
 *   * Es gibt keine Attrappe. Die Idempotenz wird nicht behauptet, sondern in
 *     der Datenbank nachgezaehlt (SELECT count(*) FROM subscriptions), und die
 *     Rolle wird aus users gelesen - gesetzt hat sie der Trigger der Datenbank
 *     (ADR-003), nicht dieser Test und nicht die Anwendung.
 */
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createSessionToken, authConfigFromEnv, type AuthConfig } from '../src/auth.js';
import { closeDb } from '../src/db.js';
import { BTCPAY_SIGNATURE_HEADER, WEBHOOK_SECRET_ENV, computeSignatureHex } from '../src/subscriptions.js';
import { createTestUser, sql } from './helpers.js';

/** Genau das Geheimnis, das vitest.config.ts fuer den Testlauf setzt. */
const WEBHOOK_SECRET = process.env.BTCPAY_WEBHOOK_SECRET as string;

const SECRET_FEHLT = 'geheimnis-fehlt-absichtlich';

const app = await createApp(sql, { cleanupOnStart: async () => undefined });
const appOhneGeheimnis = await createApp(sql, { webhookSecret: '', cleanupOnStart: async () => undefined });

const config: AuthConfig = authConfigFromEnv();

// -----------------------------------------------------------------------------
// Aufraeumbuch
// -----------------------------------------------------------------------------

const angelegteNutzer: string[] = [];

afterAll(async () => {
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

interface IntentBody {
  intentId: string;
  invoiceId: string;
  status: string;
  expiresAt: string;
  metadata: { userId: string; intentId: string };
}

interface WebhookBody {
  status: string;
  processed?: boolean;
  result?: string;
  event?: string | null;
  invoiceId?: string | null;
  intentId?: string | null;
  userId?: string | null;
  subscriptionId?: string | null;
  isRedelivery?: boolean;
  error?: { code: string; message: string };
}

async function neuerNutzer(): Promise<{ id: string; username: string; token: string }> {
  const nutzer = await createTestUser();
  angelegteNutzer.push(nutzer.id);
  return { ...nutzer, token: createSessionToken(nutzer.id, config) };
}

/**
 * Holt eine Absicht ueber die API - mit Sitzung, so wie der Client es tut.
 * Der Aufruf geht wirklich durch die Route (Autorisierung inklusive).
 */
async function absichtHolen(token: string): Promise<{ status: number; body: IntentBody }> {
  const antwort = await app.request('/api/subscriptions/intent', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token },
  });
  return { status: antwort.status, body: (await antwort.json()) as IntentBody };
}

function zufallsTxid(): string {
  let hex = '';
  while (hex.length < 64) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

interface PayloadOptionen {
  type?: string;
  invoiceId: string;
  txid?: string | null;
  isRedelivery?: boolean;
  timestamp?: string;
  ohnePayments?: boolean;
  extra?: Record<string, unknown>;
}

/**
 * Eine Zustellung in der Form, die BTCPay schickt. Die Felder sind genau die
 * der Referenz: _type (BTCPay schreibt es mit Unterstrich), delivery_id,
 * webhook_id, original_delivery_id, is_redelivery, timestamp, store_id,
 * invoice_id, payments - und bei InvoiceSettled zusaetzlich manually_marked
 * und over_paid.
 */
function payload(o: PayloadOptionen): Record<string, unknown> {
  const txid = o.txid === undefined ? zufallsTxid() : o.txid;
  const koerper: Record<string, unknown> = {
    delivery_id: 'delivery-' + zufallsTxid().slice(0, 12),
    webhook_id: 'webhook-test',
    original_delivery_id: 'delivery-' + zufallsTxid().slice(0, 12),
    is_redelivery: o.isRedelivery === true,
    type: o.type ?? 'InvoiceSettled',
    timestamp: o.timestamp ?? Math.floor(Date.now() / 1000),
    store_id: 'store-test',
    invoice_id: o.invoiceId,
  };
  if (o.type === undefined || o.type === 'InvoiceSettled') {
    koerper.manually_marked = false;
    koerper.over_paid = false;
  }
  if (o.ohnePayments !== true) {
    koerper.payments = [
      {
        id: 'payment-' + zufallsTxid().slice(0, 12),
        receivedDate: Math.floor(Date.now() / 1000),
        value: '250000',
        fee: '120',
        status: 'Settled',
        amount: '0.00250000',
        transactionId: txid,
        confirmed: true,
      },
    ];
  }
  return { ...koerper, ...(o.extra ?? {}) };
}

/**
 * Eine Zustellung ueber die ECHTE HTTP-Strecke der App senden. `roh` sind die
 * Bytes, die auf der Leitung liegen; signiert wird genau dieses Buffer. Wer
 * einen anderen Koerper signiert, kann das ueber `signiereUeber` tun - genau
 * damit wird die Rohbyte-Bindung nachgewiesen.
 */
async function zustellen(
  roh: Buffer,
  optionen: {
    signiereUeber?: Buffer;
    signatur?: string | null;
    ohneKopf?: boolean;
    secret?: string;
    client?: typeof app;
  } = {},
): Promise<{ status: number; body: WebhookBody }> {
  const secret = optionen.secret ?? WEBHOOK_SECRET;
  const kopfOderNull =
    optionen.signatur !== undefined
      ? optionen.signatur
      : createHmac('sha256', secret).update(optionen.signiereUeber ?? roh).digest('hex');

  const kopf: Record<string, string> = { 'content-type': 'application/json' };
  if (optionen.ohneKopf !== true && kopfOderNull !== null) {
    kopf[BTCPAY_SIGNATURE_HEADER] = kopfOderNull;
  }

  const antwort = await (optionen.client ?? app).request('/api/webhooks/btcpay', {
    method: 'POST',
    headers: kopf,
    body: roh,
  });
  return { status: antwort.status, body: (await antwort.json()) as WebhookBody };
}

function jsonBytes(wert: unknown): Buffer {
  return Buffer.from(JSON.stringify(wert), 'utf8');
}

async function zaehleSubscriptions(userId: string): Promise<number> {
  const rows = await sql<{ anzahl: string }[]>`
      SELECT count(*)::text AS anzahl FROM subscriptions WHERE user_id = ${userId}
  `;
  return Number(rows[0]?.anzahl ?? '0');
}

async function rolleVon(userId: string): Promise<string> {
  const rows = await sql<{ role: string }[]>`SELECT role FROM users WHERE id = ${userId}`;
  return rows[0]?.role ?? '';
}

async function aboZeilen(userId: string): Promise<{ type: string; active: boolean; payment_txid: string | null; expires_at: Date }[]> {
  return sql<{ type: string; active: boolean; payment_txid: string | null; expires_at: Date }[]>`
      SELECT type, active, payment_txid, expires_at FROM subscriptions WHERE user_id = ${userId}
  `;
}

interface IntentZeile {
  status: string;
  settled_at: Date | null;
  expires_at: Date;
}

async function intentZeile(intentId: string): Promise<IntentZeile> {
  const rows = await sql<IntentZeile[]>`
      SELECT status, settled_at, expires_at FROM subscription_intents WHERE id = ${intentId}
  `;
  const zeile = rows[0];
  if (zeile === undefined) {
    throw new Error('Absicht nicht gefunden: ' + intentId);
  }
  return zeile;
}

function secretFuerKindprozess(): string {
  return (process.env.SESSION_SECRET ?? 'x').repeat(2).slice(0, 40);
}

/** Der Port der beiden Starttests - bewusst hoch und ungewoehnlich. */
const PORT_FUER_STARTTEST = 55999;

const SERVER_PFAD = fileURLToPath(new URL('../src/server.ts', import.meta.url));
const TSX_PFAD = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));

/**
 * Startet src/server.ts als eigenen Prozess - der Start ist das, was hier
 * geprueft wird, und ein Start laesst sich nicht im selben Prozess nachstellen.
 */
function starteServer(umgebung: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [TSX_PFAD, SERVER_PFAD], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: umgebung,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function umgebungMit(secret: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: secretFuerKindprozess(),
    AUTH_BASE_URL: 'https://auth.test.invalid',
    PORT: String(PORT_FUER_STARTTEST),
    NODE_ENV: 'test',
  };
  if (secret === null) {
    delete env[WEBHOOK_SECRET_ENV];
  } else {
    env[WEBHOOK_SECRET_ENV] = secret;
  }
  return env;
}

// -----------------------------------------------------------------------------
// Absicht anlegen
// -----------------------------------------------------------------------------

describe('POST /api/subscriptions/intent', () => {
  it('ohne Sitzung 401 - und keine Zeile', async () => {
    const antwort = await app.request('/api/subscriptions/intent', { method: 'POST' });
    expect(antwort.status).toBe(401);
  });

  it('legt eine Absicht an und liefert invoiceId und metadata', async () => {
    const nutzer = await neuerNutzer();
    const { status, body } = await absichtHolen(nutzer.token);

    expect(status).toBe(200);
    expect(body.status).toBe('open');
    expect(body.invoiceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.metadata).toEqual({ userId: nutzer.id, intentId: body.intentId });

    // Die Zeile existiert wirklich, und sie gehoert diesem Nutzer.
    const zeile = await intentZeile(body.intentId);
    expect(zeile.status).toBe('open');
    expect(zeile.settled_at).toBeNull();
    expect(zeile.expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('ein zweiter Aufruf liefert DIESELBE Absicht (die Nutzlast der Rechnung ist unveraenderlich)', async () => {
    const nutzer = await neuerNutzer();
    const erste = await absichtHolen(nutzer.token);
    const zweite = await absichtHolen(nutzer.token);

    expect(zweite.body.intentId).toBe(erste.body.intentId);
    expect(zweite.body.invoiceId).toBe(erste.body.invoiceId);

    const rows = await sql<{ anzahl: string }[]>`
        SELECT count(*)::text AS anzahl FROM subscription_intents WHERE user_id = ${nutzer.id}
    `;
    expect(Number(rows[0]?.anzahl)).toBe(1);
  });

  it('mit aktivem Abonnement 409 statt einer zweiten Absicht', async () => {
    const nutzer = await neuerNutzer();
    await sql`
        INSERT INTO subscriptions (user_id, type, active, started_at, expires_at, payment_txid)
        VALUES (${nutzer.id}, 'annual', true, now(), now() + interval '1 year', ${zufallsTxid()})
    `;
    const antwort = await app.request('/api/subscriptions/intent', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + nutzer.token },
    });
    expect(antwort.status).toBe(409);
  });
});

// -----------------------------------------------------------------------------
// Signatur
// -----------------------------------------------------------------------------

describe('Signaturpruefung des BTCPay-Webhooks', () => {
  it('ungueltige Signatur -> 401, und NICHTS wird angelegt', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const roh = jsonBytes(payload({ invoiceId: absicht.body.invoiceId }));

    const falsch = 'a'.repeat(64);
    const antwort = await zustellen(roh, { signatur: falsch });

    expect(antwort.status).toBe(401);
    expect(antwort.body.error?.code).toBe('invalid_signature');
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);
    expect((await intentZeile(absicht.body.intentId)).status).toBe('open');
    expect(await rolleVon(nutzer.id)).toBe('visitor');
  });

  it('fehlender Signaturkopf -> 401', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const roh = jsonBytes(payload({ invoiceId: absicht.body.invoiceId }));

    const antwort = await zustellen(roh, { ohneKopf: true });
    expect(antwort.status).toBe(401);
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);
  });

  it('Signatur ueber einen ANDEREN Body -> 401 (die Rohbyte-Bindung)', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);

    // Derselbe Inhalt, zwei Serialisierungen: die eine kompakt, die andere mit
    // Leerzeichen. Beide sind gueltiges JSON und bedeuten dasselbe - fuer die
    // HMAC sind es VERSCHIEDENE Bytes.
    const inhalt = payload({ invoiceId: absicht.body.invoiceId });
    const kompakt = Buffer.from(JSON.stringify(inhalt), 'utf8');
    const mitLeerzeichen = Buffer.from(JSON.stringify(inhalt, null, 2), 'utf8');
    expect(kompakt.equals(mitLeerzeichen)).toBe(false);
    expect(computeSignatureHex(WEBHOOK_SECRET, kompakt)).not.toBe(
      computeSignatureHex(WEBHOOK_SECRET, mitLeerzeichen),
    );

    // Signatur der kompakten Fassung, gesendet wird die eingerueckte -> 401.
    const abgewiesen = await zustellen(mitLeerzeichen, { signiereUeber: kompakt });
    expect(abgewiesen.status).toBe(401);
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);

    // Dieselben Bytes signiert und gesendet -> angenommen. Damit ist belegt,
    // dass die 401 oben an den Bytes lag und nicht an der Anfrage.
    const angenommen = await zustellen(mitLeerzeichen);
    expect(angenommen.status).toBe(200);
    expect(angenommen.body.processed).toBe(true);
  });

  it('Signatur mit anderem Geheimnis -> 401', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const roh = jsonBytes(payload({ invoiceId: absicht.body.invoiceId }));

    const antwort = await zustellen(roh, { secret: SECRET_FEHLT });
    expect(antwort.status).toBe(401);
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);
  });

  it('ohne konfiguriertes Geheimnis -> 401, nie eine Verarbeitung', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const roh = jsonBytes(payload({ invoiceId: absicht.body.invoiceId }));

    // Die Signatur ist mit dem TESTGEHEIMNIS korrekt gebildet - die App hat aber
    // keines. Ohne Geheimnis kann nichts geprueft werden, also wird nichts
    // verarbeitet.
    const antwort = await zustellen(roh, { client: appOhneGeheimnis });
    expect(antwort.status).toBe(401);
    expect(antwort.body.error?.code).toBe('missing_secret');
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// Gutschrift
// -----------------------------------------------------------------------------

describe('InvoiceSettled schreibt gut', () => {
  it('legt das Abonnement an UND setzt role auf subscriber (Trigger, nicht Anwendung)', async () => {
    const nutzer = await neuerNutzer();
    expect(await rolleVon(nutzer.id)).toBe('visitor');

    const absicht = await absichtHolen(nutzer.token);
    const txid = zufallsTxid();
    const roh = jsonBytes(payload({ invoiceId: absicht.body.invoiceId, txid }));

    const antwort = await zustellen(roh);
    expect(antwort.status).toBe(200);
    expect(antwort.body.processed).toBe(true);
    expect(antwort.body.result).toBe('settled');
    expect(antwort.body.userId).toBe(nutzer.id);

    const abos = await aboZeilen(nutzer.id);
    expect(abos).toHaveLength(1);
    expect(abos[0]?.type).toBe('annual');
    expect(abos[0]?.active).toBe(true);
    expect(abos[0]?.payment_txid).toBe(txid);
    expect(abos[0]?.expires_at.getTime()).toBeGreaterThan(Date.now());

    // Die Rolle ist die Folge des Triggers subscriptions_sync_user_role_trg -
    // die Anwendung setzt sie nirgends.
    expect(await rolleVon(nutzer.id)).toBe('subscriber');

    const zeile = await intentZeile(absicht.body.intentId);
    expect(zeile.status).toBe('settled');
    expect(zeile.settled_at).not.toBeNull();
  });

  it('eine andere Schreibweise der txid trifft dieselbe Zahlung (Normalisierung)', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const txid = zufallsTxid();

    const antwort = await zustellen(jsonBytes(payload({ invoiceId: absicht.body.invoiceId, txid: txid.toUpperCase() })));
    expect(antwort.body.processed).toBe(true);

    // normalize_txid_case() legt die Spalte kanonisch klein ab.
    const abos = await aboZeilen(nutzer.id);
    expect(abos[0]?.payment_txid).toBe(txid);
  });

  it('manually_marked wird im Antwortkoerper gemeldet, aendert die Buchung aber nicht', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const roh = jsonBytes(
      payload({ invoiceId: absicht.body.invoiceId, extra: { manually_marked: true, over_paid: false } }),
    );

    const antwort = await zustellen(roh);
    expect(antwort.status).toBe(200);
    // Gemeldet:
    expect((antwort.body as { manuallyMarked?: boolean }).manuallyMarked).toBe(true);
    // Und trotzdem verbucht - die Auslegung aus api/README.md, Punkt 26.
    expect(antwort.body.processed).toBe(true);
    expect(await zaehleSubscriptions(nutzer.id)).toBe(1);
  });
  it('InvoiceSettled ohne verwertbare Transaktionskennung -> 200, aber kein Abonnement', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const roh = jsonBytes(payload({ invoiceId: absicht.body.invoiceId, ohnePayments: true }));

    const antwort = await zustellen(roh);
    expect(antwort.status).toBe(200);
    expect(antwort.body.processed).toBe(false);
    expect(antwort.body.result).toBe('no_payment_txid');
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);
    expect((await intentZeile(absicht.body.intentId)).status).toBe('open');
  });
});

// -----------------------------------------------------------------------------
// Idempotenz - die drei Schichten
// -----------------------------------------------------------------------------

describe('Idempotenz', () => {
  it('DIESELBE Zustellung ZWEIMAL -> genau eine Abo-Zeile, keine Verlaengerung', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const txid = zufallsTxid();
    const roh = jsonBytes(payload({ invoiceId: absicht.body.invoiceId, txid }));

    const erste = await zustellen(roh);
    expect(erste.body.processed).toBe(true);
    const abosNachErstem = await aboZeilen(nutzer.id);

    const zweite = await zustellen(roh);
    expect(zweite.status).toBe(200);
    expect(zweite.body.processed).toBe(false);
    expect(zweite.body.result).toBe('intent_not_open');

    // Die ZAHL: eine Zeile, und ihre Frist ist unveraendert.
    const abosNachZweitem = await aboZeilen(nutzer.id);
    expect(abosNachZweitem).toHaveLength(1);
    expect(abosNachZweitem[0]?.expires_at.getTime()).toBe(abosNachErstem[0]?.expires_at.getTime());
    expect(await zaehleSubscriptions(nutzer.id)).toBe(1);
    expect(await rolleVon(nutzer.id)).toBe('subscriber');
  });

  it('is_redelivery = true: eine ERNEUTE Zustellung bucht nichts doppelt', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const txid = zufallsTxid();

    const erste = await zustellen(jsonBytes(payload({ invoiceId: absicht.body.invoiceId, txid })));
    expect(erste.body.processed).toBe(true);

    const wiederholung = await zustellen(
      jsonBytes(
        payload({
          invoiceId: absicht.body.invoiceId,
          txid,
          isRedelivery: true,
          extra: { original_delivery_id: 'delivery-original' },
        }),
      ),
    );
    expect(wiederholung.status).toBe(200);
    expect(wiederholung.body.processed).toBe(false);
    expect(wiederholung.body.isRedelivery).toBe(true);
    expect(await zaehleSubscriptions(nutzer.id)).toBe(1);

    // Und der Gegentest zur Behauptung "is_redelivery ist nicht die
    // Absicherung": eine ERSTE Zustellung mit is_redelivery = true wird ohne
    // Zaudern verbucht. Wer sich auf das Feld verliesse, liesse hier eine echte
    // Zahlung liegen.
    const zweiterNutzer = await neuerNutzer();
    const zweiteAbsicht = await absichtHolen(zweiterNutzer.token);
    const alsWiederholungMarkiert = await zustellen(
      jsonBytes(payload({ invoiceId: zweiteAbsicht.body.invoiceId, isRedelivery: true })),
    );
    expect(alsWiederholungMarkiert.body.processed).toBe(true);
    expect(await zaehleSubscriptions(zweiterNutzer.id)).toBe(1);
  });

  it('zweite Rechnung mit DERSELBEN Transaktion -> keine zweite Gutschrift (UNIQUE auf lower(payment_txid))', async () => {
    const ersterNutzer = await neuerNutzer();
    const zweiterNutzer = await neuerNutzer();
    const ersteAbsicht = await absichtHolen(ersterNutzer.token);
    const zweiteAbsicht = await absichtHolen(zweiterNutzer.token);
    const txid = zufallsTxid();

    const erste = await zustellen(jsonBytes(payload({ invoiceId: ersteAbsicht.body.invoiceId, txid })));
    expect(erste.body.processed).toBe(true);

    const zweite = await zustellen(
      jsonBytes(payload({ invoiceId: zweiteAbsicht.body.invoiceId, txid: txid.toUpperCase() })),
    );
    expect(zweite.status).toBe(200);
    expect(zweite.body.processed).toBe(false);
    expect(zweite.body.result).toBe('duplicate_payment');

    expect(await zaehleSubscriptions(ersterNutzer.id)).toBe(1);
    expect(await zaehleSubscriptions(zweiterNutzer.id)).toBe(0);
    // Keine halbe Buchung: die Absicht bleibt offen, weil der Rollback den
    // Statuswechsel mitnimmt.
    expect((await intentZeile(zweiteAbsicht.body.intentId)).status).toBe('open');
    expect(await rolleVon(zweiterNutzer.id)).toBe('visitor');
  });

  it('zwei GLEICHZEITIGE Zustellungen -> genau eine Gutschrift', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const roh = jsonBytes(payload({ invoiceId: absicht.body.invoiceId }));

    const [a, b] = await Promise.all([zustellen(roh), zustellen(roh)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect([a.body.processed, b.body.processed].filter(Boolean)).toHaveLength(1);
    expect(await zaehleSubscriptions(nutzer.id)).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// Ereignisse, die nichts buchen
// -----------------------------------------------------------------------------

describe('Ereignisse ohne Gutschrift', () => {
  it.each(['InvoiceCreated', 'InvoiceReceivedPayment', 'InvoiceProcessing', 'InvoiceExpired', 'InvoicePaymentSettled', 'InvoiceInvalid'])(  
    '%s -> 200, aber keine Gutschrift',
    async (typ) => {
      const nutzer = await neuerNutzer();
      const absicht = await absichtHolen(nutzer.token);
      const roh = jsonBytes(payload({ type: typ, invoiceId: absicht.body.invoiceId }));

      const antwort = await zustellen(roh);
      expect(antwort.status).toBe(200);
      expect(antwort.body.processed).toBe(false);
      expect(antwort.body.result).toBe('ignored_event');
      expect(await zaehleSubscriptions(nutzer.id)).toBe(0);
      expect(await rolleVon(nutzer.id)).toBe('visitor');
    },
  );

  it.each([
    ['InvoiceExpired', 'expired'],
    ['InvoiceInvalid', 'invalid'],
  ])('%s schliesst die Absicht (Status %s), bucht aber nichts', async (typ, erwarteterStatus) => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);

    const antwort = await zustellen(jsonBytes(payload({ type: typ, invoiceId: absicht.body.invoiceId })));
    expect(antwort.status).toBe(200);
    expect(antwort.body.processed).toBe(false);
    expect(antwort.body.result).toBe('ignored_event');
    expect((antwort.body as { closedIntent?: boolean }).closedIntent).toBe(true);

    // Der Status der Absicht steht jetzt auf dem, was wirklich gilt. Vorher war
    // 'expired'/'invalid' ein Wert, den niemand schreiben konnte.
    const zeile = await sql<{ status: string }[]>`
        SELECT status FROM subscription_intents WHERE id = ${absicht.body.intentId}
    `;
    expect(zeile[0]?.status).toBe(erwarteterStatus);
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);

    // Und die verspaetete Zahlung auf dieselbe Rechnung begruendet kein
    // Abonnement mehr - die Absicht ist nicht mehr offen.
    const nachzuegler = await zustellen(jsonBytes(payload({ invoiceId: absicht.body.invoiceId })));
    expect(nachzuegler.status).toBe(200);
    expect(nachzuegler.body.processed).toBe(false);
    expect(nachzuegler.body.result).toBe('intent_not_open');
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);
    expect(await rolleVon(nutzer.id)).toBe('visitor');
  });

  it('InvoiceExpired zu einer UNBEKANNTEN Rechnung schliesst nichts und ergibt 200', async () => {
    const antwort = await zustellen(
      jsonBytes(payload({ type: 'InvoiceExpired', invoiceId: 'unbekannt-' + zufallsTxid().slice(0, 8) })),
    );
    expect(antwort.status).toBe(200);
    expect(antwort.body.result).toBe('ignored_event');
    expect((antwort.body as { closedIntent?: boolean }).closedIntent).toBe(false);
  });
  it('unbekannte invoice_id -> 200 mit Vermerk, NICHT 404', async () => {
    const roh = jsonBytes(payload({ invoiceId: 'unbekannte-rechnung-' + zufallsTxid().slice(0, 8) }));
    const antwort = await zustellen(roh);
    expect(antwort.status).toBe(200);
    expect(antwort.body.processed).toBe(false);
    expect(antwort.body.result).toBe('unknown_invoice');
  });

  it('abgelaufene Absicht -> 200, keine Gutschrift (und die Absicht bleibt offen)', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);

    // Die Frist wird direkt in der Datenbank in die Vergangenheit gesetzt. Der
    // CHECK subscription_intents_expiry_check verbietet expires_at <= created_at,
    // also wird auch created_at mitgenommen.
    await sql`
        UPDATE subscription_intents
           SET created_at = now() - interval '2 days',
               expires_at = now() - interval '1 day'
         WHERE id = ${absicht.body.intentId}
    `;

    const antwort = await zustellen(jsonBytes(payload({ invoiceId: absicht.body.invoiceId })));
    expect(antwort.status).toBe(200);
    expect(antwort.body.processed).toBe(false);
    expect(antwort.body.result).toBe('expired_intent');
    expect(await zaehleSubscriptions(nutzer.id)).toBe(0);
    expect(await rolleVon(nutzer.id)).toBe('visitor');
    expect((await intentZeile(absicht.body.intentId)).status).toBe('open');
  });

  it('kaputter Koerper mit gueltiger Signatur -> 400 (kein stiller Erfolg)', async () => {
    const roh = Buffer.from('{kein json', 'utf8');
    const antwort = await zustellen(roh);
    expect(antwort.status).toBe(400);
    expect(antwort.body.error?.code).toBe('malformed_body');
  });
});

// -----------------------------------------------------------------------------
// Ablauf der Rolle und Start der API
// -----------------------------------------------------------------------------

describe('Ablauf und Start', () => {
  it('expires_at in der Vergangenheit -> role faellt auf user', async () => {
    const nutzer = await neuerNutzer();
    const absicht = await absichtHolen(nutzer.token);
    const txid = zufallsTxid();
    expect((await zustellen(jsonBytes(payload({ invoiceId: absicht.body.invoiceId, txid })))).body.processed).toBe(true);
    expect(await rolleVon(nutzer.id)).toBe('subscriber');

    // Das Abonnement laeuft ab. Ein UPDATE auf subscriptions feuert
    // subscriptions_sync_user_role_trg - die Rolle ist eine Ableitung, kein
    // zweiter Wahrheitswert.
    await sql`
        UPDATE subscriptions
           SET started_at = now() - interval '2 years', expires_at = now() - interval '1 day'
         WHERE user_id = ${nutzer.id}
    `;
    expect(await rolleVon(nutzer.id)).toBe('user');

    // Und eine STIMME ist danach nicht mehr moeglich - ADR-003 wird in der
    // Datenbank durchgesetzt. Der Beweis dafuer gehoert hierher, weil genau
    // diese Kette (Webhook -> Abo -> Stimmrecht) der Zweck der Phase ist.
    const autor = await neuerNutzer();
    const ideen = await sql<{ id: string }[]>`
        INSERT INTO ideas (author_id, title, description, language, stage)
        VALUES (${autor.id}, ${'Ablauftest ' + zufallsTxid().slice(0, 8)},
                ${'Eine Idee fuer den Ablauftest des Webhooks, deutlich ueber zwanzig Zeichen.'},
                'de', 'voting')
        RETURNING id
    `;
    const ideeId = ideen[0]?.id as string;
    await expect(
      sql`INSERT INTO idea_votes (idea_id, user_id, direction) VALUES (${ideeId}, ${nutzer.id}, 'up')`,
    ).rejects.toThrow(/ADR-003/);
    await sql`DELETE FROM ideas WHERE id = ${ideeId}`;
  });

  it('ein abgelaufenes Abonnement blockiert eine neue Absicht NICHT', async () => {
    const nutzer = await neuerNutzer();
    const erste = await absichtHolen(nutzer.token);

    // Ein Abonnement, das abgelaufen ist: active = false, expires_at in der
    // Vergangenheit. Es ist Historie (Entscheidung 2), kein Hindernis - die
    // 409-Pruefung fragt nach einem AKTIVEN Abonnement und darf hier nicht
    // greifen.
    await sql`
        INSERT INTO subscriptions (user_id, type, active, started_at, expires_at, payment_txid)
        VALUES (${nutzer.id}, 'annual', false, now() - interval '2 years', now() - interval '1 day', ${zufallsTxid()})
    `;
    const zweite = await absichtHolen(nutzer.token);
    expect(zweite.status).toBe(200);

    // Dieselbe Absicht: sie ist offen und innerhalb der Frist, und ihre Kennung
    // steckt bereits in einer Rechnung bei BTCPay - eine zweite waere eine
    // Absicht, die niemand mehr bedient. Genau deshalb ist die Wiederverwendung
    // gewollt und nicht eine neue Zeile.
    expect(zweite.body.intentId).toBe(erste.body.intentId);
    expect(zweite.body.status).toBe('open');
  });

  it('fehlendes BTCPAY_WEBHOOK_SECRET -> der Start bricht ab', () => {
    const lauf = starteServer(umgebungMit(null));
    const ausgabe = (lauf.stdout ?? '') + (lauf.stderr ?? '');
    expect(ausgabe).toContain(WEBHOOK_SECRET_ENV + ' fehlt');
    expect(lauf.status).toBe(1);
  });

  it('mit gesetztem BTCPAY_WEBHOOK_SECRET bricht der Start NICHT daran ab', async () => {
    // Derselbe Start, nur MIT dem Geheimnis. Damit der Kindprozess nicht bis zum
    // Timeout laeuft (ein laufender Server endet von allein nicht), wird der Port
    // vorher belegt: der Server meldet dann EADDRINUSE und endet - aber erst NACH
    // der Konfigurationspruefung. Die Ausgabe unten zeigt, dass er bis dorthin
    // gekommen ist.
    const belegt = net.createServer();
    await new Promise<void>((fertig) => belegt.listen(0, '127.0.0.1', fertig));
    const adresse = belegt.address();
    if (adresse === null || typeof adresse === 'string') {
      throw new Error('Der Sperrserver hat keine Portnummer geliefert.');
    }
    try {
      const lauf = starteServer({
        ...umgebungMit('ein-testgeheimnis-fuer-den-kindprozess'),
        PORT: String(adresse.port),
      });
      const ausgabe = (lauf.stdout ?? '') + (lauf.stderr ?? '');
      expect(ausgabe).not.toContain(WEBHOOK_SECRET_ENV + ' fehlt');
      expect(ausgabe).toContain('Port ' + adresse.port + ' ist bereits belegt');
      expect(lauf.status).toBe(1);
    } finally {
      await new Promise<void>((fertig) => belegt.close(() => fertig()));
    }
  });
});

// -----------------------------------------------------------------------------
// Die Signaturfunktion selbst
// -----------------------------------------------------------------------------

describe('computeSignatureHex', () => {
  it('rechnet ueber Bytes, nicht ueber Text - ein Byte Unterschied ist ein anderer HMAC', () => {
    const a = Buffer.from('{"a":1}', 'utf8');
    const b = Buffer.from('{"a": 1}', 'utf8');
    expect(computeSignatureHex('geheim', a)).toMatch(/^[0-9a-f]{64}$/);
    expect(computeSignatureHex('geheim', a)).not.toBe(computeSignatureHex('geheim', b));
  });
});

beforeAll(() => {
  if (WEBHOOK_SECRET === undefined || WEBHOOK_SECRET === '') {
    throw new Error(
      'BTCPAY_WEBHOOK_SECRET ist im Testlauf nicht gesetzt - vitest.config.ts setzt es auf einen Testwert.',
    );
  }
});