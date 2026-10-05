# Ideenschmiede API

Backend für **Roadmap Phase 3.1/3.2** (Hono + PostgreSQL, TypeScript). Die API
liest Ideen und meldet Nutzer per **LNURL-auth** an — sonst nichts: keine
Geschäftslogik, kein Schreiben über die API. Das Gerüst belegt die Kette

    Repository (SQL)  ->  Hono  ->  PostgreSQL

gegen eine echte Datenbank trägt. Verifiziert gegen **PostgreSQL 16.15** mit
`api/migrations/001_init.sql` **und** `api/migrations/002_auth.sql`.

Maßgeblich für die Feldnamen der Datenbank ist `api/CONTRACT.md`; das Schema
stammt ausschließlich aus den Migrationen. Diese Datei erfindet keine Tabelle
und keine Spalte.

Maßgeblich für die **Antwortform** ist `ARCHITECTURE.md` Anhang 5.2
(`interface Idea`) — camelCase und verschachtelt, wie es `CONTRACT.md` unter
„Namensform je Schicht“ festschreibt. Die API ist die Übersetzungsschicht
dazwischen: sie liest die flachen `snake_case`-Spalten und liefert die
dokumentierte Form. Die Zuordnung camelCase ↔ snake_case steht vollständig in
`api/migrations/README.md`.

## Voraussetzungen

| | Version |
|---|---|
| Node.js | **20.19.0 oder neuer** (entwickelt und geprüft mit 24.19). Die Untergrenze stammt von `@noble/curves`, das die Signaturprüfung macht: ältere 20.x-Versionen lassen die Installation durchlaufen und scheitern erst beim Anmeldeversuch. |
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
| `src/app.ts` | Die Hono-App: `GET /health`, `GET /api/ideas`, die vier LNURL-auth-Endpunkte, 404 und Fehler als JSON |
| `src/auth.ts` | LNURL-auth: k1 erzeugen, LNURL bauen, DER-Signatur prüfen (secp256k1), Sitzungs-Token (HS256-JWT) |
| `src/authStore.ts` | Die Datenbankzugriffe dazu — inklusive des bedingten `UPDATE`, das eine k1 verbraucht |
| `src/bech32.ts` | bech32 nach BIP-173 (nur Kodieren) — die LNURL für den QR-Code |
| `src/server.ts` | Startet die App auf `PORT`, prüft die Verbindung einmal und meldet sie |
| `src/version.ts` | Version aus `package.json` (für `/health`) |
| `tests/` | Vitest gegen die echte Datenbank |
| `migrations/001_init.sql` | **Unverändert.** Eingespielt und verifiziert |
| `migrations/002_auth.sql` | **Neu.** `auth_identities` und `auth_challenges` (Phase 3.2) |
| `CONTRACT.md` | **Unverändert.** Kanonischer Datenvertrag |

## Konfiguration

Alles über Umgebungsvariablen (oder `api/.env`, siehe `.env.example`):

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `DATABASE_URL` | **ja** | — | `postgres://benutzer:passwort@host:port/datenbank` |
| `SESSION_SECRET` | **ja** | — | Geheimnis der Sitzungs-Token (HS256), mindestens 32 Zeichen |
| `AUTH_BASE_URL` | **ja** | — | Basis-URL dieser Instanz, z. B. `https://auth.ideenschmiede.example` — sie steckt im QR-Code |
| `PORT` | nein | `3000` | Port der HTTP-Schnittstelle (1..65535) |
| `HOST` | nein | `127.0.0.1` | Lauschadresse; im Container `0.0.0.0` |
| `NODE_ENV` | nein | `development` | `development`, `test`, `production` |

`DATABASE_URL`, `SESSION_SECRET` und `AUTH_BASE_URL` haben bewusst **keinen**
Standardwert. Fehlt einer, endet der Start mit Exit-Code 1 und einer Meldung,
die jeden Mangel einzeln benennt:

    Ungueltige Konfiguration - die API startet nicht:
      - DATABASE_URL fehlt (Pflichtwert ohne Standardwert), z.B. postgres://benutzer:passwort@localhost:5432/ideenschmiede
      - SESSION_SECRET fehlt (Pflichtwert ohne Standardwert), mindestens 32 Zeichen - ...
      - AUTH_BASE_URL fehlt (Pflichtwert ohne Standardwert), z.B. https://auth.ideenschmiede.example - ...
    Vorlage mit allen Variablen: api/.env.example

