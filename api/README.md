# Ideenschmiede API

Backend-Gerüst für **Roadmap Phase 3.1** (Hono + PostgreSQL, TypeScript).
Bewusst klein: **keine Authentifizierung, keine Geschäftslogik, kein Schreiben
über die API**. Das Gerüst belegt genau eine Sache — dass die Kette

    Repository (SQL)  ->  Hono  ->  PostgreSQL

gegen eine echte Datenbank trägt. Verifiziert gegen **PostgreSQL 16.15** mit
`api/migrations/001_init.sql`.

Maßgeblich für die Feldnamen der Datenbank ist `api/CONTRACT.md`; das Schema
stammt ausschließlich aus `api/migrations/001_init.sql`. Diese Datei erfindet
keine Tabelle und keine Spalte.

Maßgeblich für die **Antwortform** ist `ARCHITECTURE.md` Anhang 5.2
(`interface Idea`) — camelCase und verschachtelt, wie es `CONTRACT.md` unter
„Namensform je Schicht“ festschreibt. Die API ist die Übersetzungsschicht
dazwischen: sie liest die flachen `snake_case`-Spalten und liefert die
dokumentierte Form. Die Zuordnung camelCase ↔ snake_case steht vollständig in
`api/migrations/README.md`.

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
| `src/app.ts` | Die Hono-App: `GET /health`, `GET /api/ideas` (dokumentierte Form aus Anhang 5.2), 404 und Fehler als JSON |
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
`tags` ohne Leerstring). Zwei Ideen, weil die Antwortform von der Phase
abhängt: die eine **ohne** Marktplatzphase, die andere **mit**:

```sql
INSERT INTO users (username, display_name, email, language)
VALUES ('anna_demo', 'Anna Beispiel', 'anna@example.invalid', 'de');

-- ohne Marktplatzphase: keine Marktspalten
INSERT INTO ideas (author_id, title, description, tags, language, stage)
SELECT id,
       'Solarbetriebene Kaffeeroesterei',
       'Eine Roesterei, die ausschliesslich mit Solarstrom arbeitet und den Ertrag mit den Nachbarn teilt.',
       ARRAY['energie', 'kaffee'], 'de', 'voting'
  FROM users WHERE username = 'anna_demo';

-- mit Marktplatzphase: alle drei Marktspalten, sonst greift
-- ideas_marketplace_all_or_nothing_check
INSERT INTO ideas (author_id, title, description, tags, language, stage,
                   marketplace_opened_at, marketplace_closes_at, funding_goal_sat)
SELECT id,
       'Reparaturcafe fuer Elektronik',
       'Ein Reparaturcafe, das alte Geraete vor dem Muell rettet und Wissen weitergibt.',
       ARRAY['reparatur'], 'de', 'marketplace',
       now() - interval '10 days', now() + interval '20 days', 12000000
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

Ergebnis des geprüften Laufs (gegen PostgreSQL 16.15 im Container):

    ✓ tests/ideas.test.ts (23 tests)
    ✓ tests/health.test.ts (3 tests)
    Test Files  2 passed (2)
         Tests  26 passed (26)

Geprüft wird unter anderem:

* `/health` liefert 200 mit `db: true` — und `db` stammt aus `SELECT 1`.
  Ein zusätzlicher Fall zeigt `db: false` und 503, wenn die Datenbank nicht
  erreichbar ist; damit ist ausgeschlossen, dass `db` fest verdrahtet ist.
* `/api/ideas` liefert eine **per SQL angelegte** Idee in der dokumentierten
  Form: camelCase, `discussion` verschachtelt, `marketplace` nur bei
  eröffneter Marktplatzphase. Die flachen Spaltennamen (`author_id`,
  `created_at`, `comment_count`, `vote_up`, `raised_sat`,
  `creator_share_bp`, …) und die abgelösten Arbeitsnamen (`votes_up`,
  `comments`, `raised`) kommen **nicht** mehr vor.
* Eine Idee **ohne** Marktplatzphase hat den Schlüssel `marketplace`
  überhaupt nicht — nicht `null`, sondern gar nicht.
* Eine Idee **mit** Marktplatzphase trägt dort genau die sechs Felder
  `openedAt`, `closesAt`, `fundingGoal`, `raised`, `investors`,
  `creatorShareBp` mit den Werten aus der Datenbank.
* Beträge: unter 2^53-1 eine JSON-Zahl, darüber eine Dezimalzahl als String.
  Der Fall wird mit `raised_sat = 9007199254740993` (2^53+1) geprüft; ein
  zusätzlicher Fall belegt, dass genau dieser Wert **nicht** durch einen
  JSON-Ausdruck in SQL laufen darf (siehe „Entscheidungen“, Punkt 9).
* Paginierung: `limit`/`offset` werden eingehalten und blättern ohne
  Doppelung; eine Idee **ohne** Marktplatzphase fällt dabei nicht aus der
  Liste. `limit=0`, `limit=abc`, `limit=1.5`, `limit=101`, `offset=-1`
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

Die Antwort ist `{ items, count, limit, offset }`. Jedes Element hat die Form
aus `ARCHITECTURE.md` Anhang 5.2 (`interface Idea`) — camelCase und
verschachtelt, wie es `CONTRACT.md` im Abschnitt „Namensform je Schicht`
verlangt:

