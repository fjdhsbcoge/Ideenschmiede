# Ideenschmiede Build Manual

**Purpose:** Step-by-step building instructions for developers. Each version corresponds to a working demo.

**Current Version:** v0.2

---

## Version History

| Version | Date | Status | Demo Link |
|---------|------|--------|-----------|
| v0.1 | 2026-03-04 | Complete | https://fjdhsbcoge.github.io/Ideenschmiede |
| v0.2 | 2026-03-05 | In Progress | https://fjdhsbcoge.github.io/Ideenschmiede |

---

## Process Visualization

**Live Interactive Version:** https://fjdhsbcoge.github.io/Ideenschmiede/process.html

### Three Perspectives

The platform has three user types, each with their own journey:

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 IDEATOR          💰 INVESTOR           🔨 BUILDER           │
│                                                                 │
│  1. Post Idea        1. Browse Ideas       1. Browse Ideas      │
│  2. Gather Feedback  2. Vote               2. Apply as Team     │
│  3. Move to Market   3. Buy Idea-Shares    3. Get Funded        │
│  4. Earn 15% cut     4. Fund Teams         4. Build             │
│  5. Earn from shares 5. Earn Returns       5. Profit            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Idea Lifecycle Stages

An idea progresses through distinct stages. Here's one example for each stage:

### Stage 1: Discussion (Free to Browse)

**Example:** "Dezentrale Energiespeicher-Community"

```
┌────────────────────────────────────────┐
│ 💬 In Discussion                       │
│                                        │
│ A community-owned network of home      │
│ battery systems that trade energy...   │
│                                        │
│ 👤 @solar_max    💬 12    👍 85%       │
│                                        │
│ [View Details]                         │
└────────────────────────────────────────┘
```

**Who can interact:**
| Action | Anonymous | Free User | Member |
|--------|-----------|-----------|--------|
| Browse | ✅ | ✅ | ✅ |
| Comment | ❌ | ✅ | ✅ |
| Vote | ❌ | ✅ | ✅ |
| Post Idea | ❌ | ✅ | ✅ |

**Requirements to post:** Subscription ($120/year)

---

### Stage 2: Voting (8 Days)

**Example:** "Open-Source Medikamenten-Datenbank"

```
┌────────────────────────────────────────┐
│ 🗳️ Voting (Day 3 of 8)                │
│                                        │
│ A crowdsourced database of drug        │
│ interactions and side effects...       │
│                                        │
│ 👍 78%    👎 12%    🗳️ 156 votes      │
│                                        │
│ [Vote Up]  [Vote Down]                 │
│                                        │
│ ⏰ Needs >25% upvotes to pass          │
└────────────────────────────────────────┘
```

**Rules:**
- Duration: 8 days
- Pass threshold: >25% upvotes
- One person, one vote (subscription required)
- If passes → unlocks Marketplace

---

### Stage 3: Marketplace - Idea-Shares (14 Days)

**Example:** "AI-gestützte Sprachlern-App"

```
┌────────────────────────────────────────┐
│ 🛒 Marketplace - Idea-Shares           │
│                                        │
│ Learn languages through AI conversations│
│ with native speakers...                │
│                                        │
│ 💰 Funding: ₿ 0.45 of ₿ 1.00 goal      │
│ 📊 Share Price: 0.00005 BTC/share      │
│ 👥 12 Investors                        │
│ ⏰ 6 days remaining                    │
│                                        │
│ [Buy Shares]  [View Teams]             │
└────────────────────────────────────────┘
```

**Share Pricing:**
```
Your % = Your Investment / Total Investment

Example:
- You invest: ₿ 0.10
- Total raised: ₿ 0.50
- Your ownership: 20% of Idea-Shares
```

**Investment Split:**
```
100% of your investment
├── 15% → Ideator (immediate)
├── 5%  → Early Contributors
└── 80% → Team Building Pool
```

---

### Stage 4: Marketplace - Team Applications (Simultaneous)

**Example:** Same idea, now with team proposals

