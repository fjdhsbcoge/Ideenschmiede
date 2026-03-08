# Ideenschmiede Technical Architecture

**Version:** 2.0  
**Last Updated:** 2026-03-08  
**Status:** Current Implementation

---

## 1. System Overview

### 1.1 Current Implementation Status

**Live Demo:** https://fjdhsbcoge.github.io/Ideenschmiede/

**Pages Implemented:**
| Page | URL | Access Level |
|------|-----|--------------|
| Landing (DE) | /index.html | Public |
| Landing (EN) | /index-en.html | Public |
| Discussion | /discussion.html | Free |
| Marketplace | /marketplace.html | Member |
| Teams | /teams.html | Member |
| Profile | /profile.html | Login |

### 1.2 Core Principles

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

### 2.4 Internationalization (i18n)

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

### 4.2 Discussion Page

**Purpose:** Browse ideas in discussion phase

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
