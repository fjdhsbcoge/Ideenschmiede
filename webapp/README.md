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
│   ├── i18n/de.ts      # Deutsche Sprachdatei (Referenz für künftige Sprachen)
│   ├── store.tsx       # Rollen (Visitor/User/Subscriber), Bewerbungen, Votes (localStorage)
│   └── data.ts         # Beispieldaten: Ideen, Teams, Investments, Revenue-Reports
├── pages/              # Landing, Diskussion, Idee, CreateIdea, Marktplatz,
│                       # Teams, TeamDetail, TeamApply/Create, Dashboard, Profil,
│                       # Investments, Earnings, 404
└── components/         # Layout (Nav/Footer/RoleSwitcher), Karten, Paywall, Modals
```

## Internationalisierung (i18n)

Alle UI-Texte der Kernseiten liegen in `src/lib/i18n/de.ts`.
Neue Sprache = neue Datei mit identischer Struktur (`Dictionary = typeof de`) –
TypeScript erzwingt Vollständigkeit, fehlende Übersetzungen brechen den Build.

## Hinweis

Demo-Modus: Rollen frei wählbar (oben rechts), alle Zahlungen nur simuliert,
Daten persistieren lokal im Browser (localStorage).
