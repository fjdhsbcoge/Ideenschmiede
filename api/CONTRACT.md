# Ideenschmiede — Kanonischer Datenvertrag

**Verbindlich für jede Arbeit am Backend (Phase 3, Roadmap).**
Vor der Arbeit lesen. Abweichungen sind erlaubt, müssen aber im Commit
begründet werden — stillschweigende Abweichung nicht.

## Warum diese Datei existiert

Zwei Arbeiter haben dieselbe Schema-Aufgabe gelöst (MiniMax-M3 und Kimi K3).
Ergebnis: bei **allen Entwurfsentscheidungen volle Übereinstimmung**, aber
**62 % der geprüften Merkmale divergierten** — ausschließlich bei Bezeichnern,
Typen und Wertebereichen. Beide Migrationen laufen fehlerfrei gegen
PostgreSQL 16.15, beide setzen ADR-003 funktionierend durch, und trotzdem
ist keine Zeile zusammenführbar.

Der Grund ist strukturell: Modelle konvergieren bei der *Struktur* und
divergieren bei der *Benennung*. Deshalb wird die Benennung hier
festgelegt, bevor parallel gearbeitet wird — nicht danach zusammengeführt.

## Kanonische Bezeichner

### Geld

| Regel | Begründung |
|---|---|
| Satoshi ist `bigint`, **niemals** `numeric`/`float`/`decimal` | ADR-006, non-custodial; Ganzzahlen sind exakt und rekonstruierbar |
| Geldfelder enden auf `_sat` | `raised_sat`, `funding_goal_sat`, `price_sat`, `amount_sat` — verhindert die Verwechslung mit Cent oder Prozent |
| Anteile sind **Basispunkte**, `smallint`/`integer`, 10000 = 100 % | Nie als Bruch speichern; `creator_share_bp DEFAULT 2000` sind die 20 % |
| Anteile werden **nicht** gespeichert, sondern berechnet | View `idea_investor_shares` rechnet `investierte_sat / gesamte_sat` ganzzahlig |

### Belege (Bitcoin)

| Feld | Typ | Regel |
|---|---|---|
| `payment_txid` | `text` | Transaktionskennung. **Nicht** `payment_tx_hash` |
| `payment_address` | `text` | Empfangsadresse |
| `txid` | `text` | in Ledgertabellen |

Gespeichert werden **nur** Public Keys (xpub/ypub/zpub/tpub) und Adressen.
Private Schlüssel (WIF-, xprv-Präfixe) werden per `CHECK` abgewiesen —
ADR-006 wird damit in der Datenbank durchgesetzt, nicht nur dokumentiert.

#### Jede Belegspalte mit Zahlungsbezug ist eindeutig

Eine Spalte, die eine Bitcoin-Transaktion belegt, trägt eine
**Eindeutigkeitsregel in der Datenbank** — nicht nur einen Format-`CHECK`:

| Spalte | Regel |
|---|---|
| Pflichtspalte (`NOT NULL`) | `UNIQUE` |
| optionale Spalte (`nullable`) | partieller Index `UNIQUE ... WHERE spalte IS NOT NULL`, damit beliebig viele Zeilen ohne Beleg möglich bleiben |

Grund: externe Systeme **wiederholen Zustellungen** — BTCPay Server tut das
planmäßig bei Timeouts. Ohne diese Regel verbucht die Wiederholung dieselbe
Zahlung doppelt, und beim Abonnement verdoppelt das nach ADR-003 das
Stimmrecht. **Idempotenz des Webhooks ist damit eine Eigenschaft des
Schemas, nicht des Anwendungscodes.**

#### Nur Ketten-Zahlungen sind ein Beleg

Eine Zahlung gilt **nur dann** als Beleg, wenn sie auf der Kette liegt.
Eine Lightning-Zahlung ist **kein** Beleg — auch dann nicht, wenn ihr
`payment_hash` die Form einer Transaktionskennung hat (64 Hexzeichen).

Der Grund ist eine Verwechslungsgefahr, die die Formprüfung nicht auflösen
kann: `payment_hash` und `txid` sehen gleich aus. Unterscheidbar sind sie nur
über die **Zahlungsart**, die BTCPay im Zahlungsobjekt als `paymentMethod`
mitliefert (`BTC` gegen `BTC-LightningLike`). Liegt keine Zahlungsart vor,
entscheidet die Form — liegt eine vor und enthält sie `lightning`, wird die
Zahlung **verworfen**, unabhängig von `transactionId`.

