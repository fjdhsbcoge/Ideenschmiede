# Ideenschmiede Living Specification

**Version:** 0.3.0  
**Last Updated:** 2026-03-03  
**Author:** Kimi Claw (AI Assistant)  
**Status:** Draft - Open for Review

**Changelog:**
- v0.3.0: Added missing features roadmap, DeepL translation, divergence tracking
- v0.2.0: Added Implementation Phase, Team Selection, Revenue Sharing, Chain-of-Thought rewards
- v0.1.0: Initial specification with Voting, DLC, and Share Tracking

---

## 0. Divergence Tracking (From Original Whitepaper)

### Core Vision Preserved ✅
- Marketplace for ideas
- Community voting on ideas
- Multiple competing teams per idea
- Bitcoin-native payments
- Open source ethos

### Intentional Divergences ⚠️

| Aspect | Whitepaper | Current Implementation | Rationale |
|--------|-----------|----------------------|-----------|
| **Voting threshold** | >50% negative = reject | >25% downvotes = reject | Stricter quality control for tech-savvy community |
| **Access control** | Open for registered users | $120/year subscription | Prevent spam, ensure serious participants |
| **Equity default** | Ideator sets, holds 100% | 50/50 team/idea-owners | Fair compensation for builders |
| **Server funding** | Transaction fees | Subscription fees | Predictable revenue model |
| **File storage** | Unlimited uploads | Minimal (links preferred) | Cost control, teams use own tools |
| **Revenue accountability** | Smart contracts | Transparency + milestones | Practical enforcement without legal overhead |

### Missing Features (Future Implementation)
- Patent research tools
- Accounting integrations  
- Legally secure documents
- Derivative idea logic
- Decentralized storage

---

## 1. Executive Summary

Ideenschmiede is a decentralized marketplace for ideas built on Bitcoin. Ideas are validated through community voting, then funded through DLC (Discreet Log Contract) investments. Ownership is tracked via Bitcoin UTXOs.

### Core Principles
- **Bitcoin-only:** No other blockchains, no tokens
- **Trust-minimized:** Federated oracle for voting attestation
- **Permissionless:** Anyone can post ideas, anyone can invest
- **Transparent:** All transactions on-chain, verifiable

---

## 2. System Overview

### 2.1 Actors

| Actor | Role |
|-------|------|
| **Ideator** | Creates ideas, sets initial share price, receives investments |
| **Investor** | Pledges Bitcoin to ideas, receives shares if idea passes |
| **Oracle (Federated)** | Attests to vote results, enables DLC settlement |
| **Platform** | Facilitates discovery, hosts discussion, tracks reputation |

### 2.2 Lifecycle of an Idea

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OPEN EXCHANGE │───▶│ VOTING PHASE    │───▶│  TRADING PHASE  │
│   (Discussion)  │    │ (8 days + DLC)  │    │ (Live trading)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   Ideas refined          Vote decides:           Shares trade
   Pledges made           - PASS: Funded          Secondary market
                          - FAIL: Refunded
```

---

## 3. Voting Phase Specification

### 3.1 Duration

- **Standard voting period:** 8 days from idea publication
- **Oracle attestation deadline:** 16 days (8 days voting + 8 days buffer)
- **Investor refund available:** 24 days (if oracle fails)

### 3.2 Voting Mechanics

#### One Person, One Vote

**⚠️ OPEN POINT:** Sybil resistance mechanism to be determined.

Options under consideration:
- Web-of-trust (vouching by existing members)
- Invitation codes (founder-distributed)
- Stake-based (1 satoshi = 1 vote, imperfect)

**Decision needed before mainnet launch.**

#### Vote Calculation

```
IF positive_votes > negative_votes:
    result = PASS
ELSE IF negative_votes >= positive_votes:
    result = FAIL
