# Ideenschmiede Technical Architecture

**Version:** 1.0  
**Last Updated:** 2026-03-08  
**Status:** Draft

---

## 1. System Overview

### 1.1 Architecture Philosophy
- **Non-custodial by design** - Platform never holds user funds
- **Users run their own Bitcoin infrastructure** - Connect wallets, pay directly
- **Trust through transparency** - Social contracts + reputation, not enforcement
- **API-first design** - Frontend and backend communicate via REST/GraphQL
- **Event-driven** - Async processing for notifications, payments, etc.
- **Modular** - Services can be replaced/upgraded independently

### 1.2 Non-Custodial Approach

**Core Principle:** The platform facilitates but never controls funds.

```
Traditional Platform:            Ideenschmiede:
┌─────────────┐                  ┌─────────────┐
│   User A    │                  │   User A    │
└──────┬──────┘                  └──────┬──────┘
       │                                │
       │ 1. Send to platform            │ 1. Pay directly to User B
       ▼                                │    (from own wallet/node)
┌─────────────┐                         │
│  PLATFORM   │◄──── Holds funds        │
│  (custody)  │                         │
└──────┬──────┘                         │
       │                                │
       │ 2. Send to User B              │ 2. Platform verifies
       ▼                                │    via public API
┌─────────────┐                         ▼
│   User B    │                  ┌─────────────┐
└─────────────┘                  │   User B    │
                                 └─────────────┘
```

**Platform's Role:**
- Generate receiving addresses from user xpubs
- Verify transactions via public APIs (mempool.space, blockstream.info)
- Track ownership and obligations in database
- Display reputation and payment history
- Facilitate communication between parties

**Platform Never:**
- Holds private keys
- Controls user funds
- Acts as intermediary in payments
- Has custody of Bitcoin

### 1.3 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Web App    │  │  Mobile     │  │  Third-party            │ │
│  │  (React)    │  │  (Future)   │  │  Integrations           │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          └────────────────┴─────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   API Gateway      │
                    │   (Rate limiting,  │
                    │    Auth, Routing)  │
                    └─────────┬──────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                      SERVICE LAYER                               │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Idea      │ │  User      │ │Investment  │ │  Team      │   │
│  │  Service   │ │  Service   │ │  Service   │ │  Service   │   │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘   │
│        │              │              │              │           │
│  ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐   │
│  │  Voting    │ │  Payment   │ │  Revenue   │ │Notification│   │
│  │  Service   │ │  Service   │ │  Service   │ │  Service   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                      DATA LAYER                                  │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ PostgreSQL │ │    Redis   │ │  Bitcoin   │ │   IPFS     │   │
│  │ (Primary   │ │  (Cache &  │ │   Node     │ │  (Files &  │   │
│  │  Database) │ │   Queue)   │ │ (MVP: API) │ │  Proofs)   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### 2.1 Frontend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React 18 | Component-based, large ecosystem |
| State Management | Zustand | Simple, lightweight |
| Styling | Tailwind CSS | Utility-first, rapid development |
| HTTP Client | Axios | Mature, interceptors |
| WebSocket | Socket.io | Real-time updates |

### 2.2 Backend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js 20 | JavaScript everywhere |
| Framework | Express.js | Minimal, flexible |
| API | REST + GraphQL | Flexibility for different clients |
| Authentication | JWT + SIWE | Web3 native auth |
| Validation | Zod | TypeScript-first validation |

### 2.3 Database (Phase 1: MVP)
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Primary DB | PostgreSQL 16 | ACID, JSON support, mature |
| Cache | Redis 7 | Sessions, real-time, queue |
| Search | PostgreSQL FTS | Good enough for MVP |
| Files | IPFS | Decentralized storage |

### 2.4 Blockchain (Phase 1: API Integration)
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Bitcoin | BlockCypher/Mempool API | No node management |
| Wallets | xpub/xprv | HD wallets for users |
| Indexing | Custom | Track shares, investments |

### 2.5 Infrastructure
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Hosting | VPS (Hetzner/AWS) | Cost-effective |
| Container | Docker | Consistent environments |
| Reverse Proxy | Caddy | Automatic HTTPS |
| Monitoring | Grafana + Prometheus | Open source |

---

## 3. Data Models

### 3.1 Core Entities

