/**
 * Helfer fuer die LNURL-auth-Tests.
 *
 * Hier wird WIRKLICH signiert: die Tests erzeugen ein secp256k1-Schluesselpaar
 * und signieren die k1-Bytes mit @noble/curves - genau wie ein Wallet es tut.
 * Eine nachgebaute Signatur wuerde nur pruefen, dass der Test mit sich selbst
 * einig ist. Die DER-Kodierung entsteht dabei aus der Bibliothek.
 *
 * Die Abfragen laufen ueber sql.unsafe() mit Parametern ($1, $2, ...). Damit
 * steht in dieser Datei keine einzige Vorlagen-Zeichenkette - die Parameter
 * werden trotzdem von postgres.js gebunden, nicht in den Text gebaut.
 */
import { createHmac } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sql } from './helpers.js';

export interface TestKeypair {
  /** 32 Byte privater Schluessel (hex) - bleibt im Test. */
  secretKeyHex: string;
  /** 33 Byte compressed (hex) - das ist der linkingKey. */
  publicKeyHex: string;
}

export function createKeypair(): TestKeypair {
  const erzeugt = secp256k1.keygen();
  return {
    secretKeyHex: Buffer.from(erzeugt.secretKey).toString('hex'),
    publicKeyHex: Buffer.from(erzeugt.publicKey).toString('hex'),
  };
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

/**
 * Die k1 signieren, wie ein Wallet es tut: ueber die k1-BYTES, mit SHA-256
 * (prehash) und DER-Kodierung. lowS: false, damit der Test auch eine Signatur
 * mit hohem S erzeugen koennte - die Pruefseite akzeptiert beide.
 */
export function signChallenge(k1: string, secretKeyHex: string): string {
  const signature = secp256k1.sign(hexToBytes(k1), hexToBytes(secretKeyHex), {
    format: 'der',
    lowS: false,
  });
  return Buffer.from(signature).toString('hex');
}

/**
 * Eine DER-Signatur, die formal gueltig ist, aber zu einem ANDEREN Schluessel
 * gehoert. Damit laesst sich pruefen, dass key und sig zusammenpassen muessen.
 */
export function signWithWrongKey(k1: string): { sig: string; publicKeyHex: string } {
  const fremd = createKeypair();
  return { sig: signChallenge(k1, fremd.secretKeyHex), publicKeyHex: fremd.publicKeyHex };
}

/** Ein Hexzeichen am Ende umdrehen - eine kaputte Signatur, die wie eine aussieht. */
export function mutateHex(hex: string): string {
  const zeichen = hex.split('');
  const stelle = zeichen.length - 2;
  const alt = zeichen[stelle] as string;
  zeichen[stelle] = alt === 'f' ? '0' : 'f';
  return zeichen.join('');
}

export interface ChallengeDbRow {
  used_at: Date | null;
  expires_at: Date;
  action: string;
}

/** Der Zustand der Herausforderung in der Datenbank - der Replay-Nachweis. */
export async function challengeRow(k1: string): Promise<ChallengeDbRow | null> {
  const rows = await sql.unsafe<ChallengeDbRow[]>(
    'SELECT used_at, expires_at, action FROM auth_challenges WHERE k1 = $1',
    [k1],
  );
  return rows[0] ?? null;
}

export async function countIdentities(linkingKeyHex: string): Promise<number> {
  const rows = await sql.unsafe<{ anzahl: string }[]>(
    'SELECT count(*)::text AS anzahl FROM auth_identities WHERE lower(linking_key) = lower($1)',
    [linkingKeyHex],
  );
  return Number(rows[0]?.anzahl ?? '0');
}

export async function deleteChallenge(k1: string): Promise<void> {
  await sql.unsafe('DELETE FROM auth_challenges WHERE k1 = $1', [k1]);
}

/**
 * Eine bereits abgelaufene Herausforderung anlegen. Ueber die API ist das nicht
 * zu erreichen (sie erzeugt immer eine frische) - der Fall muss also direkt in
 * die Datenbank. used_at bleibt NULL, damit die Ablehnung wirklich am Ablauf
 * haengt und nicht am Verbrauch.
 */
export async function insertExpiredChallenge(k1: string, action: string): Promise<void> {
  await sql.unsafe(
    "INSERT INTO auth_challenges (k1, action, created_at, expires_at)" +
      " VALUES ($1, $2, now() - interval '10 minutes', now() - interval '5 minutes')",
    [k1, action],
  );
}

/**
 * Einen Nutzer samt gebundener Identitaet anlegen - fuer den Fall "Schluessel
 * ist bereits bekannt". Die Anlage ueber die API ist der Regelfall; hier wird
 * der Ausgangszustand gesetzt, damit der Test nicht von sich selbst abhaengt.
 */
export async function createUserWithIdentity(linkingKeyHex: string): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const nutzer = await sql.unsafe<{ id: string }[]>(
    'INSERT INTO users (username, display_name, email, language) VALUES ($1, $2, $3, $4) RETURNING id',
    ['ln_test_' + suffix, 'Testnutzer ' + suffix, 'ln_' + suffix + '@test.invalid', 'de'],
  );
  const userId = (nutzer[0] as { id: string }).id;
  await sql.unsafe('INSERT INTO auth_identities (user_id, linking_key) VALUES ($1, $2)', [
    userId,
    linkingKeyHex.toLowerCase(),
  ]);
  return userId;
}

