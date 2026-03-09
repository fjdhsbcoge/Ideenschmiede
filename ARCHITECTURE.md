# Ideenschmiede Technical Architecture

**Version:** 2.1  
**Last Updated:** 2026-03-09  
**Status:** v0.4 Interactive Demo Complete

---

## 1. System Overview

### 1.1 Current Implementation Status

**Live Demo:** https://fjdhsbcoge.github.io/Ideenschmiede/v0.4/

**Pages Implemented (v0.4):**
| Page | URL | Access Level | Features |
|------|-----|--------------|----------|
| Landing (DE) | /v0.4/index.html | Public | Scroll animations, card hovers, progress bar |
| Landing (EN) | /v0.4/index-en.html | Public | Full i18n, shimmer effects |
| Discussion | /v0.4/discussion.html | Free | Live voting, filters, sorting |
| Idea Detail | /v0.4/idea-detail.html | Free | Comments, voting, toast notifications |
| Marketplace | /v0.4/marketplace.html | Member | Investment calc, team cards, modals |
| Team Apply | /v0.4/team-apply.html | Member | Dynamic forms, budget validation |
| Teams | /v0.4/teams.html | Member | Tab nav, progress tracking |
| Profile | /v0.4/profile.html | Login | Wallet, earnings, investments |

### 1.2 v0.4 Interactive Features

| Feature | Technology | Implementation |
|---------|------------|----------------|
| Scroll Animations | Intersection Observer API | Fade-in, slide-up on scroll |
| Voting System | JavaScript State | Toggle up/down, real-time stats |
| Investment Calc | DOM Events | Input × price = total (live) |
| Dynamic Forms | JS DOM Manipulation | Add/remove milestones |
| Validation | JS Event Listeners | 5% minimum skin-in-game |
| Notifications | CSS + JS | Toast messages, timed fade |
| Modals | CSS display/flex | Overlay with click-outside close |
| Tab Navigation | JS class toggle | Content switching without reload |

### 1.3 Core Principles

- **Non-custodial** - Platform never holds user funds
- **Users control keys** - Connect own wallets, pay directly
- **Trust through transparency** - Social contracts + reputation
- **WebSocket real-time** - Two-way communication for interactivity
- **i18n ready** - German/English support built-in

### 1.3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │   Landing   │ │ Discussion  │ │ Marketplace │            │
│  │   (i18n)    │ │   (Free)    │ │  (Member)   │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
│         │               │               │                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │    Teams    │ │   Profile   │ │   v3 Demo   │            │
│  │  (Member)   │ │  (Login)    │ │(Team Form)  │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     GitHub Pages                           │
│                 (Static Hosting)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### 2.1 Current Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Markup | HTML5 | - | Semantic structure |
| Styling | CSS3 | - | Custom properties, flexbox, grid |
| Icons | Emoji | Unicode | Native, no dependencies |
| Responsive | CSS Media Queries | - | Mobile-first approach |

### 2.2 Page Structure

**Landing Page (index.html / index-en.html):**
```
┌─────────────────────────────────────┐
│  Language Switcher (fixed)          │
│  Navigation (fixed)                 │
├─────────────────────────────────────┤
│  Hero Section                       │
│  - Large title (gradient text)      │
│  - Tagline + subtitle               │
├─────────────────────────────────────┤
│  "So profitierst du" Section        │
│  - 3 Cards (Ideator/Investor/Builder)│
├─────────────────────────────────────┤
│  Timeline Section                   │
│  - 6 steps with vertical line       │
├─────────────────────────────────────┤
│  CTA Section                        │
│  - 3 options with badges            │
├─────────────────────────────────────┤
│  Footer                             │
└─────────────────────────────────────┘
```

**Subpages (discussion, marketplace, teams, profile):**
```
┌─────────────────────────────────────┐
│  Navigation (fixed, 4 items)        │
├─────────────────────────────────────┤
│  Page Header                        │
│  - Title + subtitle                 │
├─────────────────────────────────────┤
│  Content Area                       │
│  - Cards, lists, stats              │
├─────────────────────────────────────┤
│  (Optional) Tabs for sub-views      │
└─────────────────────────────────────┘
```

### 2.3 CSS Architecture

**Design Tokens (CSS Custom Properties):**
```css
:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-tertiary: #1a1a25;
  --text-primary: #ffffff;
  --text-secondary: #a0a0b0;
  --text-tertiary: #606070;
  --accent-primary: #e94560;
  --accent-green: #2ecc71;
  --accent-blue: #3498db;
  --accent-orange: #f39c12;
  --border-color: rgba(255, 255, 255, 0.1);
}
```

**Responsive Breakpoints:**
- Desktop: > 1024px
- Tablet: 768px - 1024px
- Mobile: < 768px
- Small Mobile: < 375px (iPhone 13 mini)