Folge für den Betrieb: eine Rechnung, die nur Lightning anbietet, kann nie
gebucht werden. Rechnungen müssen eine on-chain-Zahlungsart anbieten.

#### Belegspalten werden in Kleinschreibung normalisiert

Der Format-`CHECK` erlaubt `a-fA-F`, `UNIQUE` ist aber **case-sensitiv**:
in der C-Kollation sind `F` und `f` verschiedene Zeichen, also für `UNIQUE`
zwei verschiedene Werte. Dieselbe Transaktion einmal groß und einmal klein
geschrieben käme damit zweimal durch — die Eindeutigkeitsregel wäre
umgehbar, ohne dass ein Fehler sichtbar wird.

Ob der Zahlungsdienstleister die Kennung immer klein liefert, ist **nicht
zugesichert**. Deshalb darf die Identität einer Zahlung nicht von der
Schreibweise abhängen. Zwei Regeln zusammen:

1. **Normalisieren beim Schreiben.** Ein `BEFORE INSERT OR UPDATE`-Trigger
   setzt die Spalte auf `lower(...)`. Normalisieren statt abweisen:
   derselbe Aufruf gelingt, wird aber kanonisch gespeichert.
2. **Eindeutigkeit über den Ausdruck.** `UNIQUE` über `lower(spalte)`, nicht
   über die Spalte. Eine Tabellen-Constraint kann keine Ausdrücke listen,
   deshalb ist es ein `CREATE UNIQUE INDEX` — Name und Fehlercode `23505`
   bleiben gleich.

Der Format-`CHECK` bleibt bewusst weiter gefasst als die Normalform: `CHECK`
läuft **nach** dem `BEFORE`-Trigger, sonst wäre die Normalisierung
unerreichbar.

**Folge für Abfragen — verbindlich:** die Belegindizes sind Ausdrucksindizes.
Eine Belegsuche lautet `lower(txid) = lower($1)`, **nicht** `txid = $1`.

Beides ist inhaltlich richtig, weil die Spalte kanonisch klein gespeichert
wird. Der Unterschied liegt im Zugriffspfad, am Planer gemessen:

| Abfrage | Plan | Kosten |
|---|---|---|
| `lower(payment_txid) = lower($1)` | Index Scan | 0.12 – 8.14 |
| `payment_txid = $1` | Bitmap Heap Scan | 4.13 – 20.59 |

Der direkte Vergleich nutzt den Index nur als Filter, nicht als Suche.
Ein zusätzlicher Index auf der Spalte wäre möglich, kostet aber Schreiblast
auf jedem Beleg — die Normalisierung macht ihn entbehrlich. Der Webhook-
Lookup und jede Belegsuche verwenden deshalb die `lower`-Form.

### Stimmen

| Feld | Typ | Wertebereich |
|---|---|---|
| `direction` | `text` | `'up'` oder `'down'` — **nicht** `-1`/`+1` |
| `subscription_id` | `uuid` | `REFERENCES subscriptions(id) ON DELETE RESTRICT` — belegt, welches Abo die Stimme gedeckt hat. **Unveränderlich nach dem Einfügen** |

`direction` ist Text, damit die Absicht in jeder Abfrage lesbar bleibt und
`SUM(value)` nicht versehentlich über eine Richtung gebildet wird.

**Der Stimmbeleg ist unveränderlich.** `subscription_id` hält fest, welches
Abonnement die Stimme gedeckt hat, und ist ein historischer Beleg. Ein
`UPDATE`, das die Spalte ändert — auch auf `NULL` — wird abgewiesen. Ein
`NULL` würde die Stimme nachträglich unbegründbar machen.

Daraus folgt `ON DELETE RESTRICT` statt `SET NULL`: Ein Abonnement, auf das
Stimmen zeigen, ist nicht löschbar. Die Deklaration muss der Wirkung
entsprechen — `SET NULL` kann hier nie greifen, weil die Prüfung des
Stimmrechts vor der Fremdschlüsselaktion läuft und dann kein aktives
Abonnement mehr findet.

