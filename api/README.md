# Ideenschmiede API

Backend für **Roadmap Phase 3.1/3.2/3.3** (Hono + PostgreSQL, TypeScript). Die
API liest Ideen, meldet Nutzer per **LNURL-auth** an und nimmt den
**BTCPay-Webhook** entgegen, der bezahlte Abonnements gutschreibt. Das Gerüst
belegt die Kette

    Repository (SQL)  ->  Hono  ->  PostgreSQL

gegen eine echte Datenbank trägt. Verifiziert gegen **PostgreSQL 16.15** mit
`api/migrations/001_init.sql`, `api/migrations/002_auth.sql` **und**
`api/migrations/003_subscriptions.sql`.

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
| `src/authStore.ts` | Die Datenbankzugriffe dazu — inklusive des bedingten `UPDATE`, das eine k1 verbraucht, der Ratenzählung und des Aufräumens |
| `src/rateLimit.ts` | Ratenbegrenzung von `POST /api/auth/challenge`: Client-Adresse bestimmen, gleitendes Fenster zählen, 429 auslösen |
| `src/cleanup.ts` | Aufräumen: Fristen und Reihenfolge für abgelaufene und verbrauchte Herausforderungen sowie alte Ratenzeilen |
| `scripts/cleanup-auth.mjs` | Dasselbe Aufräumen von Hand oder per Cron (`npm run cleanup`) |
| `src/subscriptions.ts` | BTCPay-Webhook: HMAC-Prüfung über die **rohen Bytes**, Auswertung des Ereignisses, Idempotenz beim Buchen |
| `scripts/verify-webhook.mjs` | Verifikationsskript gegen den laufenden Server (nicht Teil der Testsuite) — signiert echte Bytes und stellt dreimal zu |
| `src/bech32.ts` | bech32 nach BIP-173 (nur Kodieren) — die LNURL für den QR-Code |
| `src/server.ts` | Startet die App auf `PORT`, prüft die Verbindung einmal und meldet sie |
| `src/version.ts` | Version aus `package.json` (für `/health`) |
| `tests/` | Vitest gegen die echte Datenbank |
| `migrations/001_init.sql` | **Unverändert.** Eingespielt und verifiziert |
| `migrations/002_auth.sql` | `auth_identities` und `auth_challenges` (Phase 3.2) |
| `migrations/003_subscriptions.sql` | `subscription_intents` — die Absicht, die Nutzer und BTCPay-Rechnung verbindet (Phase 3.3) |
| `migrations/004_ideas_listing.sql` | Sortierindex für die Ideenliste |
| `migrations/005_ratelimit.sql` | **Neu.** `auth_rate_events` — eine Zeile je erlaubtem Aufruf, gezählt über ein gleitendes Fenster |
| `tests/subscriptions.test.ts` | 34 Tests zum Webhook (Phase 3.3) |
| `tests/ratelimit.test.ts` | **Neu.** 26 Tests zu Ratenbegrenzung, Client-Adresse (inkl. `X-Forwarded-For`) und Aufräumen |
| `CONTRACT.md` | **Unverändert.** Kanonischer Datenvertrag |

## Konfiguration

Alles über Umgebungsvariablen (oder `api/.env`, siehe `.env.example`):

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `DATABASE_URL` | **ja** | — | `postgres://benutzer:passwort@host:port/datenbank` |
| `SESSION_SECRET` | **ja** | — | Geheimnis der Sitzungs-Token (HS256), mindestens 32 Zeichen |
| `AUTH_BASE_URL` | **ja** | — | Basis-URL dieser Instanz, z. B. `https://auth.ideenschmiede.example` — sie steckt im QR-Code |
| `BTCPAY_WEBHOOK_SECRET` | **ja** (für den Start) | — | Geheimnis, mit dem BTCPay den Webhook signiert (Kopf `BTCPay-Sig`) |
| `AUTH_RATE_LIMIT` | nein | `30` | Erlaubte Aufrufe von `POST /api/auth/challenge` je Client-Adresse und Fenster (1..10000) |
| `AUTH_RATE_WINDOW_MS` | nein | `60000` | Länge des **gleitenden** Fensters in Millisekunden (1000 .. 86400000) |
| `AUTH_TRUSTED_PROXIES` | nein | leer | Adressen von Reverse Proxies, deren `X-Forwarded-For` geglaubt wird (kommasepariert) |
| `PORT` | nein | `3000` | Port der HTTP-Schnittstelle (1..65535) |
| `HOST` | nein | `127.0.0.1` | Lauschadresse; im Container `0.0.0.0` |
| `NODE_ENV` | nein | `development` | `development`, `test`, `production` |

