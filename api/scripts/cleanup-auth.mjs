/**
 * Raeumt abgelaufene und verbrauchte Herausforderungen sowie alte Ratenzeilen
 * weg - von Hand oder per Cron.
 *
 *   npm run cleanup            (aus api/)
 *   node scripts/cleanup-auth.mjs
 *
 * Cron (stuendlich; die Fristen sind eine Stunde, siehe src/cleanup.ts):
 *   0 * * * * cd /pfad/zu/api && npm run cleanup >> /var/log/ideenschmiede-cleanup.log 2>&1
 *
 * Die Logik selbst steht in src/cleanup.ts - dieses Skript verbindet nur. Eine
 * zweite Umsetzung hier waere eine zweite Wahrheit ueber die Fristen.
 *
 * Gelesen wird der GEBAUTE Stand aus dist/ (`npm run build`), weil auch der
 * Server daraus laeuft - ein Cron-Lauf soll dieselbe Logik ausfuehren wie der
 * laufende Prozess. Fehlt dist/, wird der Quelltext genommen; laeuft das
 * Skript dann unter tsx (`npm run cleanup`), funktioniert auch das. Eine
 * zweite Kopie der Logik hier waere genau die zweite Wahrheit, die vermieden
 * werden soll.
 *
 * Exit-Code 0 = aufgeraeumt (auch wenn nichts zu tun war), 1 = Fehler. Ein
 * Cron-Lauf, der scheitert, faellt damit auf, statt still nichts zu tun.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const quelle = new URL('../src/cleanup.ts', import.meta.url);
const gebaut = new URL('../dist/cleanup.js', import.meta.url);

if (!existsSync(fileURLToPath(quelle)) && !existsSync(fileURLToPath(gebaut))) {
  console.error(
    'Weder src/cleanup.ts noch dist/cleanup.js gefunden - zuerst `npm run build` ausfuehren.',
  );
  process.exit(1);
}

const gebautDa = existsSync(fileURLToPath(gebaut));
const modul = gebautDa ? '../dist/cleanup.js' : '../src/cleanup.ts';
const datenbank = gebautDa ? '../dist/db.js' : '../src/db.ts';
const { cleanupAuth, describeCleanup } = await import(modul);
const { closeDb, getDb } = await import(datenbank);

try {
  const db = getDb();
  const ergebnis = await cleanupAuth(db);
  console.log(describeCleanup(ergebnis));
  await closeDb();
} catch (error) {
  console.error('Aufraeumen fehlgeschlagen:', error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exit(1);
}
