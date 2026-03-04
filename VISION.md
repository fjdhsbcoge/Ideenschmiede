# Ideenschmiede Vision

**Purpose:** This document describes the ideal version of Ideenschmiede - what we would build with unlimited resources and skills. It serves as guidance for future developers to understand our decisions and direction.

**Last Updated:** 2026-03-04

---

## Core Vision Statement

Ideenschmiede is the marketplace where ideas become reality through community validation and decentralized funding. Built on Bitcoin, it enables anyone to propose ideas, the community to validate them, and teams to build them - with fair compensation for everyone involved.

**Tagline:** *Der Marktplatz für Ideen*

---

## Why This Exists

### Problem We're Solving
1. **Ideas die in isolation** - Great ideas never get built because ideators lack resources
2. **Builders lack direction** - Developers want to build but don't know what the market needs
3. **Investment is gatekept** - Only accredited investors can invest in early-stage ideas
4. **Value capture is broken** - Ideators get nothing, platforms take everything

### Our Solution
- **Open ideation** - Anyone can post ideas
- **Community validation** - The crowd decides what's worth building
- **Parallel execution** - Multiple teams can build the same idea (competition)
- **Fair compensation** - 20% to idea-owners, 80% to builders (inverted from traditional)

---

## Core Principles (Non-Negotiable)

| Principle | Rationale |
|-----------|-----------|
| **Bitcoin-only** | No other blockchains, no tokens. Bitcoin is the only truly decentralized, censorship-resistant money. |
| **No legal contracts** | Social contracts + reputation + transparency. Legal contracts are jurisdiction-dependent and exclude global participation. |
| **One-person-one-vote** | Subscription-based ($120/year) prevents sybil attacks without requiring identity verification. |
| **Parallel teams** | Multiple teams per idea creates competition and increases success probability. |
| **Builders get majority** | 80% to teams, 20% to idea-owners. Builders do the work, they should get the reward. |
| **Radical transparency** | All revenue reports public, all transactions verifiable. Trust through visibility, not legal enforcement. |

---

## Ideal User Flow

### For Ideators
```
1. Post idea to Discussion (free)
   ↓
2. Gather feedback, refine concept
   ↓
3. Subscribe ($120/year) and move to Marketplace
   ↓
4. Receive immediate 15% of all investments
   ↓
5. Earn 20% of all team revenue forever
```

### For Investors
```
1. Subscribe ($120/year) for marketplace access
   ↓
2. Browse validated ideas
   ↓
3. Buy Idea-Shares (earn from ALL teams)
   ↓
4. Or invest directly in specific teams (earn from ONE team)
   ↓
5. Receive revenue share proportional to ownership
```

### For Builders
```
1. Browse marketplace ideas
   ↓
2. Form team and post proposal
   ↓
3. Receive investments directly (80% of funds)
   ↓
4. Build and generate revenue
   ↓
5. Share 20% with idea-owners, keep 80%
```

---

## The Two Share Types

### Idea-Shares (Red)
- **What:** Ownership of the idea itself
- **Earn from:** ALL teams building the idea
- **Split:** 20% of all team revenue
- **Exit:** Same 20% on company sale
- **Who can buy:** Subscribed members
- **Price:** Set by market dynamics

### Team-Shares (Orange)
- **What:** Ownership of a specific team
- **Earn from:** Only that team's revenue
- **Split:** 80% of team revenue (distributed by investment)
- **Who can buy:** Anyone (but only investors are stakeholders)
- **Price:** Set by team leader

---

## Revenue Flows

### Investment Split (When someone invests)
```
100% Investment
├── 15% → Ideator (immediate compensation)
├── 5%  → Early contributors (chain-of-thought rewards)
└── 80% → Team (building funds)
```

### Revenue Split (When team earns)
```
100% Team Revenue
├── 20% → Idea-Share holders (all investors in the idea)
└── 80% → Team-Share holders (investors in this specific team)
```

### Exit Split (Company sale)
```
Same as revenue: 20% / 80%
```

---

## Ideator Ownership Formula

**Dynamic ownership based on skin in the game:**

```
Ideator Ownership % = Ideator Investment / Outside Investment
```

**Example:**
- Ideator invests: ₿ 0.10
- Outside investment: ₿ 1.0
- Ideator owns: 10% of idea-shares

**Why this works:**
- More ideator investment = higher ownership
- Low valuations reward ideators with higher %
- Immediate 50% ROI from 15% cut incentivizes posting

---

## Chain-of-Thought Rewards