```typescript
interface Idea {
  id: UUID;
  authorId: UUID;
  title: string;
  description: string;
  tags: string[];
  language: string;              // 'de' | 'en'
  stage: 'discussion' | 'voting' | 'marketplace' | 'active' | 'completed';

  // Diskussionsphase — immer vorhanden (mit der Idee entstanden)
  discussion: {
    openedAt: Timestamp;         // ISO-8601 mit Z
    comments: number;
    votes: { up: number; down: number };
  };

  // Marktplatzphase — NUR vorhanden, wenn sie eröffnet ist.
  // Sonst fehlt der Schlüssel ganz (nicht null).
  marketplace?: {
    openedAt: Timestamp;
    closesAt: Timestamp;
    fundingGoal: Satoshis;       // Zahl, ab 2^53-1 Dezimalzahl als String
    raised: Satoshis;            // dito
    investors: number;
    creatorShareBp: number;      // Basispunkte, 10000 = 100 %
  };

  createdAt: Timestamp;
}
```

Zwei echte Antworten, direkt von der laufenden API abgerufen (gekürzt auf die
Demo-Ideen; `GET /api/ideas?limit=100`):

```json
// Idee OHNE Marktplatzphase — kein "marketplace"-Schlüssel
{"id":"88084353-f6e6-4e31-8528-f0bf897bd180","authorId":"2bc67121-5fef-4ec3-a825-cb57de02c615",
 "title":"Demo Ohne Marktplatz","description":"Eine Idee, deren Marktplatzphase noch nicht eroeffnet ist - sie hat nur eine Diskussion.",
 "tags":["demo","diskussion"],"language":"de","stage":"voting",
 "discussion":{"openedAt":"2026-10-05T20:55:29.746Z","comments":0,"votes":{"up":0,"down":0}},
 "createdAt":"2026-10-05T20:55:29.746Z"}

// Idee MIT Marktplatzphase — "creatorShareBp" steht in "marketplace"
{"id":"73cd7dee-e25e-43f8-8e09-ad44fe66e33b","authorId":"2bc67121-5fef-4ec3-a825-cb57de02c615",
 "title":"Demo Mit Marktplatz","description":"Eine Idee mit eroeffneter Marktplatzphase und gesetztem Funding-Ziel in Satoshi.",
 "tags":["demo","marktplatz"],"language":"de","stage":"marketplace",
 "discussion":{"openedAt":"2026-10-05T20:55:29.746Z","comments":0,"votes":{"up":0,"down":0}},
 "createdAt":"2026-10-05T20:55:29.746Z",
 "marketplace":{"openedAt":"2026-09-25T20:55:29.746Z","closesAt":"2026-10-25T20:55:29.746Z",
                "fundingGoal":12000000,"raised":0,"investors":0,"creatorShareBp":2000}}

// Dieselbe Form, aber ein Betrag ÜBER 2^53-1: Zahl wird Text.
// Als JSON-Zahl gelesen wäre 9007199254740993 hier 9007199254740992.
"marketplace":{"openedAt":"2026-10-05T20:57:40.895Z","closesAt":"2026-11-04T20:57:40.895Z",
               "fundingGoal":"9007199254740993","raised":"9007199254740993","investors":0,
               "creatorShareBp":2000}
```

| Parameter | Standard | Erlaubt | Verhalten außerhalb |
|---|---|---|---|
| `limit` | 20 | 1..100 | 400 |
| `offset` | 0 | 0..1000000 | 400 |

Reihenfolge: `created_at DESC, id DESC` — stabil, damit beim Blättern keine
Zeile doppelt oder gar nicht kommt.

Zeitstempel (`timestamptz`) gehen als ISO-8601 mit `Z` heraus, nie lokal und
nie in der Postgres-Schreibweise `+00:00`.

#### Woher die Werte kommen

| Antwortfeld | Quelle |
|---|---|
| `id`, `authorId`, `title`, `description`, `tags`, `language`, `stage`, `createdAt` | `ideas` |
| `discussion.*` | View `idea_discussion` (`JOIN`) |
| `marketplace.*` | View `idea_marketplace` (`LEFT JOIN`) |

