# Migrationen — Ideenschmiede API

Diese Datei ist die Begruendung zu `001_init.sql`, nicht nur eine Bedienungsanleitung.
Sie haelt fest, *warum* das Schema so aussieht — insbesondere bei den fuenf Punkten,
die die Aufgabe bewusst offen gelassen hat.

## Inhalt

| Datei | Zweck |
|---|---|
| `001_init.sql` | Migration 001. Die vier Kernentitaeten `users`, `ideas`, `teams`, `milestones` — plus die drei Tabellen, die aus den Entscheidungen unten folgen: `subscriptions`, `user_wallets`, `idea_votes`. |

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

Ergebnis fuer diese Datei: 59 Statements, 7 Tabellen, alle vier Kerntabellen
vorhanden, keine Gleitkomma-Spalten, 9 Fremdschluessel (alle mit `ON DELETE`),
20 Indizes, `ERGEBNIS: PARSE OK`.

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
   Vergangenheit bei jeder Verlaengerung.
2. **Der Geldfluss braucht einen Ort.** Jede Verlaengerung ist ein eigener
   Zahlungsvorgang mit eigener Transaktion (ADR-006, non-custodial).
   `payment_tx_hash` und `payment_amount` sind die Belegkette. In einer einzelnen
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

**Wahl: beides — Einzelstimmen sind die Wahrheit, `votes_up`/`votes_down` sind ein
Cache, den ausschliesslich ein Trigger schreibt.**

Die Frage war, ob Abstimmungen nachpruefbar sind. Mit einem Zaehler allein lautet
die Antwort *nein*: ein Zaehler ist eine Behauptung, eine Tabelle aus Einzelstimmen
ist ein Beweis.

1. **Die Wahrheit liegt in `idea_votes`:** wer, wann, welche Richtung — und ueber
   `subscription_id` auch, welches Abonnement dieses Stimmrecht verliehen hat.
2. **Doppelstimmen sind strukturell unmoeglich.** `UNIQUE (idea_id, user_id)`
   entscheidet in der Datenbank, nicht die Anwendung. Kein Race Condition, kein
   Bug in einem Endpunkt kann sie erzeugen.
3. **Der Zaehler bleibt trotzdem.** Die Ideenliste braucht ihn bei jedem
   Seitenaufruf; ein `COUNT(*)` ueber alle Stimmen je Zeile waere dafuer zu teuer.
4. **Ein Cache mit genau einem Schreiber driftet nicht.** Nur
   `idea_votes_sync_counters` fasst die beiden Spalten an — bei INSERT, UPDATE und
   DELETE. Kein Anwendungspfad schreibt sie direkt. `CHECK (>= 0)` faengt ab, was
   trotzdem durchkaeme.
5. **Der Cache ist beweisbar korrekt**, weil er sich jederzeit aus den
   Einzelstimmen rekonstruieren laesst. Diese Abfrage muss immer leer sein:

