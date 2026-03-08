# Getting Started

**New to this project? Start here.**

This guide explains how to navigate the Ideenschmiede documentation and begin building.

---

## Document Reading Order

**Always read in this sequence:**

### 1. VISION.md (Why)
Understand what we're building and why these decisions were made.

**Key takeaways:**
- Non-custodial platform (we never hold user funds)
- 20/80 revenue split (builders get majority)
- Bitcoin-only payments
- Trust through transparency, not enforcement
- One-person-one-vote validation

**⚠️ Non-negotiables:**
- Never change the 20/80 split
- Never add custody of funds
- Never require legal contracts
- Never add other blockchains/tokens

---

### 2. ARCHITECTURE.md (How)
Understand the technical approach.

**Key sections:**
- **Stack:** React, Node.js, PostgreSQL, Redis
- **Bitcoin:** Non-custodial, users connect own wallets
- **Real-time:** WebSocket (Socket.io)
- **Data models:** User, Idea, Team, Shares, etc.

**Critical decisions:**
- Use mempool.space API (no Bitcoin node needed)
- Dynamic BTC pricing for subscriptions
- Reputation system for trust
- WebSocket for two-way communication

---

### 3. BUILD.md (What)
Step-by-step implementation guide.

**Versions:**
- v0.1: Basic flow (done)
- v0.2: Stage visualization + profile (done)
- v0.3: Team formation flow (next)

**Use this for:**
- Feature specifications
- UI mockups
- File structure
- Implementation steps

---

## Quick Start for Builders

### If you're implementing the backend:
1. Read ARCHITECTURE.md section 3 (Data Models)
2. Read ARCHITECTURE.md section 4 (API Design)
3. Set up PostgreSQL with schema
4. Implement REST API endpoints
5. Add WebSocket handlers

### If you're implementing the frontend:
1. Read VISION.md user flows
2. Read BUILD.md v0.2 specifications
3. Check prototypes/ for HTML mockups
4. Build React components
5. Connect to backend API + WebSocket

### If you're implementing Bitcoin integration:
1. Read ARCHITECTURE.md section 7 (Integration Points)
2. Understand xpub/xprv wallet connection
3. Implement address generation
4. Add payment verification via mempool.space API
5. Build reputation tracking (no enforcement)

---

## Repository Structure

```
├── VISION.md           → Read first (principles)
├── ARCHITECTURE.md     → Read second (technical)
├── BUILD.md            → Read third (implementation)
├── GETTING_STARTED.md  → This file
├── AGENTS.md           → AI workspace conventions
│
├── prototypes/         → HTML mockups
│   ├── ideenschmiede-v2.html    → Latest demo
│   └── process-visualization.html
│
├── docs/               → GitHub Pages deployment
│   ├── index.html
│   ├── v2.html
│   └── process.html
│
└── specs/              → Additional specs
    └── SPECIFICATION.md
```

---

## Common Questions

### "Can I change..."

| Question | Answer |
|----------|--------|
| The 20/80 split? | ❌ No - core principle |
| Add Ethereum support? | ❌ No - Bitcoin only |
| Hold user funds? | ❌ No - non-custodial |
| Use custodial service? | ❌ No - users control keys |
| Add legal contracts? | ❌ No - social contracts only |
| Change to 50/50 split? | ❌ No - builders must get majority |
| Use WebSocket? | ✅ Yes - specified in architecture |
| Add team chat? | ✅ Yes - fits WebSocket approach |
| Change technology stack? | ⚠️ Discuss first - has implications |

### "Where do I find..."

| Need | Location |
|------|----------|
| User flow diagrams | VISION.md + BUILD.md |
| Data models | ARCHITECTURE.md section 3 |
| API endpoints | ARCHITECTURE.md section 4 |
| UI mockups | prototypes/ folder + BUILD.md |
| Bitcoin integration | ARCHITECTURE.md section 7 |
| WebSocket events | ARCHITECTURE.md section 4.2 |
| Stage examples | BUILD.md "Idea Lifecycle Stages" |

---

## Implementation Priority

### Phase 1: MVP (Start here)
1. User auth (wallet connection)
2. Idea posting & voting
3. Idea-Share investment (fixed supply)
4. Team applications
5. Basic profile page

### Phase 2: Growth
1. Team-Share investment (Series A/B)
2. Milestone tracking
3. Revenue reporting
4. Reputation system
5. Team chat (WebSocket)

### Phase 3: Scale
1. RGB Protocol integration
2. Secondary market
3. Mobile app
4. Multi-language
5. Advanced analytics

---

## Key Principles to Remember

1. **Users own their keys** - We never hold Bitcoin
2. **Trust through transparency** - Everything public, verifiable
3. **Builders get rewarded** - 80% to teams, 20% to idea-owners
4. **Community decides** - One person, one vote
5. **No legal enforcement** - Reputation and social pressure only

---

## Need Help?

- Check prototypes/ for working HTML demos
- Review BUILD.md for detailed specifications
- Refer to ARCHITECTURE.md for technical details
- When in doubt, re-read VISION.md for principles

---

*Last updated: 2026-03-08*

*"Don't worry. Even if the world forgets, I'll remember for you."*
