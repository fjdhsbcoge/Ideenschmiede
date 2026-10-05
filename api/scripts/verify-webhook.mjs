/**
 * Verifikationsskript (nicht Teil der Testsuite): legt einen Nutzer samt
 * Identitaet in der Datenbank an, holt per HTTP eine Absicht und stellt die
 * Zustellung eines BTCPay-Webhooks dreimal zu:
 *
 *   1. korrekt signiert                    -> 200, Gutschrift
 *   2. DIESELBEN Bytes ein zweites Mal     -> 200, keine zweite Gutschrift
 *   3. Koerper veraendert, Signatur der
 *      Originalbytes                       -> 401, keine Verarbeitung
 *
 * Aufruf:  node scripts/verify-webhook.mjs http://127.0.0.1:55998
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { createSessionToken } from '../dist/auth.js';

const basis = process.argv[2] ?? 'http://127.0.0.1:55998';
const SECRET = process.env.BTCPAY_WEBHOOK_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
if (SECRET === undefined || SESSION_SECRET === undefined || DATABASE_URL === undefined) {
  throw new Error('BTCPAY_WEBHOOK_SECRET, SESSION_SECRET und DATABASE_URL muessen gesetzt sein');
}

const sql = postgres(DATABASE_URL, { onnotice: () => {} });
const endung = randomBytes(4).toString('hex');

const [nutzer] = await sql.unsafe(
  'INSERT INTO users (username, display_name, email, language) VALUES ($1, $2, $3, $4) RETURNING id, role',
  ['veri_' + endung, 'Verifikationsnutzer', 'veri_' + endung + '@example.invalid', 'de'],
);
await sql.unsafe('INSERT INTO auth_identities (user_id, linking_key) VALUES ($1, $2)', [
  nutzer.id,
  '02' + randomBytes(32).toString('hex'),
]);
console.log('1) Nutzer angelegt: user_id=' + nutzer.id + ' role=' + nutzer.role);

const token = createSessionToken(nutzer.id, {
  secret: SESSION_SECRET,
  baseUrl: basis,
  now: Date.now,
});
const intentAntwort = await fetch(basis + '/api/subscriptions/intent', {
  method: 'POST',
  headers: { authorization: 'Bearer ' + token },
});
const intent = await intentAntwort.json();
console.log('2) POST /api/subscriptions/intent -> HTTP ' + intentAntwort.status);
console.log('   Antwort: ' + JSON.stringify(intent));
if (intentAntwort.status !== 200) process.exit(1);

const txid = randomBytes(32).toString('hex');
const koerper = {
  delivery_id: randomUUID(),
  webhook_id: 'verify-webhook',
  original_delivery_id: randomUUID(),
  is_redelivery: false,
  type: 'InvoiceSettled',
  timestamp: Math.floor(Date.now() / 1000),
  store_id: 'verify-store',
  invoice_id: intent.invoiceId,
  manually_marked: false,
  over_paid: false,
  metadata: intent.metadata,
  payments: [
    {
      id: 'pay-' + randomUUID(),
      receivedDate: Math.floor(Date.now() / 1000),
      value: '250000',
      fee: '120',
      status: 'Settled',
      amount: '0.00250000',
      transactionId: txid,
      confirmed: true,
    },
  ],
};

// DIE Bytes, die gesendet werden. Signiert wird genau dieses Buffer - es gibt
// kein JSON.parse/JSON.stringify dazwischen, das andere Bytes erzeugen koennte.
const roh = Buffer.from(JSON.stringify(koerper), 'utf8');
const signatur = createHmac('sha256', SECRET).update(roh).digest('hex');
console.log('3) Rohe Bytes: ' + roh.length + ' Byte');
console.log('   Erste 80 Zeichen der gesendeten Bytes: ' + roh.subarray(0, 80).toString('utf8'));
console.log('   HMAC-SHA256 ueber genau diese Bytes: ' + signatur);

async function zustellen(name, bytes, sig) {
  const antwort = await fetch(basis + '/api/webhooks/btcpay', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'BTCPay-Sig': sig },
    body: bytes,
  });
  const text = await antwort.text();
  console.log(name + ' -> HTTP ' + antwort.status + '  ' + text);
  return { status: antwort.status, text };
}

async function stand(userId) {
  const [a] = await sql.unsafe('SELECT count(*)::int AS abos FROM subscriptions WHERE user_id = $1', [userId]);
  const [r] = await sql.unsafe('SELECT role FROM users WHERE id = $1', [userId]);
  return 'subscriptions=' + a.abos + '  users.role=' + r.role;
}

await zustellen('4) 1. Zustellung (korrekt signiert)', roh, signatur);
console.log('   Datenbank danach: ' + (await stand(nutzer.id)));

await zustellen('5) 2. Zustellung (DIESELBEN Bytes)', roh, signatur);
console.log('   Datenbank danach: ' + (await stand(nutzer.id)));

// Ein Byte mehr am Ende: derselbe Inhalt bis auf das letzte Zeichen, aber ANDERE
// Bytes. Die Signatur der Originalbytes passt dazu nicht mehr.
const veraendert = Buffer.concat([roh.subarray(0, roh.length - 1), Buffer.from(' ', 'utf8')]);
await zustellen('6) 3. Zustellung (Koerper veraendert, Signatur der Originalbytes)', veraendert, signatur);
console.log('   Datenbank danach: ' + (await stand(nutzer.id)));

const [abo] = await sql.unsafe(
  'SELECT id, type, active, payment_txid, started_at, expires_at FROM subscriptions WHERE user_id = $1',
  [nutzer.id],
);
console.log('7) Die Abo-Zeile: id=' + abo.id + ' type=' + abo.type + ' active=' + abo.active);
console.log('   payment_txid=' + abo.payment_txid + ' (identisch mit der gesendeten: ' + (abo.payment_txid === txid) + ')');
console.log('   started_at=' + abo.started_at.toISOString() + ' expires_at=' + abo.expires_at.toISOString());
const [absicht] = await sql.unsafe(
  'SELECT status, settled_at IS NOT NULL AS hat_settled_at FROM subscription_intents WHERE id = $1',
  [intent.intentId],
);
console.log('8) Die Absicht: ' + JSON.stringify(absicht));
console.log('VERIFY-USER-ID=' + nutzer.id);
// --- Zusatz: InvoiceExpired schliesst die Absicht, eine spaete Zahlung bucht nicht
const [zweiter] = await sql.unsafe(
  'INSERT INTO users (username, display_name, email, language) VALUES ($1, $2, $3, $4) RETURNING id',
  ['veri2_' + endung, 'Verifikationsnutzer 2', 'veri2_' + endung + '@example.invalid', 'de'],
);
const token2 = createSessionToken(zweiter.id, { secret: SESSION_SECRET, baseUrl: basis, now: Date.now });
const absicht2 = await (await fetch(basis + '/api/subscriptions/intent', {
  method: 'POST',
  headers: { authorization: 'Bearer ' + token2 },
})).json();

async function zustellen2(name, objekt) {
  const bytes = Buffer.from(JSON.stringify(objekt), 'utf8');
  const sig = createHmac('sha256', SECRET).update(bytes).digest('hex');
  const antwort = await fetch(basis + '/api/webhooks/btcpay', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'BTCPay-Sig': sig },
    body: bytes,
  });
  console.log(name + ' -> HTTP ' + antwort.status + '  ' + (await antwort.text()));
}

const basisKoerper = {
  delivery_id: randomUUID(),
  webhook_id: 'verify-webhook',
  original_delivery_id: randomUUID(),
  is_redelivery: false,
  timestamp: Math.floor(Date.now() / 1000),
  store_id: 'verify-store',
  invoice_id: absicht2.invoiceId,
  payments: [{ transactionId: randomBytes(32).toString('hex'), confirmed: true, amount: '0.0025' }],
};
console.log('10) Absicht 2: ' + absicht2.intentId + ' invoice_id=' + absicht2.invoiceId);
await zustellen2('11) InvoiceExpired', { ...basisKoerper, type: 'InvoiceExpired' });
const [z2] = await sql.unsafe('SELECT status FROM subscription_intents WHERE id = $1', [absicht2.intentId]);
console.log('    Absicht danach: status=' + z2.status);
await zustellen2('12) Danach InvoiceSettled (verspaetete Zahlung)', { ...basisKoerper, type: 'InvoiceSettled' });
const [a2] = await sql.unsafe('SELECT count(*)::int AS abos FROM subscriptions WHERE user_id = $1', [zweiter.id]);
console.log('    subscriptions=' + a2.abos + '  (kein Abonnement aus einer abgeschlossenen Absicht)');
await sql.unsafe('DELETE FROM subscription_intents WHERE user_id = $1', [zweiter.id]);
await sql.unsafe('DELETE FROM users WHERE id = $1', [zweiter.id]);
await sql.unsafe('DELETE FROM subscription_intents WHERE user_id = $1', [nutzer.id]);
await sql.unsafe('DELETE FROM subscriptions WHERE user_id = $1', [nutzer.id]);
await sql.unsafe('DELETE FROM users WHERE id = $1', [nutzer.id]);
console.log('13) Verifikationsdaten wieder entfernt.');
await sql.end();