```

- Tie goes to FAIL (conservative, protects investors)
- Minimum quorum TBD (⚠️ OPEN POINT)

### 3.3 Investment During Voting

Investors can pledge Bitcoin during the 8-day voting period via DLC.

**Key rule:** Each investment is a **separate DLC** between one investor and the ideator.

---

## 4. DLC (Discreet Log Contract) Specification

### 4.1 Contract Structure

Each investment creates a DLC with two possible outcomes:

| Outcome | Condition | Funds go to |
|---------|-----------|-------------|
| **PASS** | Idea receives majority positive votes | Ideator |
| **FAIL** | Idea receives majority negative votes or tie | Investor (refund) |

### 4.2 Timeline

```
Day 0        Day 8        Day 16       Day 24
  │            │            │            │
  ▼            ▼            ▼            ▼
Idea       Voting      Oracle       Investor
posted     ends        deadline     refund
                       passes       available
```

### 4.3 Bitcoin Script (Simplified)

```
OP_IF
    // PASS path: Oracle signature required
    <oracle_pubkey> OP_CHECKSIGVERIFY
    <ideator_pubkey> OP_CHECKSIG
OP_ELSE
    // FAIL path: Oracle signature required
    <oracle_pubkey> OP_CHECKSIGVERIFY
    <investor_pubkey> OP_CHECKSIG
OP_ELSE
    // Timeout path: After 24 days, investor can reclaim
    <24_day_locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP
    <investor_pubkey> OP_CHECKSIG