### 2.4 JavaScript Architecture (v0.4)

**No Frameworks Approach:**
- Vanilla JavaScript for all interactions
- No build step required
- Direct DOM manipulation
- Event-driven architecture

**Common Patterns Used:**

**1. State Management:**
```javascript
// Voting state example
const votes = { up: 142, down: 24 };
let userVote = null;

function vote(type) {
  if (userVote === type) {
    votes[type]--;
    userVote = null;
  } else {
    if (userVote) votes[userVote]--;
    votes[type]++;
    userVote = type;
  }
  updateUI();
}
```

**2. Intersection Observer for Animations:**
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });
```

**3. Dynamic DOM Updates:**
```javascript
function addMilestone() {
  const item = document.createElement('div');
  item.className = 'milestone-item';
  item.innerHTML = `...`;
  list.appendChild(item);
  updateNumbers();
}
```

**4. Form Validation:**
```javascript
function calculateBudget() {
  let total = 0;
  document.querySelectorAll('.milestone-input')
    .forEach(input => total += parseFloat(input.value) || 0);
  document.getElementById('total').textContent = '₿ ' + total.toFixed(2);
}
```

**5. Modal System:**
```javascript
function showModal(content) {
  document.getElementById('modalContent').innerHTML = content;
  document.getElementById('modal').classList.add('active');
}

// Close on overlay click
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});
```

### 2.5 Internationalization (i18n)

**Current Implementation:**
- Separate HTML files per language
- DE: index.html
- EN: index-en.html
- Language switcher in top-right corner

**Future Enhancement:**
- JSON translation files
- URL-based routing (/de/, /en/)
- DeepL API integration for automatic translation

---

## 3. Navigation System

### 3.1 Access Control Badges

| Category | Path | Badge | Access |
|----------|------|-------|--------|
| Ideen-Diskussion | /discussion.html | Frei (Green) | Public read, login to post |
| Ideen-Marktplatz | /marketplace.html | Mitglied (Red) | Subscription required |
| Meine Teams | /teams.html | Mitglied (Red) | Subscription required |
| Mein Profil | /profile.html | Login (Blue) | Login required |

### 3.2 Navigation Component

```html
<nav class="main-nav">
  <div class="main-nav-container">
    <a href="index.html" class="nav-logo">...</a>
    <button class="mobile-menu-btn">☰</button>
    <div class="nav-menu" id="navMenu">
      <a href="discussion.html" class="nav-item">
        💡 Ideen-Diskussion
        <span class="nav-badge badge-free">Frei</span>
      </a>
      <!-- ... more items -->
    </div>
  </div>
