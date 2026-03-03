# Ideenschmiede V0 - Project Summary

**Last Updated:** 2026-03-04  
**Status:** Prototype Phase Complete  
**Repository:** https://github.com/fjdhsbcoge/Ideenschmiede

---

## What is Ideenschmiede?

A decentralized marketplace for ideas built on Bitcoin. Ideas are validated through community voting, then funded and built by teams, with revenue shared between idea-owners and builders.

**Tagline:** *Der Marktplatz für Ideen*

---

## Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Bitcoin-only** | No other blockchains, no tokens |
| **Trust-minimized** | Social contracts + transparency, not legal overhead |
| **One-person-one-vote** | Subscription-based ($120/year) as sybil resistance |
| **Open source** | Code and process transparent |
| **Parallel teams** | Multiple teams can build the same idea |

---

## Investment Model (v0.4)

### Where Your Investment Goes

When you buy Idea-Shares, your Bitcoin is split:

| Destination | % | Purpose |
|-------------|---|---------|
| **Ideator** | 15% | Immediate compensation for ideation |
| **Chain-of-thought** | 5% | Rewards early Discussion contributors |
| **Team** | 80% | Funds the team you choose |

**Example:** You invest ₿ 1.0
- ₿ 0.15 → Ideator (immediate)
- ₿ 0.05 → Early commenters/voters
- ₿ 0.80 → Team SolarGrid (your choice)

### Ideator Ownership Formula

```
Ideator Ownership % = Ideator Investment / Outside Investment
```

**Example:**
- Ideator invests: ₿ 0.10
- Outside investment: ₿ 1.0
- **Ideator owns: 10%** (0.10 / 1.0)

**Key insight:** Ideator makes **50% immediate profit** from the 15% cut, plus future revenue share from their ownership %.

---

## The Two Share Types

### Idea-Shares (Red)
- **What:** Ownership of the idea itself
- **Earn from:** ALL teams building the idea
- **Split:** **20%** of profit to idea-share holders, **80%** to team-share holders
- **Buy:** After voting approval, in marketplace

### Team-Shares (Orange)
- **What:** Ownership of a specific team
- **Earn from:** Only that team's revenue
- **Split:** Investment amount determines share ownership (investors only)
- **Buy:** Directly into team of your choice

---

## Process Flow (5 Steps)

```
1. 💡 Idee posten        → Discussion (free)
2. 🗳️ Community-Voting   → 8 days, >25% downvotes = reject
3. 🛒 In den Marktplatz  → After approval: Idea-Shares offered
4. 👥 Teams bilden       → Teams form, investors choose & invest
5. 🚀 Umsetzung          → Build, 20/80 profit split
```

---

## Access Control

| Feature | Free | Paid ($120/year) |
|---------|------|------------------|
| Discussion (post ideas, comment) | ✅ | ✅ |
| Marketplace (vote, invest, teams) | ❌ | ✅ |
| Create/join teams | ❌ | ✅ |

---

## Revenue Accountability

**Problem:** Teams work externally but must share revenue

**Solution:** Transparency + Milestone Gates

1. **Public revenue reporting** - Monthly, visible dashboard
2. **Milestone-based funding** - Funds released in tranches
3. **Reputation system** - "Verified" badge for good actors
4. **Social pressure** - Track record affects future funding

**NOT used:** Legal contracts, revenue oracles, mandatory platform integration

---

## Storage Policy

**Philosophy:** Integration over storage

| What | Limit | Where |
|------|-------|-------|
| Team logo | 2 MB | Ideenschmiede |
| Idea attachments | 5 MB | Ideenschmiede |
| Source code | - | GitHub/GitLab |
| Design files | - | Figma |
| Documents | - | Notion/Drive |
| Communication | - | Discord/Slack |

---

## Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Voting threshold | >25% downvotes = reject | Stricter quality control |
| Equity default | 50/50 team/idea-owners | Fair compensation for builders |
| Team selection | Investor self-selection | No central gatekeeper |
| Revenue enforcement | Transparency + milestones | Practical, not legal |
| Storage | Minimal + external links | Cost control |
| **Investment split** | **15/5/80** | Ideator compensated, teams funded |
| **Ideator ownership** | **Invested/Outside** | Skin in game, dynamic stake |

---

## Files in Repo

| File | Purpose |
|------|---------|
| `docs/index.html` | Live prototype (GitHub Pages) |
| `prototypes/ideenschmiede-v5.html` | Latest prototype source |
| `specs/SPECIFICATION.md` | Full technical specification |
| `docs/Ideenschmiede_Whitepaper.pdf` | Original whitepaper |

---

## Next Steps (When You Return)

1. **Review prototype** - https://fjdhsbcoge.github.io/Ideenschmiede
2. **Check specification** - `specs/SPECIFICATION.md`
3. **Decide on:**
   - Sybil resistance mechanism (web-of-trust vs other)
   - Share representation (RGB vs UTXO)
   - Oracle federation members

---

## Contact

Built by: Kimi Claw (AI Assistant)  
For: @senator-thunfisch

---

*"Don't worry. Even if the world forgets, I'll remember for you."* — Kimi Claw
