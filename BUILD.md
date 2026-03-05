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

- [x] User profile page
- [ ] Real comment system
- [ ] Team creation flow
- [ ] Investment portfolio view
- [ ] Revenue reporting UI
- [ ] Chain-of-thought scoring display

---

## Profile Page Specification

### Overview
A comprehensive profile page showing all account-related information for the logged-in user.

### URL
`/profile` or accessible via user menu

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Profile                                                        │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  👤 AVATAR       │  USER INFO                                   │
│  [Upload Photo]  │  Username: @solar_max                        │
│                  │  Member Since: 2026-01-15                    │
│                  │  Subscription: Active (expires 2027-01-15)   │
│                  │                                              │
│                  │  [Edit Profile]  [Manage Subscription]       │
│                  │                                              │
├──────────────────┴──────────────────────────────────────────────┤
│                                                                 │
│  📊 OVERVIEW                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ Ideas       │ │ Investments │ │ Teams       │ │ Earnings  │ │
│  │ Posted: 3   │ │ Made: 12    │ │ Leading: 1  │ │ ₿ 0.45    │ │
│  │ In Market: 1│ │ Active: 8   │ │ Member: 2   │ │ This Month│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💡 MY IDEAS                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Dezentrale Energiespeicher-Community    [In Discussion] │   │
│  │ Posted: 2026-02-01  |  Comments: 12  |  Votes: 85%      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ AI-gestützte Sprachlern-App             [In Marketplace]│   │
│  │ Posted: 2026-02-15  |  Raised: ₿ 0.45  |  Investors: 12 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💰 MY INVESTMENTS                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Idea-Shares                                               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ AI-gestützte Sprachlern-App                             │   │
│  │ Invested: ₿ 0.10  |  Ownership: 20%  |  Value: ₿ 0.12   │   │
│  │ Status: Active  |  Revenue Share: ₿ 0.03/month          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Team-Shares                                               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ ChatFluent (Team for AI-gestützte Sprachlern-App)       │   │
│  │ Invested: ₿ 0.05  |  Ownership: 25%  |  Value: ₿ 0.08   │   │
│  │ Status: Building  |  Revenue Share: ₿ 0.15/month        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔨 MY TEAMS                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Leading: ChatFluent                                     │   │
│  │ Idea: AI-gestützte Sprachlern-App                       │   │
│  │ Status: Building (Month 2)  |  Revenue: ₿ 0.12/month    │   │
│  │ [View Dashboard]  [Report Revenue]  [Manage Team]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Member: Team SolarGrid                                  │   │
│  │ Idea: Dezentrale Energiespeicher-Community              │   │
│  │ Status: Funded  |  Role: Developer                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📈 EARNINGS HISTORY                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Month        │ Idea-Shares │ Team-Shares │ Total        │   │
│  ├──────────────┼─────────────┼─────────────┼──────────────┤   │
│  │ 2026-03      │ ₿ 0.03      │ ₿ 0.15      │ ₿ 0.18       │   │
│  │ 2026-02      │ ₿ 0.02      │ ₿ 0.10      │ ₿ 0.12       │   │
│  │ 2026-01      │ ₿ 0.01      │ ₿ 0.05      │ ₿ 0.06       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔔 ACTIVITY / NOTIFICATIONS                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Your idea passed voting and entered marketplace       │   │
│  │ • Team ChatFluent reached milestone: Beta Launch        │   │
│  │ • New investment in your idea: ₿ 0.05 from @investor_3  │   │
│  │ • Revenue distribution processed: ₿ 0.18 received       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚙️ SETTINGS                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Connected Wallets]                                     │   │
│  │ • Wallet 1: bc1q...x9k2 (Primary)                       │   │
│  │ • Wallet 2: bc1q...a3m7                                 │   │
│  │ [Add Wallet]                                            │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ [Notification Preferences]                              │   │
│  │ ☑ Email notifications    ☐ SMS notifications            │   │
│  │ ☑ Investment updates     ☑ Revenue alerts               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Structure

