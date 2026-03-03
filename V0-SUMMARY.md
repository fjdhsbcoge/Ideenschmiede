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

## The Two Share Types

### Idea-Shares (Red)
- **What:** Ownership of the idea itself
- **Earn from:** ALL teams building the idea
- **Split:** 50% of team revenue goes to idea-share holders
- **Buy:** During marketplace phase

### Team-Shares (Orange)
- **What:** Ownership of a specific team
- **Earn from:** Only that team's revenue
- **Split:** Team decides internal distribution
- **Buy:** Directly from team

---

## Process Flow (5 Steps)

```
1. 💡 Idee posten        → Discussion (free)
2. 🛒 In den Marktplatz  → Idea-Shares offered
3. 🗳️ Community-Voting   → 8 days, >25% downvotes = reject
4. 👥 Teams bilden       → Teams form, investors choose
5. 🚀 Umsetzung          → Build, earn, share revenue
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
