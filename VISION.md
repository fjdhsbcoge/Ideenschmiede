# Ideenschmiede Vision

**Purpose:** This document describes the ideal version of Ideenschmiede - what we would build with unlimited resources and skills. It serves as guidance for future developers to understand our decisions and direction.

**Last Updated:** 2026-03-05

---

## Core Vision Statement

Ideenschmiede is the marketplace where ideas become reality through community validation and decentralized funding. It enables anyone to propose ideas, the community to validate them, and teams to build them—with fair compensation for everyone involved.

**Tagline:** *The Marketplace for Ideas*

**Subtitle:** *The idea-to-product value chain, rethought*

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
3. Subscribe ($120/year) and move OWN Idea to Marketplace (only ideator can move)
   ↓
4. Receive immediate 15% of all investments
```

### For Investors
```
1. Subscribe ($120/year) for marketplace access
   ↓
2. Browse validated ideas
   ↓
3. Buy Idea-Shares (earn from ALL teams, first to invest in Series A funding)
   ↓
4. Or invest directly in specific teams (earn from ONE team)
   ↓
5. Receive revenue share and exit share proportional to ownership
```

### For Builders
```
1. Browse marketplace ideas
   ↓
2. Form team and post proposal
   ↓
3. Receive investments, defined by milestones
   ↓
4. Build and generate revenue
   ↓
5. Share 20% with idea-share-owners and keep 80% between team-share-owners
```

---

## The Two Share Types

### Idea-Shares
- **What:** Ownership of the idea itself
- **Earn from:** ALL teams based on the idea
- **Split:** 20% of all team revenue
- **Exit:** Same 20% on company sale
- **Who can buy:** Subscribed members
- **Price:** Dynamic, based on investment ratio

**Share Percentage Formula:**
```
Your Idea Shares: Your sat invested/ Total sat invested into Idea

```

**Example:**
In total: 100000 sat Investment

Investor 1: 20000 sat = 20% Idea shares
Investor 2: 30000 sat = 30% Idea shares
Investor 3: 50000 sat = 50% Idea shares


### Team-Shares 
- **What:** Ownership of a specific team
- **Earn from:** 80% of that team's revenue/exit (distributed by ownership)
- **Who can buy:** Anyone
- **Price:** Same dynamic formula as Idea-Shares
- **When:** Available after team formation, buyable at any time

**Team Formation Flow:**
1. **Team Leader Application** - Posts proposal with:
   - Skin-in-game investment (required)
   - Roadmap with milestones
   - Budget breakdown
   - Focus area and team composition
   - Minimum funding goal

2. **Investor Team Selection** - Idea-Share investors choose which team(s) to fund:
   - Their portion of the 80% pool goes to chosen team(s)
   - Can diversify across multiple teams
   - **Non-refundable** once committed

3. **Ongoing Team Funding** - Anyone can buy Team-Shares:
   - Price determined by same formula
   - Funds go directly to team
   - Available at any point in the process

**Team Funding Safeguards:**
- **Minimum Threshold:** Team sets funding goal + timeline
  - If not reached → automatic refund to investors
- **Milestone-Based Release:** Funds released in tranches
  - Team defines milestones in proposal
  - Investors vote on milestone completion
  - If milestone failed → vote to continue or refund remainder
- **Team Leader Reputation:** Track record visible, stake at risk

**Why these safeguards:**
- Protects investors from bad actors
- Ensures only viable teams get funded
- Aligns team incentives with delivery
- Maintains investor confidence in the platform

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
100% Company Exit
├── 20% → Idea-Share holders (all investors in the idea)
└── 80% → Team-Share holders (investors in this specific team)
```
```

---

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
- Distributed after Team funding is finished
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
1. Team leader posts proposal to build idea
2. Defines: focus area, milestone plan, funding goal, "skin in the game" -investment
3. Investors choose which team(s) to fund
4. Multiple teams per idea allowed (competition)
5. Teams work independently

**Team internal structure:**
- Share ownership = Investment / Total team investment

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
