import { defineConfig } from 'vitest/config';

// Die Tests laufen gegen eine ECHTE PostgreSQL-Datenbank (DATABASE_URL).
// Es gibt keine Attrappe: /health soll nachweislich SELECT 1 ausfuehren.
//
// fileParallelism: false - beide Testdateien teilen sich dieselbe Datenbank.
// Sie legen eigene Zeilen mit eindeutigen Namen an und raeumen sie wieder ab;
// parallele Dateien wuerden sich beim Aufraeumen nicht stoeren, aber die
// Ausgabe bleibt so leichter lesbar und die Last auf der Test-DB gering.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
});