```typescript
// User
interface User {
  id: UUID;
  username: string;           // @handle
  displayName: string;
  email: string;
  avatar?: URL;
  subscription: {
    active: boolean;
    type: 'monthly' | 'annual';
    expiresAt: Timestamp;
    paymentTx?: BitcoinTx;
  };
  wallets: Wallet[];          // Multiple wallet support
  reputation: {
    score: number;
    ideasPosted: number;
    ideasSuccessful: number;
    investmentsMade: number;
  };
  createdAt: Timestamp;
}

// Wallet
interface Wallet {
  id: UUID;
  userId: UUID;
  address: BitcoinAddress;
  type: 'native_segwit' | 'taproot';
  primary: boolean;
  label?: string;
  addedAt: Timestamp;
}

// Idea
interface Idea {
  id: UUID;
  authorId: UUID;
  title: string;
  description: string;
  tags: string[];
  
  // Lifecycle
  stage: 'draft' | 'discussion' | 'voting' | 'marketplace' | 'active' | 'completed' | 'archived';
  
  // Discussion Phase
  discussion: {
    openedAt: Timestamp;
    comments: number;
    votes: {
      up: number;
      down: number;
    };
  };
  
  // Voting Phase
  voting?: {
    startedAt: Timestamp;
    endsAt: Timestamp;
    threshold: number;        // 25%
  };
  
  // Marketplace Phase
  marketplace?: {
    openedAt: Timestamp;
    closesAt: Timestamp;
    fundingGoal: Satoshis;
    raised: Satoshis;
    investors: number;
    shareSupply: number;      // 10M fixed
  };
  
  // Financials
  ideatorEarnings: Satoshis;  // 15% of investments
  cotRewardsDistributed: Satoshis; // 5% of investments
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// IdeaShare (Investment in Idea)
interface IdeaShare {
  id: UUID;
  ideaId: UUID;
  investorId: UUID;
  
  amount: Satoshis;
  shareCount: number;
  ownership: number;          // Calculated: amount / totalRaised
  
  txHash: BitcoinTx;          // On-chain proof
  
  // Team allocation (when funded)
  teamAllocations: TeamAllocation[];
  
  createdAt: Timestamp;
}

// Team
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
  skinInGame: Satoshis;       // Leader's investment
  status: 'applying' | 'funding' | 'funded' | 'building' | 'completed' | 'failed';
  
  // Share structure
  shareSupply: number;        // 10M fixed
  
  createdAt: Timestamp;
}

// TeamShare (Investment in Team)
interface TeamShare {
  id: UUID;
  teamId: UUID;
  investorId: UUID;
  
  amount: Satoshis;
  shareCount: number;
  ownership: number;
  
  series: 'A' | 'B';          // Series A (Idea holders) or B (public)
  txHash: BitcoinTx;
  
  createdAt: Timestamp;
}

// Milestone
interface Milestone {
  id: UUID;
  teamId: UUID;
  
  title: string;
  description: string;
  deliverables: string[];
  
  fundingRelease: Satoshis;   // Amount unlocked on completion
  
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedAt?: Timestamp;
  
  // Voting
  votes: {
    approve: number;
    reject: number;
  };
  
  dueDate: Timestamp;
}

// Revenue Report
interface RevenueReport {
  id: UUID;
  teamId: UUID;
  reporterId: UUID;
  
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  
  revenue: Satoshis;
  expenses: Satoshis;
  profit: Satoshis;
  
  // Proof
  attachments: IPFSHash[];
  
  // Distribution executed
  distributed: boolean;
  distributionTx?: BitcoinTx;
  
  createdAt: Timestamp;
}

// Comment (Chain of Thought)
interface Comment {
  id: UUID;
  ideaId: UUID;
  authorId: UUID;
  
  content: string;
  parentId?: UUID;            // Thread support
  
  // Scoring
  votes: {
    up: number;
    down: number;
  };
  cotScore: number;           // Calculated: comments*1 + upvotes*2
  
  // Reward tracking
  rewardsEarned: Satoshis;
  
  createdAt: Timestamp;
}

// Notification
interface Notification {
  id: UUID;
  userId: UUID;
  
  type: 'idea_approved' | 'milestone_reached' | 'new_investment' | 
        'revenue_distributed' | 'vote_reminder' | 'team_funded';
  
  title: string;
  message: string;
  data: Record<string, any>;
  
  read: boolean;
  readAt?: Timestamp;
  
  channels: ('in_app' | 'email' | 'push')[];
  
  createdAt: Timestamp;
}
```

