import { defineConfig } from 'vitest/config';

// Die Tests laufen gegen eine ECHTE PostgreSQL-Datenbank (DATABASE_URL).
// Es gibt keine Attrappe: /health soll nachweislich SELECT 1 ausfuehren.
//
// fileParallelism: false - beide Testdateien teilen sich dieselbe Datenbank.
// Sie legen eigene Zeilen mit eindeutigen Namen an und raeumen sie wieder ab;
// parallele Dateien wuerden sich beim Aufraeumen nicht stoeren, aber die
// Ausgabe bleibt so leichter lesbar und die Last auf der Test-DB gering.
//
// SESSION_SECRET und AUTH_BASE_URL sind PFLICHTWERTE der API (src/env.ts) und
// werden hier fuer den Testlauf gesetzt - es sind ausdruecklich Testwerte, kein
// Geheimnis. Ohne sie wuerde schon createApp() abbrechen, und genau das ist
// gewollt: die Tests sollen nicht stillschweigend auf einen Standardwert
// laufen, den es in der Anwendung nicht gibt.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 20_000,
    env: {
      SESSION_SECRET: 'test-secret-nur-fuer-den-testlauf-32-zeichen-lang',
      AUTH_BASE_URL: 'https://auth.test.invalid',
      // Geheimnis des BTCPay-Webhooks. Wie oben ein ausdruecklicher TESTWERT, kein
      // Geheimnis. Die Tests signieren ihre Koerper selbst mit genau diesem Wert;
      // die Signaturpruefung laeuft also wirklich und nicht abgeschaltet.
      BTCPAY_WEBHOOK_SECRET: 'test-btcpay-webhook-secret-nur-fuer-den-testlauf',
    },
  },
});