**Purpose:** Reward early contributors who helped refine the idea

**Scoring:**
```
Score = (Comments × 1) + (Upvotes × 2) + (Referrals)
Minimum: 3 points to qualify
```

**Distribution:**
- 5% of each investment
- Distributed immediately (not at exit)
- Proportional to engagement score

---

## Access Control

| Feature | Free | Subscription ($120/year) |
|---------|------|--------------------------|
| Browse Discussion | ✅ | ✅ |
| Post ideas to Discussion | ❌ | ✅ |
| Comment and vote | ❌ | ✅ |
| Move idea to Marketplace | ❌ | ✅ |
| Access Marketplace | ❌ | ✅ |
| Invest in ideas/teams | ❌ | ✅ |
| Create/join teams | ❌ | ✅ |

**Why subscription:**
- Sybil resistance (one person, one vote)
- Revenue model for platform sustainability
- Filters for serious participants

---

## Team Formation

**Process:**
1. Team leader posts proposal to marketplace idea
2. Defines: focus area, milestone plan, funding goal
3. Investors choose which team(s) to fund
4. Multiple teams per idea allowed (competition)
5. Teams work independently

**Team internal structure:**
- Only investors are stakeholders
- Share ownership = Investment / Total team investment
- No "team equity" for builders (they're compensated via idea-shares if they invested)

---

## Revenue Accountability

**Problem:** Teams work externally but must share revenue

**Solution:** Transparency + Milestone Gates (not legal contracts)

**Mechanisms:**
1. **Public revenue reporting** - Monthly, visible dashboard
2. **Milestone-based funding** - Funds released in tranches
3. **Reputation system** - "Verified" badge for consistent reporters
4. **Social pressure** - Public track record affects future funding

**Explicitly NOT used:**
- Legal contracts (jurisdiction-dependent)
- Revenue oracles (complex, adds friction)
- Mandatory platform integration (teams resist)

**Rationale:** Teams that want to cheat will find a way. The goal is attracting legitimate teams who value transparency.

---

## Technical Architecture (Ideal)

### Phase 1: MVP (Database)
- Centralized database for speed of iteration
- Bitcoin payments via standard wallets
- Simple web interface

### Phase 2: RGB Protocol
- Decentralized share tracking
- Client-side validation
- Bitcoin-native assets

### Phase 3: Full Decentralization
- Permissionless oracle federation (if needed)
- DAO governance
- Cross-platform integration

---

## Why These Decisions

| Decision | Alternative Considered | Why We Chose This |
|----------|------------------------|-------------------|
| 20/80 split | 50/50 or ideator-controlled | Builders do the work, should get majority |
| Subscription sybil resistance | Web-of-trust, stake-based | Simple, effective, generates revenue |
| No legal contracts | Standard equity agreements | Global participation, no jurisdiction lock-in |
| Parallel teams | Exclusive licensing | Competition increases success probability |
| Social accountability | Smart contract enforcement | Teams work externally anyway, social pressure more practical |
| Database → RGB | Start with RGB | Validate product-market fit first |

---

## Success Metrics

**Platform health:**
- Number of ideas posted
- Percentage reaching marketplace
- Number of teams formed
- Total investment volume
- Revenue generated by teams

**User success:**
- Ideators: Revenue from idea-shares
- Investors: ROI on investments
- Teams: Revenue from team-shares

**Ecosystem health:**
- Number of successful exits
- Ideas forked/extended
- Community engagement (comments, votes)

---

## Future Possibilities

**Phase 2+ features:**
- Patent research tools
- Accounting integrations
- Legally secure documents (optional)
- Derivative ideas system
- Secondary market for shares
- DeepL translation for internationalization

**Not in scope (intentionally):**
- Token launch
- Other blockchains
- KYC/AML (subscription is sufficient)
- Exclusive licensing
- Legal enforcement

---

## For Future Developers

**Before changing anything in this document:**
1. Understand why the decision was made
2. Consider the core principles
3. Ask: Does this help ideators, investors, or builders?
4. Ask: Does this maintain Bitcoin-only ethos?
5. Ask: Does this preserve fairness (20/80)?

**This vision is:**
- ✅ A guide for building
- ✅ A record of decisions
- ✅ A communication tool
- ❌ Not set in stone (evolve with learning)
- ❌ Not a technical spec (see BUILD.md for that)

---

*Authored by Kimi Claw (AI Assistant) in collaboration with @senator-thunfisch*

*"Don't worry. Even if the world forgets, I'll remember for you."*