```javascript
const userProfile = {
  // Basic Info
  id: "user_123",
  username: "@solar_max",
  displayName: "Solar Max",
  avatar: "https://.../avatar.jpg",
  memberSince: "2026-01-15",
  subscription: {
    active: true,
    expiresAt: "2027-01-15",
    type: "annual" // or "monthly"
  },
  
  // Overview Stats
  stats: {
    ideasPosted: 3,
    ideasInMarketplace: 1,
    investmentsMade: 12,
    activeInvestments: 8,
    teamsLeading: 1,
    teamsMember: 2,
    totalEarnings: 0.45,
    earningsThisMonth: 0.18
  },
  
  // Ideas
  ideas: [
    {
      id: 1,
      title: "Dezentrale Energiespeicher-Community",
      stage: "discussion",
      postedAt: "2026-02-01",
      comments: 12,
      votePercent: 85
    },
    {
      id: 3,
      title: "AI-gestützte Sprachlern-App",
      stage: "marketplace",
      postedAt: "2026-02-15",
      raised: 0.45,
      investors: 12
    }
  ],
  
  // Investments
  investments: {
    ideaShares: [
      {
        ideaId: 3,
        ideaTitle: "AI-gestützte Sprachlern-App",
        invested: 0.10,
        ownership: 20,
        currentValue: 0.12,
        status: "active",
        monthlyRevenue: 0.03
      }
    ],
    teamShares: [
      {
        teamId: 1,
        teamName: "ChatFluent",
        ideaTitle: "AI-gestützte Sprachlern-App",
        invested: 0.05,
        ownership: 25,
        currentValue: 0.08,
        status: "building",
        monthlyRevenue: 0.15
      }
    ]
  },
  
  // Teams
  teams: {
    leading: [
      {
        id: 1,
        name: "ChatFluent",
        ideaId: 3,
        ideaTitle: "AI-gestützte Sprachlern-App",
        status: "building",
        month: 2,
        monthlyRevenue: 0.12
      }
    ],
    member: [
      {
        id: 2,
        name: "Team SolarGrid",
        ideaId: 1,
        ideaTitle: "Dezentrale Energiespeicher-Community",
        status: "funded",
        role: "Developer"
      }
    ]
  },
  
  // Earnings History
  earnings: [
    { month: "2026-03", ideaShares: 0.03, teamShares: 0.15, total: 0.18 },
    { month: "2026-02", ideaShares: 0.02, teamShares: 0.10, total: 0.12 },
    { month: "2026-01", ideaShares: 0.01, teamShares: 0.05, total: 0.06 }
  ],
  
  // Activity
  activity: [
    {
      type: "idea_approved",
      message: "Your idea passed voting and entered marketplace",
      timestamp: "2026-03-05T10:30:00Z",
      read: false
    },
    {
      type: "milestone_reached",
      message: "Team ChatFluent reached milestone: Beta Launch",
      timestamp: "2026-03-04T14:20:00Z",
      read: true
    },
    {
      type: "new_investment",
      message: "New investment in your idea: ₿ 0.05 from @investor_3",
      timestamp: "2026-03-03T09:15:00Z",
      read: true
    },
    {
      type: "revenue_distribution",
      message: "Revenue distribution processed: ₿ 0.18 received",
      timestamp: "2026-03-01T00:00:00Z",
      read: true
    }
  ],
  
  // Settings
  wallets: [
    { address: "bc1q...x9k2", primary: true, label: "Main Wallet" },
    { address: "bc1q...a3m7", primary: false, label: "Secondary" }
  ],
  notifications: {
    email: true,
    sms: false,
    investmentUpdates: true,
    revenueAlerts: true,
    milestoneUpdates: true,
    teamActivity: true
  }
};
```

### Components

#### 1. Profile Header
- Avatar upload
- Username display
- Member since date
- Subscription status
- Edit profile button

#### 2. Stats Overview
- 4-card grid showing key metrics
- Click cards to jump to sections

#### 3. My Ideas Section
- List of all ideas posted
- Stage badges (Discussion, Voting, Marketplace, etc.)
- Quick stats for each

#### 4. My Investments Section
- Separate tabs for Idea-Shares and Team-Shares
- Investment amount, ownership %, current value
- Monthly revenue from each

#### 5. My Teams Section
- Teams user is leading
- Teams user is member of
- Status and quick actions

#### 6. Earnings History
- Monthly breakdown table
- Chart visualization (optional)
- Export to CSV

#### 7. Activity Feed
- Recent notifications
- Mark as read/unread
- Filter by type

#### 8. Settings
- Connected wallets
- Notification preferences
- Privacy settings

### Navigation Integration

Add to main navigation:
```
[Home] [Discussion] [Marketplace] [Profile] [Logout]
```

Or user dropdown:
```
👤 @solar_max ▼
├── Profile
├── My Ideas
├── My Investments
├── Settings
└── Logout
```

### Implementation Notes

1. **Data Fetching:** Load profile data on page load, refresh sections independently
2. **Real-time Updates:** WebSocket or polling for activity/notifications
3. **Responsive:** Stack sections on mobile, sidebar layout on desktop
4. **Empty States:** Show helpful messages when no data ("Post your first idea!")
5. **Loading States:** Skeleton loaders while fetching data

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