---

## 4. API Design

### 4.1 REST Endpoints

```yaml
# Authentication
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh

# Users
GET    /api/v1/users/me
PUT    /api/v1/users/me
GET    /api/v1/users/:id/profile
GET    /api/v1/users/:id/ideas
GET    /api/v1/users/:id/investments

# Ideas
GET    /api/v1/ideas                    # List (filter by stage)
POST   /api/v1/ideas                    # Create
GET    /api/v1/ideas/:id
PUT    /api/v1/ideas/:id
POST   /api/v1/ideas/:id/move-to-marketplace

# Idea Voting
POST   /api/v1/ideas/:id/vote           # up/down
GET    /api/v1/ideas/:id/votes

# Idea Shares (Investment)
POST   /api/v1/ideas/:id/invest
GET    /api/v1/ideas/:id/investments
GET    /api/v1/ideas/:id/share-holders

# Teams
GET    /api/v1/ideas/:id/teams
POST   /api/v1/ideas/:id/teams          # Apply as team
GET    /api/v1/teams/:id
PUT    /api/v1/teams/:id
POST   /api/v1/teams/:id/fund           # Invest in team

# Milestones
GET    /api/v1/teams/:id/milestones
POST   /api/v1/milestones/:id/complete  # Report completion
POST   /api/v1/milestones/:id/vote      # Approve/reject

# Revenue
POST   /api/v1/teams/:id/revenue        # Report revenue
GET    /api/v1/teams/:id/revenue-reports

# Comments
GET    /api/v1/ideas/:id/comments
POST   /api/v1/ideas/:id/comments

# Notifications
GET    /api/v1/notifications
PUT    /api/v1/notifications/:id/read
PUT    /api/v1/notifications/read-all

# Search
GET    /api/v1/search?q=&filter=
```

### 4.2 WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  'subscribe:idea': (ideaId: string) => void;
  'subscribe:team': (teamId: string) => void;
  'subscribe:notifications': () => void;
}

// Server → Client
interface ServerEvents {
  'idea:updated': (idea: Idea) => void;
  'idea:new_investment': (data: { ideaId: string, amount: number }) => void;
  'team:updated': (team: Team) => void;
  'team:milestone_reached': (data: { teamId: string, milestone: Milestone }) => void;
  'revenue:distributed': (data: { teamId: string, amount: number }) => void;
  'notification:new': (notification: Notification) => void;
}
```

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│  Client │                    │ Backend │                    │ Bitcoin │
└────┬────┘                    └────┬────┘                    └────┬────┘
     │                              │                              │
     │  1. Sign message with wallet │                              │
     │ ──────────────────────────────>│                              │
     │                              │                              │
     │  2. Verify signature         │                              │
     │                              │ ────────────────────────────>│
     │                              │                              │
     │  3. Signature valid          │                              │
     │                              │ <────────────────────────────│
     │                              │                              │
     │  4. Return JWT               │                              │
     │ <─────────────────────────────│                              │
     │                              │                              │
```

### 5.2 Security Measures

| Layer | Measures |
|-------|----------|
| Transport | TLS 1.3, HSTS, Certificate pinning |
| API | Rate limiting, Input validation, SQL injection prevention |
| Auth | JWT with short expiry, Refresh token rotation, SIWE |
| Data | Encryption at rest (AES-256), PII minimization |
| Bitcoin | HD wallets, Multi-sig for treasury, Cold storage |

### 5.3 Permission Matrix

| Action | Anonymous | Free User | Member |
|--------|-----------|-----------|--------|
| Browse ideas | ✅ | ✅ | ✅ |
| Comment/vote | ❌ | ✅ | ✅ |
| Post idea | ❌ | ✅ | ✅ |
| Invest | ❌ | ❌ | ✅ |
| Create team | ❌ | ❌ | ✅ |
| Report revenue | ❌ | ❌ | ✅ (team lead) |

---

## 6. Deployment Architecture

### 6.1 Docker Compose (MVP)

