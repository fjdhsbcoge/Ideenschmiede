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
├── webapp/              # 🆕 v1.2 – React-Plattform (TypeScript + Vite + Tailwind)
│   ├── src/pages/       # Landing, Diskussion, Marktplatz, Teams, Dashboard …
│   ├── src/lib/i18n/    # de.ts – zentrale Sprachdatei (i18n-ready)
│   └── src/lib/         # Store (Rollen, Bewerbungen, Votes), Beispieldaten
│
├── prototypes/          # UI prototypes and mockups
│   ├── ideenschmiede-demo.html    # v0.1 - Basic flow demo
│   ├── ideenschmiede-v2.html      # v0.2 - Stage visualization + profile
│   └── process-visualization.html # Interactive process view
│
├── docs/                # GitHub Pages deployment
│   ├── index.html       # Main demo (v0.1)
│   ├── v2.html          # v0.2 demo
│   ├── process.html     # Process visualization
│   └── stages.html      # Stage browser
│
├── specs/               # Specification documents
│   └── SPECIFICATION.md # Living spec (v0.3.0)
│
├── VISION.md            # Ideal version - core principles & decisions
├── BUILD.md             # Building manual - step-by-step implementation
├── ARCHITECTURE.md      # Technical architecture - stack, data models, APIs
├── README.md            # This file
└── AGENTS.md            # Workspace conventions for AI agents
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

**Ältere HTML-Demos (v0.4):** [https://fjdhsbcoge.github.io/Ideenschmiede/v0.4/](https://fjdhsbcoge.github.io/Ideenschmiede/v0.4/)

*Interactive demo with role system, marketplace paywall, team creation, and wallet integration.*

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
- [ ] v0.3 prototype - Team formation flow
- [ ] Living specification document
- [ ] Technical architecture

### Planned 📋
- [ ] Real comment system
- [ ] Investment portfolio tracking
- [ ] Revenue reporting UI
- [ ] Chain-of-thought scoring
- [ ] RGB Protocol integration (Phase 2)

---

## 📖 Key Documents

| Document | Purpose |
|----------|---------|
| [VISION.md](VISION.md) | Ideal version - core principles, user flows, decisions |
| [BUILD.md](BUILD.md) | Building manual - step-by-step implementation guide |
| [AGENTS.md](AGENTS.md) | Workspace conventions for AI agents |

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

- **Live Demo:** https://fjdhsbcoge.github.io/Ideenschmiede
- **Process View:** https://fjdhsbcoge.github.io/Ideenschmiede/process.html
- **v0.2 Demo:** https://fjdhsbcoge.github.io/Ideenschmiede/v2.html

---

## 📜 License

To be determined by project owner.

---

*Authored by Kimi Claw (AI Assistant) in collaboration with @senator-thunfisch*

> "Don't worry. Even if the world forgets, I'll remember for you."
