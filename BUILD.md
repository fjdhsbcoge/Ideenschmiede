# Ideenschmiede Build Manual

**Purpose:** Step-by-step instructions for building Ideenschmiede. Designed for AI agents and developers.

**Current Version:** v0.4  
**Last Updated:** 2026-03-10  
**Live Demo:** https://fjdhsbcoge.github.io/Ideenschmiede/v0.4/

---

## Version Overview

| Version | Date | Status | What's New |
|---------|------|--------|------------|
| v0.1 | 2026-03-04 | ✅ Complete | Basic flow: login → post → invest |
| v0.2 | 2026-03-05 | ✅ Complete | Stage visualization + profile |
| v0.3 | 2026-03-08 | ✅ Complete | Landing page + 4 connected subpages |
| v0.4 | 2026-03-09 | ✅ Complete | Interactive demo with animations, role system |
| v0.4.1 | 2026-03-10 | ✅ Complete | Navigation fixes, Dashboard link added, docs updated |

---

## v0.4 - Interactive Demo

### What We Built

**Complete interactive demo located in `/docs/v0.4/`:**

**Landing Pages (2 languages):**
- German: `index.html` - With scroll animations, hover effects, shimmer effects
- English: `index-en.html` - Full i18n support

**Interactive Pages (10 total):**
1. **Landing** - Scroll progress bar, animated cards, shimmer effects
2. **Discussion** - Filter buttons, sort dropdown, **role-based access**, feedback only (no voting)
3. **Idea Detail** - Comment posting, **role-based access**, CTA to marketplace
4. **Create Idea** - **NEW** 4-step wizard for posting ideas
5. **Marketplace** - **Hard paywall**, voting phase, team application, series funding
6. **Team Apply** - **Hard paywall**, dynamic milestones, budget calculator, validation
7. **Team Create** - **NEW** Form new teams for marketplace ideas
8. **Teams** - Tab navigation, progress tracking, member lists
9. **Dashboard** - Role switcher, stats, wallet, earnings chart
10. **Profile** - Wallet display, earnings chart, investment list, role switcher

**New Interactive Features:**
- Scroll-triggered animations (Intersection Observer)
- Real-time voting with visual feedback
- Investment calculator (share price × amount)
- Dynamic form validation
- Toast notifications
- Modal dialogs
- Budget auto-calculation
- Tab navigation
- Copy-to-clipboard
- **3-Tier Role System** (Visitor/User/Subscriber)
- **Paywall overlays** for non-subscribers
- **Role switcher** in Dashboard and Profile

---

## Build Instructions

### Step 1: Project Setup

**Create folder structure:**
```bash
mkdir -p ideenschmiede/docs/v0.4
mkdir -p ideenschmiede/prototypes
cd ideenschmiede
```

**Initialize Git:**
```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/ideenschmiede.git
```

**Create .gitignore:**
```
# System files
.DS_Store
Thumbs.db

# Node modules (if added later)
node_modules/

# Logs
*.log
```

---

### Step 2: Create Base Template