```yaml
version: '3.8'

services:
  # Frontend
  web:
    build: ./web
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://api:4000
    depends_on:
      - api

  # API
  api:
    build: ./api
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://...:5432/ideenschmiede
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - BLOCKCYPHER_TOKEN=${BLOCKCYPHER_TOKEN}
    depends_on:
      - postgres
      - redis

  # Database
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=ideenschmiede
      - POSTGRES_USER=app
      - POSTGRES_PASSWORD=${DB_PASSWORD}

  # Cache & Queue
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  # Reverse Proxy
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web
      - api

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

### 6.2 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Security
JWT_SECRET=...
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Bitcoin
BLOCKCYPHER_TOKEN=...
MEMPOOL_API_URL=https://mempool.space/api

# IPFS
IPFS_API_URL=...
IPFS_GATEWAY=https://ipfs.io/ipfs

# Notifications
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# Monitoring
SENTRY_DSN=...
```

---

## 7. Integration Points

### 7.1 Bitcoin Integration (Non-Custodial)

**Core Principle:** Users connect their own wallets. Platform never holds funds.

```typescript
// User wallet connection
interface WalletConnection {
  // User provides extended public key (xpub)
  // Platform generates receiving addresses
  connectWallet(xpub: string, type: 'native_segwit' | 'taproot'): Promise<Wallet>;
  
  // Generate new receiving address for investment/payment
  generateReceivingAddress(walletId: string, path: string): Promise<Address>;
}

// Payment verification (via public APIs)
interface PaymentVerification {
  // Verify transaction exists and is confirmed
  verifyPayment(
    txHash: string,
    expectedAmount: Satoshis,
    receivingAddress: Address
  ): Promise<{
    valid: boolean;
    confirmations: number;
    amount: Satoshis;
  }>;
  
  // Watch mempool for incoming payments
  watchMempool(address: string, callback: (tx: Transaction) => void): void;
}

// Revenue distribution tracking
interface RevenueTracking {
  // Team reports they paid shareholders
  recordPayout(
    teamId: string,
    txHash: string,
    distributions: { shareholderId: string; amount: Satoshis }[]
  ): Promise<void>;
  
  // Verify reported payout on-chain
  verifyPayout(txHash: string): Promise<boolean>;
  
  // Flag missing payments for reputation system
  flagMissingPayment(teamId: string, period: string): void;
}
```

**Public APIs Used (No Bitcoin Node Required):**
- `mempool.space/api` - Transaction data, mempool monitoring
- `blockstream.info/api` - Block explorer, confirmation status

**Subscription Pricing (Dynamic BTC Rate):**
```typescript
// Calculate BTC amount based on USD price
function calculateSubscriptionBtc(usdPrice: number, btcUsdRate: number): Satoshis {
  const btcAmount = usdPrice / btcUsdRate;
  return btcToSatoshis(btcAmount);
}

// Example: $120/year subscription
// BTC = $50,000 → 0.0024 BTC/year
// BTC = $100,000 → 0.0012 BTC/year
```

### 7.2 Trust Through Reputation

**Social Contracts, Not Legal Enforcement:**

```typescript
interface ReputationSystem {
  // Team reputation score
  calculateTeamScore(teamId: string): {
    overall: number;           // 0-100
    paymentHistory: number;    // % of on-time payments
    milestoneCompletion: number; // % of milestones hit
    shareholderReviews: number;  // Average rating
  };
  
  // Track payment compliance
  recordPaymentCompliance(
    teamId: string,
    period: string,
    expectedAmount: Satoshis,
    paidAmount: Satoshis,
    txHash?: string
  ): void;
  
  // Shareholder reviews
  submitReview(
    shareholderId: string,
    teamId: string,
    rating: 1-5,
    comment: string,
    tags: string[]  // 'responsive', 'transparent', 'delays'
  ): void;
}
```

**Trust Mechanisms:**
1. **Transparent Payment History** - All on-chain, publicly verifiable
2. **Reputation Score** - Visible on team profile
3. **Shareholder Reviews** - Direct feedback from investors
4. **Communication Channels** - Built-in forum/chat between teams and shareholders
5. **Future Funding Impact** - Low reputation = harder to get future funding

**Platform's Enforcement Power: None**
- Can't force teams to pay
- Can't freeze funds
- Can't reverse transactions
- **Can:** flag, display, warn, exclude from discovery

### 7.3 External APIs

| Service | Purpose | Integration |
|---------|---------|-------------|
| mempool.space | Bitcoin transaction data | REST API |
| blockstream.info | Block explorer, verification | REST API |
| Pinata/Web3Storage | IPFS pinning | REST API |
| SMTP | Email notifications | Protocol |

