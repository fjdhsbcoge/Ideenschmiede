import { createHmac } from 'node:crypto';

const SECRET = process.env.BTCPAY_WEBHOOK_SECRET;
const basis = 'http://127.0.0.1:55998';
// Genau die Nutzlast der ersten Zustellung: dieselbe Rechnung, dieselbe txid.
const koerper = {
  delivery_id: 'd1df39e0-5033-4470-ac4a-fbd25ddf164f',
  webhook_id: 'verify-webhook',
  original_delivery_id: 'd1df39e0-5033-4470-ac4a-fbd25ddf164f',
  is_redelivery: true,
  type: 'InvoiceSettled',
  timestamp: Math.floor(Date.now() / 1000),
  store_id: 'verify-store',
  invoice_id: '416f68d4-a29a-4e8c-b2e3-f9b85f19ad54',
  manually_marked: false,
  over_paid: false,
  metadata: { userId: '3995c085-3840-4ebb-bd41-924412fd1b8c', intentId: '30111aa9-31d1-4ecf-ad80-bc096154d389' },
  payments: [
    {
      id: 'pay-einmalig',
      receivedDate: Math.floor(Date.now() / 1000),
      value: '250000',
      fee: '120',
      status: 'Settled',
      amount: '0.00250000',
      transactionId: 'd6ddd1cdc126c53f93b71f2c12655c8c87a0084c04ed47a4549967b3eb54218f',
      confirmed: true,
    },
  ],
};
const roh = Buffer.from(JSON.stringify(koerper), 'utf8');
const signatur = createHmac('sha256', SECRET).update(roh).digest('hex');
const antwort = await fetch(basis + '/api/webhooks/btcpay', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'BTCPay-Sig': signatur },
  body: roh,
});
console.log('InvoiceSettled erneut, Absicht steht auf open -> HTTP ' + antwort.status + '  ' + (await antwort.text()));