OP_ENDIF
```

**Note:** Actual implementation uses adaptor signatures for privacy. See DLC specification for details.

### 4.4 Oracle Attestation

**⚠️ OPEN POINT:** Oracle key structure to be determined.

Current decision: **Federated oracle (2-of-3 multi-sig)**

**Key holders (TBD):**
- [ ] Key 1: Founder (@senator-thunfisch)
- [ ] Key 2: [Community member TBD]
- [ ] Key 3: [Community member TBD]

**Attestation format:**
```
Event ID: ideenschmiede:v1:idea:<idea_hash>:<outcome>
Outcome: "PASS" or "FAIL"
Timestamp: Unix timestamp of attestation
Signature: Schnorr signature by oracle
```

### 4.5 Fee Structure

| Fee Type | Paid By | Amount |
|----------|---------|--------|
| DLC transaction fee | Investor | Deducted from investment amount |
| Oracle attestation fee | Platform | Subsidized initially, may charge later |
| Miner fees | Investor | Standard Bitcoin network fee |

**Fee calculation:**
```
investment_amount = pledged_amount - estimated_fees
estimated_fees = dlc_tx_fee + miner_fee + buffer
```

---

## 5. Share Tracking

### 5.1 Share Definition

A "share" represents ownership in an idea. Shares are tracked via Bitcoin UTXOs with specific amounts.

**Initial state:**
- Ideator holds 100% of shares
- Total shares = 100,000,000 (1e8, like Bitcoin sats)

### 5.2 Share Price

Ideator sets initial share price in Bitcoin.

Example:
- Initial price: 0.00001 BTC per share
- Total idea valuation: 0.00001 * 100,000,000 = 1,000 BTC (if all shares sold)

### 5.3 Investment → Shares

When investor pledges amount X:
```
shares_received = X / current_share_price
```

Shares are represented as colored coins or simply tracked off-chain with Bitcoin UTXOs as proof.

**⚠️ OPEN POINT:** Exact share representation mechanism.

Options:
- RGB protocol (native asset on Bitcoin)
- Simple UTXO tracking (off-chain index)
- Client-side validation (RGB-like, simpler)

### 5.4 Ownership Visualization

```
@solar_punk (Ideator):     55% ████████████████████
@energy_whale:             20% ███████▌
@green_future:             15% █████▌
@tech_savvy:               10% ███▊
```

---

## 6. Trading Phase

### 6.1 Activation

Trading phase begins when:
1. Voting ends with PASS result
2. Oracle attests PASS outcome
3. Ideator claims invested funds
4. Shares are distributed to investors

### 6.2 Secondary Market

Investors can sell shares to other users.

**Price discovery:**
- Order book style (bids/asks)
- Or AMM (automated market maker) - ⚠️ OPEN POINT

**Transaction mechanism:**
- Atomic swaps (Bitcoin for shares)
- On-chain settlement

### 6.3 Revenue Distribution

**DEPRECATED:** See Section 10 (Implementation Phase) for updated revenue sharing model.

When idea generates revenue:
```
payout_per_share = total_revenue / total_shares
investor_payout = payout_per_share * investor_shares
```

**Note:** This simple model is replaced by the team-based equity pool system in Section 10.

---

## 7. Rejected Ideas

### 7.1 Outcome

If voting ends with FAIL result:
1. Oracle attests FAIL outcome
2. Investors can claim refund via DLC
3. Idea marked as "rejected" in platform
4. Ideator receives no funds

### 7.2 Refund Process

```
Investor calls: claim_refund(idea_id, investment_id)
Platform provides: oracle_attestation (FAIL)
Bitcoin tx: Investor receives original amount - fees
```

### 7.3 Resubmission

Rejected ideas can be:
- Modified and resubmitted as new idea
- Or abandoned

**⚠️ OPEN POINT:** Should there be a cooldown period for resubmission?

---

## 8. Derivatives and Forks

### 8.1 Definitions

| Type | Description |
|------|-------------|
| **Copy** | Identical idea, no changes |
| **Fork** | Modified version of original idea |
| **Extension** | Builds on original, adds new features |

### 8.2 Policy

- **Copies:** Deleted by platform (not protocol-enforced)
- **Forks/Extensions:** Allowed with original ideator approval
- **Attribution:** Automatic link to original idea

### 8.3 Equity Negotiation

Original ideator can negotiate equity in forks:
```
fork_equity = negotiated_percentage (default: 0%)
```

**⚠️ OPEN POINT:** How is this enforced? Social contract only, or DLC-based?

---

## 9. Identity and Reputation

### 9.1 Identity

Users identified by:
- **Platform username** (human-readable)
- **Bitcoin public key** (cryptographic identity)

**⚠️ OPEN POINT:** Username registration mechanism.

### 9.2 Reputation Tracking

On-chain reputation via Bitcoin attestations:

```
Reputation Event Types:
- idea_created: hash, timestamp
- idea_passed: hash, votes
- idea_failed: hash, votes
- investment_made: idea_hash, amount
- investment_returned: idea_hash, amount, ROI
```

Reputation score calculation TBD.

---

## 10. Implementation Phase

### 10.1 Overview

Once an idea passes voting, it enters the **Implementation Phase**. This is where the concept becomes reality through team execution.

**Key principle:** Each team forms a **separate equity pool**. Investors self-select which team(s) to fund.

### 10.2 Stakeholders

| Stakeholder | Role | Compensation |
|-------------|------|--------------|
| **Idea-share owners** | Original concept + validation | % of revenue from ALL team pools |
| **Investors** | Capital + curation | % of revenue (via idea-shares) |
| **Team-owners** | Execution + build | % of revenue (negotiated per team) |
| **Contributors** | Early feedback, refinements | % of exit (chain-of-thought pool) |

### 10.3 Implementation Flow

```
1. IDEA ACCEPTED
   └── Voting ends with PASS
   └── DLC funds released from investor locks
   
2. TEAM FORMATION
   └── Teams submit proposals with:
       - Milestone plan
       - Budget request
       - Equity ask (team-ownership %)
       
3. INVESTOR SELECTION
   └── Investors review proposals
   └── Each investor chooses which team(s) to fund
   └── Funds sent DIRECTLY to chosen team(s)
   └── No treasury middleman
   
4. PARALLEL BUILDING
   └── Multiple teams can build simultaneously
   └── Each team is independent
   └── Competition encouraged
   
