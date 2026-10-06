/**
 * Die Belegpruefung des Zahlungswegs (extractPaymentTxid).
 *
 * Diese Funktion entscheidet, ob eine Zahlung ueberhaupt ein Abonnement
 * begruendet. Sie hatte bis hierher KEINEN Test - und genau dort lag eine
 * Luecke: geprueft wurde nur die FORM der Kennung (64 Hex-Zeichen). Der
 * payment_hash einer Lightning-Zahlung hat dieselbe Form. Eine Blitz-Zahlung
 * mit gefuelltem transactionId waere damit als Beleg durchgegangen, obwohl
 * dieses Projekt nur Ketten-Zahlungen als Beleg akzeptiert.
 *
 * Die Zahlungsarten sind hier ausgeschrieben, wie BTCPay sie liefert.
 *
 * Reine Rechenpruefung, keine Datenbank: die Funktion ist rein.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { extractPaymentTxid } from '../src/subscriptions.js';

/** Gueltige Kennung einer Ketten-Zahlung. */
const KETTE = '9f2c1d4e5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f';
/** Kennung einer ZWEITEN Ketten-Zahlung. */
const KETTE2 = 'aa11bb22cc33dd44ee55ff6600778899aabbccddeeff00112233445566778899';
/**
 * Der payment_hash einer Blitz-Zahlung. 64 Hex-Zeichen - von einer
 * Ketten-Kennung durch die FORM nicht zu unterscheiden.
 */
function blitzHash(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

describe('extractPaymentTxid - nur Ketten-Zahlungen sind ein Beleg', () => {
  it('nimmt die Kennung einer Ketten-Zahlung an', () => {
    const txid = extractPaymentTxid({
      payments: [{ paymentMethod: 'BTC', transactionId: KETTE, confirmed: true, amount: '120000' }],
    });
    expect(txid).toBe(KETTE);
  });

  it('gibt die Kennung klein zurueck - die Identitaet haengt nicht an der Schreibweise', () => {
    const txid = extractPaymentTxid({
      payments: [{ paymentMethod: 'BTC', transactionId: KETTE.toUpperCase(), confirmed: true }],
    });
    expect(txid).toBe(KETTE);
    expect(txid).toBe(txid?.toLowerCase());
  });

  it('lehnt eine Blitz-Zahlung ab, selbst wenn transactionId gefuellt ist', () => {
    const hash = blitzHash('blitz-1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const txid = extractPaymentTxid({
      payments: [{ paymentMethod: 'BTC-LightningLike', transactionId: hash, confirmed: true }],
    });
    expect(txid).toBeNull();
  });

  it('lehnt auch BTC-LightningNetwork ab - die Schreibweise entscheidet nicht', () => {
    const txid = extractPaymentTxid({
      payments: [{ paymentMethod: 'BTC-LightningNetwork', transactionId: blitzHash('blitz-2'), confirmed: true }],
    });
    expect(txid).toBeNull();
  });

  it('nimmt die Ketten-Zahlung, auch wenn die groessere Blitz-Zahlung daneben steht', () => {
    const txid = extractPaymentTxid({
      payments: [
        { paymentMethod: 'BTC', transactionId: KETTE, confirmed: true, amount: '1000' },
        { paymentMethod: 'BTC-LightningLike', transactionId: blitzHash('blitz-gross'), confirmed: true, amount: '999999' },
      ],
    });
    expect(txid).toBe(KETTE);
  });

  it('bevorzugt die bestaetigte vor der groesseren unbestaetigten Zahlung', () => {
    const txid = extractPaymentTxid({
      payments: [
        { paymentMethod: 'BTC', transactionId: KETTE2, confirmed: false, amount: '500000' },
        { paymentMethod: 'BTC', transactionId: KETTE, confirmed: true, amount: '1000' },
      ],
    });
    expect(txid).toBe(KETTE);
  });

  it('findet die Kennung auch als txid statt als transactionId', () => {
    const txid = extractPaymentTxid({ payments: [{ paymentMethod: 'BTC', txid: KETTE, confirmed: true }] });
    expect(txid).toBe(KETTE);
  });

  it('nimmt eine Kennung ohne Zahlungsart an - die Form muss stimmen', () => {
    expect(extractPaymentTxid({ payments: [{ transactionId: KETTE, confirmed: true }] })).toBe(KETTE);
    expect(extractPaymentTxid({ txid: KETTE })).toBe(KETTE);
  });

  it('lehnt eine Kennung ab, die die Form verletzt', () => {
    const falsch = ['', 'abc', KETTE + 'ff', KETTE.slice(0, 63), 'z'.repeat(64)];
    for (const wert of falsch) {
      expect(extractPaymentTxid({ payments: [{ paymentMethod: 'BTC', transactionId: wert }] })).toBeNull();
    }
  });

  it('ohne Zahlungen wird nicht gebucht', () => {
    expect(extractPaymentTxid({})).toBeNull();
    expect(extractPaymentTxid({ payments: [] })).toBeNull();
    expect(extractPaymentTxid({ payments: 'keine Liste' })).toBeNull();
    expect(extractPaymentTxid({ payments: [null, 42] })).toBeNull();
  });
});
