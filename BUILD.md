# Ideenschmiede – Bauanleitung (BUILD)

**Stand: v1.2 · Gilt für die React-Plattform in [`webapp/`](webapp/)**

> Die historische Bauanleitung für die statischen HTML-Demos (v0.1–v0.5) ist
> zusammen mit den Demos ins Archiv umgezogen: [`archive/legacy-demos/`](archive/legacy-demos/).

---

## 1. Voraussetzungen

| Werkzeug | Version | Zweck |
|---|---|---|
| Node.js | ≥ 20 | Laufzeit & Build |
| npm | ≥ 10 | Paketverwaltung (Lockfile liegt bei) |
| Git | ≥ 2.4 | Versionskontrolle |

Keine weiteren Services nötig: Die Plattform ist aktuell eine reine Frontend-App
ohne Backend, ohne Datenbank, ohne Build-Secrets.

---

## 2. Schnellstart

```bash
git clone https://github.com/fjdhsbcoge/Ideenschmiede.git
cd Ideenschmiede/webapp
npm install        # einmalig
npm run dev        # Entwicklungsserver (Vite, Hot Reload)
npm run build      # Produktions-Build → dist/
```

Der Build besteht aus zwei Stufen: `tsc -b` (TypeScript-Prüfung, strikt) und
`vite build` (Bundling). **Ein Commit sollte nie gepusht werden, wenn
`npm run build` lokal fehlschlägt** – derselbe Befehl läuft in der CI.

---

## 3. Projektstruktur

```
webapp/
├── index.html               # Einstieg (de, Meta-Tags)
├── vite.config.ts           # base: './' (relative Pfade → jeder Unterpfad funktioniert)
├── src/
│   ├── main.tsx             # HashRouter + App
│   ├── App.tsx              # Routen + Provider (Language → Store → Router)
│   ├── index.css            # Design-System (Tokens, Buttons, Cards, Badges …)
│   ├── lib/
│   │   ├── i18n/
│   │   │   ├── index.tsx    # LanguageProvider + useT()-Hook
│   │   │   └── de.ts        # Deutsche Sprachdatei (Referenz-Struktur)
│   │   ├── store.tsx        # Rollen, Bewerbungen, Votes, Toasts (localStorage)
│   │   └── data.ts          # Beispieldaten: Ideen, Teams, Investments, Reports
│   ├── components/
│   │   ├── Layout.tsx       # Navigation, Footer, RoleSwitcher
│   │   └── bits.tsx         # Karten, Paywall, Modals, SplitBar, StatCards
│   └── pages/               # Eine Datei pro Route (siehe §4)
└── .github/workflows/       # (im Repo-Root) Deploy nach GitHub Pages
```

---

## 4. Routen & Seiten

Alle Routen leben in `src/App.tsx`. Die App nutzt **HashRouter**
(`#/diskussion` statt `/diskussion`) – damit funktionieren Deep Links auf
GitHub Pages ohne Server-Rewrites.

| Route | Datei | Zweck |
|---|---|---|
| `/` | `pages/Landing.tsx` | Landing Page (vollständig i18n) |
| `/discussion` | `pages/Discussion.tsx` | Ideen-Diskussion, Filter, Voting |
| `/idea/:id` | `pages/IdeaDetail.tsx` | Ideen-Detail + Kommentare |
| `/create-idea` | `pages/CreateIdea.tsx` | 4-Schritte-Wizard |
| `/marketplace` | `pages/Marketplace.tsx` | Paywall, Voting, Investor Team Selection |
| `/teams` | `pages/Teams.tsx` | Team-Übersicht + Bewerbungs-Tab |
| `/team/:id` | `pages/TeamDetail.tsx` | Meilensteine, Reports, Shareholder, Leader-Ansicht |
| `/team-apply`, `/team-create` | `pages/TeamApply.tsx` | Team-Bewerbung/-Gründung (geteiltes Formular) |
| `/dashboard`, `/profile` | `pages/Dashboard.tsx`, `pages/Profile.tsx` | Account-Bereich |
| `/investments`, `/earnings` | `pages/Investments.tsx`, `pages/Earnings.tsx` | Portfolio & Erträge |
| `*` | `pages/NotFound.tsx` | 404 |

**Neue Seite anlegen:**
1. `src/pages/MeineSeite.tsx` erstellen (Export default)
2. Route in `App.tsx` ergänzen
3. Bei Bedarf Nav-Eintrag in `components/Layout.tsx` (Labels kommen aus `de.ts`, siehe §5)

---

## 5. Internationalisierung (i18n) – verbindliche Regel