`DATABASE_URL`, `SESSION_SECRET`, `AUTH_BASE_URL` und (für den Betrieb)
`BTCPAY_WEBHOOK_SECRET` haben bewusst **keinen** Standardwert. Fehlt einer,
endet der Start mit Exit-Code 1 und einer Meldung, die jeden Mangel einzeln
benennt:

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
# Reihenfolge: 001, dann 002, dann 003. Jede setzt die vorige voraus.
docker cp api/migrations/001_init.sql ide-api-pg:/tmp/001.sql
docker cp api/migrations/002_auth.sql ide-api-pg:/tmp/002.sql
docker cp api/migrations/003_subscriptions.sql ide-api-pg:/tmp/003.sql
docker cp api/migrations/004_ideas_listing.sql ide-api-pg:/tmp/004.sql
docker cp api/migrations/005_ratelimit.sql ide-api-pg:/tmp/005.sql
docker exec ide-api-pg psql -U postgres -d ideenschmiede -v ON_ERROR_STOP=1 -f /tmp/001.sql
docker exec ide-api-pg psql -U postgres -d ideenschmiede -v ON_ERROR_STOP=1 -f /tmp/002.sql
docker exec ide-api-pg psql -U postgres -d ideenschmiede -v ON_ERROR_STOP=1 -f /tmp/003.sql
docker exec ide-api-pg psql -U postgres -d ideenschmiede -v ON_ERROR_STOP=1 -f /tmp/004.sql
docker exec ide-api-pg psql -U postgres -d ideenschmiede -v ON_ERROR_STOP=1 -f /tmp/005.sql
```

`001_init.sql` legt 9 Tabellen und 4 Views an (`idea_discussion`,
`idea_marketplace`, `idea_investor_shares`, `team_investor_shares`).
`002_auth.sql` legt 2 Tabellen an (`auth_identities`, `auth_challenges`),
`003_subscriptions.sql` eine (`subscription_intents`), `004_ideas_listing.sql`
einen Sortierindex, `005_ratelimit.sql` eine (`auth_rate_events` - die
Ratenbegrenzung, siehe „Ratenbegrenzung und Aufräumen“). Keine der neueren
Migrationen fasst `001_init.sql` an — sie ist eingespielt und verifiziert; jede
ist einzeln einspielbar und läuft nach der vorigen.

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

    [api] Aufgeraeumt: 0 verbrauchte Herausforderungen, 12 abgelaufene Herausforderungen, 480 Ratenzeilen (Stand 2026-10-05T22:06:36.560Z)
    [api] PostgreSQL verbunden: postgres://***:***@127.0.0.1:55454/ideenschmiede (server_version 16.15)
    [api] Ideenschmiede-API 0.1.0 hoert auf http://127.0.0.1:3000 (NODE_ENV=development, BTCPAY_WEBHOOK_SECRET gesetzt)

Zugangsdaten werden dabei maskiert. Ist die Datenbank nicht erreichbar, startet
der Prozess trotzdem — `/health` meldet dann `db: false`.

Die erste Zeile ist das **Aufräumen beim Start** (siehe „Aufräumen“): es läuft
vor dem Binden des Ports, damit der Zustand feststeht, wenn die API erreichbar
ist. Scheitert es, wird das gemeldet und der Start läuft weiter:

    [api] Aufraeumen beim Start fehlgeschlagen (der Start laeuft weiter): <Meldung>

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

    ✓ tests/subscriptions.test.ts (34 tests)
    ✓ tests/auth.test.ts (36 tests)
    ✓ tests/ratelimit.test.ts (26 tests)
    ✓ tests/ideas.test.ts (23 tests)
    ✓ tests/health.test.ts (3 tests)
    Test Files  5 passed (5)
         Tests  122 passed (122)

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
* **BTCPay-Webhook** (34 Tests): eine Absicht wird über die Route angelegt (ohne
  Sitzung `401`); ein zweiter Aufruf liefert **dieselbe** Absicht; mit aktivem
  Abonnement `409`. Die Signatur wird über die **rohen Bytes** geprüft: eine
  gültige Zustellung bucht, eine gefälschte Signatur ergibt `401` **ohne jede
  Buchung**, ein fehlender Kopf ebenso, ein anderes Geheimnis ebenso, und ein
  Rumpf, dessen Signatur über eine **andere Serialisierung** desselben Inhalts
  gebildet wurde, ebenfalls `401` — dieselben Bytes signiert und gesendet werden
  angenommen. DIESELBE Zustellung zweimal: `subscriptions` bleibt bei **1** Zeile
  und die Frist verschiebt sich nicht; `is_redelivery: true` bucht nichts
  doppelt, und eine **erste** Zustellung mit `is_redelivery: true` wird trotzdem
  verbucht (das Feld ist ein Hinweis, keine Absicherung). Eine zweite Rechnung mit
  derselben `txid` ergibt `duplicate_payment`, keine zweite Zeile und eine
  **offen** gebliebene Absicht (der Rollback nimmt den Statuswechsel mit). Zwei
  **gleichzeitige** Zustellungen ergeben genau eine Gutschrift. Alle übrigen
  Ereignistypen (`InvoiceCreated`, `InvoiceReceivedPayment`, `InvoiceProcessing`,
  `InvoiceExpired`, `InvoicePaymentSettled`, `InvoiceInvalid`) ergeben `200` ohne
  Buchung, eine unbekannte `invoice_id` `200` mit `unknown_invoice` (**nicht**
  `404`), eine abgelaufene Absicht `expired_intent`, ein kaputter Rumpf mit
  gültiger Signatur `400`. `InvoiceExpired` und `InvoiceInvalid` buchen nichts,
  schließen die Absicht aber (`status` = `expired`/`invalid`, `closedIntent: true`) —
  eine danach eintreffende Zahlung auf dieselbe Rechnung ergibt
  `intent_not_open` und **kein** Abonnement. `manually_marked: true` wird als
  `manuallyMarked` **gemeldet** und ändert an der Buchung nichts. Nach der Gutschrift
  steht `role` auf `subscriber`;
  läuft das Abonnement ab, fällt sie auf `user` **und eine Stimme wird von der
  Datenbank abgewiesen** (ADR-003). Fehlt `BTCPAY_WEBHOOK_SECRET`, bricht der
  Start mit Exit-Code 1 ab; mit gesetztem Wert kommt er über die Prüfung hinaus
  (belegt über einen Kindprozess, der auf einem belegten Port läuft und
  `EADDRINUSE` meldet).
* **Ratenbegrenzung und Aufräumen** (26 Tests, `tests/ratelimit.test.ts`): unter
  der Grenze gelingen mehrere Aufrufe; **der nächste** ergibt `429` mit
  `{"status":"ERROR","reason":"Too many requests"}` und einem ganzzahligen
  `Retry-After`; die abgewiesene Anfrage schreibt **keine** Zeile. Nach Ablauf
  des Fensters ist wieder erlaubt — **ohne echte Wartezeit**, die Uhr kommt aus
  `AuthConfig.now`. Die Grenze gilt **je Client-Adresse** (ein belegter fremder
  Schlüssel sperrt den eigenen nicht aus) und **nicht** auf anderen Endpunkten
  (`/api/ideas`, `/health`, `/api/auth/logout`, `/api/users/me`,
  `/api/auth/callback` werden von der erreichten Grenze nicht berührt). Ein
  Nutzer mit mehreren vollständigen Anmeldungen im Fenster kommt durch (dreimal
  dieselbe `userId`). `X-Forwarded-For` wird **nicht** geglaubt, wenn die
  Verbindung von keinem eingetragenen Proxy kommt (fünf erfundene Adressen
  landen in **einem** Topf und der sechste Aufruf ergibt `429`); kommt sie von
  einem eingetragenen, zählt der **erste** Eintrag der Kette, und zwei Clients
  haben getrennte Grenzen; ein leerer oder unbrauchbar langer Kopf fällt auf die
  Verbindungsadresse zurück; ohne feststellbare Adresse gilt **ein** Topf
  (`unknown`). Die Adressbildung selbst ist ohne HTTP geprüft (`clientAddress`,
  `forwardedClientAddress`, `peerAddressOf`). Aufgeräumt wird gegen eine echte
  Datenbank: verbrauchte Herausforderungen verschwinden, abgelaufene erst nach
  der Nachfrist, **gültige unbenutzte bleiben stehen**; der zweite Lauf meldet
  `0, 0, 0`, und zwei **gleichzeitige** Läufe löschen zusammen genau einmal.
  Zuletzt: das Aufräumen beim Start wird aufgerufen und **ein Fehler dabei
  beendet den Start nicht** (beide Fälle mit einer injizierten Funktion geprüft).
  Die Konfiguration hat Standardwerte (`30`/`60000`), lässt sich überschreiben
  und meldet unbrauchbare Werte, statt sie still zu ersetzen.

Die Tests legen ihre Zeilen selbst an und räumen sie wieder ab; sie schreiben
nichts über die API, sondern per SQL. `tests/auth.test.ts` setzt die Grenze für
seinen Lauf ausdrücklich hoch (10 000): er ruft den Endpunkt vielfach auf und
prüft die **Anmeldung**, nicht die Begrenzung — die hat eine eigene Datei.

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

**Ratenbegrenzung.** Der Endpunkt ist öffentlich, und jeder Aufruf schreibt eine
Zeile. Deshalb zählt er je Client-Adresse in einem **gleitenden** Fenster
(Standard: 30 Aufrufe je 60 Sekunden, `AUTH_RATE_LIMIT` / `AUTH_RATE_WINDOW_MS`):

| Fall | HTTP | Antwort |
|---|---|---|
| innerhalb der Grenze | 200 | `{ k1, lnurl, expiresAt }` |
| Grenze überschritten | 429 | `{"status":"ERROR","reason":"Too many requests"}` + `Retry-After: 60` |

Die abgewiesene Anfrage erzeugt **keine** Herausforderung und **keine** Ratenzeile
— sonst wäre die Zähltabelle selbst der Schreibverstärker, den sie begrenzen
soll. `Retry-After` nennt ganze Sekunden (RFC 9110) und ist eine obere Schranke:
so lange, bis der älteste gezählte Aufruf aus dem Fenster fällt. Einzelheiten,
Grenzen und die Behandlung von `X-Forwarded-For`: „Ratenbegrenzung“ unter
„Sicherheitshinweise zum Login“.

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
Logzeile wäre ein Zugangsschlüssel in einer Logzeile. Eine abgewiesene Anfrage
(429) hinterlässt eine Zeile mit dem **Schlüssel** (der Client-Adresse), nicht
mit einem Token oder einer `k1`.

#### Ratenbegrenzung und Aufräumen

Zwei Mechanismen, die zusammengehören: der eine **begrenzt**, wie schnell neue
Zeilen entstehen, der andere **entfernt** sie wieder.

##### Ratenbegrenzung: in der Datenbank, nicht im Arbeitsspeicher

`POST /api/auth/challenge` ist der einzige Endpunkt, den ein Unbeteiligter
**ohne Anmeldung** in einer Schleife aufrufen kann, und jeder Aufruf schreibt
eine Zeile. Ohne Begrenzung ist das ein Schreibverstärker.

Die Zählung liegt in der Tabelle `auth_rate_events` (Migration 005) und **nicht**
in einer Map im Prozess. Gründe:

* Ein Zähler im Speicher geht beim **Neustart** verloren — wer die Grenze
  erreicht hat, dürfte danach sofort weiter. Ein Neustart wäre ein Umgehungsweg.
* Er gilt nur für **einen Prozess**. Bei mehreren Instanzen hinter einem
  Lastverteiler (ADR-004 lässt Föderation zu) wäre die wirksame Grenze das
  n-fache der eingestellten.

**Form: Ereigniszeilen mit Zeitstempel** (`auth_rate_events.moment`), gezählt über
ein gleitendes Fenster — nicht ein Zähler je Kalenderfenster. Der Grund ist die
Kante: ein Zähler je Kalenderfenster erlaubt im ungünstigsten Fall die doppelte
Menge (29 Aufrufe kurz vor dem Fensterwechsel, 30 direkt danach). Das gleitende
Fenster hat diese Kante nicht: es zählen zu jedem Zeitpunkt die letzten
`AUTH_RATE_WINDOW_MS`. Der Index
`auth_rate_events_bucket_key_moment_idx (bucket, key, moment)` macht die
Zählung zur Bereichssuche. Die vollständige Begründung steht in
`migrations/005_ratelimit.sql`.

**Was gezählt wird:** die Client-Adresse. Sie kommt aus der **Verbindung**
(`c.env.incoming.socket.remoteAddress`). `X-Forwarded-For` wird **nur** gelesen,
wenn die Verbindung selbst von einer Adresse aus `AUTH_TRUSTED_PROXIES` stammt:

| Verbindung von | `X-Forwarded-For` | gezählter Schlüssel |
|---|---|---|
| nicht eingetragenem Proxy | beliebig | Adresse der Verbindung |
| unmittelbarem Client | gesetzt | Adresse der Verbindung |
| eingetragenem Proxy | gesetzt und plausibel | **erster** Eintrag des Kopfes |
| eingetragenem Proxy | leer / unbrauchbar | Adresse der Verbindung |
| nicht feststellbar | beliebig | `unknown` (ein gemeinsamer Topf) |

Der Kopf ist ein **gewöhnlicher HTTP-Kopf** und damit von jedem Aufrufer setzbar.
Würde er immer gelesen, schriebe ein Angreifer in jede Anfrage eine andere
erfundene Adresse — und die Begrenzung liefe für ihn nie an. Deshalb ist die
Vorgabe `AUTH_TRUSTED_PROXIES=` (leer): der Kopf wird **nie** gelesen, solange
niemand den Proxy ausdrücklich einträgt. Ohne Eintrag ist der Kopf wirkungslos.

**Grenzen dieser Wahl — ausdrücklich:**

1. **Hinter einem Reverse Proxy ohne Eintrag teilen sich alle Nutzer einen
   Topf.** Die Verbindung kommt dann vom Proxy, und alle Aufrufer haben dessen
   Adresse. Wer die API hinter nginx, Caddy, Traefik oder Cloudflare betreibt,
   muss die Adresse des Proxys in `AUTH_TRUSTED_PROXIES` eintragen — sonst kann
   ein einzelner Vielnutzer alle anderen ausbremsen. Für Docker-Netze ist das
   die Adresse des Gateways (z. B. `172.17.0.1`), für Cloudflare die dort
   veröffentlichten Bereiche (dann je Adresse ein Eintrag; CIDR-Bereiche werden
   **nicht** unterstützt, siehe `src/env.ts`).
2. **Nur der ERSTE Eintrag** der Kette wird genommen (`Client, Proxy1, …`). Der
   letzte wäre der nächste Proxy und würde alle dessen Nutzer zusammenfassen.
   Bei mehreren Proxies hintereinander muss **jeder** eingetragen sein, und der
   äußerste bestimmt, was im Kopf steht.
3. **Ein vorgeschalteter Proxy, der den Kopf ungeprüft durchreicht oder selbst
   aus dem Kopf übernimmt, hebt die Begrenzung aus.** Wer `AUTH_TRUSTED_PROXIES`
   setzt, muss wissen, dass sein Proxy `X-Forwarded-For` **setzt** und nicht
   übernimmt.
4. **Die Grenze gilt je Adresse, nicht global.** Ein Angreifer mit vielen
   Adressen (Botnetz) umgeht sie; sie begrenzt, was **eine** Quelle anrichten
   kann. Gegen verteilte Angriffe hilft nur eine vorgelagerte Stufe.
5. **IPv6 wird je Adresse gezählt, nicht je Präfix.** Ein Anschluss mit einem
   /64-Netz hat damit viele „Adressen“.
6. **Die Grenze ist keine Sperre.** Sie verhindert nicht, dass jemand über
   Stunden viele Herausforderungen erzeugt — nur, dass es schnell geht. Genau
   dafür gibt es das Aufräumen.

**Ein Nutzer mit mehreren Anmeldungen kommt durch.** Die Standardgrenze ist 30
Aufrufe je Minute. Eine Anmeldung ist **ein** Aufruf des Endpunkts: ein Nutzer,
der sich mehrfach anmeldet, verbraucht je Versuch einen Platz. 30 sind deutlich
mehr, als ein echter Anmeldeversuch braucht (QR-Code erzeugen, scannen,
bestätigen — samt einem oder zwei Fehlversuchen), und deutlich weniger als eine
Schleife. Als Richtwert: fünf vollständige Anmeldungen je Minute sind erlaubt,
sechzig nicht. Geprüft ist genau das in `tests/ratelimit.test.ts` („sperrt einen
Nutzer mit mehreren Anmeldungen im Fenster nicht aus“).

##### Aufräumen: eigener Vorgang, nicht im Anmeldepfad

`auth_challenges` bekommt bei jedem Anmeldeversuch eine Zeile, `auth_rate_events`
bei jedem erlaubten Aufruf. Beide wachsen ohne Aufräumen dauerhaft.

Das Aufräumen läuft **nicht** im heißen Weg (Anmeldung): ein `DELETE` über eine
wachsende Tabelle in jedem Aufruf wäre Last ohne Nutzen — die Anmeldung braucht
die alten Zeilen nicht — und zwei gleichzeitige Aufrufer würden gegeneinander
sperren. Es ist ein eigener, **wiederholbarer** Vorgang:

```bash
# aus api/, von Hand oder per Cron
npm run cleanup            # liest dist/ (nach npm run build), sonst src/ ueber tsx
node scripts/cleanup-auth.mjs   # derselbe Vorgang ohne npm; braucht dist/
```

    Aufgeraeumt: 0 verbrauchte Herausforderungen, 25 abgelaufene Herausforderungen, 40 Ratenzeilen (Stand 2026-10-05T22:08:37.028Z)

Cron, stündlich (die Fristen sind eine Stunde, also reicht das):

    0 * * * * cd /pfad/zu/api && npm run cleanup >> /var/log/ideenschmiede-cleanup.log 2>&1

Zusätzlich läuft derselbe Vorgang **beim Serverstart** (fehlertolerant, siehe
„Starten“). Beides ist derselbe Code (`src/cleanup.ts`); das Skript ist nur die
Verbindung für den Aufruf von außen. Es liest den **gebauten** Stand aus `dist/`
— also genau den Code, den auch der Server ausführt — und weicht nur dann auf
`src/` aus, wenn nicht gebaut wurde (dann läuft es unter `tsx`, siehe
`package.json`).

**Fristen** (die Zahlen stehen in `src/cleanup.ts` mit ihrer Begründung):

| Zeilen | Frist | Begründung |
|---|---|---|
| **verbrauchte** Herausforderungen (`used_at`) | 1 Stunde | verbraucht heißt sofort unbenutzbar — das entscheidet `used_at`, nicht die Zeile. Eine Stunde lässt einen gemeldeten Vorfall noch nachvollziehen. |
| **abgelaufene** Herausforderungen (`expires_at`) | 1 Stunde Nachfrist | deckt den Uhrenunterschied zwischen Anwendung und Datenbank ab (die Frist entsteht aus `AuthConfig.now`, verglichen wird mit `now()` der Datenbank). Ohne Nachfrist könnte eine nach Anwendungsuhr noch gültige Zeile verschwinden — der Nutzer sähe „Unknown k1“ statt „Challenge expired“. |
| **Ratenzeilen** (`moment`) | 1 Stunde über dem Fenster | sie zählen nur im Fenster; die Stunde ist eine Versicherung: wird `AUTH_RATE_WINDOW_MS` später **erhöht**, sind die Zeilen der letzten Stunde noch da und zählen wieder mit. |

**Gültige, unbenutzte Herausforderungen bleiben unangetastet** — sie sind ein
laufender Anmeldevorgang. Wer sie wegräumt, lässt einen QR-Code im Nichts enden.

**Gefahrlos mehrfach ausführbar:** jeder Schritt ist ein `DELETE` mit einer
Bedingung; beim zweiten Lauf trifft sie nichts, und die Zähler sind 0. Zwei
gleichzeitige Läufe sind ebenfalls unbedenklich: PostgreSQL lässt einen die
Zeilen sperren, der andere meldet danach 0. Beides ist getestet.

### Abonnement und BTCPay-Webhook (Roadmap Phase 3.3)

Zwei Endpunkte, die zusammengehören: der eine sagt **wer** zahlen will, der
andere erfährt **dass** gezahlt wurde. Dazwischen liegt eine Rechnung bei BTCPay
Server, die **nicht** diese API anlegt (dafür braucht es den API-Schlüssel des
Betreibers).

Der Ablauf:

1. Der Client ruft `POST /api/subscriptions/intent` mit seiner Sitzung auf. Die
   API legt eine **Absicht** an: sie kennt den **Nutzer**. Antwort: `intentId`,
   `invoiceId`, `expiresAt` und die `metadata`.
2. Der Client legt bei BTCPay Server eine Rechnung an und gibt `metadata` als
   Nutzlast mit (`userId` und `intentId`). BTCPay liefert diese Nutzlast später
   unverändert im Webhook zurück — sie ist der zweite Weg zur Absicht, falls die
   `invoice_id` einmal nicht ausreicht.
3. Der Nutzer zahlt. BTCPay stellt zu.
4. `POST /api/webhooks/btcpay` prüft die Signatur, findet über `invoice_id` die
   Absicht und verbucht: eine Zeile in `subscriptions`, Status der Absicht auf
   `settled`.
5. Die Rolle ergibt sich daraus **in der Datenbank**:
   `subscriptions_sync_user_role_trg` setzt `users.role = 'subscriber'`. Die
   Anwendung setzt sie **nicht** — sie wäre sonst eine zweite Wahrheit neben dem
   Abonnement (ADR-003).

Warum die Absicht eine eigene Tabelle ist: eine Rechnung bei BTCPay kennt
**keinen Nutzer**, und `subscriptions` verlangt schon beim `INSERT` ein
`expires_at`, das niemand kennt, solange nicht bezahlt ist. Ohne die Absicht
könnte der Webhook die Gutschrift niemandem zuordnen.

#### `POST /api/subscriptions/intent`

Erfordert eine Sitzung (Cookie oder `Authorization: Bearer <token>`); ohne sie
`401`. Rumpf: keiner.

```
$ curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    http://127.0.0.1:3000/api/subscriptions/intent
{"intentId":"30111aa9-31d1-4ecf-ad80-bc096154d389",
 "invoiceId":"416f68d4-a29a-4e8c-b2e3-f9b85f19ad54",
 "status":"open",
 "expiresAt":"2026-10-06T21:24:27.189Z",
 "metadata":{"userId":"3995c085-3840-4ebb-bd41-924412fd1b8c",
             "intentId":"30111aa9-31d1-4ecf-ad80-bc096154d389"}}
