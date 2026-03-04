# Ideenschmiede Build Manual

**Purpose:** Step-by-step building instructions for developers. Each version corresponds to a working demo.

**Current Version:** v0.1

---

## Version History

| Version | Date | Status | Demo Link |
|---------|------|--------|-----------|
| v0.1 | 2026-03-04 | In Progress | https://fjdhsbcoge.github.io/Ideenschmiede |

---

## v0.1 - Basic Flow Demo

### Goal
Demonstrate the core user flow: login → post idea → view idea → move to marketplace → invest.

### Features Implemented

#### 1. Authentication
**Requirements:**
- Login modal with two options: "user" (free) or "member" (paid)
- State persisted in localStorage
- Logout functionality
- UI updates based on login state

**Implementation:**
```javascript
// State structure
{
  user: string | null,      // username
  member: boolean,          // subscription status
  ideas: [],                // all ideas
  investments: []           // all investments
}
```

**Access Control:**
| Feature | Not Logged | Free User | Member |
|---------|------------|-----------|--------|
| Browse Discussion | ✅ | ✅ | ✅ |
| Post ideas | ❌ | ✅ | ✅ |
| Comment/vote | ❌ | ✅ | ✅ |
| Move to marketplace | ❌ | ❌ | ✅ |
| Access marketplace | ❌ | ❌ | ✅ |
| Invest | ❌ | ❌ | ✅ |

#### 2. Idea Creation
**Requirements:**
- Form with title and description
- Location selector: Discussion (free) or Marketplace (member-only)
- Validation: Marketplace requires membership
- Save to localStorage

**Data Structure:**
```javascript
{
  id: number,
  title: string,
  desc: string,
  author: string,
  phase: 'discussion' | 'marketplace',
  createdAt: timestamp,
  votes: { up: number, down: number },
  comments: number,
  // Marketplace fields (set when moved)
  ideatorInvestment: number,    // default 0.1
  outsideInvestment: number,    // starts at 0
  sharePrice: number            // default 0.0001
}
```

#### 3. Discussion Page
**Requirements:**
- List all ideas in 'discussion' phase
- Show login prompt if not logged in
- Show "Create Idea" button for logged-in users
- Show "Move to Marketplace" button for idea author (members only)
- Click idea to view detail

**UI Elements:**
- Badge: "💬 In Diskussion"
- Stats: author, vote %, comment count
- Action buttons based on permissions

#### 4. Idea Detail Page
**Requirements:**
- Full description
- Statistics sidebar (supporters, comments)
- Comments section with input
- Voting section (marketplace only, members only)
- Investment card (marketplace only)
- Teams sidebar (marketplace only)

**Conditional Display:**
```
IF phase === 'marketplace':
  - Show voting section
  - Show investment card
  - Show teams sidebar
  
IF user is member:
  - Enable voting buttons
  - Enable invest button
  
IF user is logged in:
  - Show comment input
```

#### 5. Marketplace Page
**Requirements:**
- Show paywall for non-members
- Show marketplace content for members
- List all marketplace ideas
- Show teams sidebar

**Paywall Content:**
- Lock icon
- Pricing: $12/month or $120/year
- Feature list
- CTA to subscribe (demo: instant activation)

#### 6. Investment Flow
**Requirements:**
- Modal with amount input
- Show investment split visualization (15/5/80)
- Confirm investment
- Update idea's outsideInvestment
- Save investment record

**Investment Split Display:**
```
15% → Ideator (immediate)
 5% → Early contributors
80% → Team (your choice)
```

### File Structure

```
prototypes/
└── ideenschmiede-demo.html    # Main demo file

docs/
└── index.html                 # GitHub Pages (copy of demo)
```

### Code Organization

**HTML Structure:**
```html
<!-- Pages -->
<div id="home" class="page active">...</div>
<div id="discussion" class="page">...</div>
<div id="marketplace" class="page">...</div>
<div id="idea-detail" class="page">...</div>

<!-- Modals -->
<div class="modal" id="create-idea-modal">...</div>
<div class="modal" id="invest-modal">...</div>
```

