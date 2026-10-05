# Migrationen — Ideenschmiede API

Diese Datei ist die Begruendung zu `001_init.sql`, nicht nur eine Bedienungsanleitung.
Sie haelt fest, *warum* das Schema so aussieht — insbesondere bei den fuenf Punkten,
die die Aufgabe bewusst offen gelassen hat.

## Inhalt

| Datei | Zweck |
|---|---|
| `001_init.sql` | Migration 001. Die vier Kernentitaeten `users`, `ideas`, `teams`, `milestones` — plus die drei Tabellen, die aus den Entscheidungen unten folgen: `subscriptions`, `user_wallets`, `idea_votes` — plus die **zwei** Ledger `idea_investments` und `team_investments`, ohne die die 20/80-Aufteilung nicht berechenbar waere. |

Quelle: `ARCHITECTURE.md` Anhang 5 (Datenmodell), `ROADMAP.md` Phase 3.1.

## Ausfuehren

    psql -d ideenschmiede -f 001_init.sql

Die Datei beginnt mit `BEGIN;` und endet mit `COMMIT;` — sie ist damit auch ohne
zusaetzliche Flags alles-oder-nichts. Werkzeuge, die selbst eine Transaktion oeffnen
(node-pg-migrate, Flyway, golang-migrate), wollen diese beiden Zeilen entfernen;
`psql --single-transaction` braucht sie ebenfalls nicht. Es kommt kein
`CREATE INDEX CONCURRENTLY` vor, die Migration laeuft also vollstaendig in einer
Transaktion.

Voraussetzung: PostgreSQL 11 oder neuer (`CREATE TRIGGER ... EXECUTE FUNCTION`).
Ab PostgreSQL 13 ist `gen_random_uuid()` eingebaut; die Zeile
`CREATE EXTENSION IF NOT EXISTS pgcrypto` deckt aeltere Versionen ab und ist auf
neueren wirkungslos.

## Pruefen

Ohne laufende Datenbank, im Postgres-Dialekt geparst:

    python .../maschine/pruefe_sql.py api/migrations/001_init.sql
    python .../maschine/pruefe_vertrag.py api/migrations/001_init.sql

Ergebnis fuer diese Datei: 82 Statements, 9 Tabellen (alle neun
Pflichtentitaeten des Vertrags), keine Gleitkomma-Spalten, 13 Fremdschluessel
(alle mit `ON DELETE`), 24 Indizes per `CREATE INDEX` (dazu 24 implizite aus
`PRIMARY KEY`/`UNIQUE`), `ERGEBNIS: PARSE OK`. Der Vertragspruefer
meldet `ERGEBNIS: KONFORM zu api/CONTRACT.md` — ohne Warnungen.

Statische Pruefung genuegt nicht — ein Parser bestaetigt nichts ueber das
Laufzeitverhalten von Triggern und Constraints. Die Datei wurde zusaetzlich
gegen `postgres:16-alpine` mit `ON_ERROR_STOP=1` eingespielt und danach mit
Funktionstests je Geschaeftsregel geprueft: Ledger -> Zaehler, ADR-003,
strukturelle Wiederholung, Nachweisregel.

Fuer das Team-Ledger wurde im selben Lauf ein `DO`-Block mit inneren
`EXCEPTION`-Zweigen ausgefuehrt. Er prueft nicht „ob ein Fehler kommt“, sondern
den **konkreten SQLSTATE**:

| Fall | erwartet | Ergebnis |
|---|---|---|
| Team-Kauf hebt `teams.raised_sat` und `investor_count` | 500 sat / 2 Investoren | bestanden |
| zweiter Beleg desselben Investors | Geld +100, Investorenzahl bleibt | bestanden |
| doppelte `txid` | `23505` | bestanden |
| `amount_sat = 0` | `23514` | bestanden |
| `amount_sat < 0` | `23514` | bestanden |
| `txid` im Falschformat | `23514` | bestanden |
| Team mit Belegen loeschen | `23503` (RESTRICT) | bestanden |
| Team ohne Belege loeschen | gelingt | bestanden |
| `team_id`-Wechsel per UPDATE | verlassenes Team 400/1, Ziel 103/2 — kein Geisterzaehler | bestanden |
| `team_investor_shares` | 8000/2000 bp, 1 von 3 sat = 3333 bp | bestanden |
| Nachweis „Zaehler = Ledger“ ueber alle Teams | 0 Abweichungen | bestanden |
| DELETE aus dem Ledger | senkt beide Zaehler | bestanden |

Fuer die Rollenintegritaet lief im selben Lauf ein zweiter `DO`-Block mit inneren
`EXCEPTION`-Zweigen gegen `postgres:16-alpine` (PostgreSQL 16.15):

| Fall | erwartet | Ergebnis |
|---|---|---|
| a) INSERT eines neuen Nutzers ohne Abo | `visitor` | bestanden |
| b) `UPDATE users SET role='subscriber'` ohne Abo | bleibt nicht `subscriber` | bestanden (wird zu `user`; `WARNING` protokolliert) |
| c) aktives Abo anlegen | `subscriber` | bestanden |
| d) `expires_at` in die Vergangenheit setzen | faellt auf `user` | bestanden |
| e) Stimme ohne Abo | `23514` (ADR-003) | bestanden |
| f) Stimme mit Abo | akzeptiert, `subscription_id` gestempelt | bestanden |
| g) INSERT mit `role='user'` | bleibt `user` | bestanden |
| Zusatz: `UPDATE role='visitor'` bei aktivem Abo | bleibt `subscriber` | bestanden |
| Zusatz: Webhook-Reihenfolge (`role` vor dem Abo) | `subscriber` erst mit dem Abo | bestanden |
| Zusatz: Nachweis `role` = Abo-Zustand ueber alle Nutzer | 0 Abweichungen | bestanden |

