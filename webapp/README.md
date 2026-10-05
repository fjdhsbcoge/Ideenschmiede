# Ideenschmiede – Webapp (v1.2)

Interaktive Plattform-Demo der Ideenschmiede. React 19 + TypeScript + Vite + Tailwind CSS.

## Start

```bash
npm install
npm run dev    # Entwicklung (Vite Dev-Server)
npm run build  # Produktions-Build → dist/
```

## Struktur

```
src/
├── lib/
│   ├── api.ts          # Die Grenze zum Backend: Wire-Typen, Prüfungen, listIdeas(), getCurrentUser()
│   ├── dataSource.ts   # Entscheidet, woher die Ideen kommen – und bildet die API-Form ab
│   ├── i18n/de.ts      # Deutsche Sprachdatei (Referenz für künftige Sprachen)
│   ├── store.tsx       # Rollen, Bewerbungen, Votes (localStorage) + die Ideen
│   └── data.ts         # Beispieldaten: Ideen, Teams, Investments, Revenue-Reports
├── pages/              # Landing, Diskussion, Idee, CreateIdea, Marktplatz,
│                       # Teams, TeamDetail, TeamApply/Create, Dashboard, Profil,
│                       # Investments, Earnings, 404
└── components/         # Layout (Nav/Footer/RoleSwitcher), Karten, Paywall, Modals,
                        # Banner für den Rückfall auf Beispieldaten
```

## Datenquelle: Beispieldaten oder API

Die Ideen kommen über `src/lib/dataSource.ts`. Diese Schicht entscheidet an EINER
Stelle, woher sie stammen; die Seiten kennen nur noch die Ansichtsform
(`Idea` aus `lib/data.ts`) und erfahren nie, ob sie aus dem Repository oder aus
dem Backend kommt. Der Store bezieht sie über `dataSource`, nicht mehr direkt
aus `lib/data.ts`.

| Zustand | Verhalten |
| --- | --- |
| `VITE_API_BASE_URL` **nicht gesetzt** | Beispieldaten aus `lib/data.ts`. **Kein Netzaufruf**, kein Hinweis. Das ist der Standard – und damit das Verhalten der öffentlichen Seite (GitHub Pages), die ohne laufende API ausgeliefert wird. |
| gesetzt, API antwortet | echte Daten aus `GET /api/ideas` |
| gesetzt, Aufruf scheitert | Beispieldaten **und** ein sichtbarer Hinweis mit dem Grund |
| `VITE_IDEAS_SOURCE=sample` | immer Beispieldaten, auch wenn die Basis-URL gesetzt ist (Notaus) |
| `VITE_IDEAS_SOURCE=api` | API wird auch ohne Basis-URL versucht (dann `/api`) |

Vorlage und Erläuterung beider Variablen: `.env.example`. Kopie als `.env.local`.

Der Rückfall ist kein Abbruch: `loadIdeas()` wirft nie. Ein Fehler ist dort ein
Ergebnis (`kind: 'fallback'`) mit einem eingeordneten Grund – `unreachable`
(kein Netz), `server` (HTTP 5xx), `rejected` (HTTP 4xx), `invalid` (Antwort
passt nicht zum Vertrag), `unknown` – und der Originalmeldung im Klartext.

### Warum der Hinweis ein Banner ist – und kein Badge und keine Konsole

* **Keine Konsole.** Die Konsole sieht niemand, der die Seite benutzt. Dass die
  API nicht antwortet, ändert die DATEN, nicht nur die Darstellung: statt der
  echten Ideen stehen Beispieldaten auf der Seite. Ein Fehler, der nur in der
  Konsole steht, ist ein verschwiegener Fehler.
* **Kein Badge.** Ein Badge hat Platz für ein Wort. Gebraucht wird aber der
  Grund – die Meldung der API ist der Teil, mit dem man den Fehler sucht.
* **Banner.** Es trägt beides: die Aussage („Beispieldaten“) und den Grund mit
  der Originalmeldung, ohne die Seite zu blockieren. Die Seite bleibt
  vollständig benutzbar – genau das ist der Zweck des Rückfalls. Es sitzt im
  Layout über dem Seiteninhalt, gilt also für jede Seite und kann von keiner
  Seite vergessen werden, und hat einen Knopf „Erneut versuchen“.

Gezeigt wird **nur** der Rückfall (`kind: 'fallback'`). Ohne gesetzte Variable
sind die Beispieldaten der Normalzustand (`kind: 'sample'`) und brauchen keine
Warnung; mit antwortender API gibt es nichts zu melden. Deshalb erscheint der
Hinweis auf der öffentlichen Seite nicht. Alle Texte stehen in `de.ts`
(`dataSource`), die Gründe als `satisfies Record<FallbackReason, string>` –
kommt ein Grund dazu, bricht der Build ab, solange seine Übersetzung fehlt.

### Die Abbildung der beiden Idea-Formen