```

`invoiceId` wird **hier** vergeben und ist die Kennung, unter der die Rechnung
bei BTCPay anzulegen ist — nicht umgekehrt. Nur so existiert die Zuordnung
schon, bevor die Rechnung existiert.

Eine offene Absicht wird **wiederverwendet**: solange sie offen und innerhalb
der Frist ist, liefert ein zweiter Aufruf dieselbe `intentId` und dieselbe
`invoiceId`. Die Nutzlast steckt bereits in einer Rechnung bei BTCPay und ist
dort unveränderlich; eine zweite Absicht wäre eine Absicht, die niemand mehr
bedient. Die Frist beträgt 24 Stunden (`INTENT_TTL_MS`).

Besteht bereits ein **aktives** Abonnement, antwortet der Endpunkt `409`
(`subscription_active`) statt einer zweiten Absicht: `subscriptions_one_active_per_user`
lässt ohnehin nur eines zu, und eine Absicht, die bei der Gutschrift
zwangsläufig scheitern müsste, wäre eine Falle.

#### `POST /api/webhooks/btcpay`

**Öffentlich — ohne Sitzung.** Die einzige Berechtigung ist die Signatur.
Rumpf: das JSON von BTCPay, unverändert. Antwort immer `200`, außer bei
ungültiger Signatur (`401`) oder unlesbarem JSON (`400`).

```
{"status":"OK","processed":true,"result":"settled",
 "event":"InvoiceSettled",
 "invoiceId":"416f68d4-a29a-4e8c-b2e3-f9b85f19ad54",
 "intentId":"30111aa9-31d1-4ecf-ad80-bc096154d389",
 "userId":"3995c085-3840-4ebb-bd41-924412fd1b8c",
 "subscriptionId":"1aa2bbc2-6a36-49da-8f9a-e64f73e9ef20",
 "isRedelivery":false,
 "manuallyMarked":false,
 "closedIntent":false}