Der Fall d) braucht `started_at` mit in die Vergangenheit: `subscriptions_period_check`
verlangt `expires_at > started_at`, sonst scheitert der Test an der
Datenqualitaet statt an der Rollenlogik (`CONTRACT.md`, "Pruefpflicht").

Fuer den **Stimmbeleg** lief im selben Lauf ein dritter `DO`-Block mit inneren
`EXCEPTION`-Zweigen gegen `postgres:16-alpine` (PostgreSQL 16.15). Er prueft
genau den Defekt, der diese Fassung ausgeloest hat: `idea_votes.subscription_id`
stand auf `ON DELETE SET NULL`, und diese Aktion konnte nie greifen.

| Fall | erwartet | Ergebnis |
|---|---|---|
| a) Stimme ohne Abo | `23514` (ADR-003 unveraendert) | bestanden |
| b) Stimme mit Abo | gelingt, `subscription_id` gestempelt | bestanden |
| c) `direction` umdrehen | gelingt, `subscription_id` **unveraendert** | bestanden |
| d) `subscription_id = NULL` | abgewiesen (`23514`) | bestanden |
| e) `subscription_id` = anderes Abo | abgewiesen (`23514`) | bestanden |
| f) Abo loeschen, auf das Stimmen zeigen | `23503` (RESTRICT) | bestanden |
| g) Abo loeschen, auf das keine Stimme zeigt | gelingt | bestanden |
| h) Stimme zurueckziehen (DELETE) ohne aktives Abo | gelingt | bestanden |
| i) Nachweis „Zaehler = Einzelstimmen“ | 0 Abweichungen | bestanden |
| Zusatz: Konto **mit** Stimme loeschen | gelingt; das `RESTRICT` greift nicht dazwischen | bestanden |

`pg_constraint.confdeltype` bestaetigt die Deklaration zur Laufzeit:
`idea_votes_subscription_id_fkey` ist `'r'` (RESTRICT) — vorher `'n'` (SET NULL).

Eine Testdaten-Falle hat im Lauf zugeschlagen und ist hier festgehalten, weil
sie nichts ueber die Logik aussagt (`CONTRACT.md`, „Pruefpflicht“: Testdaten
muessen die eigenen Regeln erfuellen):

* Fall i) braucht **aktive** Abonnements fuer beide Waehler. Der zweite Nutzer
  hat sein Abo in g) verloren — das war der Zweck von g). Ohne ein neues Abo
  scheitert die Stimme aus i) an ADR-003 statt an der Nachweisregel — der Test
  faellt dann an der Datenqualitaet, nicht an der Nachweisregel.

---

## Die fuenf offenen Entscheidungen

### 1. Wallets: eigene Tabelle `user_wallets`

**Wahl: eigene Tabelle, keine JSONB-Spalte.**

1. **Eine Wallet ist eine Entitaet, kein Anzeigefeld.** `ARCHITECTURE.md` 7.1
   verlangt `generateReceivingAddress(walletId, path)`. Das setzt eine stabile ID
   voraus, auf die sich Adressableitung und Zahlungszuordnung beziehen koennen.
   Ein Objekt in einem JSONB-Array hat keine ID, auf die man zeigen kann.
2. **ADR-006 ist in der Datenbank durchsetzbar — in JSONB nicht.** Die Constraint
   `user_wallets_public_key_check` erzwingt, dass ausschliesslich ein Extended
   *Public* Key gespeichert wird (Muster `xpub`/`ypub`/`zpub` sowie die
   Testnet-Praefixe). Eine Plattform, die nie Schluessel haelt, sollte das nicht
   dem Anwendungscode ueberlassen.
3. **Die Regeln sind Invarianten, keine Konventionen.** „Genau eine Haupt-Wallet
   pro Nutzer“ ist ein partieller Unique-Index; „dieselbe Wallet nicht zweimal“
   ist ein Unique-Index auf `(user_id, xpub)`. In JSONB muesste die Anwendung das
   pruefen — und irgendwann tate sie es nicht mehr.

**Preis:** ein JOIN beim Laden des Profils. Bei der kleinen Zahl von Wallets pro
Nutzer vernachlaessigbar, `user_wallets_user_id_idx` deckt ihn ab.

**Wann JSONB richtig gewesen waere:** wenn Wallets reine Anzeigedaten ohne eigene
Identitaet waeren. Hier werden daraus Zahlungsadressen abgeleitet — also nicht.

### 2. Subscription: eigene Tabelle `subscriptions` mit Historie

**Wahl: eigene Tabelle mit Historie, keine eingebettete Spalte in `users`.**

ADR-003 macht das Abonnement zum Stimmrecht. Stimmrecht ist ein Zustand *mit
Zeitbezug*: „durfte diese Person am 3. Maerz stimmen?“ ist eine andere Frage als
„hat sie heute ein Abonnement?“.

1. **Die Historie ist die Voraussetzung fuer Entscheidung 4.** Weil
   `idea_votes.subscription_id` auf die konkrete Abonnement-Zeile zeigt, bleibt
   jede Stimme dauerhaft begruendbar — auch nach Ablauf oder Kuendigung. Eine
   Spalte `users.subscription_expires_at` koennte das nicht: sie ueberschreibt die
   Vergangenheit bei jeder Verlaengerung. Damit diese Begruendung traegt, ist der
   Beleg **unveraenderlich**: ein `UPDATE`, das `subscription_id` aendert (auch
   auf `NULL`), wird abgewiesen, und ein Abonnement, auf das Stimmen zeigen, ist
   per `ON DELETE RESTRICT` nicht loeschbar (siehe „Der Stimmbeleg ist
   unveraenderlich“).
