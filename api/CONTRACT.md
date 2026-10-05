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
| `txid` | `text` | in Ledgertabellen, mit `UNIQUE` |

Gespeichert werden **nur** Public Keys (xpub/ypub/zpub/tpub) und Adressen.
Private Schlüssel (WIF-, xprv-Präfixe) werden per `CHECK` abgewiesen —
ADR-006 wird damit in der Datenbank durchgesetzt, nicht nur dokumentiert.

### Stimmen

| Feld | Typ | Wertebereich |
|---|---|---|
| `direction` | `text` | `'up'` oder `'down'` — **nicht** `-1`/`+1` |
| `subscription_id` | `uuid` | `REFERENCES subscriptions(id) ON DELETE SET NULL` — belegt, welches Abo die Stimme gedeckt hat |

`direction` ist Text, damit die Absicht in jeder Abfrage lesbar bleibt und
`SUM(value)` nicht versehentlich über eine Richtung gebildet wird.

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