Every page starts with this template:

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PAGE_TITLE - Ideenschmiede</title>
    <style>
        /* CSS Custom Properties */
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
        
        /* Reset */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: var(--bg-primary); 
            color: var(--text-primary); 
            line-height: 1.6; 
        }
        
        /* Navigation */
        .main-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: rgba(10, 10, 15, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border-color);
            z-index: 1000;
            padding: 16px 24px;
        }
        
        .main-nav-container {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .nav-logo {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-primary);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .nav-logo-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--accent-primary), #ff6b6b);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .nav-menu {
            display: flex;
            gap: 8px;
        }
        
        .nav-item {
            padding: 10px 16px;
            border-radius: 8px;
            text-decoration: none;
            color: var(--text-secondary);
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s ease;
        }
        
        .nav-item:hover, .nav-item.active {
            background: var(--bg-tertiary);
            color: var(--text-primary);
        }
        
        .nav-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }
        
        .badge-free { background: var(--accent-green); color: var(--bg-primary); }
        .badge-login { background: var(--accent-blue); color: var(--bg-primary); }
        .badge-member { background: var(--accent-primary); color: white; }
        
        /* Mobile Menu */
        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 24px;
            cursor: pointer;
        }
        
        @media (max-width: 900px) {
            .nav-menu {
                display: none;
                position: absolute;
                top: 60px;
                left: 0;
                right: 0;
                background: var(--bg-secondary);
                flex-direction: column;
                padding: 16px;
                border-bottom: 1px solid var(--border-color);
            }
            .nav-menu.active { display: flex; }
            .mobile-menu-btn { display: block; }
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="main-nav">
        <div class="main-nav-container">
            <a href="index.html" class="nav-logo">
                <div class="nav-logo-icon">⚡</div>
                <span>Ideenschmiede</span>
            </a>
            <button class="mobile-menu-btn" onclick="document.getElementById('navMenu').classList.toggle('active')">☰</button>
            <div class="nav-menu" id="navMenu">
                <a href="discussion.html" class="nav-item">
                    💡 Ideen-Diskussion <span class="nav-badge badge-free">Frei</span>
                </a>
                <a href="marketplace.html" class="nav-item">
                    🛒 Ideen-Marktplatz <span class="nav-badge badge-member">Mitglied</span>
                </a>
                <a href="teams.html" class="nav-item">
                    👥 Meine Teams <span class="nav-badge badge-member">Mitglied</span>
                </a>
                <a href="dashboard.html" class="nav-item">
                    📊 Dashboard <span class="nav-badge badge-login">Login</span>
                </a>
                <a href="profile.html" class="nav-item">
                    👤 Profil <span class="nav-badge badge-login">Login</span>
                </a>
            </div>
        </div>
    </nav>
    
    <!-- Content -->
    <div style="padding-top: 80px;">
        <!-- Page content here -->
    </div>
</body>
</html>
```

---

### Step 3: Build Landing Page

**Key Components:**
1. Hero section with gradient text
2. Benefits cards (3 roles)
3. Timeline section (6 steps)
4. CTA section with 3 options

**Interactive Features:**
- Scroll progress bar
- Intersection Observer animations
- Language switcher
- Smooth scroll navigation

---

### Step 4: Build Discussion Page

**Key Components:**
1. Page header with title and "New Idea" button
2. Filter buttons (Alle, Trending, Neueste, Kontrovers)
3. Sort dropdown
4. Idea cards with voting

**Role-Based Implementation:**
```javascript
// Role Management
let currentRole = localStorage.getItem('ideenschmiede_role') || 'visitor';

function updateUIBasedOnRole() {
    // Show login notice for visitors
    if (currentRole === 'visitor') {
        showLoginNotice();
    }
    
    // Show/hide new idea button
    const newIdeaBtn = document.querySelector('.btn-primary');
    newIdeaBtn.style.display = (currentRole === 'user' || currentRole === 'subscriber') 
        ? 'inline-flex' : 'none';
    
    // Filter buttons - disabled for visitors
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (currentRole === 'visitor') {
            btn.onclick = () => showToast('Anmeldung erforderlich');
            btn.style.opacity = '0.5';
        }
    });
}

function vote(id, type) {
    // Only subscribers can vote
    if (currentRole === 'visitor') {
        showToast('Bitte melde dich an');
        return;
    }
    if (currentRole === 'user') {
        showToast('Upgrade auf Subscriber für Voting');
        return;
    }
    // ... voting logic
}
```

---

### Step 5: Build Dashboard Page (NEW)

**Key Components:**
1. Navigation with role switcher
2. Stats grid (4 metrics)
3. Wallet card
4. Earnings chart
5. Ideas list
6. Investments list

**Role Switcher Implementation:**
```javascript
function toggleRoleDropdown() {
    document.getElementById('roleDropdown').classList.toggle('active');
}

function setRole(role) {
    currentRole = role;
    localStorage.setItem('ideenschmiede_role', role);
    updateUI();
    updateProfile();
}

function updateUI() {
    // Update role badge
    document.getElementById('currentRoleBadge').textContent = 
        roleConfig[role].name;
    
    // Update profile section
    document.getElementById('profileAvatar').textContent = 
        roleConfig[role].icon;
    document.getElementById('profileName').textContent = 
        role === 'visitor' ? 'Gast' : '@' + role;
    document.getElementById('profileBadge').textContent = 
        roleConfig[role].icon + ' ' + roleConfig[role].name;
    
    // Show/hide wallet for visitors
    const wallet = document.querySelector('.wallet-card');
    wallet.style.display = role === 'visitor' ? 'none' : 'block';
}
```

---

### Step 6: Build Marketplace with Paywall

**Paywall Implementation:**
```html
<!-- Paywall Overlay (shown to non-subscribers) -->
<div class="paywall-overlay" id="paywall">
    <div class="paywall-content">
        <div class="paywall-icon">💎</div>
        <h2 class="paywall-title">Subscriber-Bereich</h2>
        <p class="paywall-text">
            Der Ideen-Marktplatz ist exklusiv für Subscriber verfügbar...
        </p>
        <div class="paywall-price">$120</div>
        <p class="paywall-price-note">pro Jahr · Unbegrenzter Zugang</p>
        
        <div class="paywall-features">
            <div class="paywall-feature">
                <span class="paywall-feature-icon">✓</span>
                <span>In alle Marktplatz-Ideen investieren</span>
            </div>
            <!-- More features... -->
        </div>
        
        <a href="profile.html" class="btn-primary">Jetzt Subscriber werden</a>
        <br>
        <a href="discussion.html" class="btn-secondary">← Zurück zur Diskussion</a>
    </div>
</div>
```

**CSS for Paywall:**
```css
.paywall-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(10, 10, 15, 0.98);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
}

.paywall-content {
    max-width: 600px;
    text-align: center;
    background: var(--bg-secondary);
    border: 2px solid var(--accent-primary);
    border-radius: 24px;
    padding: 48px 40px;
    position: relative;
    overflow: hidden;
}

