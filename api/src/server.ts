/**
 * Startet die API auf PORT. Der Prozess endet sofort mit einer klaren Meldung,
 * wenn die Konfiguration fehlt - es gibt keinen stillen Standardwert.
 */
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { closeDb, dbVersion, getDb, pingDb } from './db.js';
import { type Env, loadEnv, redactDatabaseUrl } from './env.js';
import { missingWebhookSecretMessage, WEBHOOK_SECRET_ENV } from './subscriptions.js';
import { API_VERSION } from './version.js';

function loadEnvOrExit(): Env {
  try {
    return loadEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Ohne BTCPAY_WEBHOOK_SECRET wird der Webhook nicht geprueft - jede beliebige
 * Stelle koennte dann Zahlungen gutschreiben und damit Stimmrecht verleihen
 * (ADR-003). Deshalb ist der Wert beim START Pflicht, genau wie SESSION_SECRET:
 * es gibt keinen stillen Rueckfall auf einen Standardwert, sondern eine Meldung
 * und Exit-Code 1.
 *
 * Warum das nicht in loadEnv() steht: die uebrigen Pruefungen dort gelten fuer
 * jede Art von Start, diese gilt fuer den Betrieb. Ein Testlauf, der den Webhook
 * nicht anfasst, soll nicht an einem Geheimnis scheitern, das er nicht benutzt.
 */
function requireWebhookSecret(value: string): string {
  if (value === '') {
    const nachricht = missingWebhookSecretMessage();
    console.error(nachricht);
    process.exit(1);
  }
  return value;
}

const env = loadEnvOrExit();
requireWebhookSecret(env.BTCPAY_WEBHOOK_SECRET);
const db = getDb();
// createApp ist async: es wartet das Aufraeumen beim Start ab (src/cleanup.ts),
// damit der Zustand feststeht, bevor der Server den Port annimmt. Fehler beim
// Aufraeumen beendet den Start nicht - das meldet createApp selbst.
const app = await createApp(db);

// Verbindung einmal beim Start pruefen und MELDEN. Ein Nichterreichen beendet
// den Start nicht: genau dafuer gibt es /health mit db: false.
try {
  await pingDb(db);
  console.log(
    `[api] PostgreSQL verbunden: ${redactDatabaseUrl(env.DATABASE_URL)} (server_version ${await dbVersion(db)})`,
  );
} catch (error) {
  console.warn(
    `[api] PostgreSQL nicht erreichbar (${redactDatabaseUrl(env.DATABASE_URL)}): ${error instanceof Error ? error.message : String(error)}`,
  );
}

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  // Nur der NAME der Variable, nie der Wert: ein Geheimnis gehoert nicht ins
  // Protokoll.
  console.log(
    `[api] Ideenschmiede-API ${API_VERSION} hoert auf http://${env.HOST}:${info.port} (NODE_ENV=${env.NODE_ENV}, ${WEBHOOK_SECRET_ENV} gesetzt)`,
  );
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[api] Port ${env.PORT} ist bereits belegt. PORT in der Umgebung aendern.`);
  } else {
    console.error('[api] Serverfehler:', error);
  }
  process.exit(1);
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} empfangen - fahre herunter`);
  server.close(() => {
    void closeDb().then(() => process.exit(0));
  });
  // Notausstieg, falls eine offene Verbindung das Schliessen aufhaelt.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