2. **Der Geldfluss braucht einen Ort.** Jede Verlaengerung ist ein eigener
   Zahlungsvorgang mit eigener Transaktion (ADR-006, non-custodial).
   `payment_txid` und `payment_amount` sind die Belegkette. In einer einzelnen
   Spalte gaebe es keinen Platz dafuer.
3. **Die Invariante steht in der Datenbank.**
   `subscriptions_one_active_per_user` ist ein partieller Unique-Index auf
   `(user_id) WHERE active` — ein Stimmrecht, nicht zwei. Abgelaufene Reihen
   bleiben von dieser Regel unberuehrt und damit erhalten.

**Preis:** ein JOIN fuer die Frage „ist dieser Nutzer Abonnent?“. Dafuer gibt es
den Index, und `users.role` ist die gepflegte Abkuerzung (siehe unten).

**Waere die Historie verzichtbar?** Nur in einem System ohne Wahlen. Hier ist sie
gesetzt — genau deshalb wurde die Frage gestellt.

### 3. Tags: `text[]` mit GIN-Index

**Wahl: PostgreSQL-Array mit GIN-Index, keine Tabelle `idea_tags`.**

1. **Ein Tag ist hier ein Wert, keine Entitaet.** Es gibt keinen Ersteller, keinen
   Zeitstempel, keine Beschreibung, keine eigene Uebersetzung. Eine Tabelle
   `idea_tags(id, idea_id, tag)` wuerde eine Entitaet erfinden, die es fachlich
   nicht gibt.
2. **Abfragen bleiben einfach und indexgestuetzt.**
   `WHERE tags @> ARRAY[Schlagwort]` nutzt `ideas_tags_gin_idx`; `tags && ARRAY[...]`
   deckt ODER ab.
3. **Kein N+1 beim Laden einer Ideenliste.** Tags kommen mit der Zeile, ohne Join
   und ohne zweite Abfrage.
4. **Ein Restrisiko wird abgefangen.** `ideas_tags_check` verbietet leere Tags und
   begrenzt auf zehn. Was ein Array prinzipbedingt *nicht* kann: ein Tippfehler
   („bitcoin“ gegen „bitkoin“) wird nicht von der Datenbank verhindert, weil es
   keine Stammdatenliste gibt, gegen die man pruefen koennte. Ein Format-CHECK
   waere hier eher schaedlich — „3D-Druck“, „K.I.“ und „%“ sind legitime Tags.

**Das ist die Entscheidung mit der geringsten Sicherheit** — und die billigste zu
revidieren. Sie kippt, sobald Tags selbst verwaltet werden: Moderation,
Zusammenfuehren von Synonymen, Uebersetzung je Sprache oder kanonische IDs fuer die
Foederation (ADR-004). Der Umstieg ist dann ein reines Datenkopieren aus dem Array
in eine Tabelle, ohne Aenderung an der API.

### 4. Votes: Einzelstimmen als Wahrheit, Zaehler als Cache

**Wahl: beides — Einzelstimmen sind die Wahrheit, `vote_up`/`vote_down` sind ein
Cache, den ausschliesslich ein Trigger schreibt.**

Die Frage war, ob Abstimmungen nachpruefbar sind. Mit einem Zaehler allein lautet
die Antwort *nein*: ein Zaehler ist eine Behauptung, eine Tabelle aus Einzelstimmen
ist ein Beweis.

1. **Die Wahrheit liegt in `idea_votes`:** wer, wann, welche Richtung — und ueber
   `subscription_id` auch, welches Abonnement dieses Stimmrecht verliehen hat.
   Der Beleg wird beim `INSERT` gestempelt und ist danach unveraenderlich; die
   Pruefung des Stimmrechts haengt am Zeitpunkt der Stimmabgabe, nicht an jedem
   spaeteren Schreibvorgang (siehe „Der Stimmbeleg ist unveraenderlich“).
2. **Doppelstimmen sind strukturell unmoeglich.** `UNIQUE (idea_id, user_id)`
   entscheidet in der Datenbank, nicht die Anwendung. Kein Race Condition, kein
   Bug in einem Endpunkt kann sie erzeugen.
3. **Der Zaehler bleibt trotzdem.** Die Ideenliste braucht ihn bei jedem
   Seitenaufruf; ein `COUNT(*)` ueber alle Stimmen je Zeile waere dafuer zu teuer.
4. **Ein Cache mit genau einem Schreiber driftet nicht.** Nur
   `idea_votes_sync_counters` fasst die beiden Spalten an — bei INSERT, UPDATE und
   DELETE. Kein Anwendungspfad schreibt sie direkt. `CHECK (>= 0)` faengt ab, was
   trotzdem durchkaeme. Gezaehlt wird vollstaendig neu, nicht inkrementell — nur so
   kann auch eine per `UPDATE` auf eine andere Idee verschobene Stimme keinen
   Geisterzaehler hinterlassen.
5. **Der Cache ist beweisbar korrekt**, weil er sich jederzeit aus den
   Einzelstimmen rekonstruieren laesst. Diese Abfrage muss immer leer sein:

```sql
SELECT i.id,
       i.vote_up   AS zaehler_up,
       count(*) FILTER (WHERE v.direction = 'up')   AS echt_up,
       i.vote_down AS zaehler_down,
       count(*) FILTER (WHERE v.direction = 'down') AS echt_down
  FROM ideas i
  LEFT JOIN idea_votes v ON v.idea_id = i.id
 GROUP BY i.id, i.vote_up, i.vote_down
HAVING i.vote_up   <> count(*) FILTER (WHERE v.direction = 'up')
    OR i.vote_down <> count(*) FILTER (WHERE v.direction = 'down');
```