5. REVENUE SHARING
   └── Each team generates revenue independently
   └── Revenue split per team:
       - 50% to idea-share owners (all investors + ideator)
       - 50% to team-owners
   
6. EXIT (Company Sale)
   └── Sale proceeds distributed:
       - Idea-share owners: 40%
       - Team-owners: 40%
       - Chain-of-thought pool: 5%
       - Platform reserve: 15%
```

### 10.4 Investment Flow & Ideator Ownership

**New Investment Model (v0.4):**

When investor buys Idea-Shares, funds are split:

```
Investor sends: ₿ 1.0
├── 15% (₿ 0.15) → Ideator wallet (immediate compensation)
├── 5%  (₿ 0.05) → Chain-of-thought pool (early contributors)
└── 80% (₿ 0.80) → Team of investor's choice (building funds)
```

**Ideator Ownership Formula:**
```
Ideator Ownership % = Ideator Investment / Outside Investment
```

**Example:**
- Ideator invests: ₿ 0.10
- Outside investment: ₿ 1.0
- Ideator ownership: 0.10 / 1.0 = **10%**

**Key Properties:**
1. **Immediate ideator profit:** 15% cut means 50% ROI immediately (₿ 0.15 received vs ₿ 0.10 invested)
2. **Dynamic ownership:** Higher ideator investment relative to outside = higher ownership %
3. **Team funding:** 80% goes directly to builders
4. **Early contributor rewards:** 5% to Discussion phase participants

**Why this works:**
- Ideator has skin in the game (must invest)
- Ideator compensated immediately for ideation work
- Investors see exactly where money goes
- Teams get majority of funds (80%)
- Low valuations reward ideators with higher ownership %

---

### 10.5 Equity Pool Structure

**Example:** Idea "Decentralized Energy Storage"

```
Idea Shares (100M total):
├── @solar_punk (Ideator): 10M shares (10%)  ← Dynamic: 0.10 / 1.0
├── @energy_whale: 40M shares (40%)
├── @green_future: 30M shares (30%)
└── @tech_savvy: 20M shares (20%)
```

**Revenue Split (Profit Only):**
- **20%** to Idea-Share holders (proportional to ownership)
- **80%** to Team-Share holders (proportional to investment)

**Exit Split (Company Sale):**
- ⚠️ OPEN POINT: Same 20/80 or different?

**Example Revenue Distribution:**
- Team A generates: ₿ 1.0 profit
- Idea-Share pool (20%): ₿ 0.20
  - @solar_punk (10%): ₿ 0.02
  - @energy_whale (40%): ₿ 0.08
  - etc.
- Team-Share pool (80%): ₿ 0.80
  - Distributed to team investors by investment amount

**Team-Share Structure:**
- Only **investors** are stakeholders
- Share ownership = Investment amount / Total team investment
- No "team equity" for builders (they're compensated via idea-shares if they invested)

**Example Team A:**
- Total invested: ₿ 0.80
- @energy_whale invested: ₿ 0.50 → 62.5% of team shares
- @green_future invested: ₿ 0.30 → 37.5% of team shares
- Revenue share proportional to investment

### 10.5 Team Selection (Investor Self-Selection)

**Process:**
1. Teams post proposals to platform
2. 7-day review period for investors
3. Each investor decides independently
4. No collective vote required

**Minimum funding:** Team can set minimum threshold. If not met, funds returned.

**Multiple investments:** Investor can fund multiple teams for same idea (diversification).

### 10.6 Revenue Split

**Standard terms:**
- Idea-share owners: **20%**
- Team-share holders: **80%**

**Note:** Fixed 20/80 split. Not negotiable per team.

### 10.7 Revenue Sharing & Accountability

**Core Challenge:** Teams work externally but must share revenue with idea-share holders.

**Enforcement Approach:** Transparency + Milestone Gates (not legal contracts)

#### Accountability Mechanism

**1. Public Revenue Reporting**
- Teams report revenue monthly
- Public dashboard shows all reports
- Historical data builds reputation
- Missing reports = red flag for future investors

**2. Milestone-Based Funding**
- Investor funds released in tranches
- Each tranche requires:
  - Proof of progress (deliverables)
  - Revenue report from previous period
  - Team attestation of continued commitment
- Natural checkpoint for accountability

**3. Reputation System**
- Teams with consistent reporting gain "Verified" badge
- Investors can filter by reputation tier
- Poor performers excluded from featured listings
- Community can flag suspicious behavior

**4. Social Pressure**
- Revenue reports are public and permanent
- Future funding depends on track record
- Community discussion around team performance
- Transparent equity split visible to all

**Explicitly NOT Used:**
- Legal contracts (expensive, jurisdiction-dependent)
- Revenue oracles (complex, adds friction)
- Mandatory platform integration (teams resist)

**Rationale:** Teams that want to cheat will find a way. The goal is attracting legitimate teams who value transparency and reputation.

### 10.8 Chain-of-Thought Rewards

**Purpose:** Reward early contributors who helped refine the idea.

**Qualifying contributions:**
- Substantive comments that improved the idea
- Voting participation (either direction)
- Sharing/amplification (tracked via referrals)

**Reward pool:** 5% of exit value

**Distribution:**
- Proportional to engagement score
- Minimum threshold to prevent spam
- Paid at exit (company sale or liquidation)

**Example:**
```
Exit value: $1,000,000
Chain-of-thought pool: $50,000 (5%)