## Datenbank aufsetzen

```bash
docker run -d --name ide-api-pg -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=ideenschmiede -p 55454:5432 postgres:16-alpine

# warten, bis sie annimmt
docker exec ide-api-pg pg_isready -U postgres

# Migrationen einspielen (bricht beim ersten echten Fehler ab)
# Reihenfolge: 001, dann 002. 002 setzt users voraus.
docker cp api/migrations/001_init.sql ide-api-pg:/tmp/001.sql
docker cp api/migrations/002_auth.sql ide-api-pg:/tmp/002.sql
docker exec ide-api-pg psql -U postgres -d ideenschmiede -v ON_ERROR_STOP=1 -f /tmp/001.sql
docker exec ide-api-pg psql -U postgres -d ideenschmiede -v ON_ERROR_STOP=1 -f /tmp/002.sql
```

`001_init.sql` legt 9 Tabellen und 4 Views an (`idea_discussion`,
`idea_marketplace`, `idea_investor_shares`, `team_investor_shares`).
`002_auth.sql` legt 2 Tabellen an (`auth_identities`, `auth_challenges`) und
fasst `001_init.sql` **nicht** an — sie ist eingespielt und verifiziert. Die
zweite Migration ist einzeln einspielbar und läuft nach der ersten.

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

`SESSION_SECRET` und `AUTH_BASE_URL` setzt `vitest.config.ts` für den Testlauf
selbst — es sind ausdrücklich Testwerte, kein Geheimnis.

Ergebnis des geprüften Laufs (gegen PostgreSQL 16.15 im Container):

    ✓ tests/auth.test.ts (36 tests)
    ✓ tests/ideas.test.ts (23 tests)
    ✓ tests/health.test.ts (3 tests)
    Test Files  3 passed (3)
         Tests  62 passed (62)

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
* **LNURL-auth** (36 Tests): Herausforderung → echte Signatur → `OK`; derselbe
  Aufruf ein zweites Mal → `Challenge already used`; abgelaufene Herausforderung
  → abgewiesen (auch mit gültiger Signatur und bekanntem Schlüssel); nie
  erzeugte `k1` → abgewiesen; gefälschte Signatur → abgewiesen (und die
  Herausforderung bleibt **unverbraucht**); Signatur eines fremden Schlüssels →
  abgewiesen; Signatur zu einer anderen `k1` → abgewiesen; `action=login` mit
  unbekanntem Schlüssel → abgewiesen und **kein** Konto; `action=register` legt
  an, der zweite Login findet **denselben** Nutzer; `action` aus der URL wird
  ignoriert (maßgeblich ist die gespeicherte); `/api/users/me` ohne Sitzung →
  401, mit Token aus dem Login → der Nutzer; gefälschtes und abgelaufenes Token
  → 401; die LNURL wird im Test **unabhängig** dekodiert (eigener bech32-Decoder
  mit Prüfsumme) und muss genau die Callback-URL aus `AUTH_BASE_URL` tragen;
  fehlendes oder zu kurzes `SESSION_SECRET` und fehlende bzw. relative
  `AUTH_BASE_URL` brechen ab — auch beim Start der App.

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

### LNURL-auth — Anmeldung per Lightning-Wallet

Vier Endpunkte. Umgesetzt nach LUD-01/LUD-04: das Wallet leitet aus dem vollen
Domainnamen einen secp256k1-Schlüssel ab, signiert die `k1`-Bytes und ruft die
Callback-URL auf. **Es gibt kein Passwort und keine E-Mail-Prüfung** — der
Schlüssel ist die Identität.

#### Ablauf