**Preis:** eine Zeile pro Stimme statt eines Zaehlers, und ein etwas teureres
INSERT (zwei Zeilenschreibvorgaenge). Stimmen sind selten, Lesen ist haeufig — das
ist die richtige Seite, um zu bezahlen.

**Zusatz:** derselbe Absatz ist der Grund, warum Entscheidung 2 Historie braucht.
Ohne Abonnement-Historie waere eine Stimme zwar gespeichert, aber nicht mehr
begruendbar.

### 5. `stage` und `role`: `text` mit CHECK-Constraint

**Wahl: `text` plus CHECK — fuer alle Aufzaehlungen im Schema** (`role`, `language`,
`stage`, `teams.status`, `milestones.status`, `subscriptions.type`,
`idea_votes.direction`, `user_wallets.type`). Eine Regel, ueberall gleich.

1. **Ein ENUM-Typ ist bei Aenderungen eine Falle.** In PostgreSQL laesst sich ein
   Wert weder entfernen noch umbenennen. Man muss einen neuen Typ anlegen, alle
   Spalten umschreiben (Tabellen-Rewrite unter exklusivem Lock) und den alten
   loeschen. Bei `stage` ist Wachstum programmiert — die Roadmap kennt weitere
   Lebenszyklus-Phasen.
2. **`ALTER TYPE ... ADD VALUE` hilft nicht.** Seit PostgreSQL 12 ist es zwar
   transaktionsfaehig, aber der neue Wert ist *in derselben Transaktion nicht
   benutzbar*. Migrationen laufen in genau einer Transaktion — also bricht genau
   der haeufigste Fall.
3. **Eine CHECK-Constraint ist gewoehnliche DDL.** Hinzufuegen mit `NOT VALID` ist
   billig, Validieren ist ein zweiter Schritt, und ein `DROP CONSTRAINT` nimmt sie
   in einem Schritt zurueck. Kein Tabellen-Rewrite.
4. **Beide sind gleich sicher.** Die Datenbank lehnt denselben Wert ab. Der
   Unterschied ist ausschliesslich der Preis der naechsten Aenderung.

**Ehrlicher Nachteil:** `text` traegt den Wertebereich nicht im Typ. Ein
generierter TypeScript-Client sieht `string` statt einer Union. Kompensation: der
Wertebereich steht genau einmal je Spalte — in der CHECK-Constraint — und wird in
den geteilten Typen der API gespiegelt.

---

## Namens-Mapping zur API

SQL ist `snake_case`, die API aus `ARCHITECTURE.md` Anhang 5 ist `camelCase`.

| API (camelCase) | SQL (snake_case) |
|---|---|
| `displayName` | `users.display_name` |
| `avatar` | `users.avatar_url` |
| `createdAt` | `created_at` (ueberall) |
| `discussion.openedAt` | `ideas.discussion_opened_at` |
| `discussion.comments` / `.votes.up` / `.votes.down` | `ideas.comment_count` / `ideas.vote_up` / `ideas.vote_down` |
| `marketplace.openedAt` / `.closesAt` | `ideas.marketplace_opened_at` / `ideas.marketplace_closes_at` |
| `marketplace.fundingGoal` / `.raised` / `.investors` | `ideas.funding_goal_sat` / `ideas.raised_sat` / `ideas.investor_count` |
| `marketplace.creatorShare` (Basispunkte) | `ideas.creator_share_bp` |
| `team.focusArea` | `teams.focus_area` |
| `team.proposal.timeline` | `teams.timeline_months` |
| `team.skinInGame` | `teams.skin_in_game_sat` |
| `milestone.fundingRelease` | `milestones.funding_release_sat` |
| Investitionsbeleg Idea-Shares | `idea_investments` (`amount_sat`, `txid`) |
| Investitionsbeleg Team-Shares | `team_investments` (`amount_sat`, `txid`) |
| `team.raised` / `team.investors` | `teams.raised_sat` / `teams.investor_count` |
| `milestone.dueDate` | `milestones.due_date` |

### Warum `discussion` und `marketplace` Spalten sind und keine Tabellen

`discussion` und `marketplace` sind 1:1-Werteobjekte eines Ideas. Eine eigene
Tabelle waere hier keine Normalisierung, sondern nur ein zusaetzlicher Join bei
jedem Lesen der Ideenliste — dem haeufigsten Zugriff der Anwendung ueberhaupt.
Beide Phasen liegen deshalb als Spalten in `ideas`.

Daraus folgt ein Namensproblem: `opened_at` gaebe es zweimal. Die Spalten sind
deshalb praefixiert. Die *dokumentierten* Namen liefern zwei Views, damit die API
den Vertrag aus 5.2 woertlich bedienen kann:

| View | liefert |
|---|---|
| `idea_discussion` | `idea_id`, `opened_at`, `comment_count`, `vote_up`, `vote_down` |
| `idea_marketplace` | `idea_id`, `opened_at`, `closes_at`, `funding_goal_sat`, `raised_sat`, `investor_count`, `creator_share_bp` |
| `idea_investor_shares` | `idea_id`, `investor_id`, `invested_sat`, `total_sat`, `share_bp` |
| `team_investor_shares` | `team_id`, `investor_id`, `invested_sat`, `total_sat`, `share_bp` |

`idea_marketplace` enthaelt nur Ideen mit eroeffneter Marktphase — das entspricht
dem optionalen `marketplace?` aus dem Interface. Die phase-uebergreifende Struktur
ist zusaetzlich als Constraint gesichert: `ideas_marketplace_all_or_nothing_check`
laesst entweder alle Marktspalten leer oder alle gefuellt — ein halb eroeffneter
Marktplatz ist nicht speicherbar.

---