**Wann geprüft wird.** Die Prüfung „aktives Abonnement" gehört an den
Zeitpunkt der Stimmabgabe, nicht an jedes spätere `UPDATE`:

| Operation | Verhalten |
|---|---|
| `INSERT` | prüft das Stimmrecht, stempelt `subscription_id` |
| `UPDATE` | prüft **nicht** neu (das Recht wurde bei der Abgabe geprüft und ist im Beleg festgehalten); jede Änderung von `subscription_id` wird abgewiesen |
| `DELETE` | frei — Zurückziehen braucht kein Abonnement |

### Zähler

| Kanonisch | Nicht verwenden |
|---|---|
| `vote_up`, `vote_down` | `votes_up`, `votes_down` |
| `comment_count` | `comments` |
| `investor_count` | `investors` |
| `raised_sat` | `raised` |

**Jeder Zähler hat eine Quelltabelle.** Ein Zähler ohne Quelle ist ein
Datenverlust: der Wert ist später nicht rekonstruierbar. Konkret gilt:

- `vote_up`/`vote_down` ← `idea_votes`, per Trigger vollständig neu gezählt
- `raised_sat`/`investor_count` in `ideas` ← `idea_investments`, per Trigger
- `raised_sat`/`investor_count` in `teams` ← `team_investments`, per Trigger
- `comment_count` ← `idea_comments` (Migration 002)

### Warum zwei Ledger, nicht eines

Idea-Shares und Team-Shares sind **getrennt verkäufliche Beteiligungen**:

| | Idea-Shares | Team-Shares |
|---|---|---|
| Rolle | Series-A-Runde der Idee | Beteiligung an **einem** Team |
| Wann kaufbar | während der Marktplatzphase | **jederzeit**, auch später |
| Ertrag aus | **allen** Teams der Idee (20 %) | **einem** Team (80 %) |

Wer Idea-Shares hält, verdient an allen Teams; wer Team-Shares hält, an
einem. Ein gemeinsames Ledger könnte diese beiden Ansprüche nicht trennen,
und keine Auszahlung wäre mehr begründbar.

### Aufzählungen

Immer `text` mit `CHECK`, **kein** `CREATE TYPE`. Grund: `ALTER TYPE ...
ADD VALUE` ist in derselben Transaktion nicht benutzbar — genau der
Migrationsfall, für den die Aufzählung gebraucht wird.

| Feld | Erlaubte Werte |
|---|---|
| `role` | `visitor`, `user`, `subscriber` |
| `stage` | `discussion`, `voting`, `marketplace`, `active`, `completed` |
| `language` | `de`, `en` |

## Namensform je Schicht

Drei Schichten, drei Schreibweisen — das ist Absicht, nicht Nachlässigkeit:

| Schicht | Form | Beispiel |
|---|---|---|
| Datenbank (SQL) | `snake_case`, flach | `vote_up`, `comment_count`, `raised_sat` |
| API (JSON) | `camelCase`, **verschachtelt** | `votes.up`, `discussion.comments`, `marketplace.raised` |
| Frontend (`webapp/src/lib/data.ts`) | `camelCase`, verschachtelt | wie die API |

**Die API ist die Übersetzungsschicht.** Sie liest die flachen
`snake_case`-Spalten und liefert die verschachtelte `camelCase`-Form aus
`ARCHITECTURE.md` Anhang 5 — das ist der dokumentierte Vertrag gegenüber
dem Frontend.

Für die verschachtelten Teile gibt es **eigene Views**, gebaut genau für
diesen Zweck: `idea_discussion` und `idea_marketplace`. Wer eine neue
Ressource hinzufügt, liefert die dokumentierte Form und reicht nicht die
Spaltennamen durch.

Die vollständige Zuordnungstabelle liegt in `api/migrations/README.md`.
Sie ist die Quelle für die Abbildung — nicht der Spaltenname.

**Warum das hier steht:** eine API, die rohe Spaltennamen durchreicht,
verlagert die Übersetzung in jeden Client. Bei mehreren Clients —
Web-App, später mobile App, Föderationspartner (ADR-004) — driftet die
Abbildung dann auseinander, und jeder Client interpretiert anders. Genau
die Divergenz, die dieser Vertrag verhindern soll.

## Pflichtentitäten