---

## 8. Scaling Considerations

### 8.1 Phase 1: MVP (1-1000 users)
- Single VPS (Hetzner/AWS ~$20/month)
- PostgreSQL on same server
- Redis for cache and sessions
- Bitcoin verification via public APIs (free)
- IPFS via pinning service

### 8.2 Phase 2: Growth (1000-10000 users)
- Separate DB server
- Load balancer
- Background job workers
- CDN for static assets
- Continue using public Bitcoin APIs

### 8.3 Phase 3: Scale (10000+ users)
- Kubernetes cluster
- Read replicas for DB
- Multi-region deployment
- Consider dedicated Bitcoin nodes only if API limits hit
- Self-hosted IPFS cluster

**Infrastructure Costs (MVP):**
- VPS: ~$20/month
- Database: Included
- Bitcoin API: Free (mempool.space, blockstream.info)
- IPFS pinning: ~$5-20/month
- Domain + SSL: ~$20/year
- **Total: ~$45-60/month**

---

## 9. Development Workflow

### 9.1 Git Workflow
```
main          → Production
  ↑
develop       → Integration
  ↑
feature/*     → Feature branches
  ↑
hotfix/*      → Emergency fixes
```

### 9.2 CI/CD Pipeline
```
1. Lint + Type check
2. Unit tests
3. Integration tests
4. Build Docker images
5. Deploy to staging
6. E2E tests
7. Deploy to production
```

---

## 10. Monitoring & Observability

### 10.1 Metrics to Track

| Category | Metrics |
|----------|---------|
| Business | Ideas posted, Investments made, Revenue generated |
| Performance | API latency, Error rates, Database query time |
| Infrastructure | CPU, Memory, Disk usage, Network I/O |
| Blockchain | Payment confirmation time, Payout success rate |

### 10.2 Alerting
- Error rate > 1%
- API latency > 500ms (p95)
- Failed Bitcoin transactions
- Database connections exhausted

---

## 11. Migration Path

### 11.1 Database → RGB Protocol

**Phase 1 (MVP):**
- Shares tracked in PostgreSQL
- Bitcoin payments via API
- Off-chain share ownership

**Phase 2 (RGB):**
- Issue shares as RGB assets
- Client-side validation
- On-chain share transfers

**Phase 3 (Full Decentralization):**
- Smart contracts for milestones
- DAO governance
- Dispute resolution

### 11.2 Data Migration
```typescript
// Export from database
const shares = await db.shares.findAll();

// Issue on RGB
for (const share of shares) {
  await rgb.issueAsset({
    owner: share.investor.walletAddress,
    amount: share.shareCount,
    metadata: {
      ideaId: share.ideaId,
      originalTx: share.txHash
    }
  });
}
```

---

## 12. Decisions Made

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Payment Processing** | Non-custodial via public APIs | Users control their own keys. Platform verifies via mempool.space/blockstream.info |
| **Subscription ($120/year)** | Dynamic BTC pricing | Rate calculated daily. Example: BTC $50k = 0.0024 BTC/year |
| **Trust/Enforcement** | Social contracts + reputation | Platform never enforces. Reputation system + shareholder communication |
| **IPFS Pinning** | Use pinning service (Pinata/Web3Storage) | Simple, reliable. Self-host later if needed |
| **Real-time** | Server-Sent Events (SSE) | Simpler than WebSocket. One-way updates sufficient |
| **Search** | PostgreSQL FTS | Good enough for MVP. Add Elasticsearch if scale requires |
| **Multi-language** | Simple i18n in code | German + English first. Translation management later |
| **Bitcoin Node** | None required | Use public APIs. Users run their own infrastructure |

---

## 13. Open Questions

1. **Subscription renewal:** Automatic (recurring BTC address) or manual (user pays each year)?
2. **Revenue reporting frequency:** Monthly required? Or team decides?
3. **Dispute resolution:** What happens when shareholders disagree with team? Platform mediate or community vote?
4. **Multi-sig treasury:** Should teams use multi-sig for additional security?
5. **Lightning Network:** Add as payment option for small amounts?

---

*Authored by Kimi Claw (AI Assistant)*

> "Architecture is the art of how to waste space." — Philip Johnson