```
Client                        API                          Datenbank
  |                            |                                |
  |-- POST /api/auth/challenge ->                                |
  |                            |-- 32 Zufallsbyte (k1) -------->|  auth_challenges
  |                            |   (action, expires_at, used_at) |
  |<- { k1, lnurl, expiresAt } -|                                |
  |                            |                                |
  |   QR-Code zeigen -> Wallet scannt die LNURL                  |
  |   Wallet signiert die k1-Bytes (SHA-256, DER)                |
  |                            |                                |
  |-- GET /api/auth/callback?tag=login&k1=&key=&sig=&action= --> |
  |                            |   bekannt? abgelaufen? benutzt? |
  |                            |   Signatur gültig? key passt?   |
  |                            |-- used_at setzen (bedingt!) --->|  UPDATE ... WHERE
  |                            |-- Nutzer/Identität anlegen ---->|  used_at IS NULL
  |<- { status: OK } + Set-Cookie                               |
```

Die vier Schritte im Einzelnen:

1. **`POST /api/auth/challenge`** erzeugt 32 zufällige Byte aus dem CSPRNG des
   Betriebssystems (`node:crypto`), schreibt sie als 64 Hexzeichen nach
   `auth_challenges` und liefert die fertige LNURL. Der Aufrufer schickt
   **keine** URL und keine Domain — die Callback-Adresse kommt ausschließlich
   aus `AUTH_BASE_URL`.
2. Das **Wallet** liest den QR-Code, leitet aus dem Domainnamen seinen Schlüssel
   ab und signiert die `k1`-Bytes. Hashen und Kodieren macht die
   Wallet-Bibliothek; die API prüft nur.
3. **`GET /api/auth/callback`** prüft in dieser Reihenfolge: Ist die `k1`
   bekannt? (sonst `Unknown k1`) · Ist sie abgelaufen? (`Challenge expired`) ·
   Ist sie schon benutzt? (`Challenge already used`) · Stimmt die
   DER-Signatur zum angegebenen `key`? (`Invalid signature`) · Ist der
   Schlüssel bekannt, falls `action=login`? (`Unknown linking key`). Erst
   danach wird die Herausforderung verbraucht und der Nutzer angelegt oder
   gefunden — **in einer Transaktion**: ein Konto ohne gebundenen Schlüssel
   wäre ein Konto, in das niemand mehr hineinkommt.
4. Die Antwort setzt ein Sitzungs-Cookie (`httpOnly`, `SameSite=Lax`) und
   trägt das Token zusätzlich im Körper — für Clients ohne Cookie-Speicher
   (CLI, spätere App), die es als `Authorization: Bearer <token>` senden.

#### `POST /api/auth/challenge`

Körper (optional): `{"action": "register" | "login" | "link" | "auth"}`.
Ohne Angabe gilt `login`. Eine unbekannte `action` ergibt **400** — sie wird
nicht stillschweigend zu `login`.

```json
{
  "k1": "0cb2f64a264f8d744f0154e4091012e7cad60c0f0b88b68418c8b2270a92bb24",
  "lnurl": "LNURL1DP68GURN8GHJ7CT4W35ZU6TYV4JKUUMRDPKKJETYV5HX27RPD4CXCEF0V9CXJTMPW...",
  "expiresAt": "2026-10-05T21:15:37.531Z"
}
```

`lnurl` ist die vollständige, bech32-kodierte URL für den QR-Code
(Großschreibung `LNURL1…`, wie es Wallets erwarten). Sie zeigt auf
`<AUTH_BASE_URL>/api/auth/callback?tag=login&k1=…&action=…`.

`expiresAt` ist ISO-8601 mit `Z` — wie jeder Zeitstempel dieser API. Die Frist
beträgt 5 Minuten (`CHALLENGE_TTL_MS`).

#### `GET /api/auth/callback`

Parameter: `k1` (64 Hexzeichen), `key` (33 Byte compressed, hex — 02/03-Präfix),
`sig` (DER-kodiert, hex), dazu `tag=login` und `action`.