</nav>
```

**Features:**
- Fixed position at top
- Mobile hamburger menu
- Active page highlighting
- Access level badges

---

## 4. Page Specifications

### 4.1 Landing Page

**Sections:**
1. **Hero** - Full viewport, centered content
2. **So profitierst du** - 3 cards explaining roles
3. **Von der Idee zum Profit** - 6-step timeline
4. **Überzeugt?** - 3 CTA options

**Responsive Behavior:**
- Desktop: Side-by-side cards
- Mobile: Stacked vertically
- Timeline: Left-aligned with connecting line

### 4.2 Discussion Page (v0.4)

**Purpose:** Browse ideas with interactive voting

**Components:**
- Idea cards with live voting buttons
- Filter buttons (Alle, Trending, Neueste, Kontrovers)
- Sort dropdown (Beliebtheit, Neueste, Stimmen, Kommentare)
- Vote progress bars
- Toast notifications

**Interactive Features:**
- Upvote/downvote with toggle
- Real-time percentage calculation
- Visual feedback on vote
- Staggered card animations on load

### 4.3 Idea Detail Page (v0.4)

**Purpose:** View idea details and participate in discussion

**Components:**
- Full idea description with tags
- Large voting section with statistics
- Comment form with textarea
- Comments list with like buttons
- "Move to Marketplace" CTA (if >25% votes)

**Interactive Features:**
- Voting with visual progress bar
- Comment posting (appears immediately)
- Comment liking
- Tag click filtering

### 4.4 Marketplace Page (v0.4)

**Purpose:** Invest in validated ideas

**Components:**
- Stats bar (active ideas, volume, investors, teams)
- Large idea card with funding progress
- Share price display box
- Investment calculator
- Team cards with funding status

**Interactive Features:**
- Investment amount input → auto-calculated total
- Buy button → confirmation modal
- Team invest button → confirmation modal
- Progress bar updates after purchase

### 4.5 Team Application Page (v0.4)

**Purpose:** Apply as a team to build an idea

**Components:**
- Progress steps indicator
- Idea selection display
- Team details form
- Dynamic milestone list
- Budget breakdown inputs
- Skin-in-game calculator

**Interactive Features:**
- Add/remove milestones dynamically
- Auto-calculate total budget
- Calculate minimum investment (5%)
- Calculate ownership percentage
- Form validation before submit

### 4.6 Teams Overview Page (v0.4)

**Purpose:** Manage your teams and applications

**Components:**
- Tab navigation (Leading / Member / Applications)
- Team cards with detailed stats
- Member avatars list
- Progress bars for milestones
- Action buttons per team

**Features:**
- Tab switching without page reload
- Team status indicators (Building, Pending, etc.)
- Different actions per team type

### 4.7 Profile Page (v0.4)

**Purpose:** User dashboard and wallet

**Components:**
- Profile header with avatar
- Stats grid (ideas, investments, teams, earnings)
- Wallet card with balance
- Earnings chart (visual bars)
- Ideas list
- Investments list

**Interactive Features:**
- Copy wallet address to clipboard
- Edit profile button
- View transaction history

**Components:**
- Idea cards with badges
- Comment counts
- Vote percentages
- Author info

### 4.3 Marketplace Page

**Purpose:** Invest in validated ideas

**Components:**
- Funding progress bars
- Stats grid (raised, goal, investors, teams)
- Investment buttons
- Team application links

### 4.4 Teams Page

**Purpose:** Manage teams you lead or belong to

**Components:**
- Tab navigation (Geleitete Teams / Team-Mitglied)
- Team cards with stats
- Status indicators (Aktiv / Bewerbung)
- Action buttons (Dashboard, Revenue melden)

### 4.5 Profile Page

**Purpose:** User dashboard

**Components:**
- Profile header with avatar
- Stats grid (4 metrics)
- Ideas section
- Investments section

---

## 5. Data Models

### 5.1 User
```typescript
interface User {
  id: UUID;
  username: string;           // @handle
  displayName: string;
  email: string;
  avatar?: URL;
  language: 'de' | 'en';
  subscription: {
    active: boolean;
    type: 'monthly' | 'annual';
    expiresAt: Timestamp;
  };
  wallets: Wallet[];          // Multiple wallet support
  createdAt: Timestamp;
}
```

### 5.2 Idea
```typescript
interface Idea {
  id: UUID;
  authorId: UUID;
  title: string;
  description: string;
  tags: string[];
  stage: 'discussion' | 'voting' | 'marketplace' | 'active' | 'completed';
  
  // Discussion Phase
  discussion: {
    openedAt: Timestamp;
    comments: number;
    votes: { up: number; down: number };
  };
  
  // Marketplace Phase
  marketplace?: {
    openedAt: Timestamp;
    closesAt: Timestamp;
    fundingGoal: Satoshis;
    raised: Satoshis;
    investors: number;
  };
  
  createdAt: Timestamp;
}
```

### 5.3 Team
```typescript
interface Team {
  id: UUID;
  ideaId: UUID;
  leaderId: UUID;
  name: string;
  description: string;
  focusArea: string;
  
  // Proposal
  proposal: {
    roadmap: Milestone[];
    budget: BudgetItem[];
    timeline: number;         // Months
  };
  
  // Funding
  fundingGoal: Satoshis;
  raised: Satoshis;
  skinInGame: Satoshis;
  status: 'applying' | 'funding' | 'funded' | 'building' | 'completed';
  
  createdAt: Timestamp;
}
```

### 5.4 Milestone
```typescript
interface Milestone {
  id: UUID;
  teamId: UUID;
  title: string;
  description: string;
  deliverables: string[];
  fundingRelease: Satoshis;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedAt?: Timestamp;
  dueDate: Timestamp;
}
```

---

## 6. API Design

### 6.1 REST Endpoints (Future Implementation)

```yaml
# Authentication
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout

# Ideas
GET    /api/v1/ideas?stage=&filter=
POST   /api/v1/ideas
GET    /api/v1/ideas/:id
POST   /api/v1/ideas/:id/vote
POST   /api/v1/ideas/:id/move-to-marketplace

# Teams
GET    /api/v1/ideas/:id/teams
POST   /api/v1/ideas/:id/teams
GET    /api/v1/teams/:id
POST   /api/v1/teams/:id/fund