Diese Tabellen müssen existieren. Fehlt eine, ist die Produktlogik nicht
ausführbar — nicht nur unsauber:

| Tabelle | Zweck | Warum unverzichtbar |
|---|---|---|
| `users` | Konten | — |
| `user_wallets` | öffentliche Schlüssel | Zahlungen brauchen eine stabile Wallet-ID als FK |
| `subscriptions` | Abo **mit Historie** | das Abo ist das Stimmrecht (ADR-003); ohne Historie ist eine Stimme nach Ablauf nicht mehr begründbar |
| `ideas` | Ideen | — |
| `idea_votes` | **Einzelstimmen** | ein Zähler ist eine Behauptung, Einzelstimmen sind ein Beweis |
| **`idea_investments`** | **Ledger der Idea-Shares** | **ohne dieses Ledger ist die 20/80-Aufteilung nicht berechenbar.** Ein Zähler `raised_sat` ohne Quelle ist wertlos |
| `teams` | Teams, genau eine Idee | — |
| **`team_investments`** | **Ledger der Team-Shares** | Team-Shares werden **separat und jederzeit** gekauft. Ohne eigenes Ledger ist die Team-Seite der 80 % nicht berechenbar |
| `milestones` | Meilensteine eines Teams | — |

## Nachweisregeln

Jede Stimme muss nachweisbar sein:

```sql
-- Muss immer 0 Zeilen liefern: Zähler und Einzelstimmen im Gleichklang
SELECT i.id, i.vote_up, COUNT(v.*) FILTER (WHERE v.direction = 'up')
FROM ideas i LEFT JOIN idea_votes v ON v.idea_id = i.id
GROUP BY i.id, i.vote_up
HAVING i.vote_up <> COUNT(v.*) FILTER (WHERE v.direction = 'up');
```

ADR-003 wird **in der Datenbank** durchgesetzt, nicht in der Anwendung:
ein `BEFORE INSERT OR UPDATE`-Trigger weist Stimmen ohne aktives Abo ab
und stempelt `subscription_id` ein. `DELETE` bleibt frei — Zurückziehen
braucht kein Abo.

## Indizes

Jeder Fremdschlüssel braucht Indexabdeckung. Eine `UNIQUE (a, b)`-Constraint
erzeugt bereits einen Btree, der mit `a` beginnt, und bedient eine FK-Prüfung
auf `a` vollständig — ein zusätzlicher Einzelindex auf `a` ist reine
Schreiblast.

**Aber:** das gilt nur, wenn die FK-Spalte die **erste** Spalte des Index ist.
Ein Index `(b, a)` deckt eine FK-Prüfung auf `a` **nicht** ab.

## Zeitstempel

Alle Zeitangaben `timestamptz` (absolut, nie lokal).

## Prüfpflicht vor der Abgabe

Statische Prüfung genügt **nicht** — ein Parser bestätigt nichts über das
Laufzeitverhalten von Triggern und Constraints. Vor der Abgabe:

1. `postgres:16-alpine` starten, eigene Datenbank je Migration
2. Datei mit `ON_ERROR_STOP=1` einspielen (bricht beim ersten echten Fehler ab)
3. Funktionstest je Geschäftsregel, vier Fälle: Verstoß ohne Berechtigung
   muss abgewiesen werden · gültiger Fall muss gelingen · Wiederholung muss
   strukturell scheitern · abgeleitete Zähler müssen stimmen
4. Testdaten müssen die eigenen `CHECK`-Constraints erfüllen, sonst scheitert
   der Test an der Datenqualität statt an der Logik

## Herkunft

Dieser Vertrag fasst die Befunde aus dem Divergenztest vom 2026-10-05
zusammen (MiniMax-M3 gegen Kimi K3, gemessen gegen PostgreSQL 16.15).
Die Entwurfsentscheidungen sind **empirisch konvergent** — beide Modelle
wählten identisch und begründeten gleich. Festgelegt wird hier nur, was
divergierte: Name, Typ und Wertebereich.

**Befunde der Form „Modell X macht Y" sind Momentaufnahmen einer
Modellversion.** Anbieter streichen Modellpaletten zusammen oder leiten
alte Namen auf neue Modelle um. Tragfähig bleibt der problemseitige Teil:
welche Information im Schema existieren muss, damit die Produktlogik
ausführbar ist.