| Fall | HTTP | Antwort |
|---|---|---|
| Erfolg | 200 | `{"status":"OK","token":"…","userId":"…","user":{…}}` + `Set-Cookie` |
| Parameter fehlen oder unbrauchbar | 400 | `{"status":"ERROR","reason":"Invalid request"}` |
| `k1` nie erzeugt | 401 | `…"reason":"Unknown k1"` |
| `k1` abgelaufen | 401 | `…"reason":"Challenge expired"` |
| `k1` schon benutzt | 401 | `…"reason":"Challenge already used"` |
| Signatur falsch, kaputt oder fremder Schlüssel | 401 | `…"reason":"Invalid signature"` |
| `action=login` mit unbekanntem Schlüssel | 401 | `…"reason":"Unknown linking key"` |
| `action=link` ohne Sitzung | 401 | `…"reason":"Action link requires an authenticated session"` |

Die Erfolgs- und Fehlerform ist die der Spezifikation. Sie unterscheidet sich
bewusst von der Fehlerform der übrigen Endpunkte (`{ error: { code, message } }`):
LNURL-auth-Clients sind Wallets, und sie sollen keine API-eigene Hülle
verstehen müssen.

#### `POST /api/auth/logout`

Löscht das Sitzungs-Cookie und antwortet `{"status":"OK"}`. Das Token selbst
wird **nicht** widerrufen — es gibt keine Sitzungstabelle (so vorgesehen).
Gültig bleibt es bis `exp`; die Lebensdauer (`SESSION_TTL_SECONDS`, 7 Tage)
ist damit die einzige Schranke für ein bereits kopiertes Token.

#### `GET /api/users/me`

Der angemeldete Nutzer, sonst **401** `{"status":"ERROR","reason":"Unauthorized"}`.
Die Sitzung kommt aus dem Cookie `session` oder aus `Authorization: Bearer <token>`.

```json
{"user":{"id":"f9e71731-5235-4eba-afdb-9b0396071f28","username":"ln_03280e0e189bc621e1fd9150a2d",
 "displayName":"LNURL-Nutzer 03280e0e18","email":"ln_03280e0e189bc621e1fd9150a2d@lnurl.invalid",
 "language":"de","role":"visitor","createdAt":"2026-10-05T21:10:58.951Z"}}
```

`role` ist die abgeleitete Rolle aus `users` (ADR-003) — ein angemeldeter Nutzer
ohne Abonnement ist `visitor`. Ein `avatarUrl` fehlt, solange es keinen gibt.
`email` ist bei einem per LNURL-auth angelegten Konto ein Platzhalter auf der
reservierten Domain `.invalid` (siehe unten).

#### `action`: register, login, link, auth

| Wert | Verhalten |
|---|---|
| `login` (Standard) | Unbekannter Schlüssel wird **abgewiesen** (401) |
| `register` | Unbekannter Schlüssel wird angelegt; ein bekannter wird angemeldet (idempotent) |
| `auth` | wie `register` — der übliche LNURL-auth-Fall |
| `link` | **nicht umgesetzt**: verlangt eine Sitzung (401 sonst) und antwortet auch mit Sitzung `501` |

Maßgeblich ist die `action`, die **in der Datenbank** zur `k1` steht — nicht die
aus der URL. Ein Aufrufer, der `action=register` an eine für `login` erzeugte
Herausforderung hängt, ändert damit nichts (ein Test hält das fest).

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

### Sicherheitshinweise zum Login

#### Die `k1` ist EINMAL verwendbar — und das entscheidet die Datenbank

Die Spezifikation verlangt: „*it is strongly advised to have a cache of unused
k1s, only proceed with verification of k1s present in that cache and REMOVE USED
k1s on successful auth attempts*“. Umgesetzt ist das **nicht** als Cache im
Arbeitsspeicher, sondern als Zustand in der Datenbank:

* Ein Cache im Speicher gilt nur, solange **ein** Prozess läuft. Bei zwei
  Instanzen hinter einem Lastverteiler sieht die zweite die `k1` der ersten
  nicht (die Anmeldung schlägt zufällig fehl), und ein Neustart vergisst alle
  offenen Herausforderungen — **schlimmer: er vergisst auch die verbrauchten.**
  Eine bereits benutzte `k1` wäre danach wieder gültig, der Login also
  wiederholbar. Genau das darf nicht passieren.