```
┌────────────────────────────────────────┐
│ 👥 Team Proposals (2)                  │
│                                        │
│ ┌────────────────────────────────┐     │
│ │ Team: ChatFluent               │     │
│ │ Focus: European languages      │     │
│ │ Goal: ₿ 0.30                   │     │
│ │ Skin: ₿ 0.05 invested          │     │
│ │ [View Proposal]                │     │
│ └────────────────────────────────┘     │
│                                        │
│ ┌────────────────────────────────┐     │
│ │ Team: LingoAI                  │     │
│ │ Focus: Asian languages         │     │
│ │ Goal: ₿ 0.20                   │     │
│ │ Skin: ₿ 0.03 invested          │     │
│ │ [View Proposal]                │     │
│ └────────────────────────────────┘     │
│                                        │
│ ⏰ Applications close in 6 days        │
└────────────────────────────────────────┘
```

**Team Application Requirements:**
- Skin-in-game investment (required)
- Roadmap with milestones
- Budget breakdown
- Focus area
- Minimum funding goal

---

### Stage 5: Active - Team Funded & Building

**Example:** "AI-gestützte Sprachlern-App" - Team ChatFluent funded

```
┌────────────────────────────────────────┐
│ 🔨 Active Development                  │
│                                        │
│ Team: ChatFluent                       │
│ Status: Building (Month 2 of 6)        │
│                                        │
│ 📊 Milestones:                         │
│   ✅ MVP Complete                      │
│   ✅ Beta Launch                       │
│   🔄 App Store Submission (in review)  │
│   ⏳ Public Launch                     │
│                                        │
│ 💰 Revenue: ₿ 0.12 (last month)        │
│ 📈 Growth: +34% users                  │
│                                        │
│ [View Dashboard]  [Buy Team-Shares]    │
└────────────────────────────────────────┘
```

**Funded Team Mechanics:**
- Funds released by milestone completion
- Investor voting on progress
- Revenue reporting monthly
- Team-Shares available for purchase

---

### Stage 6: Revenue Distribution

**Example:** Same idea generating profit

```
┌────────────────────────────────────────┐
│ 💰 Revenue Distribution                │
│                                        │
│ Total Revenue: ₿ 10.00                 │
│                                        │
┌────────────────────────────────────────┐
│ Idea-Share Pool (20%): ₿ 2.00          │
│ ├── Investor A (40%): ₿ 0.80           │
│ ├── Investor B (35%): ₿ 0.70           │
│ └── Investor C (25%): ₿ 0.50           │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ Team-Share Pool (80%): ₿ 8.00          │
│ ├── Team Lead (50%): ₿ 4.00            │
│ ├── Investor A (30%): ₿ 2.40           │
│ └── Investor B (20%): ₿ 1.60           │
└────────────────────────────────────────┘
│                                        │
│ Last distribution: 2026-03-01          │
└────────────────────────────────────────┘
```

**Revenue Split:**
```
100% Team Revenue
├── 20% → Idea-Share holders (all investors in idea)
└── 80% → Team-Share holders (investors in this team)
```

---

## v0.2 - Stage Visualization Demo

### Goal
Show all 6 stages of the idea lifecycle with clear examples and interactive elements.

### Features to Implement

#### 1. Stage Browser
**Requirements:**
- Horizontal stage selector (1-6)
- Click stage to see example
- Visual indicator of current stage

**UI:**
```
[1.Discussion] → [2.Voting] → [3.Idea-Shares] → [4.Teams] → [5.Building] → [6.Revenue]
     🔘            ⚪            ⚪              ⚪          ⚪            ⚪
```

#### 2. Example Cards
**Requirements:**
- One detailed example per stage
- Realistic data (Bitcoin amounts, timelines)
- Show all relevant UI elements

#### 3. Perspective Toggle
**Requirements:**
- Three buttons: Ideator / Investor / Builder
- Changes which actions are highlighted
- Shows relevant CTAs for each perspective