Die Views sind genau für diese Verschachtelung gebaut (`api/migrations/README.md`,
„Namens-Mapping zur API“). Der `LEFT JOIN` ist Pflicht: ein `INNER JOIN` würde
jede Idee ohne Marktplatzphase stillschweigend aus der Liste werfen. Ob
`marketplace` erscheint, entscheidet damit die View — sie liefert für eine
nicht eröffnete Phase keine Zeile. Die vollständige Zuordnungstabelle
camelCase ↔ snake_case steht in `api/migrations/README.md`.

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

1. **camelCase und verschachtelt — der offene Punkt ist entschieden und
   umgesetzt.** Die frühere Fassung lieferte die flachen `snake_case`-Spalten
   durch; `CONTRACT.md` („Namensform je Schicht“) und `ARCHITECTURE.md`
   Anhang 5.2 verlangen dagegen camelCase mit den Werteobjekten `discussion`
   und `marketplace`. Die API ist die Übersetzungsschicht: sie liest die
   flachen Spalten und liefert die dokumentierte Form. Die Verschachtelung
   kommt aus den Views `idea_discussion` und `idea_marketplace`, die genau
   dafür existieren — nicht aus einem Zusammensetzen in der Anwendung.
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
   gerundet wird. Nach dem Umbau auf die verschachtelte Form gilt das
   unverändert für `marketplace.fundingGoal` und `marketplace.raised` — mit
   einer Auflage, die in Punkt 9 steht.
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
9. **Beträge dürfen nicht durch einen JSON-Ausdruck in SQL laufen.** Der
   naheliegende Weg, `marketplace` in SQL mit `json_build_object` zu bauen,
   ist eine Falle: `to_jsonb` schreibt ein `bigint` als JSON-**Zahl**, und die
   liest der Treiber als `double`. Aus `9007199254740993` (2^53+1) wurde
   dabei nachgemessen `9007199254740992` — eine Stelle zu klein, ohne
   Fehlermeldung, und in einer Geldspalte ist das ein stiller Verlust.
   Dieselbe Bauweise hätte `timestamptz` als `2026-05-01T10:00:00+00:00`
   ausgegeben, also anders als jeder andere Zeitstempel dieser API. Deshalb
   liest die Abfrage `funding_goal_sat` und `raised_sat` als Spalten (der
   Treiber liefert `int8` dann als `bigint`, exakt) und formt sie in
   `toJsonSafe()` um. Ein Test hält den Unterschied fest: derselbe Wert, einmal
   durch JSON und einmal als Spalte gelesen.
10. **`creatorShareBp` steht in `marketplace`.** Die Zuordnungstabelle in
    `api/migrations/README.md` führt `ideas.creator_share_bp` unter
    `marketplace`; `idea_marketplace` ist außerdem die einzige View, die die
    Spalte führt. Der Auftrag zu diesem Schritt sagt dagegen „gehört zur Idee“.
    Umgesetzt ist die Zuordnungstabelle, weil Anhang 5.2 das Feld gar nicht
    führt und ein Feld außerhalb von `marketplace` auch für Ideen ohne
    Marktphase erschiene — für eine Diskussionsidee ist die 20/80-Aufteilung
    aber noch nicht entschieden. **Gemeldete Abweichung vom Auftragstext**, sie
    steht ausführlich in `api/migrations/README.md`; umdrehen lässt sie sich
    an einer Stelle (`src/app.ts`, `toIdea()`). Beim Namen folgt die API der
    Einheit statt der Tabelle: `creatorShareBp` sagt, dass 2000 Basispunkte
    (20 %) gemeint sind, `creatorShare` ließe 20, 0.2 oder 2000 offen.
11. **Die Gruppierung in `discussion`/`marketplace` bleibt in TypeScript.**
    Die Feldauswahl kommt vollständig aus den Views; das Zusammensetzen zu
    Werteobjekten ist Namensform ohne neue Information und wäre in SQL nur
    über einen JSON-Ausdruck zu haben — der laut Punkt 9 genau die beiden
    Typen beschädigt, um die es hier geht. Die Views liefern damit weiterhin
    die Wahrheit darüber, welche Werte es gibt und ob es eine Marktplatzphase
    gibt; die API setzt sie nur in die dokumentierte Form.
12. **Die Views werden nicht in TypeScript nachgebaut.** Gelesen wird über
    `JOIN idea_discussion` und `LEFT JOIN idea_marketplace` — nicht über die
    Spalten von `ideas`. Damit gibt es genau eine Quelle für `discussion` und
    `marketplace`, und eine Änderung an einer View wirkt sofort auf die
    Antwort.