* `auth_challenges.k1` ist der **Primärschlüssel**: eine `k1` kann nur einmal
  entstehen. Verbraucht heißt `used_at IS NOT NULL` — ein Zustand, den kein
  Neustart zurücknimmt.
* Verbraucht wird über ein **bedingtes** `UPDATE … WHERE k1 = $1 AND used_at IS
  NULL AND expires_at > now()`. Steht die Bedingung im `UPDATE`, entscheidet die
  Zeilensperre von PostgreSQL, wer von zwei gleichzeitigen Aufrufen gewinnt.
  Ein vorheriges `SELECT` mit anschließendem `UPDATE` hätte genau dazwischen ein
  Zeitfenster, in dem beide Aufrufe dieselbe `k1` als unverbraucht sehen.
* Die Herausforderung wird **zuletzt** verbraucht: nach der Signaturprüfung.
  Andernfalls könnte jeder mit geratenen Signaturen fremde Herausforderungen
  verbrennen. Umgekehrt gilt: eine gültige Signatur auf eine schon verbrauchte
  `k1` wird abgewiesen — ein abgefangener Callback ist damit wertlos.

Belegt ist das auf zwei Ebenen: als Test (derselbe Callback zweimal → beim
zweiten Mal `Challenge already used`, `used_at` in der Datenbank gesetzt) und
im echten Durchlauf gegen den laufenden Server (siehe unten).

#### Die Domain bindet den Schlüssel — `AUTH_BASE_URL` darf sich nicht ändern

Wallets leiten den `linkingKey` aus dem **vollen Domainnamen** ab. Die
Spezifikation sagt es deutlich: „*if auth.site.com was initially chosen then
changing it to login.site.com will result in different account for each user
because full domain name is used by wallets as material for key derivation*“.

Daraus folgt für den Betrieb:

* `AUTH_BASE_URL` ist **kein** Kosmetikwert. Wird sie geändert (auch nur
  `auth.example.com` → `login.example.com`, oder http → https), leitet dieselbe
  Wallet einen **anderen** Schlüssel ab. Bestehende Konten sind dann nicht mehr
  erreichbar — die Nutzer bekommen still ein neues Konto, und das alte bleibt
  mit seinen Daten stehen. Die Subdomain muss also **vor** dem ersten Login
  feststehen.
* Die Callback-Adresse wird ausschließlich aus `AUTH_BASE_URL` gebaut, **nie**
  aus dem `Host`-Kopf der Anfrage. Sonst hinge der Schlüssel davon ab, unter
  welcher Adresse der Client die API gerade erreicht (etwa intern über einen
  anderen Namen) — und derselbe Nutzer hätte je nach Aufrufweg ein anderes Konto.
* Aus demselben Grund ist `AUTH_BASE_URL` ein Pflichtwert **ohne Standardwert**:
  ein geratener Wert würde Nutzer an eine Domain binden, die es nicht gibt.

#### Sitzung und Geheimnis

* Das Sitzungs-Token ist ein **HS256-JWT** mit `sub` (Nutzerkennung), `iat`,
  `exp` und `jti`. Algorithmus und Signatur werden geprüft (`alg` muss `HS256`
  sein — der klassische JWT-Fehler ist eine Bibliothek, die den Algorithmus aus
  dem Token übernimmt), der Vergleich der Signatur läuft über
  `timingSafeEqual`.
