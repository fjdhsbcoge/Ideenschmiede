/**
 * bech32 (BIP-173) - nur die Kodierung, die LNURL braucht.
 *
 * LNURL ist nichts weiter als eine bech32-Zeichenkette ueber die Bytes einer
 * https-URL, mit dem Prefix "lnurl":
 *
 *     https://example.com/api/auth/callback?tag=login&k1=...&action=login
 *        ->  LNURL1DP68GURN8GHJ7CT4W...
 *
 * Vom QR-Code bleibt fuer den Nutzer nur diese eine Zeichenkette; der
 * Domainname steckt in den Bytes und ist damit der einzige Teil, der zaehlt
 * (siehe api/README.md, "Domainbindung").
 *
 * Warum hier eine eigene Datei steht, obwohl "keine eigene Krypto" gilt: dies
 * ist keine Krypto. bech32 ist eine Zeichenkodierung mit Pruefsumme - ein
 * Encoder plus sechs Zeichen BCH-Pruefsumme, ohne Schluessel, ohne Geheimnis.
 * Implementiert ist bewusst NUR das Kodieren und NUR die klassische
 * bech32-Pruefsumme (Konstante 1), nicht bech32m (Konstante 0x2bc830a3): LNURL
 * verwendet bech32. Die Umsetzung folgt BIP-173 und ist gegen die dort
 * veroeffentlichten Testvektoren geprueft (tests/auth.test.ts).
 *
 * Die Krypto des Logins (secp256k1, DER-Signatur) liegt vollstaendig in
 * @noble/curves - hier wird kein Byte davon nachgebaut.
 */

/** Das Zeichenalphabet aus BIP-173. Index = 5-Bit-Wert. */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/** Die bech32-Pruefsummenkonstante (BIP-173); bech32m hat einen anderen Wert. */
const BECH32_CONST = 1;

/**
 * Obergrenze aus BIP-173. Sie gilt fuer Adressen; LNURL ist ausdruecklich
 * laenger (LUD-01), deshalb wird sie hier nur als Parameter angeboten und nicht
 * als harte Regel eingebaut.
 */
export const BECH32_MAX_LENGTH = 90;

/** Die Generatorpolynome der Pruefsumme (BIP-173). */
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

/** Ein Schritt der BCH-Pruefsumme ueber einen 5-Bit-Wert. */
function polymodStep(pre: number): number {
  const b = pre >>> 25;
  let chk = ((pre & 0x1ffffff) << 5) >>> 0;
  for (let i = 0; i < 5; i += 1) {
    // Der Zugriff ist durch die Laenge von GENERATOR gedeckt; die Pruefung ist
    // fuer noUncheckedIndexedAccess noetig und kostet nichts.
    const generator = GENERATOR[i] ?? 0;
    if (((b >>> i) & 1) === 1) {
      chk = (chk ^ generator) >>> 0;
    }
  }
  return chk >>> 0;
}

/** Die Human-Readable-Part: je Zeichen das obere und das untere Halbbyte. */
function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (const char of hrp) {
    out.push(char.charCodeAt(0) >> 5);
  }
  out.push(0);
  for (const char of hrp) {
    out.push(char.charCodeAt(0) & 31);
  }
  return out;
}

/** Sechs 5-Bit-Gruppen aus HRP und Daten (BIP-173). */
function createChecksum(hrp: string, data: readonly number[]): number[] {
  const values = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  let polymod = BECH32_CONST;
  for (const value of values) {
    polymod = polymodStep(polymod) ^ value;
  }
  // ACHTUNG, nachgemessen: (x >>> 32) ist in JavaScript NICHT 0, sondern x -
  // die Schiebeweite wird auf 5 Bit reduziert (32 mod 32 = 0). Mit der
  // naheliegenden Schleife `polymod >>> (5 * (5 - i))` bekaeme die LETZTE der
  // sechs Pruefsummenstellen deshalb den Wert 1 statt 0 und die Stelle davor
  // einen um eins zu hohen Wert: die Pruefsumme waere falsch, und zwar nur in
  // den untersten Bits - ein Fehler, den kein Test mit kurzen Zeichenketten
  // zwingend bemerkt. Deshalb wird die letzte Stelle ausdruecklich mit 0
  // belegt und die uebrigen per Division verschoben.
  // Die Pruefsumme ist polymod XOR der bech32-Konstante - ohne dieses XOR
  // waeren die untersten Bits falsch, und zwar nur sie.
  const checksum = (polymod ^ BECH32_CONST) >>> 0;

  // ACHTUNG, nachgemessen: (x >>> 32) ist in JavaScript NICHT 0, sondern x - die
  // Schiebeweite wird auf 5 Bit reduziert (32 mod 32 = 0). Deshalb wird die
  // letzte der sechs Stellen ausdruecklich maskiert statt um 0 zu schieben.
  const out: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const shift = 5 * (5 - i);
    out.push(shift === 0 ? checksum & 31 : (checksum >>> shift) & 31);
  }
  return out;
}

/**
 * Wandelt 8-Bit-Bytes in 5-Bit-Gruppen (BIP-173, "convertbits" mit pad = true).
 * Das ist der Schritt, der aus einer URL eine bech32-Nutzlast macht: bech32
 * transportiert 5 Bit je Zeichen, die URL besteht aus 8-Bit-Bytes.
 */
export function toWords(bytes: Uint8Array): number[] {
  const words: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >>> bits) & 31);
    }
  }
  // Der Rest wird mit Nullen auf 5 Bit aufgefuellt - so schreibt es BIP-173 vor.
  if (bits > 0) {
    words.push((acc << (5 - bits)) & 31);
  }
  return words;
}

export interface Bech32Options {
  /** Obergrenze der Gesamtlaenge. Standard: keine (LNURL ist laenger als 90). */
  limit?: number;
}

/**
 * Kodiert Bytes als bech32 mit dem angegebenen Prefix - kleingeschrieben, wie
 * es die Norm verlangt; die LNURL-Darstellung im QR-Code schreibt der Aufrufer
 * mit toUpperCase() (LUD-01 zeigt "LNURL1...").
 *
 * Wirft bei unbrauchbarer Eingabe, statt etwas zu liefern, das kein Wallet
 * lesen kann: ein stiller Fehler waere hier ein QR-Code, der nichts tut.
 */
export function encode(prefix: string, bytes: Uint8Array, options: Bech32Options = {}): string {
  if (prefix.length === 0) {
    throw new Error('bech32: Prefix fehlt');
  }
  if (/^[\x21-\x7e]+$/.test(prefix) === false) {
    throw new Error(`bech32: Prefix enthaelt unbrauchbare Zeichen: "${prefix}"`);
  }
  const lower = prefix.toLowerCase();
  const data = toWords(bytes);
  const combined = [...data, ...createChecksum(lower, data)];
  let out = `${lower}1`;
  for (const value of combined) {
    const char = CHARSET[value];
    if (char === undefined) {
      throw new Error(`bech32: 5-Bit-Wert ausserhalb des Alphabets: ${value}`);
    }
    out += char;
  }
  if (options.limit !== undefined && out.length > options.limit) {
    throw new Error(`bech32: Laenge ${out.length} ueber der Grenze ${options.limit}`);
  }
  return out;
}

/**
 * Die LNURL-Darstellung einer URL: bech32 mit Prefix "lnurl", in
 * Grossschreibung - genau die Form, die ein Wallet im QR-Code erwartet
 * ("LNURL1...").
 */
export function encodeLnurl(url: string, options: Bech32Options = {}): string {
  return encode('lnurl', new TextEncoder().encode(url), options).toUpperCase();
}