```sql
SELECT i.id,
       i.votes_up   AS zaehler_up,
       count(*) FILTER (WHERE v.direction = 'up')   AS echt_up,
       i.votes_down AS zaehler_down,
       count(*) FILTER (WHERE v.direction = 'down') AS echt_down
  FROM ideas i
  LEFT JOIN idea_votes v ON v.idea_id = i.id
 GROUP BY i.id, i.votes_up, i.votes_down
HAVING i.votes_up   <> count(*) FILTER (WHERE v.direction = 'up')
    OR i.votes_down <> count(*) FILTER (WHERE v.direction = 'down');
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
| `discussion.comments` / `.votes.up` / `.votes.down` | `ideas.comments` / `ideas.votes_up` / `ideas.votes_down` |
| `marketplace.openedAt` / `.closesAt` | `ideas.marketplace_opened_at` / `ideas.marketplace_closes_at` |
| `marketplace.fundingGoal` / `.raised` / `.investors` | `ideas.funding_goal` / `ideas.raised` / `ideas.investors` |
| `team.focusArea` | `teams.focus_area` |
| `team.proposal.timeline` | `teams.timeline_months` |
| `team.skinInGame` | `teams.skin_in_game` |
| `milestone.fundingRelease` | `milestones.funding_release` |
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
| `idea_discussion` | `idea_id`, `opened_at`, `comments`, `votes_up`, `votes_down` |
| `idea_marketplace` | `idea_id`, `opened_at`, `closes_at`, `funding_goal`, `raised`, `investors` |

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

**ADR-003 wird in der Datenbank durchgesetzt.** `idea_votes_require_subscription`
weist einen INSERT ab, wenn kein aktives Abonnement vorliegt, und stempelt das
verleihende Abonnement in die Stimme. Damit kann kein API-Fehler einer
Nicht-Abonnentin eine Stimme verschaffen. Sollte ein spaeteres ADR auch anderen
Rollen ein Stimmrecht geben, ist das ein `DROP TRIGGER` — die Regel ist bewusst an
einer Stelle gebuendelt.

**`ON DELETE`-Regeln sind gewaehlt, nicht gesetzt:**

| Beziehung | Regel | Grund |
|---|---|---|
| `subscriptions`, `user_wallets` → `users` | `CASCADE` | Gehoeren der Person; ohne sie sinnlos. |
| `ideas.author_id` → `users` | `RESTRICT` | Das Loeschen eines Kontos darf keine Beitragsgeschichte mitnehmen. |
| `idea_votes` → `ideas`, `users` | `CASCADE` | Eine Stimme ohne Gegenstand oder ohne Waehlerin ist keine Stimme. |
| `idea_votes.subscription_id` → `subscriptions` | `SET NULL` | Die Stimme ueberlebt das Aufraeumen der Abrechnung; sie bleibt gueltig. |
| `teams.idea_id` → `ideas` | `CASCADE` | Ein Team ohne Idee hat keinen Auftrag. |
| `teams.leader_id` → `users` | `RESTRICT` | Eine Teamleitung wird uebergeben, nicht geloescht. |
| `milestones.team_id` → `teams` | `CASCADE` | Meilensteine gehoeren zum Team. |

**Indizes auf allen Fremdschluesseln — mit einer bewussten Ausnahme.**
`idea_votes.idea_id` hat *keinen* eigenen Index, weil die
`UNIQUE (idea_id, user_id)`-Constraint bereits einen Btree-Index erzeugt, der mit
`idea_id` beginnt und die FK-Pruefung damit vollstaendig bedient. Ein zweiter Index
waere reine Schreiblast auf dem heissesten Schreibpfad des Schemas. Alle uebrigen
Fremdschluessel haben einen eigenen Index.

---

## Was diese Migration bewusst nicht enthaelt

| Fehlt | Grund |
|---|---|
| `translations` (5.3) | In der Doku ausdruecklich als *Future* markiert. |
| `comments` (Tabelle) | Nicht Teil der vier Kernentitaeten. Der Zaehler `ideas.comments` existiert bereits, weil der Vertrag ihn verlangt; die Tabelle und ihr Trigger folgen in Migration 002. Bis dahin bleibt der Zaehler bei 0. |
| `team_members` | 5.4 kennt nur `leaderId`. Mitgliedschaft ist ein eigenes Thema (Rollen, Austritt, Reputation) und wird nicht mitgeraten. |
| `budget_items` (`proposal.budget`) | 5.4 nennt `BudgetItem[]`, definiert die Struktur aber nicht. Eine Tabelle auf Verdacht waere geraten. |
| Zahlungen, Auszahlungen, Treuhand | Widerspraeche ADR-006. Die Plattform rechnet mit Betraegen, sie haelt sie nicht. |

## Geldbetraege

Alle Betraege sind Satoshi und damit ganze Zahlen: `BIGINT`, in jeder Geldspalte.
Es kommt kein Gleitkomma- und kein Festkommatyp im Schema vor. `COMMENT ON COLUMN`
dokumentiert die Einheit direkt in der Datenbank, damit sie beim Schreiben einer
Abfrage nicht geraten werden muss.

Betroffene Spalten: `subscriptions.payment_amount`, `ideas.funding_goal`,
`ideas.raised`, `teams.funding_goal`, `teams.raised`, `teams.skin_in_game`,
`milestones.funding_release`.