* `SESSION_SECRET` hat **keinen Standardwert**. Ein fest eingebautes Geheimnis
  macht jedes Token fälschbar; fehlt es, startet die API nicht. Erzeugen z. B. mit
  `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
* Das Cookie ist `httpOnly` (JavaScript kommt nicht daran) und `SameSite=Lax`.
  `Secure` wird nur bei `NODE_ENV=production` gesetzt — im
  Entwicklungsbetrieb läuft die API über http, und ein `Secure`-Cookie würde der
  Browser dann verwerfen: die Anmeldung wäre scheinbar erfolgreich, ohne zu
  wirken.
* Im Token stehen **keine** Rechte. Rolle und Nutzer werden bei jeder Anfrage
  aus der Datenbank gelesen; ein gelöschter Nutzer hat sofort keine Sitzung mehr.

#### Krypto kommt nicht aus diesem Repository

Das Signaturverfahren (secp256k1, DER) liegt vollständig in `@noble/curves`,
HMAC-SHA256 in `node:crypto`. Eigener Code ist nur die **Reihenfolge der
Prüfungen** und die Frage, wer eine Herausforderung verbrauchen darf.
`src/bech32.ts` ist die eine Ausnahme — und keine Krypto: bech32 ist eine
Zeichenkodierung mit Prüfsumme, ohne Schlüssel und ohne Geheimnis. Sie ist
gegen die veröffentlichten Testvektoren aus BIP-173 geprüft (der P2WPKH-Vektor
`bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4`) und zusätzlich gegen eine zweite,
unabhängige Umsetzung derselben Kodierung.

#### Keine erfundene E-Mail-Adresse

`users.email` ist `NOT NULL` mit Formatprüfung, LNURL-auth übermittelt aber
keine Adresse. Ein per Schlüssel angelegtes Konto bekommt deshalb
`ln_<schlüssel>@lnurl.invalid` — die Domain `.invalid` ist nach RFC 2606
reserviert und kann niemandem gehören. Eine erfundene *echte* Adresse wäre
schlimmer: sie könnte jemandem gehören, der nichts damit zu tun hat. Nutzer
können die Adresse später ändern.

#### Protokoll und Ratenbegrenzung

`expiresAt`-Angaben und Token werden **nicht** protokolliert; im Serverprotokoll
steht bei einem Fehler nur die feste Begründung (`reason`). Ein Token in einer
Logzeile wäre ein Zugangsschlüssel in einer Logzeile. Eine Ratenbegrenzung für
`/api/auth/challenge` gibt es **nicht** — sie gehört vor den Betrieb (Reverse
Proxy), nicht in diese Anwendung; unbegrenzt erzeugte Herausforderungen wachsen
sonst in `auth_challenges`.

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
8. **LNURL-auth ist da, Schreiben fehlt weiterhin.** Phase 3.2 ergänzt die vier
   Endpunkte aus dem Abschnitt „LNURL-auth“ (`/health` und `/api/ideas` kommen
   dazu). Webhooks und schreibende Endpunkte folgen in Phase 3.3.
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
13. **Pfade weiterhin ohne Versionspräfix — gemeldeter offener Punkt.**
    `ARCHITECTURE.md` Anhang 6.1 nennt die Endpunkte mit `/api/v1/...`
    (`/api/v1/auth/login`, `/api/v1/users/me`, …); der bestehende Code nutzt
    `/api/...` ohne Version (`/api/ideas`). Die neuen Endpunkte folgen dem
    **Bestehenden** (`/api/auth/challenge`, `/api/auth/callback`,
    `/api/auth/logout`, `/api/users/me`) — eine API mit zwei
    Versionskonventionen nebeneinander wäre schlechter als eine ohne Version.
    Das ist eine **Entscheidung des Koordinators**, keine stille Abweichung:
    soll Anhang 6.1 gelten, ist es eine Änderung an einer Stelle (`src/app.ts`,
    die vier Pfadangaben) plus die Dokumentation. **Zur Kenntnis und zum
    Entscheid.**
14. **Eigene Tabelle `auth_identities` statt `user_wallets`.** `user_wallets`
    trägt `xpub` — einen erweiterten öffentlichen Schlüssel für **Zahlungen**
    (ADR-006). Der `linkingKey` ist ein einzelner secp256k1-Punkt (33 Byte,
    compressed) und dient der **Identität**. Zwei Dinge mit zwei
    Lebensdauern: ein xpub wird gewechselt, wenn der Nutzer eine andere Wallet
    zum Empfangen benutzt; der `linkingKey` **ist** der Login und an diese
    Domain gebunden. Praktisch käme hinzu, dass `user_wallets_public_key_check`
    einen `linkingKey` abweisen würde — der `CHECK` verlangt ein
    `xpub`/`ypub`/`zpub`-Präfix, ein `linkingKey` beginnt mit `02` oder `03`.
    Der `CHECK` ist richtig; deshalb eine eigene Tabelle statt einer Aufweichung
    von `001_init.sql`.
15. **Die `k1` liegt in der Datenbank, nicht im Arbeitsspeicher.** Begründung
    und Beleg stehen unter „Sicherheitshinweise“. Kurz: ein Cache im Speicher
    gilt nur für einen Prozess und vergisst beim Neustart **auch die
    verbrauchten** Herausforderungen — der Login wäre dann wiederholbar. In der
    Datenbank ist „verbraucht“ ein Zustand, der einen Neustart überlebt.
16. **`action=link` ist nicht umgesetzt.** Der Wert bleibt im Enum
    (Spezifikation) und in `auth_challenges_action_check` erlaubt; der Ablauf
    selbst — einen **zweiten** Schlüssel an ein **bestehendes** Konto hängen —
    gehört zu einer Sitzungsverwaltung, die dieser Schritt nicht hat. Ohne
    Sitzung antwortet der Endpunkt `401`, mit Sitzung `501` und dem Grund
    `Action link requires an authenticated session`. Bewusst **kein**
    stillschweigendes „wie register“: das würde einen fremden Schlüssel an ein
    bestehendes Konto hängen können.
17. **Die Sitzung ist ein HS256-JWT, keine Sitzungstabelle.** Sitzungen werden
    damit **nicht** widerrufen, sondern laufen ab (7 Tage). Das ist die
    Vorgabe; die Kehrseite gehört dazu: ein kopiertes Token bleibt bis `exp`
    gültig, auch nach einem Logout. Wer sofortigen Widerruf braucht, braucht
    eine Tabelle mit `jti` — das Token trägt die `jti` dafür bereits.
18. **Die Frist einer Herausforderung beträgt 5 Minuten.** Die Spezifikation
    nennt keine Zahl. Sie muss lang genug für „QR-Code scannen und bestätigen“
    sein und kurz genug, dass ein Screenshot des QR-Codes später nichts mehr
    wert ist. Die Konstante steht in `src/auth.ts` (`CHALLENGE_TTL_MS`).
19. **Eine abgelaufene Herausforderung wird nicht verbraucht.** Sie bleibt mit
    `used_at IS NULL` stehen — als Nachweis, dass sie erzeugt und nie benutzt
    wurde. Ein Unterschied, der beim Nachschauen zählt: `expires_at` in der
    Vergangenheit heißt „abgelaufen“, `used_at` gesetzt heißt „benutzt“.
20. **bech32 ist selbst geschrieben — als Kodierung, nicht als Krypto.**
    `lnurl` muss eine vollständige, bech32-kodierte URL sein; ein halbes
    Ergebnis wäre ein QR-Code, der nichts tut. Die Umsetzung folgt BIP-173
    (nur Kodieren, nur die klassische bech32-Prüfsumme, nicht bech32m) und ist
    gegen die veröffentlichten Testvektoren geprüft. Zwei Fallen dabei, beide
    nachgemessen und im Code benannt: die Prüfsumme ist `polymod XOR 1` (ohne
    das XOR stimmen nur die untersten Bits nicht), und `x >>> 32` ist in
    JavaScript **nicht** 0, sondern `x` — die Schiebeweite wird auf 5 Bit
    reduziert. Mit der naheliegenden Schleife wäre das letzte Prüfsummenzeichen
    falsch gewesen.
21. **Die Migration 002 ist eigenständig, aber setzt 001 voraus.** Sie legt
    `CREATE EXTENSION IF NOT EXISTS pgcrypto` erneut an — der Aufruf ist
    idempotent und schadet nach `001_init.sql` nicht (dort steht er ebenfalls).
    `001_init.sql` ist **unverändert**; die zweite Migration läuft einzeln und
    danach, geprüft mit `ON_ERROR_STOP=1` gegen PostgreSQL 16 im Container.
22. **Die E-Mail eines neuen Kontos ist ein Platzhalter auf `.invalid`.**
    Siehe „Sicherheitshinweise“; `users.email` ist `NOT NULL` mit Formatprüfung,
    LNURL-auth liefert aber keine Adresse.
23. **Echte Anmeldung, nachgemessen.** Ablauf und Ausgaben des geprüften
    Durchlaufs stehen unten im Abschnitt „Verifikation gegen echtes
    PostgreSQL“ — mit Signatur aus `@noble/curves` und der Wiederholung
    desselben Aufrufs als Replay-Nachweis.

## Verifikation gegen echtes PostgreSQL

Kein Trockenlauf: `postgres:16-alpine` im Container, `001_init.sql` **und**
`002_auth.sql` mit `ON_ERROR_STOP=1` eingespielt, Server gestartet und die
Endpunkte per HTTP abgerufen. Signiert wurde mit `@noble/curves` — dieselbe
Bibliothek, die die API zum Prüfen benutzt, aber auf der Wallet-Seite des
Protokolls. Auszug der echten Ausgaben:

```
--- POST /api/auth/challenge
HTTP 200 application/json
{"k1":"0cb2f64a264f8d744f0154e4091012e7cad60c0f0b88b68418c8b2270a92bb24",
 "lnurl":"LNURL1DP68GURN8GHJ7CT4W35ZU6TYV4JKUUMRDPKKJETYV5HX27RPD4CXCEF0V9CXJTMPW...",
 "expiresAt":"2026-10-05T21:15:37.531Z"}
