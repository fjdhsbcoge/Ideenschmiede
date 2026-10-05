# Ideenschmiede API

Backend-Gerüst für **Roadmap Phase 3.1** (Hono + PostgreSQL, TypeScript).
Bewusst klein: **keine Authentifizierung, keine Geschäftslogik, kein Schreiben
über die API**. Das Gerüst belegt genau eine Sache — dass die Kette

    Repository (SQL)  ->  Hono  ->  PostgreSQL

gegen eine echte Datenbank trägt. Verifiziert gegen **PostgreSQL 16.15** mit
`api/migrations/001_init.sql`.

Maßgeblich für Feldnamen ist `api/CONTRACT.md`; das Schema stammt
ausschließlich aus `api/migrations/001_init.sql`. Diese Datei erfindet keine
Tabelle und keine Spalte.

## Voraussetzungen

| | Version |
|---|---|
| Node.js | 20 oder neuer (entwickelt und geprüft mit 24.19) |
| PostgreSQL | 16 (geprüft mit 16.15; das Schema verlangt 11+) |
| Docker | nur für den bequemen Weg zur Testdatenbank nötig |

`webapp/` ist ein **eigenes Paket** mit eigener `package.json` und bleibt
unberührt. `api/` hat eigene `node_modules`, eigenen Lockfile und eigene
Skripte.

## Dateien

| Datei | Zweck |
|---|---|
| `package.json` | Eigener Workspace. Skripte: `dev`, `build`, `start`, `test`, `typecheck` |
| `tsconfig.json` | `strict`, ESM (`NodeNext`), Typprüfung inklusive Tests |
| `tsconfig.build.json` | Nur für `npm run build`: `src/` -> `dist/` |
| `vitest.config.ts` | Testlauf gegen die echte Datenbank |
| `.env.example` | Dokumentierte Variablen, nur Platzhalter |
| `src/env.ts` | Konfiguration aus Umgebungsvariablen — an einer Stelle, mit Klartext-Fehler |
| `src/db.ts` | Verbindungspool zum PostgreSQL — **die einzige** Stelle, an der eine Verbindung entsteht |
| `src/app.ts` | Die Hono-App: `GET /health`, `GET /api/ideas`, 404 und Fehler als JSON |
| `src/server.ts` | Startet die App auf `PORT`, prüft die Verbindung einmal und meldet sie |
| `src/version.ts` | Version aus `package.json` (für `/health`) |
| `tests/` | Vitest gegen die echte Datenbank |
| `migrations/` | **Unverändert.** Schema-Quelle, wird hier nur eingespielt |
| `CONTRACT.md` | **Unverändert.** Kanonischer Datenvertrag |

## Konfiguration

Alles über Umgebungsvariablen (oder `api/.env`, siehe `.env.example`):

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `DATABASE_URL` | **ja** | — | `postgres://benutzer:passwort@host:port/datenbank` |
| `PORT` | nein | `3000` | Port der HTTP-Schnittstelle (1..65535) |
| `HOST` | nein | `127.0.0.1` | Lauschadresse; im Container `0.0.0.0` |
| `NODE_ENV` | nein | `development` | `development`, `test`, `production` |

`DATABASE_URL` hat bewusst **keinen** Standardwert. Fehlt sie, endet der Start
mit Exit-Code 1 und einer Meldung, die den Mangel benennt:

    Ungueltige Konfiguration - die API startet nicht:
      - DATABASE_URL fehlt (Pflichtwert ohne Standardwert), z.B. postgres://benutzer:passwort@localhost:5432/ideenschmiede
    Vorlage mit allen Variablen: api/.env.example

## Datenbank aufsetzen

```bash
docker run -d --name ide-api-pg -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=ideenschmiede -p 55454:5432 postgres:16-alpine

# warten, bis sie annimmt
docker exec ide-api-pg pg_isready -U postgres

# Migration einspielen (bricht beim ersten echten Fehler ab)
docker cp api/migrations/001_init.sql ide-api-pg:/tmp/m.sql
docker exec ide-api-pg psql -U postgres -d ideenschmiede -v ON_ERROR_STOP=1 -f /tmp/m.sql
```

Die Migration legt 9 Tabellen und 4 Views an (`idea_discussion`,
`idea_marketplace`, `idea_investor_shares`, `team_investor_shares`).

