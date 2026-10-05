import { readFileSync } from 'node:fs';

/**
 * Version der API - gelesen aus api/package.json, damit sie nicht doppelt
 * gepflegt wird. Der Pfad ist relativ zu dieser Datei und stimmt sowohl fuer
 * src/version.ts als auch fuer das gebaute dist/version.js (beide liegen eine
 * Ebene unter api/).
 */
function readVersion(): string {
  try {
    const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof (parsed as { version: unknown }).version === 'string'
    ) {
      return (parsed as { version: string }).version;
    }
  } catch {
    // package.json nicht lesbar (z.B. ungewoehnliches Paketlayout): Die
    // Version ist Beiwerk, /health darf daran nicht scheitern.
  }
  return '0.0.0';
}

export const API_VERSION = readVersion();