**Alle UI-Texte** (Buttons, Überschriften, Hinweise, Toasts) gehören in
`src/lib/i18n/de.ts` – niemals hart codiert in Komponenten.

```tsx
import { useT } from '@/lib/i18n';

export default function MeineSeite() {
  const t = useT();
  return <h1>{t.meineSeite.title}</h1>;
}
```

- `Dictionary = typeof de` macht die Struktur typsicher: Eine neue Sprache
  (z. B. `en.ts`) muss **exakt** dieselbe Struktur haben, sonst bricht der Build.
  Fehlende Übersetzungen sind damit ausgeschlossen.
- Neue Sprache anlegen = Datei kopieren, Werte übersetzen, in
  `src/lib/i18n/index.tsx` registrieren.
- **Ausnahme:** Demo-Inhalte in `data.ts` (Ideen-Texte, Team-Namen) sind
  Beispieldaten und bleiben deutsch – sie werden später durch echte
  Nutzer-Inhalte ersetzt, nicht übersetzt.
- **Ist-Stand:** Landing, Layout, Paywall sind migriert. Die übrigen Seiten
  folgen (siehe ROADMAP.md, v1.3).

---

## 6. State & Rollen-System

Zentraler Store: `src/lib/store.tsx` (React Context + localStorage).

```tsx
const { role, setRole, can, toast, applications, votes, allocations } = useStore();
```

| `can(...)` | Visitor | User | Subscriber |
|---|:---:|:---:|:---:|
| `read` | ✅ | ✅ | ✅ |
| `post`, `comment` | ❌ | ✅ | ✅ |
| `vote`, `invest`, `teams`, `marketplace` | ❌ | ❌ | ✅ |

- Demo-Modus: Die Rolle ist oben rechts frei wählbar (kein echtes Login).
- Persistierte Schlüssel: `ideenschmiede_role`, `_applications`, `_votes`,
  `_allocations` – alle in `localStorage`, alle demo-seitig.
- **Guard-Muster für Features:** erst `can()`-Prüfung, sonst `toast()`
  mit Hinweis auf das nötige Rollen-Level (siehe `Teams.tsx`).

---

## 7. Design-System

Alle Tokens und Komponenten-Klassen liegen in `src/index.css`:

- **Farben:** `--accent-primary` `#e94560`, `--accent-orange` `#f39c12`,
  `--accent-green` `#2ecc71`, `--accent-blue` `#3498db`, `--accent-bitcoin` `#f7931a`,
  Hintergrund `#0a0a0f`/`#12121a`/`#1a1a25`
- **Bausteine:** `.is-card`, `.btn-primary/-secondary/-ghost`, `.badge-*`,
  `.is-input/-select/-textarea`, `.progress-track/-fill`, `.is-table`,
  `.modal-*`, `.toast`, `.reveal` (Scroll-Animation via `useReveal()`)
- **Fonts:** Space Grotesk (Display), Inter (Text), JetBrains Mono (BTC-Beträge)

Keine Inline-Farbcodes für neue Akzente – erst Token in `index.css` definieren.

---

## 8. Deployment

**Automatisch (empfohlen):** `.github/workflows/deploy.yml` baut bei jedem
Push auf `master`, der `webapp/**` betrifft, und deployed nach GitHub Pages
(`actions/deploy-pages`). Voraussetzung: Repo-Settings → Pages → Source =
„GitHub Actions".

**Manuell:** `npm run build` und den Inhalt von `dist/` auf einen beliebigen
Static-Host laden. Dank `base: './'` und HashRouter funktioniert die App in
jedem Unterpfad ohne Server-Konfiguration.

---

## 9. Konventionen für Commits

- Autor „Kimi Claw" = KI-generiert (Transparenz-Regel des Repos)
- Commits auf Englisch oder Deutsch, mit aussagekräftigem Body
- Doku-Änderungen lösen kein Deployment aus (Pfad-Filter im Workflow)
- Vor jedem Push: `npm run build` muss lokal grün sein

---

## 10. Häufige Aufgaben

**Neue Beispiel-Idee:** Eintrag in `src/lib/data.ts` → `ideas[]`
(Stages: `discussion | voting | funding | building | completed`).

**Neues Team zu einer Idee:** `teams[]` innerhalb der Idee befüllen –
mit `milestones` (+ `deliverables`), `memberList`, `shareholders`,
`revenueReports`, `updates`, `incomingApplications` (alle optional).

**Texte ändern:** nur in `src/lib/i18n/de.ts`, nie in Komponenten.

**Neue Sprache:** `de.ts` kopieren → übersetzen → in `i18n/index.tsx`
registrieren → `LanguageProvider lang="…"` in `App.tsx`.