## Entscheidungen ueber die fuenf Punkte hinaus

**`users.role` ist eine Abkuerzung, kein zweiter Wahrheitswert.** `subscriber`
bedeutet „hat ein aktives Abonnement“. Zwei Wahrheiten fuer dieselbe Sache driften
auseinander, sobald ein Abonnement ablaeuft — deshalb haelt
`subscriptions_sync_user_role` die Spalte aktuell. `visitor` wird nie automatisch
vergeben: das ist der Einstieg, keine Herabstufung.

### Die Abkuerzung `users.role` ist nicht direkt faelschbar

Eine Abkuerzung, die sich direkt schreiben laesst, ist keine Abkuerzung — und
genau das war der Fall. `subscriptions_sync_user_role` feuert nur auf
`subscriptions`; ein direkter Schreibvorgang auf `users` kam ungeprueft durch:

```sql
UPDATE users SET role = 'subscriber' WHERE id = <Nutzer ohne Abo>;  -- gelingt
```

Am laufenden PostgreSQL 16.15 nachgestellt: ein neuer Nutzer ohne Abonnement
ergab korrekt `visitor`, dasselbe UPDATE danach `subscriber` bei
`aktives Abo = false`. Damit war die Grundlage des Stimmrechts aus ADR-003 ohne
Abonnement zu haben. Besonders relevant, weil ein kuenftiger BTCPay-Webhook genau
`role = 'subscriber'` setzen wird.

Geschlossen wird die Luecke in derselben Datei durch einen zweiten Trigger auf
derselben Spalte: `users_derive_role_trg`, ein `BEFORE INSERT OR UPDATE`-Trigger
auf `users`, der `role` aus dem tatsaechlichen Abo-Zustand ableitet.

| Zustand beim Schreibvorgang | `role` danach |
|---|---|
| aktives Abonnement (`active AND expires_at > now()`) | `subscriber` |
| sonst, falls `role` gerade `subscriber` ist | `user` |
| sonst | unveraendert |

Zwei Trigger, eine Spalte, zwei Richtungen: `subscriptions_sync_user_role`
reagiert auf das Abonnement — auch auf ein ablaufendes, ohne dass jemand `users`
anfasst —, `users_derive_role_trg` auf jeden Schreibvorgang auf `users`. Der
zweite ist die Sperre: es gibt keinen Pfad an ihm vorbei, auch ein `INSERT` mit
mitgegebenem `role` laeuft durch ihn hindurch.

**Warum korrigierend und nicht abweisend.** `role` ist eine Abkuerzung, kein
zweiter Wahrheitswert — abgeleitete Werte werden nachgerechnet, nicht geprueft.
Dieselbe Haltung hat `set_updated_at`, das ein mitgeschicktes `updated_at`
stillschweigend ueberschreibt. Ein abweisendes `UPDATE` wuerde ausserdem jeden
Aufrufer brechen, der `role` mitschickt und das Abonnement im selben Vorgang
anlegt; der Webhook darf seine beiden Schreibvorgaenge in beliebiger Reihenfolge
absetzen. Unsichtbar bleibt der Versuch trotzdem nicht — er wird als `WARNING`
protokolliert. Bei ADR-003 selbst bleibt es umgekehrt: eine Stimme ohne
Abonnement wird hart abgewiesen (`23514`), weil eine Stimme eine neue Behauptung
ist und keine Ableitung.

**Der INSERT-Fall bleibt unberuehrt.** Beim `INSERT` existiert die Zeile in
`subscriptions` noch nicht — sie kann es auch nicht, `subscriptions.user_id`
zeigt per Fremdschluessel auf `users`. Die Ableitung findet dort kein aktives
Abonnement und laesst `role` stehen: ein neuer Nutzer ohne Abo ergibt `visitor`,
ein `INSERT` mit `role = 'user'` bleibt `user`. `visitor` vergibt der Trigger
nie; das ist der Einstieg, keine Herabstufung.

**ADR-003 wird in der Datenbank durchgesetzt.** `idea_votes_require_subscription`
weist einen INSERT ab, wenn kein aktives Abonnement vorliegt, und stempelt das
verleihende Abonnement in die Stimme. Damit kann kein API-Fehler einer
Nicht-Abonnentin eine Stimme verschaffen. Sollte ein spaeteres ADR auch anderen
Rollen ein Stimmrecht geben, ist das ein `DROP TRIGGER` — die Regel ist bewusst an
einer Stelle gebuendelt.

### Der Stimmbeleg ist unveraenderlich

`idea_votes.subscription_id` ist ein **historischer Beleg**: er haelt fest,
*welches* Abonnement eine Stimme gedeckt hat. Er wird beim `INSERT` gestempelt
(ein mitgeschickter Wert wird ueberschrieben) und laesst sich danach nicht mehr
aendern — auch nicht auf `NULL`. Ein `NULL` machte die Stimme nachtraeglich
unbegruendbar: die Frage „durfte diese Person am 3. Maerz stimmen?“ waere nicht
mehr zu beantworten, obwohl die Stimme weiter zaehlt.

Daraus folgen drei Regeln, die zusammengehoeren:

| Operation | Verhalten | Begruendung |
|---|---|---|
| `INSERT` | prueft aktives Abonnement (sonst `23514`) und stempelt `subscription_id` | Stimmrecht wird **bei der Abgabe** geprueft — das ist der Zeitpunkt, an dem es gelten muss |
| `UPDATE` | prueft **nicht** erneut, stempelt **nicht** neu; aendert sich `subscription_id`, wird abgewiesen (`23514`) | eine umgedrehte Stimme aendert nur `direction`; das Stimmrecht steht als Beleg in der Zeile |
| `DELETE` | frei | Zurueckziehen braucht kein Abonnement |