LNURL Länge: 246 Zeichen
Signatur (DER, hex): 144 Zeichen

--- GET /api/auth/callback (gültig)
HTTP 200 application/json
session=<JWT>; Max-Age=604800; Path=/; HttpOnly
{"status":"OK","token":"<JWT>","userId":"974f5871-…","user":{…}}

--- GET /api/auth/callback (DERSELBE Aufruf, zweites Mal)
HTTP 401 application/json
{"status":"ERROR","reason":"Challenge already used"}

--- GET /api/users/me (mit Token aus dem Login)
HTTP 200 application/json
{"user":{"id":"974f5871-…","username":"ln_0332d1d0b32…","role":"visitor",…}}

--- GET /api/users/me (ohne Token)
HTTP 401 application/json
{"status":"ERROR","reason":"Unauthorized"}

--- POST /api/auth/logout
HTTP 200 application/json
session=; Max-Age=0; Path=/; HttpOnly
{"status":"OK"}

--- Datenbank nach dem Login
auth_challenges: {"k1":"0cb2f64a…","action":"register",
                  "used_at":"2026-10-05T21:10:37.611Z","abgelaufen":false}
auth_identities: {"linking_key":"0332d1d0b32a…","last_login_at":"2026-10-05T21:10:37.611Z"}
users:           {"username":"ln_0332d1d0b32…","role":"visitor"}