// -----------------------------------------------------------------------------
// bech32-Nachweis
// -----------------------------------------------------------------------------

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/**
 * Dekodiert eine LNURL. Absichtlich als EIGENE Umsetzung im Test: wenn Test und
 * Anwendung dieselbe Funktion benutzten, bewiese der Test nur, dass sie sich
 * selbst gleich ist. Die Pruefsumme wird mitgerechnet (polymod == 1), ein
 * falscher Checksum faellt damit auf.
 */
export function decodeBech32(address: string): { prefix: string; words: number[] } {
  const klein = address.toLowerCase();
  const trenner = klein.lastIndexOf('1');
  if (trenner < 1 || trenner + 7 > klein.length) {
    throw new Error('Kein gueltiges bech32: ' + address);
  }
  const prefix = klein.slice(0, trenner);
  const werte: number[] = [];
  for (const zeichen of klein.slice(trenner + 1)) {
    const index = CHARSET.indexOf(zeichen);
    if (index < 0) {
      throw new Error('Zeichen ausserhalb des bech32-Alphabets: ' + zeichen);
    }
    werte.push(index);
  }
  if (polymod(hrpExpand(prefix).concat(werte)) !== 1) {
    throw new Error('Pruefsumme stimmt nicht (polymod != 1)');
  }
  return { prefix, words: werte.slice(0, werte.length - 6) };
}

/** 5-Bit-Gruppen zurueck in Bytes (convertbits mit pad = false). */
export function wordsToBytes(words: readonly number[]): number[] {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const wort of words) {
    acc = (acc << 5) | wort;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >>> bits) & 0xff);
    }
  }
  return bytes;
}

export function utf8FromBytes(bytes: readonly number[]): string {
  return Buffer.from(Uint8Array.from(bytes)).toString('utf8');
}

const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: readonly number[]): number {
  let chk = 1;
  for (const value of values) {
    const b = chk >>> 25;
    chk = (((chk & 0x1ffffff) << 5) >>> 0) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if (((b >>> i) & 1) === 1) {
        chk = (chk ^ (GEN[i] as number)) >>> 0;
      }
    }
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (const zeichen of hrp) {
    out.push(zeichen.charCodeAt(0) >> 5);
  }
  out.push(0);
  for (const zeichen of hrp) {
    out.push(zeichen.charCodeAt(0) & 31);
  }
  return out;
}

// -----------------------------------------------------------------------------
// JWT fuer den Ablauf- und Faelschungstest
// -----------------------------------------------------------------------------

export function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/** Ein Token mit beliebigem Inhalt bauen - fuer den Faelschungsnachweis. */
export function forgeToken(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const data = header + '.' + body;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + sig;
}