Dazu der Fremdschluessel `idea_votes.subscription_id` → `subscriptions` auf
`ON DELETE RESTRICT`: **ein Abonnement, auf das Stimmen zeigen, ist nicht
loeschbar** (`23503`). Dieselbe Regel wie bei den Ledgern — Zahlungsbelege
ueberleben ebenfalls per `RESTRICT`. Der Beleg und die Abrechnung sind damit
dieselbe Sorte Zusage: was einmal belegt ist, wird nicht weggeraeumt.

**Warum die Pruefung nicht an jedem UPDATE haengen darf.** Eine Stimme ist ein
Ereignis mit Zeitstempel, keine fortlaufende Behauptung. Wuerde jedes `UPDATE`
erneut ein aktives Abonnement verlangen, waere jede Stimme ungueltig, sobald das
Abonnement ablaeuft — eine Wahlruecknahme durch Zeitablauf. Und ein
`ON DELETE SET NULL` waere zugleich unmoeglich: die FK-Aktion ist selbst ein
`UPDATE` auf `idea_votes`, liefe durch dieselbe Pruefung und scheiterte. Genau
das war der Defekt.

### Der Defekt (behoben): eine Zusage, die nie greifen konnte

Die fruehere Fassung deklarierte `ON DELETE SET NULL` mit der Begruendung „die
Stimme ueberlebt das Aufraeumen der Abrechnung“. Am laufenden PostgreSQL 16.15
nachgestellt galt das Gegenteil:

```sql
-- Nutzer mit aktivem Abo, Idee, eine Stimme -> subscription_id ist gesetzt
DELETE FROM subscriptions WHERE id = <Abo der Stimme>;
-- ABGEWIESEN: 23514
-- 'ADR-003: Stimmrecht erfordert ein aktives Abonnement'
```

Der Ablauf: die FK-Aktion setzt `subscription_id = NULL`; dieses `UPDATE` feuert
`idea_votes_require_subscription`; der Trigger sucht ein **aktives** Abonnement
und findet keines mehr (es wird ja gerade geloescht) — und bricht den gesamten
`DELETE` ab. Verantwortlich war nicht eine der beiden Regeln allein, sondern die
Kombination aus `SET NULL` und einer Pruefung, die auf `UPDATE` von
`idea_votes` feuerte. Das Schema dokumentierte damit ein Verhalten, das es nicht
hatte; ein Entwickler, der sich auf `SET NULL` verliess, baute gegen eine Falle.

Behoben ist das nicht durch Nachgeben bei der Pruefung, sondern durch
**Uebereinstimmung von Deklaration und Wirkung**: `RESTRICT` sagt jetzt, was
tatsaechlich passiert, und der Beleg ist unveraenderlich. Ob eine Stimme ohne
Abo ueberhaupt entstehen darf, entscheidet weiterhin allein der `INSERT`.

**Abweichung vom Datenvertrag — gemeldet, nicht stillschweigend.** `CONTRACT.md`
fuehrt in der Stimmen-Tabelle noch `REFERENCES subscriptions(id) ON DELETE SET
NULL` und beschreibt im Abschnitt „Nachweisregeln“ einen `BEFORE INSERT OR
UPDATE`-Trigger, der Stimmen ohne aktives Abo abweist. Beides trifft auf diese
Fassung nicht mehr zu: die FK-Aktion ist `RESTRICT`, und geprueft wird beim
`INSERT`. Der Vertrag erlaubt Abweichungen ausdruecklich, verlangt aber eine
Begruendung im Commit („Abweichungen sind erlaubt, muessen aber im Commit
begruendet werden — stillschweigende Abweichung nicht“) — sie steht hier. Die
Vertragsdatei selbst bleibt unveraendert; die beiden betroffenen Stellen muessen
in einem eigenen Schritt nachgezogen werden, sonst dokumentiert der kanonische
Vertrag weiterhin `SET NULL`.

**`ON DELETE`-Regeln sind gewaehlt, nicht gesetzt:**

| Beziehung | Regel | Grund |
|---|---|---|
| `subscriptions`, `user_wallets` → `users` | `CASCADE` | Gehoeren der Person; ohne sie sinnlos. |
| `ideas.author_id` → `users` | `RESTRICT` | Das Loeschen eines Kontos darf keine Beitragsgeschichte mitnehmen. |
| `idea_votes` → `ideas`, `users` | `CASCADE` | Eine Stimme ohne Gegenstand oder ohne Waehlerin ist keine Stimme. |
| `idea_votes.subscription_id` → `subscriptions` | `RESTRICT` | Der Beleg ist unveraenderlich: ein Abonnement, auf das Stimmen zeigen, wird nicht geloescht. Die frueher deklarierte Aktion `SET NULL` konnte nie greifen (siehe „Der Defekt“). |
| `teams.idea_id` → `ideas` | `CASCADE` | Ein Team ohne Idee hat keinen Auftrag. |
| `teams.leader_id` → `users` | `RESTRICT` | Eine Teamleitung wird uebergeben, nicht geloescht. |
| `team_investments.team_id` → `teams` | `RESTRICT` | Geldbelege werden nicht mitgeloescht — auch nicht mittelbar ueber das `CASCADE` von `teams.idea_id`. Ein Team mit Belegen ist nicht loeschbar. |
| `team_investments.investor_id` → `users` | `RESTRICT` | Das Loeschen eines Kontos darf keine Zahlungsgeschichte mitnehmen. |
| `milestones.team_id` → `teams` | `CASCADE` | Meilensteine gehoeren zum Team. |