#### 4. Interactive Elements
**Requirements:**
- Click "Buy Shares" → shows investment modal
- Click "View Proposal" → shows team details
- Click milestone → shows voting UI

### Data Structure

```javascript
const exampleIdeas = [
  {
    id: 1,
    title: "Dezentrale Energiespeicher-Community",
    stage: "discussion",
    author: "@solar_max",
    description: "A community-owned network of home battery systems...",
    stats: { comments: 12, votes: { up: 85, down: 15 } }
  },
  {
    id: 2,
    title: "Open-Source Medikamenten-Datenbank",
    stage: "voting",
    author: "@med_hacker",
    voting: { daysLeft: 5, upPercent: 78, totalVotes: 156 }
  },
  {
    id: 3,
    title: "AI-gestützte Sprachlern-App",
    stage: "marketplace_ideas",
    funding: { raised: 0.45, goal: 1.0, investors: 12 },
    sharePrice: 0.00005,
    daysLeft: 6
  },
  {
    id: 4,
    title: "AI-gestützte Sprachlern-App",
    stage: "marketplace_teams",
    teams: [
      { name: "ChatFluent", focus: "European", goal: 0.30, skin: 0.05 },
      { name: "LingoAI", focus: "Asian", goal: 0.20, skin: 0.03 }
    ]
  },
  {
    id: 5,
    title: "AI-gestützte Sprachlern-App",
    stage: "building",
    team: { name: "ChatFluent", month: 2, totalMonths: 6 },
    milestones: [
      { name: "MVP Complete", status: "done" },
      { name: "Beta Launch", status: "done" },
      { name: "App Store", status: "in_review" },
      { name: "Public Launch", status: "pending" }
    ],
    revenue: { total: 0.12, growth: 34 }
  },
  {
    id: 6,
    title: "AI-gestützte Sprachlern-App",
    stage: "revenue",
    totalRevenue: 10.0,
    ideaShareHolders: [
      { name: "Investor A", percent: 40, amount: 0.80 },
      { name: "Investor B", percent: 35, amount: 0.70 },
      { name: "Investor C", percent: 25, amount: 0.50 }
    ],
    teamShareHolders: [
      { name: "Team Lead", percent: 50, amount: 4.00 },
      { name: "Investor A", percent: 30, amount: 2.40 },
      { name: "Investor B", percent: 20, amount: 1.60 }
    ]
  }
];
```

### File Structure

```
prototypes/
├── ideenschmiede-demo.html      # v0.1 demo
├── ideenschmiede-v2.html        # v0.2 demo (this version)
└── process-visualization.html   # Interactive process view

docs/
├── index.html                   # GitHub Pages (v0.1)
├── process.html                 # Process visualization
└── stages.html                  # Stage browser (v0.2)
```

### Implementation Steps

1. **Create base HTML** with stage selector
2. **Add example data** for all 6 stages
3. **Implement perspective toggle** (Ideator/Investor/Builder)
4. **Create stage cards** with realistic examples
5. **Add interactive modals** (invest, vote, view proposal)
6. **Style consistently** with v0.1 design system
7. **Deploy** to GitHub Pages

### Next Version (v0.3) Ideas

- [ ] Real comment system
- [ ] Team creation flow
- [ ] User profile page
- [ ] Investment portfolio view
- [ ] Revenue reporting UI
- [ ] Chain-of-thought scoring display

---

## Deployment

**GitHub Pages:**
```bash
# Copy v0.2 demo to docs folder
cp prototypes/ideenschmiede-v2.html docs/stages.html

# Commit and push
git add prototypes/ docs/
git commit -m "Add v0.2 stage visualization demo"
git push origin master
```

**Live URLs:**
- v0.1 Demo: https://fjdhsbcoge.github.io/Ideenschmiede
- Process View: https://fjdhsbcoge.github.io/Ideenschmiede/process.html
- Stage Browser: https://fjdhsbcoge.github.io/Ideenschmiede/stages.html

---

## Questions?

See VISION.md for why these decisions were made.

---

*Authored by Kimi Claw (AI Assistant)*
