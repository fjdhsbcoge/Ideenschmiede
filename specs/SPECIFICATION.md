# Ideenschmiede Living Specification

**Version:** 0.1.0  
**Last Updated:** 2026-02-22  
**Author:** Kimi Claw (AI Assistant)  
**Status:** Draft - Open for Review

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

When idea generates revenue:
```
payout_per_share = total_revenue / total_shares
investor_payout = payout_per_share * investor_shares
```

**⚠️ OPEN POINT:** Revenue attestation mechanism.

How does the platform verify revenue? Options:
- Self-reported by ideator (reputation risk)
- Third-party oracle (adds trust)
- On-chain revenue (if Bitcoin-native business)

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

## 10. Open Points Summary

| # | Topic | Priority | Notes |
|---|-------|----------|-------|
| 1 | **Sybil resistance** | Critical | One-person-one-vote mechanism |
| 2 | **Oracle key holders** | Critical | 2-of-3 federation members |
| 3 | **Share representation** | High | RGB vs UTXO tracking vs other |
| 4 | **Quorum requirement** | Medium | Minimum votes for valid decision |
| 5 | **Revenue attestation** | Medium | How to verify idea revenue |
| 6 | **Resubmission cooldown** | Low | Time between rejected → new submission |
| 7 | **Fork equity enforcement** | Low | Social vs technical enforcement |
| 8 | **Username registration** | Low | First-come-first-served vs auction |
| 9 | **Secondary market type** | Low | Order book vs AMM |

---

## 11. Implementation Phases

### Phase 1: MVP (Current)
- [x] Idea card prototype
- [ ] DLC implementation (basic)
- [ ] Federated oracle (2-of-3)
- [ ] Simple share tracking
- [ ] Web interface

### Phase 2: Enhanced
- [ ] Sybil resistance mechanism
- [ ] RGB protocol integration
- [ ] Secondary market
- [ ] Reputation system

### Phase 3: Decentralized
- [ ] Permissionless oracle federation
- [ ] DAO governance
- [ ] Cross-platform integration

---

## 12. References

- [DLC Specification](https://github.com/discreetlogcontracts/dlcspecs)
- [RGB Protocol](https://rgb.info/)
- [Bitcoin Script](https://en.bitcoin.it/wiki/Script)
- [Schnorr Signatures (BIP-340)](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)

---

## 13. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-22 | 0.1.0 | Initial specification draft |

---

*This document is a living specification. It will evolve as decisions are made and implementation progresses. All significant changes should be logged in the Changelog section.*

*Authored by Kimi Claw, an AI assistant, in collaboration with @senator-thunfisch.*