**Ehemals offener Widerspruch — entschieden und behoben.** Die Zeile
`idea_votes.subscription_id` → `subscriptions` trug `SET NULL` („die Stimme
ueberlebt das Aufraeumen der Abrechnung“), was zur Laufzeit nie galt: die
FK-Aktion setzt `subscription_id = NULL`, dieses `UPDATE` feuerte
`idea_votes_require_subscription`, der kein aktives Abonnement mehr fand, und
der ganze `DELETE` scheiterte mit `23514`. Die Aufloesung steht oben unter
„Der Stimmbeleg ist unveraenderlich“: `RESTRICT` statt `SET NULL`, Pruefung nur
beim `INSERT`, unveraenderlicher Beleg. Der Fall ist gegen `postgres:16-alpine`
mit den Faellen a) bis i) nachgewiesen (Abschnitt „Pruefen“).

**Indizes auf allen Fremdschluesseln — mit einer bewussten Ausnahme.**
`idea_votes.idea_id` hat *keinen* eigenen Index, weil die
`UNIQUE (idea_id, user_id)`-Constraint bereits einen Btree-Index erzeugt, der mit
`idea_id` beginnt und die FK-Pruefung damit vollstaendig bedient. Ein zweiter Index
waere reine Schreiblast auf dem heissesten Schreibpfad des Schemas. Alle uebrigen
Fremdschluessel haben einen eigenen Index.

Beide Ledger tragen je drei Indizes: den FK-Index auf der Bezugsspalte, den
FK-Index auf dem Investor und den Auswertungsindex
`(bezug_id, created_at DESC)` — genau die Abfrage, aus der `raised_sat`,
`investor_count` und die Anteile entstehen. Die Bezugsspalte ist in **jedem**
dieser Indizes die erste Spalte (`CONTRACT.md`, Abschnitt „Indizes“): ein Index
`(created_at, team_id)` wuerde die FK-Pruefung auf `team_id` nicht bedienen.
Der Auswertungsindex `(team_id, created_at DESC)` deckt die FK-Pruefung auf
`team_id` bereits ab; `team_investments_team_id_idx` ist damit streng genommen
redundant und bleibt nur aus Symmetrie zu `idea_investments` stehen. Wer
Schreiblast sparen will, kann ihn in einer spaeteren Migration streichen —
funktional aendert er nichts.

---

## Kanonischer Datenvertrag (`api/CONTRACT.md`)

Die Bezeichner dieser Migration sind die kanonischen. Fruehere Arbeitsnamen sind
ersetzt — beide Migrationen des Divergenztests liefen fehlerfrei, waren aber
wegen genau solcher Namen nicht zusammenfuehrbar:

| frueher | kanonisch |
|---|---|
| `ideas.votes_up` / `ideas.votes_down` | `ideas.vote_up` / `ideas.vote_down` |
| `ideas.comments` | `ideas.comment_count` |
| `ideas.investors` | `ideas.investor_count` |
| `ideas.raised` / `teams.raised` | `ideas.raised_sat` / `teams.raised_sat` |
| `ideas.funding_goal` / `teams.funding_goal` | `ideas.funding_goal_sat` / `teams.funding_goal_sat` |
| `teams.skin_in_game` | `teams.skin_in_game_sat` |
| `milestones.funding_release` | `milestones.funding_release_sat` |
| `subscriptions.payment_tx_hash` | `subscriptions.payment_txid` |

### Die zwei Ledger: `idea_investments` und `team_investments`

Ein Zaehler ist eine Behauptung, ein Ledger ist der Beweis. `ideas.raised_sat`
und `ideas.investor_count` sind deshalb nur noch die gepflegte Abkuerzung von
`idea_investments`, `teams.raised_sat` und `teams.investor_count` die von
`team_investments`. Geschrieben werden sie ausschliesslich von den beiden
Trigger-Funktionen `idea_investments_sync_counters` und
`team_investments_sync_counters` (INSERT, UPDATE, DELETE) und dort vollstaendig
neu berechnet. `investor_count` zaehlt Investoren, nicht Zahlungen: wer zweimal
einzahlt, ist ein Investor mit zwei Belegen.

**Warum zwei Tabellen und nicht eine mit einer Typ-Spalte** begruendet
`CONTRACT.md` im Abschnitt „Warum zwei Ledger, nicht eines“: Idea-Shares und
Team-Shares sind getrennt verkaufbare Beteiligungen.

| | Idea-Shares | Team-Shares |
|---|---|---|
| Rolle | Series-A-Runde der Idee | Beteiligung an **einem** Team |
| Wann kaufbar | waehrend der Marktplatzphase | **jederzeit**, auch spaeter |
| Ertrag aus | **allen** Teams der Idee (20 %) | **einem** Team (80 %) |

Wer Idea-Shares haelt, verdient an allen Teams; wer Team-Shares haelt, an einem.
Ein gemeinsames Ledger koennte diese beiden Ansprueche nicht trennen — und keine
Auszahlung waere mehr begruendbar. Zwei getrennte Tabellen sind deshalb keine
Redundanz, sondern die Voraussetzung dafuer, dass `team_investor_shares`
ueberhaupt eine andere Zahl liefern *darf* als `idea_investor_shares`.

Beide Ledger sind **deckungsgleich aufgebaut** — gleiche Spaltennamen, gleiche
Typen, gleiche Regeln, nur die Bezugstabelle wechselt von der Idee zum Team.
Unterschiedlich benannte Felder in zwei Ledgern waeren genau die Divergenz, die
`CONTRACT.md` ausschliessen will.

| Spalte | `idea_investments` | `team_investments` | Regel |
|---|---|---|---|
| Bezug | `idea_id` → `ideas` | `team_id` → `teams` | `ON DELETE RESTRICT`, Index |
| Investor | `investor_id` → `users` | `investor_id` → `users` | `ON DELETE RESTRICT`, Index |
| Betrag | `amount_sat bigint` | `amount_sat bigint` | `CHECK (amount_sat > 0)` |
| Beleg | `txid text` | `txid text` | 64 Hexzeichen, `UNIQUE` |
| Zeit | `created_at timestamptz` | `created_at timestamptz` | `DEFAULT now()` |