Testdaten von Hand — die `CHECK`-Constraints sind zu beachten
(`username` entspricht `^[a-z0-9_]{3,30}$`, `title` 3..200 Zeichen,
`tags` ohne Leerstring):

```sql
INSERT INTO users (username, display_name, email, language)
VALUES ('anna_demo', 'Anna Beispiel', 'anna@example.invalid', 'de');

INSERT INTO ideas (author_id, title, description, tags, language, stage)
SELECT id,
       'Solarbetriebene Kaffeeroesterei',
       'Eine Roesterei, die ausschliesslich mit Solarstrom arbeitet und den Ertrag mit den Nachbarn teilt.',
       ARRAY['energie', 'kaffee'], 'de', 'discussion'
  FROM users WHERE username = 'anna_demo';
```

## Starten

```bash
cd api
npm install

# Entwicklung (tsx, laedt bei Aenderung neu)
$env:DATABASE_URL="postgres://postgres:test@localhost:55454/ideenschmiede"
npm run dev

# oder gebaut
npm run build
npm start
```

Beim Start wird die Verbindung einmal geprüft und **gemeldet**:

    [api] PostgreSQL verbunden: postgres://***:***@127.0.0.1:55454/ideenschmiede (server_version 16.15)
    [api] Ideenschmiede-API 0.1.0 hoert auf http://127.0.0.1:3000 (NODE_ENV=development)

Zugangsdaten werden dabei maskiert. Ist die Datenbank nicht erreichbar, startet
der Prozess trotzdem — `/health` meldet dann `db: false`.

## Testen

Die Tests laufen gegen eine **echte** PostgreSQL-Datenbank; es gibt keine
Attrappe. Ohne `DATABASE_URL` brechen sie mit einer Klartext-Meldung ab,
statt auf eine geratene Datenbank zu zeigen.

```bash
cd api
$env:DATABASE_URL="postgres://postgres:test@localhost:55454/ideenschmiede"
npm test
```

Ergebnis des geprüften Laufs:

    ✓ tests/ideas.test.ts (12 tests)
    ✓ tests/health.test.ts (3 tests)
    Test Files  2 passed (2)
         Tests  15 passed (15)

Geprüft wird unter anderem:

* `/health` liefert 200 mit `db: true` — und `db` stammt aus `SELECT 1`.
  Ein zusätzlicher Fall zeigt `db: false` und 503, wenn die Datenbank nicht
  erreichbar ist; damit ist ausgeschlossen, dass `db` fest verdrahtet ist.
* `/api/ideas` liefert eine **per SQL angelegte** Idee mit den Feldnamen aus
  `CONTRACT.md` zurück (inklusive `vote_up`, `vote_down`, `comment_count`,
  `raised_sat`, `investor_count`) und führt die abgelösten Arbeitsnamen
  (`votes_up`, `comments`, `raised`) nicht.
* Paginierung: `limit`/`offset` werden eingehalten und blättern ohne
  Doppelung. `limit=0`, `limit=abc`, `limit=1.5`, `limit=101`, `offset=-1`
  und Ähnliches werden mit 400 abgewiesen.
* Unbekannte Endpunkte antworten mit 404 als JSON, nicht als HTML.

Die Tests legen ihre Zeilen selbst an und räumen sie wieder ab; sie schreiben
nichts über die API, sondern per SQL.

## Endpunkte

### `GET /health`

```
$ curl -i http://127.0.0.1:3000/health
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok","db":true,"version":"0.1.0"}
```

`db` wird durch eine echte Abfrage (`SELECT 1`) geprüft, nicht geraten.
Antwortet die Datenbank nicht, ist die Antwort `503` mit
`{"status":"degraded","db":false,"version":"0.1.0"}`.

### `GET /api/ideas?limit=&offset=`

```
$ curl -s "http://127.0.0.1:3000/api/ideas?limit=1&offset=0"
{"items":[{"id":"92f23e9d-...","author_id":"4290fe6f-...","title":"Reparaturcafe fuer Elektronik",
"description":"Ein Reparaturcafe, das alte Geraete vor dem Muell rettet und Wissen weitergibt.",
"tags":["reparatur"],"language":"de","stage":"voting","discussion_opened_at":"2026-10-05T20:48:12.868Z",
"comment_count":0,"vote_up":0,"vote_down":0,"marketplace_opened_at":null,"marketplace_closes_at":null,
"funding_goal_sat":null,"raised_sat":0,"investor_count":0,"creator_share_bp":2000,
"created_at":"2026-10-05T20:48:12.868Z","updated_at":"2026-10-05T20:48:12.868Z"}],
"count":1,"limit":1,"offset":0}
```