**JavaScript Structure:**
```javascript
// State Management
const State = { user, member, ideas, investments, save(), login(), logout(), ... }

// UI Functions
function showPage(pageId)
function updateUI()
function renderDiscussion()
function renderMarketplace()
function showIdeaDetail(ideaId)

// Action Functions
function createIdea()
function moveToMarketplace(id)
function openInvestModal(ideaId)
function confirmInvest()

// Utilities
function showToast(message, type)
```

### Styling

**CSS Variables:**
```css
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
```

**Components:**
- `.card` - White rounded container
- `.btn` - Button base
- `.btn-primary` - Gradient red button
- `.btn-secondary` - Dark button with border
- `.badge-*` - Status badges (discussion, marketplace, voting)
- `.modal` - Overlay modal
- `.toast` - Notification popup

### Demo Data

**Initial Ideas (2):**
1. "Dezentrale Energiespeicher-Community" - Discussion phase
2. "Open-Source Medikamenten-Datenbank" - Marketplace phase

**Demo Teams (2):**
1. Team SolarGrid - German markets focus
2. Team EnergyShare - European expansion

### Testing Checklist

**Authentication:**
- [ ] Login as "user" → shows free user state
- [ ] Login as "member" → shows member state
- [ ] Logout → returns to anonymous state
- [ ] Refresh page → state persists

**Discussion:**
- [ ] Not logged in → sees login prompt
- [ ] Logged in → sees "Create Idea" button
- [ ] Free user → can post idea to discussion
- [ ] Free user → CANNOT move to marketplace
- [ ] Member → can move own idea to marketplace

**Marketplace:**
- [ ] Not logged in → sees paywall with login CTA
- [ ] Free user → sees paywall with subscribe CTA
- [ ] Member → sees marketplace content
- [ ] Member → can invest button works

**Idea Detail:**
- [ ] Click idea → opens detail page
- [ ] Discussion idea → no voting section
- [ ] Marketplace idea → shows voting (members only)
- [ ] Shows comments, stats, teams

**Investment:**
- [ ] Open invest modal → shows split visualization
- [ ] Confirm → updates investment totals
- [ ] Toast notification appears

### Known Limitations (v0.1)

1. **No real Bitcoin integration** - Demo only
2. **No backend** - Everything in localStorage
3. **No real voting** - Buttons show toast only
4. **No real comments** - Static demo comments
5. **No team creation** - Static demo teams
6. **No revenue tracking** - Not implemented yet

### Next Version (v0.2) Ideas

- [ ] Real comment system
- [ ] Team creation flow
- [ ] User profile page
- [ ] Investment portfolio view
- [ ] Revenue reporting UI
- [ ] Chain-of-thought scoring display

---

## Building from Scratch

### Step 1: Setup
```bash
# Create file structure
mkdir -p prototypes docs

# Create empty HTML file with basic structure
touch prototypes/ideenschmiede-demo.html
```

### Step 2: HTML Skeleton
- Add CSS variables and base styles
- Create page containers (home, discussion, marketplace, idea-detail)
- Create modals (create-idea, invest)
- Add navigation

### Step 3: JavaScript State
- Implement State object with localStorage
- Add login/logout functions
- Add save/load functions

### Step 4: Render Functions
- Implement renderDiscussion()
- Implement renderMarketplace()
- Implement showIdeaDetail()

### Step 5: Action Functions
- Implement createIdea()
- Implement moveToMarketplace()
- Implement invest flow

### Step 6: Polish
- Add toast notifications
- Add loading states
- Test all flows
- Deploy to GitHub Pages

---

## Deployment

**GitHub Pages:**
```bash
# Copy demo to docs folder
cp prototypes/ideenschmiede-demo.html docs/index.html

# Commit and push
git add prototypes/ docs/
git commit -m "Update demo v0.1"
git push origin master
```

**Live URL:** https://fjdhsbcoge.github.io/Ideenschmiede

---

## Questions?

See VISION.md for why these decisions were made.
See SPECIFICATION.md for technical details (note: may be outdated).

---

*Authored by Kimi Claw (AI Assistant)*
