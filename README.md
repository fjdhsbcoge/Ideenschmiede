# Ideenschmiede

**The Marketplace for Ideas**

*The idea-to-product value chain, rethought*

---

## 📝 About This Repository

This repository contains the development of **Ideenschmiede**, a marketplace for ideas.

**Important Transparency Notice:**
- This repository was created and is maintained by **Kimi Claw**, an AI assistant
- All commits marked with "Kimi Claw" are authored by an AI, not a human
- The human collaborator is @senator-thunfisch (project owner)
- This is an AI-human collaborative project

---

## 🎯 What is Ideenschmiede?

Ideenschmiede is a platform where:
- **Ideators** post ideas and earn from their success
- **Investors** discover and fund validated ideas
- **Builders** form teams and bring ideas to life

### Core Principles
- **Non-custodial** - Platform never holds user funds
- **Users run their own Bitcoin infrastructure** - Connect wallets, pay directly
- **20/80 Revenue Split** - 20% to idea-owners, 80% to builders
- **Community Validation** - One person, one vote
- **Parallel Teams** - Multiple teams can build the same idea
- **Trust through transparency** - Social contracts + reputation, not enforcement

---

## 🤖 AI-Human Collaboration

This project follows an **AI-first specification approach**:
1. AI (Kimi Claw) creates prototypes and specifications
2. Human reviews and provides feedback
3. AI refines based on feedback
4. Future AI agents can use these specifications to implement

---

## 📁 Repository Structure

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
├── VISION.md            # Ideal version - core principles & decisions
├── BUILD.md             # Building manual - step-by-step implementation
├── ARCHITECTURE.md      # Technical architecture - stack, data models, APIs
└── README.md            # This file
```

---

## 🚀 Live Demo

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

**Ältere HTML-Demos:** Ins Archiv umgezogen → [`archive/legacy-demos/`](archive/legacy-demos/). Die GitHub-Pages-URL zeigt jetzt eine Weiterleitungsseite zur aktuellen Plattform.

---

## 📊 Project Status

### Completed ✅
- [x] Vision document (VISION.md)
- [x] Build manual (BUILD.md)
- [x] Architecture documentation (ARCHITECTURE.md)
- [x] v0.4 Interactive Demo with role system
  - Landing page (DE/EN)
  - Discussion with role-based access
  - Marketplace with subscriber paywall
  - Team creation and application
  - Dashboard with role switcher
  - Profile with wallet display
- [x] 3-Tier Role System (Visitor/User/Subscriber)
- [x] Team creation flow (team-create.html)
- [x] **v1.2 React-Plattform** (TypeScript + Vite + Tailwind, siehe `webapp/`)
  - Landing mit Föderations- & Subscription-Sektionen
  - Team-Detailseiten mit Revenue-Reports & Milestone-Voting
  - Bewerbungs-System (Bewerber- & Leader-Ansicht)
  - Investor Team Selection (80 %-Pool-Verteilung)
  - i18n-Infrastruktur (de.ts, typsicher erweiterbar)

### In Progress 🚧
- [ ] i18n-Migration der restlichen Seiten (Dashboard, Profil, Teams) auf de.ts
- [ ] GitHub-Actions-Workflow: Build & Deploy der webapp auf Pages
- [ ] Settings-Seite (Profil, Wallet/xpub, Benachrichtigungen)

### Planned 📋
- [ ] Backend (Auth, Datenbank, echte Persistenz) – MVP-Phase 2
- [ ] BTCPay-Server-Anbindung (Bitcoin-Subscription, non-custodial)
- [ ] Föderations-Protokoll (Instanzen, portable Reputation, signierte Attestierungen)
- [ ] RGB Protocol integration (Phase 2)

---

## 📖 Key Documents

| Document | Purpose |
|----------|---------|
| [VISION.md](VISION.md) | Ideal version - core principles, user flows, decisions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical architecture - stack, data models, APIs |
| [BUILD.md](BUILD.md) | Building manual - step-by-step implementation guide |
| [webapp/README.md](webapp/README.md) | Plattform v1.2 - Setup, Struktur, i18n |
| [Whitepaper (PDF)](docs/Ideenschmiede_Whitepaper.pdf) | Konzept-Paper |

---

## 🏗️ The 6 Stages of an Idea

```
1. Discussion    → Post idea, gather feedback (free)
2. Voting        → Community validates (8 days)
3. Idea-Shares   → Fixed supply sale (14 days)
4. Teams         → Builders apply, investors choose
5. Building      → Milestone-based development
6. Revenue       → 20/80 split to shareholders
```

---

## 💰 Revenue Flow

### Investment Split
```
100% Investment
├── 15% → Ideator (immediate)
├── 5%  → Early contributors
└── 80% → Team building pool
```

### Revenue Split
```
100% Team Revenue
├── 20% → Idea-Share holders (all teams)
└── 80% → Team-Share holders (specific team)
```

---

## 🔗 Links

- **Aktive Plattform:** [`webapp/`](webapp/) (React v1.2 – lokal via `npm run dev`)
- **Pages-Einstieg:** https://fjdhsbcoge.github.io/Ideenschmiede
- **Archiv (alte Demos):** [`archive/legacy-demos/`](archive/legacy-demos/)

---

## 📜 License

To be determined by project owner.

---

*Authored by Kimi Claw (AI Assistant) in collaboration with @senator-thunfisch*

> "Don't worry. Even if the world forgets, I'll remember for you."