Die Beispieldaten und der Vertrag der API sind **verschieden**: flach gegen
verschachtelt, `comments` als Liste gegen eine Anzahl, `author` als Text gegen
eine `authorId`. Die Abbildung steht in `mapApiIdea()` in `lib/dataSource.ts` –
eine Stelle. Verstreut über die Seiten wäre nicht nachvollziehbar, welche Seite
welche Form erwartet.

| Ansichtsform (`Idea`) | API-Form (`ApiIdea`) |
| --- | --- |
| `id`, `title`, `description`, `tags`, `stage` | gleichnamig |
| `author` | `authorId` – der Vertrag kennt keinen Anzeigenamen |
| `time` | `createdAt`, auf den Tag gekürzt (`YYYY-MM-DD`) |
| `votes.up` / `votes.down` | `discussion.votes.up` / `.down` |
| `commentCount` | `discussion.comments` (eine Zahl, keine Liste) |
| `comments` | – (bleibt leer, siehe `commentCount`) |
| `fundingGoal`, `raised`, `investors` | `marketplace.fundingGoal`, `.raised`, `.investors` (Beträge über `satToNumber()`) |
| `closesIn` | `marketplace.closesAt`, auf den Tag gekürzt |
| `problem`, `solution`, `market`, `sharePrice`, `teams` | – (kein Gegenstück im Vertrag, bleiben leer) |

Was der Vertrag nicht hergibt, wird **nicht erfunden**: `author` zeigt die
`authorId` selbst (ehrlicher als ein aus der UUID gebastelter Kunstname), die
Abschnitte Problem/Lösung/Markt bleiben leer, und `teams` ist eine leere Liste –
die Team-Seiten zeigen dann „keine Teams“ statt erfundener. Zwei Stellen in der
Oberfläche zählen Kommentare über `ideaCommentCount()` (Liste oder Zahl), damit
bei Ideen aus der API nicht „0 Kommentare“ steht, obwohl das Backend eine andere
Zahl nennt.

### Was noch in localStorage liegt (Zwischenstand)

Nur die Ideen kommen aus `dataSource`. Die übrigen Zustandsfelder haben noch
keine API-Gegenstelle und bleiben vorerst im `localStorage` des Browsers:

| Schlüssel | Inhalt |
| --- | --- |
| `ideenschmiede_role` | gewählte Rolle (Visitor/User/Subscriber) |
| `ideenschmiede_applications` | eigene Teambewerbungen |
| `ideenschmiede_votes` | eigene Stimmen (Ideen, Meilensteine) |
| `ideenschmiede_allocations` | Verteilung eines Investments auf Teams |
| `ideenschmiede_settings` | Profil- und Benachrichtigungseinstellungen |

Das ist ausdrücklich ein Zwischenstand: diese Daten sind **nicht** die des
angemeldeten Nutzers aus der API. Sie sind lokal, pro Browser und gehen bei
`resetDemo()` (Einstellungen → Demo zurücksetzen) verloren. `GET /api/users/me`
wird von `lib/api.ts` bereits gelesen, aber noch von keiner Seite verwendet.

### Bekannte Abweichung in `lib/api.ts`

`VITE_API_BASE_URL` ist der **Ursprung** (z. B. `http://127.0.0.1:3000`), nicht
der Pfad `/api`. Grund: `apiBaseUrl()` liefert ohne Variable den Standard
`'/api'`, und die Anfragepfade in `listIdeas()`/`getCurrentUser()` beginnen
selbst mit `/api/` – zusammen ergibt das `/api/api/ideas` und damit HTTP 404.
Wer die API einschaltet, setzt deshalb entweder den Ursprung oder `/`
(gleicher Ursprung hinter dem Vite-Proxy bzw. Reverse Proxy). Die Abweichung ist
gemeldet; `api.ts` wurde bewusst nicht verändert.

## Internationalisierung (i18n)

Alle UI-Texte der Kernseiten liegen in `src/lib/i18n/de.ts`.
Neue Sprache = neue Datei mit identischer Struktur (`Dictionary = typeof de`) –
TypeScript erzwingt Vollständigkeit, fehlende Übersetzungen brechen den Build.

## Hinweis

Demo-Modus: Rollen frei wählbar (oben rechts), alle Zahlungen nur simuliert,
Daten persistieren lokal im Browser (localStorage).

## Prüfen

```bash
npm run build   # muss mit Exit 0 enden
npm run lint    # Baseline: 17 vorbestehende Fehler (components/ui/*, Layout, store, TeamDetail)
```

Zum Nachweis, dass die öffentliche Seite ohne API unverändert bleibt, genügt ein
Build **ohne** `VITE_API_BASE_URL`: `initialIdeas()` liefert dann synchron die
Beispieldaten, der Effekt im Store fragt gar nicht erst an, und der Hinweis
bleibt aus (`kind: 'sample'`).