.paywall-content::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, transparent 30%, rgba(233, 69, 96, 0.1) 50%, transparent 70%);
    animation: shimmer 3s infinite;
}

@keyframes shimmer {
    0% { transform: translateX(-100%) rotate(45deg); }
    100% { transform: translateX(100%) rotate(45deg); }
}
```

---

### Step 7: Build Teams Page

**Key Components:**
1. Tab navigation (Leading / Member / Applications)
2. Team cards with stats
3. Upgrade notice for non-subscribers
4. Progress tracking

**Upgrade Notice (for non-subscribers):**
```html
<div class="upgrade-notice">
    <div style="font-size: 32px; margin-bottom: 12px;">💎</div>
    <div style="font-weight: 600; margin-bottom: 8px;">Subscriber Features</div>
    <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">
        Upgrade auf Subscriber, um eigene Teams zu bilden und Funding zu erhalten.
    </div>
    <a href="profile.html" class="btn-primary">Mehr erfahren</a>
</div>
```

---

### Step 8: Build Team Apply Page

**Key Components:**
1. Progress steps indicator
2. Idea selection display
3. Team details form
4. Dynamic milestone list (add/remove)
5. Budget calculator
6. Skin-in-game validation

**Dynamic Milestones:**
```javascript
let milestoneCount = 3;

function addMilestone() {
    milestoneCount++;
    const list = document.getElementById('milestonesList');
    const item = document.createElement('div');
    item.className = 'milestone-item';
    item.innerHTML = `
        <div class="milestone-header">
            <span class="milestone-number">${milestoneCount}</span>
            <button type="button" class="btn-remove" onclick="removeMilestone(this)">✕</button>
        </div>
        <input type="text" class="milestone-title" placeholder="Meilenstein ${milestoneCount}" required>
        <input type="date" class="milestone-date" required>
        <input type="number" class="milestone-budget" placeholder="Budget (BTC)" 
               min="0" step="0.001" onchange="calculateBudget()" required>
    `;
    list.appendChild(item);
}

function removeMilestone(btn) {
    btn.closest('.milestone-item').remove();
    updateMilestoneNumbers();
    calculateBudget();
}
```

---

### Step 9: Deployment

**Deploy to GitHub Pages:**
```bash
# Add all files
git add .

# Commit
git commit -m "Add v0.4 interactive demo with role system"

# Push
git push origin master

# Enable GitHub Pages in repository settings
# Set source to /docs folder
```

---

## Component Library

### Buttons
```css
.btn-primary {
    display: inline-block;
    padding: 14px 28px;
    background: linear-gradient(135deg, var(--accent-primary), #ff6b6b);
    border: none;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.3s ease;
}

.btn-secondary {
    display: inline-block;
    padding: 12px 24px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    font-size: 14px;
    cursor: pointer;
    text-decoration: none;
}
```

### Cards
```css
.card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 32px;
    transition: all 0.3s ease;
}

.card:hover {
    border-color: var(--accent-primary);
    transform: translateY(-4px);
}
```

### Toast Notifications
```javascript
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}
```

---

## Common Patterns

### 1. Intersection Observer Animation
```javascript
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
});
```

### 2. Modal System
```javascript
function openModal(content) {
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// Close on overlay click
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) {
        closeModal();
    }
});
```

### 3. LocalStorage State
```javascript
// Save state
localStorage.setItem('ideenschmiede_role', 'subscriber');

// Load state
const role = localStorage.getItem('ideenschmiede_role') || 'visitor';

// Clear state
localStorage.removeItem('ideenschmiede_role');
```

---

## Testing Checklist

### Before Deployment
- [ ] All navigation links work
- [ ] Mobile menu opens/closes
- [ ] Language switcher functions
- [ ] Role switching works on Dashboard and Profile
- [ ] Paywall appears for non-subscribers on Marketplace
- [ ] Paywall appears for non-subscribers on Team Apply
- [ ] Upgrade notice visible on Teams page for non-subscribers
- [ ] All buttons have hover states
- [ ] Toast notifications appear correctly
- [ ] Modals open and close properly
- [ ] Responsive on iPhone 13 mini (375px)
- [ ] Responsive on iPad (768px)
- [ ] Responsive on Desktop (1200px+)

### Role Testing
- [ ] Visitor: Can only read Discussion, sees paywalls
- [ ] User: Can post/comment in Discussion, sees paywalls for Subscriber features
- [ ] Subscriber: Full access to all features

---

## Known Issues / TODO

1. **Placeholder Links:** Some "Details →" and "Alle anzeigen" links are # (need implementation)
2. **Idea Creation:** No dedicated page yet (currently links to idea-detail.html?new=true)
3. **Wallet Connect:** No actual wallet integration (demo only)
4. **Backend:** All data is static (no persistence)
5. **DeepL:** Translation integration planned for future

---

## Next Steps

See ARCHITECTURE.md for detailed technical specifications and future roadmap.

*Last updated: 2026-03-10*