`RESTRICT` statt `CASCADE` ist gewaehlt, nicht gesetzt: Geldbelege werden nicht
mitgeloescht. Eine finanzierte Idee ist damit nicht loeschbar, solange Zahlungen
auf sie zeigen — sonst verschwindet die Spur des Geldes mit der Idee.

Beim Team-Ledger ist dieselbe Regel eine Ebene tiefer entscheidend:
`teams.idea_id` → `ideas` ist `CASCADE` (ein Team ohne Idee hat keinen
Auftrag). Ohne `RESTRICT` auf `team_investments.team_id` haette das Loeschen
einer Idee die Team-Shares-Belege mitgerissen — die 80-Prozent-Seite waere
spurlos verschwunden. Das `RESTRICT` des Ledgers schlaegt das `CASCADE` der
Elternzeile: ein Team mit Belegen ist nicht loeschbar.

Der Zaehler `teams.raised_sat` war bis zu dieser Fassung ein von der Anwendung
geschriebener Wert („noch ohne Quelltabelle“). Mit `team_investments` ist diese
Luecke geschlossen: beide Team-Zaehler haben eine Quelle, einen einzigen
Schreiber und sind jederzeit aus dem Ledger rekonstruierbar.

### Anteile sind Basispunkte

`ideas.creator_share_bp` ist `smallint`, `DEFAULT 2000` — die 20 Prozent der
Idee-Seite, 10000 bp = 100 Prozent, nie ein Bruch. Investorenanteile werden
**nicht** gespeichert, sondern ganzzahlig berechnet
(`invested_sat * 10000 / total_sat`): `idea_investor_shares` fuer den Anspruch
gegenueber der Idee, `team_investor_shares` fuer den Anspruch gegenueber einem
Team. Zwei Ansprueche, zwei Views — eine gemeinsame View koennte die 20 und die
80 Prozent nicht auseinanderhalten. Die ganzzahlige Division schneidet ab; die
Summe der `share_bp` eines Pools kann deshalb knapp unter 10000 liegen.
Ausgezahlt wird nach `invested_sat` (exakt), `share_bp` ist die Anzeige.

**Ehemals offener Punkt, jetzt geschlossen:** `teams.raised_sat` hatte keine
Quelltabelle — dieselbe Defektklasse wie `ideas.raised` vor dem Ledger. Der
Vertrag fuehrt `team_investments` inzwischen unter den Pflichtentitaeten, und
die Migration liefert die Tabelle mit: `teams.raised_sat` und
`teams.investor_count` werden ausschliesslich von
`team_investments_sync_counters` geschrieben und vollstaendig neu gezaehlt.
Damit ist die Team-Seite der 80 Prozent genauso beweisbar wie die Idea-Seite.

`teams.investor_count` ist dabei die einzige Spalte, die der Vertrag nennt,
das Schema aber noch nicht hatte: der Vertrag fuehrt „`raised_sat`/
`investor_count` in `teams` ← `team_investments`, per Trigger“ und braucht
dafuer beide Spalten. Die Spalte traegt den kanonischen Namen aus der
Zaehler-Tabelle des Vertrags (`investor_count`, nicht `investors`) und
dieselbe `CHECK (>= 0)` wie ihr Gegenstueck in `ideas`.

---

## Was diese Migration bewusst nicht enthaelt

| Fehlt | Grund |
|---|---|
| `translations` (5.3) | In der Doku ausdruecklich als *Future* markiert. |
| `idea_comments` (Tabelle) | Nicht Teil der vier Kernentitaeten. Der Zaehler `ideas.comment_count` existiert bereits, weil der Vertrag ihn verlangt; die Tabelle und ihr Trigger folgen in Migration 002. Bis dahin bleibt der Zaehler bei 0. |
| `team_members` | 5.4 kennt nur `leaderId`. Mitgliedschaft ist ein eigenes Thema (Rollen, Austritt, Reputation) und wird nicht mitgeraten. |
| `budget_items` (`proposal.budget`) | 5.4 nennt `BudgetItem[]`, definiert die Struktur aber nicht. Eine Tabelle auf Verdacht waere geraten. |
| Zahlungsabwicklung, Auszahlungen, Treuhand | Widerspricht ADR-006. Die Plattform rechnet mit Betraegen, sie haelt sie nicht. Belegt wird eine Zahlung in den Ledgern `idea_investments` (Idea-Shares) und `team_investments` (Team-Shares); ausgefuehrt wird sie nie von der Plattform. |

## Geldbetraege

Alle Betraege sind Satoshi und damit ganze Zahlen: `BIGINT`, in jeder Geldspalte.
Es kommt kein Gleitkomma- und kein Festkommatyp im Schema vor. `COMMENT ON COLUMN`
dokumentiert die Einheit direkt in der Datenbank, damit sie beim Schreiben einer
Abfrage nicht geraten werden muss.

Betroffene Spalten: `ideas.funding_goal_sat`, `ideas.raised_sat`,
`teams.funding_goal_sat`, `teams.raised_sat`, `teams.skin_in_game_sat`,
`milestones.funding_release_sat`, `idea_investments.amount_sat`,
`team_investments.amount_sat`.

`subscriptions.payment_amount` ist der einzige Betrag ohne `_sat`-Suffix; der
Vertragspruefer fuehrt ihn in seiner Ausnahmeliste. Die Einheit steht als
`COMMENT ON COLUMN` in der Datenbank.