Top contributors:
- @energy_whale (5 comments, early voter): $15,000
- @green_future (3 comments, refined concept): $10,000
- @random_user (1 comment, shared widely): $5,000
- Others: $20,000 distributed
```

### 10.8 Dispute Resolution

**Types of disputes:**
1. Revenue reporting (team claims lower revenue)
2. Milestone completion (disagreement on deliverables)
3. Equity split renegotiation

**Resolution ladder:**
1. Direct negotiation (30 days)
2. Investor vote (weighted by shares)
3. Team replacement (if vote >66% against team)
4. Arbitration (optional, external)

### 10.9 Treasury Model (Deprecated for Implementation)

**Note:** Original design included a multi-sig treasury (2-of-3: ideator, investor rep, platform).

**Current design:** Direct investor-to-team funding eliminates treasury need.

**⚠️ OPEN POINT:** Revisit if complex milestone-based funding is needed later.

---

## 11. Open Points Summary

| # | Topic | Priority | Notes |
|---|-------|----------|-------|
| 1 | **Sybil resistance** | Critical | One-person-one-vote mechanism |
| 2 | **Oracle key holders** | Critical | 2-of-3 federation members |
| 3 | **Share representation** | High | RGB vs UTXO tracking vs other |
| 4 | **Quorum requirement** | Medium | Minimum votes for valid decision |
| 5 | **Revenue attestation** | Medium | How to verify team revenue |
| 6 | **Team replacement process** | Medium | Technical mechanism for removing teams |
| 7 | **Chain-of-thought calculation** | Low | Engagement scoring algorithm |
| 8 | **Username registration** | Low | First-come-first-served vs auction |
| 9 | **Secondary market type** | Low | Order book vs AMM |
| 10 | **Treasury multi-sig** | Low | Only if milestone funding needed later |

---

## 15. Missing Features Roadmap (From Whitepaper)

### 15.1 Patent Research Tools
**Purpose:** Help ideators check patent landscape before investing time
**Features:**
- Patent search by keywords/classification
- Prior art detection
- Freedom-to-operate analysis
- Integration with patent databases (USPTO, EPO, etc.)

**Implementation:** Phase 2+ (post-MVP)

### 15.2 Accounting Integrations
**Purpose:** Automated bookkeeping for teams
**Features:**
- Expense tracking
- Revenue recognition
- Tax document generation
- Multi-currency support (BTC + fiat)

**Implementation:** Phase 2+ (post-MVP)

### 15.3 Legally Secure Documents
**Purpose:** Standardized contracts for team formation
**Templates:**
- Team formation agreement
- Equity distribution contract
- Revenue sharing agreement
- IP assignment (if applicable)

**Note:** Social contracts + reputation for MVP. Legal documents optional.

### 15.4 Storage Policy
**Philosophy:** Integration over storage. Teams use their own tools.

**Storage Limits:**
| Content Type | Limit | Rationale |
|-------------|-------|-----------|
| Team profile/logo | 2 MB | Small PNG/SVG |
| Idea attachments | 5 MB total | PDF whitepaper, mockups |
| Discussion images | 1 MB each | Compressed, auto-resize |
| Per-user total | 50 MB | Abuse prevention |

**What Ideenschmiede Stores:**
- Team metadata (members, equity split, funding status)
- Investment records (Bitcoin transactions)
- Voting data
- Reputation/verification proofs

**What Teams Handle Externally:**
- Source code → GitHub/GitLab
- Design files → Figma
- Documents → Notion/Google Drive
- Communication → Discord/Slack
- Project management → Linear/Jira

**External Tool Links:**
Teams can connect their external tools via URL:
```
GitHub: https://github.com/team/repo
Discord: https://discord.gg/invite-code
Figma: https://figma.com/file/...
```

### 15.5 Derivative Ideas System
**Purpose:** Handle forks, extensions, and copies
**Logic:**
- Copy detection (community flagging)
- Fork approval (original ideator consent)
- Attribution chain (link to original)
- Equity negotiation (original ideator can negotiate stake in forks)

**Implementation:** Phase 2

---

## 16. Internationalization

### 16.1 Machine Translation
**Service:** DeepL API
**Coverage:**
- All user-generated content (ideas, comments, team descriptions)
- UI elements (static strings)
- Real-time translation toggle

**Implementation:**
- Detect user language preference
- Store original + translated versions
- Allow users to contribute human translations for rewards

### 16.2 Language Priority
1. German (original)
2. English (primary international)
3. Other languages (community-driven)

---

## 17. Implementation Phases (Updated)

### Phase 1: MVP (Current)
- [x] Idea card prototype
- [x] Living specification v0.3.0
- [ ] Subscription system ($12/mo, $120/yr)
- [ ] Basic voting (no oracle needed)
- [ ] Team formation UI
- [ ] Direct investment flow
- [ ] Web interface

### Phase 2: Enhanced
- [ ] DeepL translation integration
- [ ] Patent research tools (basic)
- [ ] Accounting dashboard
- [ ] Derivative ideas system
- [ ] Revenue sharing contracts
- [ ] Chain-of-thought tracking
- [ ] Secondary market

### Phase 3: Decentralized
- [ ] Permissionless oracle federation
- [ ] DAO governance
- [ ] Decentralized storage
- [ ] Cross-platform integration

---

## 18. References

- [DLC Specification](https://github.com/discreetlogcontracts/dlcspecs)
- [RGB Protocol](https://rgb.info/)
- [Bitcoin Script](https://en.bitcoin.it/wiki/Script)
- [Schnorr Signatures (BIP-340)](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)
- [DeepL API Documentation](https://www.deepl.com/docs-api)

---

## 19. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-03 | 0.3.0 | Added divergence tracking, missing features roadmap, DeepL translation |
| 2026-02-22 | 0.2.0 | Added Implementation Phase, Team Selection, Revenue Sharing, Chain-of-Thought rewards |
| 2026-02-22 | 0.1.0 | Initial specification draft |

---

*This document is a living specification. It will evolve as decisions are made and implementation progresses. All significant changes should be logged in the Changelog section.*

*Authored by Kimi Claw, an AI assistant, in collaboration with @senator-thunfisch.*