```

`processed: true` heißt: **diese** Zustellung hat ein Abonnement gebucht.
`processed: false` heißt: verstanden und bestätigt, aber nichts gebucht — der
Grund steht in `result`. `closedIntent` trennt zusätzlich „nichts gebucht“ von
„nichts gebucht, und der Vorgang ist beendet“: nur `InvoiceExpired` und
`InvoiceInvalid` setzen es auf `true`. `manuallyMarked` spiegelt das Feld
`manually_marked` der Zustellung — es **meldet** nur, wie die Zahlung festgestellt
wurde, und entscheidet nichts (siehe Punkt 26).

| Fall | HTTP | `result` | Wirkung |
|---|---|---|---|
| `InvoiceSettled`, Absicht offen, Zahlung mit txid | 200 | `settled` | Abonnement angelegt, Absicht `settled`, `role` = `subscriber` |
| dieselbe Zustellung ein zweites Mal | 200 | `already_settled` / `intent_not_open` | **nichts** — die Absicht ist nicht mehr offen |
| dieselbe **txid** an einer zweiten Rechnung | 200 | `duplicate_payment` | **nichts** — der Beleg hängt schon an einem Abonnement |
| anderes `_type` (`InvoiceCreated`, `InvoiceProcessing`, …) | 200 | `ignored_event` | nichts; bestätigt, damit BTCPay nicht wiederholt |
| `InvoiceExpired` / `InvoiceInvalid` | 200 | `ignored_event`, `closedIntent: true` | **nichts gebucht**; die Absicht wird `expired` bzw. `invalid` — eine verspätete Zahlung auf dieselbe Rechnung begründet danach kein Abonnement mehr |
| `invoice_id` unbekannt | 200 | `unknown_invoice` | nichts — **kein 404**, sonst wiederholt BTCPay endlos |
| Absicht abgelaufen (`expires_at` überschritten, Status noch `open`) | 200 | `expired_intent` | nichts; die Absicht bleibt `open` — ihre Frist und der Ablauf der **Rechnung** sind zwei verschiedene Dinge, und den Rechnungszustand meldet BTCPay selbst (`InvoiceExpired`) |
| `InvoiceSettled` ohne verwertbare txid | 200 | `no_payment_txid` | nichts (siehe Punkt 24) |
| Signatur falsch oder fehlend | 401 | — | nichts wird ausgewertet |
| Rumpf kein JSON | 400 | — | nichts |

#### Das Signaturverfahren: die HMAC läuft über die ROHEN BYTES

```
roh      = der UNVERÄNDERTE Request-Body als Bytes
erwartet = hex(hmac_sha256(BTCPAY_WEBHOOK_SECRET, roh))
gesendet = Kopf "BTCPay-Sig"   (Groß-/Kleinschreibung egal)
```

Verglichen wird zeitkonstant (`timingSafeEqual`); vorher die Länge, weil
`timingSafeEqual` bei ungleicher Länge wirft — das wäre ein `500` statt eines
`401`.

**Warum roh und nicht „das Objekt“:** Wer den Rumpf parst und wieder
serialisiert, rechnet über **andere Bytes**. Ein Leerzeichen, das der
Serialisierer anders setzt, oder eine andere Schlüsselreihenfolge ergibt eine
andere Signatur — die Prüfung schlüge fehl, obwohl die Zustellung echt ist.
Schlimmer als ein Fehlschlag wäre die Umkehrung: würde über die neu erzeugten
Bytes geprüft, wäre die Signatur an **diese** Bytes gebunden und nicht mehr an
das, was BTCPay tatsächlich gesendet hat.

Die Referenzimplementierung von BTCPay macht es genauso: sie liest
`file_get_contents('php://input')` und rechnet
`hash_hmac('sha256', $raw_post_data, $secret)` — roh, ungeparst.

Umgesetzt ist das an genau zwei Stellen: `readRawBody()` liest
`c.req.raw.arrayBuffer()` **einmal**, und `processWebhook()` bekommt genau
dieses `Buffer` — dasselbe Buffer wird signiert-geprüft **und** mit
`JSON.parse` ausgewertet. Es gibt keinen zweiten Weg in die Verarbeitung, der
einen bereits geparsten Rumpf entgegennimmt.

#### Idempotenz in drei Schichten

BTCPay stellt planmäßig erneut zu (Timeout, nicht-2xx-Antwort, Neustart des
Empfängers). Eine Wiederholung darf **nichts** doppelt buchen. Drei Schichten,
jede mit einer anderen Schwäche — deshalb alle drei:

| # | Schicht | Wo | Was sie auffängt | Schwäche |
|---|---|---|---|---|
| 1 | `is_redelivery` im Payload | Anwendung | nichts — sie **meldet** nur | Das Feld kann fehlen; eine Zusage, die davon abhängt, ist keine |
| 2 | `UNIQUE (lower(payment_txid)) WHERE payment_txid IS NOT NULL` | Schema (001) | dieselbe Bitcoin-Transaktion an einer **zweiten** Rechnung oder nach einem zurückgesetzten Status | greift nicht, wenn die zweite Zustellung eine andere txid trüge (tut sie nicht — es ist dieselbe Zahlung) |
| 3 | Status der Absicht: `open` → `settled`, bedingt im `UPDATE` | Schema + Anwendung | die Wiederholung derselben Zustellung, auch gleichzeitig | hilft nicht, wenn die Absicht manuell zurückgesetzt würde |

Schicht 3 ist die schnelle: das `UPDATE ... WHERE status = 'open' RETURNING`
entscheidet in der Datenbank, wer von zwei gleichzeitigen Zustellungen gewinnt —
dieselbe Haltung wie beim Verbrauch der `k1`. Wer keine Zeile zurückbekommt,
hat nicht gebucht und legt auch kein Abonnement an. Schicht 2 ist die
härtere: sie hält auch dann, wenn die Anwendungslogik falsch ist.

Schicht 1 wird **nicht** ausgewertet. Der Webhook verarbeitet eine Zustellung
mit `is_redelivery: true` genauso wie eine erste — eine echte Zahlung, die der
Absender als Wiederholung markiert, darf nicht liegen bleiben. Umgekehrt wird
eine Zustellung ohne das Feld nicht durchgelassen, sondern durch Schicht 3
aufgehalten.

#### Die Rolle setzt die Anwendung nicht

`users.role` ist laut `CONTRACT.md` die **Ableitung** von „hat ein aktives
Abonnement“. Zwei Trigger halten das: `subscriptions_sync_user_role_trg`
(reagiert auf `subscriptions`) und `users_derive_role_trg` (korrigiert `role`
bei **jedem** Schreibvorgang auf `users`). Der Webhook schreibt nur nach
`subscriptions` — und genau deshalb genügt das.

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

24. **`subscription_intents` ist eine eigene Tabelle — und `invoice_id` wird
    über die Spalte eindeutig, nicht über `lower(invoice_id)`.** Die
    Vertragsregel „Eindeutigkeit über `lower(...)`“ gilt für **Belegspalten**
    (`payment_txid`, `txid`), also für Transaktionskennungen, bei denen derselbe
    Wert in zwei Schreibweisen auftreten kann. Eine **Rechnungsnummer** ist etwas
    anderes: sie wird von BTCPay vergeben und **unverändert** zurückgeliefert; sie
    ist keine Transaktionskennung, und zwei Schreibweisen wären zwei Rechnungen.
    Deshalb `invoice_id text NOT NULL` mit `UNIQUE` **über die Spalte** und der
    Lookup `WHERE invoice_id = $1` — dieselbe Begründung, die im Abschnitt
    „Belege“ für die Ausdrucksindizes die **Ausnahme** beschreibt. *Diese
    Auslegung ist hier festgehalten, weil sie eine Abweichung von der
    lowercase-Regel ist.*
25. **`InvoiceSettled` ohne verwertbare Transaktionskennung bucht nicht.**
    Antwort `200` mit `result: no_payment_txid`. Begründung:
    `subscriptions.payment_txid` ist der **Beleg**; eine Zeile ohne Beleg wäre
    ein Stimmrecht ohne Deckung — dieselbe Haltung wie bei den Ledgern, in denen
    eine Buchung ohne `txid` gar nicht möglich ist. **Offener Punkt, gemeldet
    und nicht entschieden:** eine **Lightning**-Zahlung trägt keine on-chain-txid,
    sondern einen Payment Hash. Ob der als Beleg gelten soll (er ist ebenfalls 64
    Hexzeichen), ist eine Frage an den Auftraggeber — dieser Schritt legt es
    **nicht** stillschweigend fest. Heute gilt: nur auf-chain-Zahlungen mit
    `transactionId` werden verbucht.
26. **`manually_marked` aus `InvoiceSettled` ändert die Buchung nicht.** Das
    Feld wird gelesen und als `manuallyMarked` im Antwortkörper zurückgemeldet
    (`webhookResponse()`), aber ein von Hand als bezahlt markiertes Invoice wird
    wie ein regulär bezahltes verbucht. *Diese Auslegung ist eine Entscheidung und keine
    Selbstverständlichkeit:* die Alternative wäre, `manually_marked` als
    Unsicherheitsmerkmal zu behandeln und **nicht** zu buchen — dann bekäme ein
    zahlender Nutzer sein Abonnement nicht, und ein `200` ohne Buchung ließe
    BTCPay nicht wiederholen. **Zur Kenntnis und zum Entscheid.**
27. **Der Intent-Endpunkt antwortet mit `409`, wenn bereits ein aktives
    Abonnement besteht.** Der Auftragstext sagt das nicht ausdrücklich; die
    Begründung steht oben. Eine **Verlängerung** (zweite Zahlung auf ein
    bestehendes Abo) ist damit ausdrücklich **nicht** Teil dieses Schritts —
    `subscriptions_one_active_per_user` ließe sie nur über `active = false` der
    alten Zeile zu. **Offener Punkt, gemeldet.**
28. **`BTCPAY_WEBHOOK_SECRET` ist ein Pflichtwert — aber erst beim Start.**
    `loadEnv()` liest den Wert nur; die verbindliche Prüfung steht in
    `src/server.ts`, und ohne ihn endet der Start mit Exit-Code 1. Warum nicht
    in `loadEnv()`: dort gelten die Prüfungen für **jede** Art von Start, diese
    gilt für den **Betrieb**. Ein Testlauf, der den Webhook nicht anfasst, soll
    nicht an einem Geheimnis scheitern, das er nicht benutzt. Der Endpunkt selbst
    verarbeitet ohne Geheimnis **nichts** und antwortet `401` (`missing_secret`) —
    es gibt keinen Zustand, in dem er ungeprüft durchlässt.
29. **Die Migration 003 ist eigenständig und setzt 001 und 002 voraus.** Sie legt
    `subscription_intents` an, `CREATE UNIQUE INDEX` wird nicht gebraucht (die
    Eindeutigkeit von `invoice_id` trägt die `UNIQUE`-Constraint), und
    `001_init.sql` sowie `002_auth.sql` sind **unverändert**. Eingespielt mit
    `ON_ERROR_STOP=1` gegen PostgreSQL 16 im Container. Die beiden Status
    `expired` und `invalid` sind **erreichbar**: `InvoiceExpired` und
    `InvoiceInvalid` schließen die Absicht über `closeIntent()` — eine
    Aufzählung, deren Werte niemand schreiben kann, wäre eine Behauptung, und
    eine Funktion ohne Aufrufer toter Code.
30. **Der Webhook bucht in EINER Transaktion, und die Rolle setzt die Anwendung
    nicht.** `settleIntent()` läuft in `db.begin(...)`: erst der bedingte
    Statuswechsel, dann das Abonnement. Scheitert das `INSERT` am
    `payment_txid`-Index, macht der Rollback auch den Statuswechsel rückgängig —
    es bleibt keine halbe Buchung stehen (ein Test hält genau das fest). Ein
    `UPDATE users SET role = ...` kommt im Webhook **nicht** vor; das ist die
    Zusage aus ADR-003, und ein zweiter Schreiber wäre eine zweite Wahrheit.
31. **Die Ratenbegrenzung steht in der Datenbank, nicht im Arbeitsspeicher.**
    Ein Zähler im Prozess ginge beim Neustart verloren (wer die Grenze erreicht
    hat, dürfte danach sofort weiter — ein Neustart wäre ein Umgehungsweg) und
    gälte bei mehreren Instanzen nur je Prozess (ADR-004: die wirksame Grenze
    wäre das n-fache). Die Zählung liegt deshalb in `auth_rate_events`
    (Migration 005). Das ist die **Kehrseite derselben Entscheidung**, die schon
    für die `k1` gilt (Punkt 15): Zustand, der einen Neustart überleben muss,
    gehört in die Datenbank. Die vollständige Begründung samt der Wahl
    *Ereigniszeilen statt Zähler je Fenster* steht in `migrations/005_ratelimit.sql`.
32. **Aufgeräumt wird als eigener Vorgang, nicht im Anmeldepfad — und
    zusätzlich beim Start.** Ein `DELETE` über eine wachsende Tabelle in jedem
    Aufruf wäre Last ohne Nutzen, und zwei gleichzeitige Aufrufer würden
    gegeneinander sperren. Aufgerufen wird derselbe Code an zwei Stellen:
    `npm run cleanup` (von Hand oder per Cron) und der Serverstart. **Die
    Verzögerung beim Start ist Absicht:** `createApp` ist deshalb `async` und
    wartet das Aufräumen ab, damit der Zustand feststeht, wenn der Port offen
    ist; ein Hintergrundlauf während der ersten Anfragen wäre ein zweiter,
    unsichtbarer Zustand. Fehlertolerant ist es trotzdem: ein Fehler wird
    gemeldet, der Start läuft weiter (alte Ratenzeilen sind ein
    Schönheitsfehler, ein Ausfall wäre keiner).
33. **`X-Forwarded-For` wird nur aus einer eingetragenen Proxy-Verbindung
    geglaubt — Vorgabe: gar nicht.** Der Kopf ist von jedem Aufrufer setzbar;
    würde er immer gelesen, wäre die Begrenzung mit einer erfundenen Adresse je
    Anfrage umgangen. Die Kehrseite ist ausdrücklich benannt (siehe
    „Ratenbegrenzung“): ohne Eintrag in `AUTH_TRUSTED_PROXIES` teilen sich
    hinter einem Reverse Proxy **alle** Nutzer einen Topf. Ein Eintrag ist
    deshalb keine Feinheit, sondern die Voraussetzung für den Betrieb hinter
    einem Proxy.
34. **Die Ratenbegrenzung wird als Standardwert ausgeliefert, nicht als
    Pflichtwert.** Anders als `DATABASE_URL`, `SESSION_SECRET` und
    `AUTH_BASE_URL` (Punkt 6 der Konfiguration) gibt es hier einen
    Standardwert — und zwar den **sicheren**: eine fehlende Begrenzung wäre der
    gefährlichere Zustand. Ein geratener Datenbankname zeigt auf die falsche
    Datenbank; eine fehlende Begrenzung öffnet einen Schreibverstärker für
    jeden. Ein **unbrauchbarer** gesetzter Wert bricht trotzdem ab, statt still
    auf den Standardwert zurückzufallen.

## Verifikation gegen echtes PostgreSQL

Kein Trockenlauf: `postgres:16-alpine` im Container, `001_init.sql` bis
`005_ratelimit.sql` mit `ON_ERROR_STOP=1` eingespielt, Server gestartet und die
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


### BTCPay-Webhook, nachgemessen (Phase 3.3)

`001_init.sql`, `002_auth.sql` **und** `003_subscriptions.sql` mit
`ON_ERROR_STOP=1` in `postgres:16-alpine` eingespielt, Server gestartet, echte
HTTP-Zustellungen gesendet. Signiert wurde mit `createHmac('sha256', secret)`
über **genau das Buffer**, das gesendet wurde (`scripts/verify-webhook.mjs`).
Auszug der echten Ausgaben:

```
--- POST /api/subscriptions/intent (mit Sitzung)
HTTP 200
{"intentId":"30111aa9-31d1-4ecf-ad80-bc096154d389",
 "invoiceId":"416f68d4-a29a-4e8c-b2e3-f9b85f19ad54",
 "status":"open",
 "expiresAt":"2026-10-06T21:24:27.189Z",
 "metadata":{"userId":"3995c085-…","intentId":"30111aa9-…"}}