--- Ohne SESSION_SECRET (Start)
EXITCODE=1
Ungueltige Konfiguration - die API startet nicht:
  - SESSION_SECRET fehlt (Pflichtwert ohne Standardwert), mindestens 32 Zeichen - …
Vorlage mit allen Variablen: api/.env.example
```

**Wie die Einmaligkeit der `k1` belegt ist** — drei voneinander unabhängige
Beobachtungen, nicht eine:

1. Der **zweite Aufruf derselben URL** (gleiche `k1`, gleiche, weiterhin
   gültige Signatur) ergibt `401 Challenge already used` und **kein** Token.
2. Die **Datenbank** zeigt danach `used_at` gesetzt — der Verbrauch ist ein
   Zustand in `auth_challenges`, keine Behauptung der Anwendung.
3. Der **Primärschlüssel** auf `k1` lässt dieselbe Herausforderung kein zweites
   Mal entstehen; ein direkter `INSERT` derselben `k1` scheitert am Schema
   (eigener Test). Damit ist auch der Fall abgedeckt, dass die Anwendung selbst
   es versuchen würde.

Dazu die Gegenprobe: eine **abgewiesene** Anmeldung (falsche Signatur,
abgelaufene Herausforderung, `action=login` mit unbekanntem Schlüssel) lässt
`used_at` auf `NULL` — abgewiesen bleibt abgewiesen, ohne die Herausforderung zu
verbrennen. Ein Angreifer mit geratenen Signaturen kann fremde Anmeldungen damit
nicht blockieren.

Der Container wurde nach der Prüfung entfernt.