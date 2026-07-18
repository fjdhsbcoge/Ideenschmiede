# Ideenschmiede

**The Marketplace for Ideas**

*Die Wertschöpfungskette von der Idee zum Produkt – neu gedacht.*

## 🔴 Live-Demo

[![Live-Demo](https://img.shields.io/badge/Live--Demo-online-54763a?style=for-the-badge&logo=githubpages&logoColor=white)](https://fjdhsbcoge.github.io/Ideenschmiede/)

**https://fjdhsbcoge.github.io/Ideenschmiede/**

Diese Seite wird bei jedem Push auf `master` (Änderungen an `webapp/**`) automatisch
per GitHub Actions neu gebaut und deployed – sie zeigt **immer die aktuellste Version**.

---

## 📝 Über dieses Repository

Dieses Repository enthält die Entwicklung der **Ideenschmiede**, einem Marktplatz für Ideen.

**Wichtiger Transparenz-Hinweis:**
- Dieses Repository wurde von **Kimi Claw**, einem KI-Assistenten, erstellt und wird von ihm gepflegt
- Alle Commits mit dem Autor „Kimi Claw" stammen von einer KI, nicht von einem Menschen
- Der menschliche Kollaborateur ist @senator-thunfisch (Projektinhaber)
- Dies ist ein KI-Mensch-Kollaborationsprojekt

---

## 🎯 Was ist die Ideenschmiede?

Die Ideenschmiede ist eine Plattform, auf der:
- **Ideengeber** Ideen veröffentlichen und an ihrem Erfolg verdienen
- **Investoren** von der Community validierte Ideen entdecken und finanzieren
- **Macher** Teams bilden und Ideen zum Leben erwecken

### Kernprinzipien
- **Non-custodial** – die Plattform hält niemals Nutzergelder
- **Eigene Bitcoin-Infrastruktur der Nutzer** – Wallets verbinden, direkt zahlen
- **20/80-Umsatzteilung** – 20 % an Ideengeber, 80 % an Macher
- **Community-Validierung** – 1 Person = 1 Stimme
- **Parallele Teams** – mehrere Teams dürfen dieselbe Idee bauen
- **Vertrauen durch Transparenz** – soziale Verträge + Reputation statt Durchsetzung

---

## 🤖 KI-Mensch-Zusammenarbeit

Dieses Projekt folgt einem **KI-first-Spezifikationsansatz**:
1. Die KI (Kimi Claw) erstellt Prototypen und Spezifikationen
2. Der Mensch prüft und gibt Feedback
3. Die KI verfeinert auf Basis des Feedbacks
4. Künftige KI-Agenten können diese Spezifikationen zur Umsetzung nutzen

---

## 📁 Repository-Struktur

```
├── webapp/              # ⭐ Aktive Plattform v1.2 (React + TypeScript + Vite + Tailwind)
│   ├── src/pages/       # Landing, Diskussion, Marktplatz, Teams, Dashboard …
│   ├── src/lib/i18n/    # de.ts – zentrale Sprachdatei (i18n-ready)
│   └── src/lib/         # Store (Rollen, Bewerbungen, Votes), Beispieldaten
│
├── docs/                # GitHub Pages (Einstieg) + Whitepaper
│   ├── index.html       # Weiterleitung zur aktuellen Demo
│   └── Ideenschmiede_Whitepaper.pdf
│
├── archive/             # Historie – nichts gelöscht, nur sortiert
│   ├── legacy-demos/    # Statische HTML-Demos v0.3–v0.5
│   ├── prototypes/      # Frühe UI-Prototypen v0.1–v0.5
│   ├── memory/          # Entwicklungs-Log (2026-03-12)
│   ├── v0.2/            # v0.2 Demo
│   └── INVESTMENT-SCENARIOS.md
│
├── VISION.md            # Idealvorstellung – Kernprinzipien & Entscheidungen
├── BUILD.md             # Bauanleitung – Schritt-für-Schritt-Umsetzung
├── ARCHITECTURE.md      # Technische Architektur – Stack, Datenmodelle, APIs
└── README.md            # Diese Datei
```

---

## 🚀 Live-Demo

**🆕 Plattform v1.2 (React):** Vollständige interaktive Plattform-Demo – siehe [`webapp/`](webapp/). Lokal starten:

```bash
cd webapp
npm install
npm run dev      # Entwicklung
npm run build    # Produktions-Build → dist/
```

**Highlights der v1.2:**
- 💡 Ideen-Diskussion mit Chain-of-Thought-Rewards & Create-Idea-Wizard
- 🛒 Marktplatz mit Paywall, echtem Voting und **Investor Team Selection** (80 %-Pool per Slider auf Teams verteilen, non-refundable)
- 👥 Team-Detailseiten: Meilensteine mit Deliverables, monatliche Revenue-Reports, Shareholder, eingehende Bewerbungen (Leader-Ansicht)
- 📨 Bewerbungs-System mit Status-Tracking (localStorage-persistiert)
- 🗳️ Milestone-Voting & Marktplatz-Voting („1 Person = 1 Stimme")
- 🗣️ i18n-Infrastruktur (`de.ts`) – neue Sprachen per Datei, typsicher
- 🌐 Landing-Sektionen „Dein Abo ist dein Stimmrecht" (Subscription statt KYC) & „Tausend Schmieden statt einer Plattform" (Föderation)

**Automatisches Deployment:** Ein GitHub-Actions-Workflow (`.github/workflows/deploy.yml`) baut die webapp bei jedem Push und deployed sie auf GitHub Pages.

**Ältere HTML-Demos:** Ins Archiv umgezogen → [`archive/legacy-demos/`](archive/legacy-demos/).

---

## 📊 Projektstatus

### Abgeschlossen ✅
- [x] Vision-Dokument (VISION.md)
- [x] Bauanleitung (BUILD.md)
- [x] Architektur-Dokumentation (ARCHITECTURE.md)
- [x] Interaktive HTML-Demos v0.1–v0.5 (Archiv)
- [x] 3-stufiges Rollensystem (Visitor/User/Subscriber)
- [x] **v1.2 React-Plattform** (TypeScript + Vite + Tailwind, siehe `webapp/`)
  - Landing mit Föderations- & Subscription-Sektionen
  - Team-Detailseiten mit Revenue-Reports & Milestone-Voting
  - Bewerbungs-System (Bewerber- & Leader-Ansicht)
  - Investor Team Selection (80 %-Pool-Verteilung)
  - i18n-Infrastruktur (de.ts, typsicher erweiterbar)
- [x] GitHub-Actions-Workflow: Build & Deploy der webapp auf Pages

### In Arbeit 🚧
- [ ] i18n-Migration der restlichen Seiten (Dashboard, Profil, Teams) auf de.ts
- [ ] Settings-Seite (Profil, Wallet/xpub, Benachrichtigungen)

### Geplant 📋
- [ ] Backend (Auth, Datenbank, echte Persistenz) – MVP-Phase 2
- [ ] BTCPay-Server-Anbindung (Bitcoin-Subscription, non-custodial)
- [ ] Föderations-Protokoll (Instanzen, portable Reputation, signierte Attestierungen)
- [ ] RGB-Protokoll-Integration (Phase 2)

---

## 📖 Zentrale Dokumente

| Dokument | Zweck |
|----------|-------|
| [VISION.md](VISION.md) | Idealvorstellung – Kernprinzipien, Nutzerflüsse, Entscheidungen |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technische Architektur – Stack, Datenmodelle, APIs |
| [BUILD.md](BUILD.md) | Bauanleitung – Schritt-für-Schritt-Umsetzung |
| [webapp/README.md](webapp/README.md) | Plattform v1.2 – Setup, Struktur, i18n |
| [Whitepaper (PDF)](docs/Ideenschmiede_Whitepaper.pdf) | Konzept-Paper |

---

## 🏗️ Die 6 Stufen einer Idee

```
1. Diskussion    → Idee posten, Feedback sammeln (kostenlos)
2. Voting        → Community validiert (8 Tage)
3. Idea-Shares   → Verkauf mit fixem Angebot (14 Tage)
4. Teams         → Macher bewerben sich, Investoren wählen
5. Building      → Meilenstein-basierte Entwicklung
6. Revenue       → 20/80-Verteilung an Shareholder
```

---

## 💰 Geldfluss

### Investitions-Aufteilung
```
100 % Investition
├── 15 % → Ideengeber (sofort)
├──  5 % → frühe Mitdenker
└── 80 % → Team-Budget
```

### Umsatz-Aufteilung
```
100 % Team-Umsatz
├── 20 % → Idea-Share-Halter (alle Teams)
└── 80 % → Team-Share-Halter (dieses Team)
```

---

## 🔗 Links

- **Aktive Plattform:** [`webapp/`](webapp/) (React v1.2 – lokal via `npm run dev`)
- **Pages-Einstieg:** https://fjdhsbcoge.github.io/Ideenschmiede
- **Archiv (alte Demos):** [`archive/legacy-demos/`](archive/legacy-demos/)

---

## 📜 Lizenz

Wird vom Projektinhaber noch festgelegt.

---

*Verfasst von Kimi Claw (KI-Assistent) in Zusammenarbeit mit @senator-thunfisch*

> "Don't worry. Even if the world forgets, I'll remember for you."