--- Die gesendeten Bytes
705 Byte
{"delivery_id":"d1df39e0-5033-4470-ac4a-fbd25ddf164f","webhook_id":"verify-webho…
HMAC-SHA256 über genau diese Bytes:
73f8db7fc13870ce54dce96a301678c47ed42047f9c741ae8420ea2e7686e597

--- 1. Zustellung (korrekt signiert)
HTTP 200  {"status":"OK","processed":true,"result":"settled",
           "event":"InvoiceSettled","invoiceId":"416f68d4-…",
           "intentId":"30111aa9-…","userId":"3995c085-…",
           "subscriptionId":"1aa2bbc2-6a36-49da-8f9a-e64f73e9ef20",
           "isRedelivery":false,"manuallyMarked":false,"closedIntent":false}
Datenbank danach: subscriptions=1  users.role=subscriber

--- 2. Zustellung (DIESELBEN Bytes, dieselbe Signatur)
HTTP 200  {"status":"OK","processed":false,"result":"intent_not_open",
           "subscriptionId":null, …}
Datenbank danach: subscriptions=1  users.role=subscriber

--- 3. Zustellung (Körper verändert, Signatur der Originalbytes)
HTTP 401  {"status":"ERROR","error":{"code":"invalid_signature",
           "message":"Die Signatur des Webhooks ist ungueltig"}}
Datenbank danach: subscriptions=1  users.role=subscriber

--- Datenbank nach dem Durchlauf
subscriptions:      type=annual active=true
                    payment_txid=d6ddd1cdc126c53f93b71f2c12655c8c87a0084c04ed47a4549967b3eb54218f
                    (= die gesendete txid: true)
                    started_at=2026-10-05T21:24:27.235Z  expires_at=2027-10-05T21:24:27.235Z
subscription_intents: status=settled  settled_at gesetzt
users:              role=subscriber

--- Gegenprobe: InvoiceExpired schließt die Absicht, eine verspätete Zahlung bucht nicht
 (zweiter Nutzer, zweite Absicht: invoice_id=07c27618-f87a-4225-a728-61bf341914f0)
HTTP 200  {"status":"OK","processed":false,"result":"ignored_event",
           "event":"InvoiceExpired","closedIntent":true, …}
Absicht danach: status=expired
HTTP 200  {"status":"OK","processed":false,"result":"intent_not_open", …}   (danach InvoiceSettled)
subscriptions=0  (aus einer abgeschlossenen Absicht entsteht kein Abonnement)

--- Gegenprobe Schicht 2 (Absicht von Hand zurück auf 'open', dieselbe Rechnung erneut)
HTTP 200  {"status":"OK","processed":false,"result":"duplicate_payment",
           "isRedelivery":true, …}
Datenbank danach: subscriptions=1 (unverändert)
Absicht:          status=open, settled_at NULL  (der Rollback hat den Statuswechsel mitgenommen)

--- Ohne BTCPAY_WEBHOOK_SECRET (Start)
EXITCODE=1
Ungueltige Konfiguration - die API startet nicht:
  - BTCPAY_WEBHOOK_SECRET fehlt (Pflichtwert ohne Standardwert)
    Ohne dieses Geheimnis laesst sich die Signatur des BTCPay-Webhooks nicht
    pruefen - jede beliebige Stelle koennte dann Zahlungen gutschreiben und
    damit Stimmrecht verleihen (ADR-003). Der Wert steht in BTCPay Server
    unter Store -> Webhooks.
    Vorlage mit allen Variablen: api/.env.example
```

**Wie die Rohbyte-Bindung belegt ist** — zwei Beobachtungen, die nur zusammen
etwas beweisen:

1. **Gleicher Inhalt, andere Serialisierung.** Derselbe Nutzeninhalt wurde
   einmal kompakt (`JSON.stringify(objekt)`) und einmal eingerückt
   (`JSON.stringify(objekt, null, 2)`) als Bytes erzeugt. Die beiden Buffer sind
   nachweislich verschieden, und ihre HMACs sind verschieden. Die Signatur der
   kompakten Fassung auf die eingerückte Fassung angewendet ergibt `401`;
   dieselben Bytes signiert und gesendet ergeben `200 settled`. Damit ist
   ausgeschlossen, dass die Prüfung heimlich über eine neu erzeugte
   Serialisierung läuft — sie würde in beiden Fällen dieselbe Bytes sehen und
   beide Male zustimmen.
2. **Der Kopf zählt, nicht der Inhalt.** Der Lauf oben zeigt denselben
   `InvoiceSettled`-Inhalt dreimal mit drei Ergebnissen (`200 settled`,
   `200 intent_not_open`, `401`) — das Ergebnis hängt allein an den Bytes und
   der Signatur, nicht am Inhalt.

**Wie die Idempotenz belegt ist** — die Zahlen aus der Datenbank, nicht die
Antwort des Servers:

| Zustellung | Antwort | `subscriptions` (DB) | `users.role` (DB) |
|---|---|---|---|
| 1. korrekt signiert | `processed: true` | **1** | `subscriber` |
| 2. identische Bytes | `processed: false` (`intent_not_open`) | **1** | `subscriber` |
| 3. Körper verändert | `401` | **1** | `subscriber` |
| Absicht künstlich auf `open`, dieselbe txid erneut | `processed: false` (`duplicate_payment`) | **1** | `subscriber` |

Die vierte Zeile ist die Gegenprobe zu Schicht 3: der Status war absichtlich
wieder `open`, die schnelle Schicht griff also **nicht** — und die txid-Schicht
hielt trotzdem. Genau dafür gibt es beide.

### Ratenbegrenzung und Aufräumen, nachgemessen (Nachtrag zu Phase 3.2)

`001_init.sql` bis `005_ratelimit.sql` mit `ON_ERROR_STOP=1` in
`postgres:16-alpine` eingespielt, Server gestartet (`AUTH_RATE_LIMIT=30`,
`AUTH_RATE_WINDOW_MS=60000`) und der Endpunkt **wirklich** 40-mal aufgerufen.
Auszug der echten Ausgaben (`Invoke-WebRequest`, ohne Beschönigung):

```
--- Aufraeumen beim Start (erste Zeile des Serverprotokolls)
[api] Aufgeraeumt: 0 verbrauchte Herausforderungen, 0 abgelaufene Herausforderungen, 100 Ratenzeilen (Stand 2026-10-05T22:06:36.560Z)
[api] PostgreSQL verbunden: postgres://***:***@localhost:55455/ideenschmiede (server_version 16.15)
[api] Ideenschmiede-API 0.1.0 hoert auf http://127.0.0.1:3100 (NODE_ENV=development, BTCPAY_WEBHOOK_SECRET gesetzt)

--- POST /api/auth/challenge, 40 Aufrufe hintereinander
Aufruf  1: HTTP 200
...
Aufruf 30: HTTP 200
Aufruf 31: HTTP 429  Retry-After=60  {"status":"ERROR","reason":"Too many requests"}
Aufruf 32: HTTP 429  Retry-After=60  {"status":"ERROR","reason":"Too many requests"}
...
Aufruf 40: HTTP 429  Retry-After=60  {"status":"ERROR","reason":"Too many requests"}

--- Derselbe Client, aber mit ERFUNDENEM X-Forwarded-For (kein Proxy eingetragen)
XFF 198.51.100.1 (unvertrauter Kopf): HTTP 429
XFF 198.51.100.2 (unvertrauter Kopf): HTTP 429
XFF 198.51.100.3 (unvertrauter Kopf): HTTP 429
XFF 198.51.100.4 (unvertrauter Kopf): HTTP 429
XFF 198.51.100.5 (unvertrauter Kopf): HTTP 429
   -> die erfundene Adresse aendert nichts: die Grenze gilt fuer die Verbindung.

--- Neustart mit AUTH_TRUSTED_PROXIES=127.0.0.1 und AUTH_RATE_LIMIT=3
Client 198.51.100.7, Aufruf 1 -> HTTP 200
Client 198.51.100.7, Aufruf 2 -> HTTP 200
Client 198.51.100.7, Aufruf 3 -> HTTP 200
Client 198.51.100.7, Aufruf 4 -> HTTP 429
Client 198.51.100.7, Aufruf 5 -> HTTP 429
Client 198.51.100.8, Aufruf 1 -> HTTP 200     <- eigener Topf, eigene Grenze
Client 198.51.100.8, Aufruf 2 -> HTTP 200
Client 198.51.100.8, Aufruf 3 -> HTTP 200
Client 198.51.100.8, Aufruf 4 -> HTTP 429

--- auth_rate_events danach (der Schluessel ist die Adresse aus dem Kopf)
      key      | treffer
---------------+---------
 127.0.0.1     |      60     <- die 30 Aufrufe der ersten Runde, je Grenze eigen
 198.51.100.7  |       3
 198.51.100.8  |       3
```

**Aufräumen, dieselbe Datenbank — Zeilenzahlen vorher und nachher:**

```
--- VORHER (50 Herausforderungen aus 002, davon 30 abgelaufen;
     dazu 25 laenger als die Nachfrist abgelaufene und 100 alte Ratenzeilen)
 challenges | abgelaufen | raten
------------+------------+-------
        142 |         55 |   106

--- npm run cleanup (erster Lauf)
Aufgeraeumt: 0 verbrauchte Herausforderungen, 25 abgelaufene Herausforderungen, 40 Ratenzeilen (Stand 2026-10-05T22:08:37.028Z)

--- NACHHER
 challenges | abgelaufen | raten
------------+------------+-------
        117 |         30 |    66

--- npm run cleanup (zweiter Lauf, unmittelbar danach)
Aufgeraeumt: 0 verbrauchte Herausforderungen, 0 abgelaufene Herausforderungen, 0 Ratenzeilen (Stand 2026-10-05T22:08:38.265Z)

--- Kontrollzeile: gueltige, unbenutzte Herausforderungen
             was              | anzahl
------------------------------+--------
 Kontrollzeile gueltig/unbenutzt |     87    <- unangetastet
 verbraucht                      |      0
```

Die Zahlen sind kein Zufall: 142 - 25 = 117 Herausforderungen und 106 - 40 = 66
Ratenzeilen. Die 25 entfernten Herausforderungen waren laenger als eine Stunde
abgelaufen; die **30** noch verbliebenen `abgelaufen` sind es **noch nicht** —
sie liegen innerhalb der Nachfrist und bleiben stehen (genau das ist die Frist).
Der zweite Lauf meldet `0, 0, 0` und beweist damit die Wiederholbarkeit. Die 87
gueltigen, unbenutzten Herausforderungen sind unverändert: ein laufender
Anmeldevorgang wird nicht weggeräumt.

Der Container wurde nach der Prüfung entfernt.