| Parameter | Standard | Erlaubt | Verhalten außerhalb |
|---|---|---|---|
| `limit` | 20 | 1..100 | 400 |
| `offset` | 0 | 0..1000000 | 400 |

Reihenfolge: `created_at DESC, id DESC` — stabil, damit beim Blättern keine
Zeile doppelt oder gar nicht kommt.

Die Feldnamen sind die kanonischen Bezeichner aus `CONTRACT.md` in
**snake_case**, also genau die Spaltennamen des Schemas. Zeitstempel
(`timestamptz`) gehen als ISO-8601 mit `Z` heraus.

### Fehlerformat

Jeder Fehler ist JSON:

```
$ curl -s "http://127.0.0.1:3000/api/ideas?limit=0"
{"error":{"code":"invalid_query","message":"Ungueltiger Parameter \"limit\": erlaubt sind 1..100 (erhalten: 0)"}}

$ curl -s http://127.0.0.1:3000/gibt-es-nicht
{"error":{"code":"not_found","message":"Unbekannter Endpunkt: GET /gibt-es-nicht"}}
```

Ein unerwarteter Fehler ergibt `500` mit `{"error":{"code":"internal_error",...}}`.
Der Stacktrace bleibt im Serverprotokoll — keine Tabellennamen, keine Pfade
nach außen.

## Entscheidungen und offene Punkte

1. **snake_case statt camelCase.** Der Auftrag verlangt die Feldnamen aus
   `CONTRACT.md` in snake_case; `ARCHITECTURE.md` Anhang 5.2 (`interface Idea`)
   und `api/migrations/README.md` sehen dagegen camelCase mit verschachtelten
   Objekten `discussion`/`marketplace` vor (dafür existieren die Views
   `idea_discussion` und `idea_marketplace`). Umgesetzt ist der Auftrag
   (flach, snake_case). **Offener Punkt für den Koordinator.**
2. **Antwortform von `/api/ideas`** ist `{ items, count, limit, offset }`.
   Der Auftrag nennt keine Hülle; `limit`/`offset` werden zurückgemeldet,
   damit der Aufrufer die angewandten Grenzen sieht.
3. **`/health` antwortet mit 503, wenn die Datenbank nicht antwortet.** Der
   Auftrag nennt nur den Erfolgsfall. `status` ist dann `"degraded"`.
4. **Zusätzliche Abhängigkeit `@hono/node-server`.** Hono selbst bringt keinen
   Node-Server mit; ohne Adapter lässt sich die App nicht auf Node 20+ starten.
5. **`bigint` in JSON.** Der Treiber `postgres` liefert `int8` standardmäßig
   als **String** (nachgemessen: `1::int8` -> `"1"`). `src/db.ts` stellt
   deshalb `types: { bigint: postgres.BigInt }` ein — exakt, ohne
   Gleitkomma-Umweg. Beim Serialisieren wird daraus eine JSON-Zahl, solange
   der Wert in 2^53-1 passt (etwa 90 Billionen Satoshi, ein Vielfaches des
   Bitcoin-Bestands); darüber eine Dezimalzahl als String, damit nichts
   gerundet wird.
6. **Keine Migration angefasst.** `001_init.sql` ist unverändert. Die
   Sortierung `created_at DESC, id DESC` hat keinen passenden Index; bei
   wachsender Tabelle wäre einer nötig — das gehört in eine Migration 002,
   nicht in diesen Schritt.
7. **Kein `description`-CHECK gefunden.** Der Auftrag nennt „description
   mindestens 20" als `CHECK`-Constraint; `001_init.sql` prüft für
   `ideas.description` nur `NOT NULL DEFAULT ''`, es gibt dort **keine**
   Längenprüfung (nur `ideas_title_check`, 3..200 Zeichen). Die Testdaten
   erfüllen die genannten 20 Zeichen trotzdem. **Zur Kenntnis für den
   Koordinator.**
8. **Kein Auth, kein Schreiben.** `POST`/Auth/Webhooks folgen in Phase 3.2/3.3.
   `/health` und `/api/ideas` sind bewusst die einzigen Endpunkte.