# User
GET    /api/v1/users/me
GET    /api/v1/users/:id/ideas
GET    /api/v1/users/:id/investments
GET    /api/v1/users/:id/teams
```

### 6.2 WebSocket Events

**Client → Server:**
```typescript
'subscribe:idea': (ideaId: string) => void
'subscribe:team': (teamId: string) => void
'idea:comment': (data: { ideaId: string; content: string }) => void
'idea:vote': (data: { ideaId: string; direction: 'up' | 'down' }) => void
'investment:initiate': (data: { ideaId: string; amount: number }) => void
'milestone:vote': (data: { milestoneId: string; approve: boolean }) => void
```

**Server → Client:**
```typescript
'idea:updated': (idea: Idea) => void
'idea:new_investment': (data: { ideaId: string; amount: number }) => void
'idea:new_comment': (comment: Comment) => void
'team:updated': (team: Team) => void
'team:milestone_reached': (data: { teamId: string; milestone: Milestone }) => void
'revenue:distributed': (data: { teamId: string; amount: number }) => void
'notification:new': (notification: Notification) => void
```

---

## 7. Bitcoin Integration

### 7.1 Non-Custodial Approach

**User Wallet Connection:**
```typescript
interface WalletConnection {
  connectWallet(xpub: string, type: 'native_segwit' | 'taproot'): Promise<Wallet>;
  generateReceivingAddress(walletId: string, path: string): Promise<Address>;
}
```

**Payment Verification:**
```typescript
interface PaymentVerification {
  verifyPayment(
    txHash: string,
    expectedAmount: Satoshis,
    receivingAddress: Address
  ): Promise<{ valid: boolean; confirmations: number; amount: Satoshis }>;
  
  watchMempool(address: string, callback: (tx: Transaction) => void): void;
}
```

### 7.2 Public APIs Used

| Service | Purpose | URL |
|---------|---------|-----|
| mempool.space | Transaction data, mempool monitoring | https://mempool.space/api |
| blockstream.info | Block explorer, verification | https://blockstream.info/api |

### 7.3 Subscription Pricing

**Dynamic BTC Conversion:**
```typescript
function calculateSubscriptionBtc(usdPrice: number, btcUsdRate: number): Satoshis {
  const btcAmount = usdPrice / btcUsdRate;
  return btcToSatoshis(btcAmount);
}

// Example: $120/year subscription
// BTC = $50,000 → 0.0024 BTC/year
// BTC = $100,000 → 0.0012 BTC/year
```

---

## 8. Deployment

### 8.1 Current Setup: GitHub Pages

**Advantages:**
- Free hosting
- Automatic HTTPS
- Version control integration
- CDN distribution

**Limitations:**
- Static only (no server-side code)
- No database
- No WebSocket support (needs external service)

### 8.2 File Structure

```
docs/
├── index.html              # German landing
├── index-en.html           # English landing
├── discussion.html         # Discussion page
├── marketplace.html        # Marketplace page
├── teams.html              # Teams page
├── profile.html            # Profile page
├── v2.html                 # v0.2 prototype
├── v3.html                 # v0.3 prototype
└── process.html            # Process visualization
```

### 8.3 Future Migration Path

**Phase 1: Add Backend (VPS)**
- Node.js/Express API
- PostgreSQL database
- Redis for cache/sessions
- Same frontend, API calls added

**Phase 2: Full-Stack**
- React frontend
- REST + WebSocket
- Authentication
- Real-time updates

---

## 9. Security Considerations

### 9.1 Frontend Security

- HTTPS enforced (GitHub Pages)
- No sensitive data in localStorage
- CSP headers (future)
- Input sanitization (future)

### 9.2 Bitcoin Security

- Users control private keys
- HD wallet support (xpub/xprv)
- Address derivation (BIP32)
- Multi-sig for team treasuries (future)

---

## 10. Performance

### 10.1 Current Optimizations

- Static HTML (no build step)
- Minimal CSS (no frameworks)
- Native emoji (no icon fonts)
- CSS custom properties (theme switching)

### 10.2 Future Optimizations

- Lazy loading for images
- Service worker for offline
- Bundle splitting (if using React)
- CDN for static assets

---

## 11. Testing Strategy

### 11.1 Manual Testing Checklist

**Desktop (Chrome, Firefox, Safari):**
- [ ] Navigation works on all pages
- [ ] Language switcher functions
- [ ] Responsive breakpoints correct
- [ ] All links functional

**Mobile (iOS Safari, Chrome Android):**
- [ ] Hamburger menu opens/closes
- [ ] Touch targets 44px+
- [ ] No horizontal scroll
- [ ] Text readable without zoom

### 11.2 Future Automated Testing

- E2E: Playwright or Cypress
- Visual regression: Percy
- Performance: Lighthouse CI

---

## 12. Open Questions

1. **Backend Migration:** When to move from static to full-stack?
2. **Authentication:** JWT vs SIWE (Sign-In with Ethereum style for Bitcoin)?
3. **WebSocket:** Use Socket.io or native WebSocket?
4. **i18n:** JSON files or database-driven translations?
5. **Search:** PostgreSQL FTS or add Elasticsearch?

---

*Last updated: 2026-03-08*

*This architecture document reflects the current implementation and serves as a blueprint for future development.*
