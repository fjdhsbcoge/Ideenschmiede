# Ideenschmiede Build Manual

**Purpose:** Step-by-step instructions for building Ideenschmiede. Designed for AI agents and developers.

**Current Version:** v0.4  
**Last Updated:** 2026-03-09  
**Live Demo:** https://fjdhsbcoge.github.io/Ideenschmiede/

---

## Version Overview

| Version | Date | Status | What's New |
|---------|------|--------|------------|
| v0.1 | 2026-03-04 | ✅ Complete | Basic flow: login → post → invest |
| v0.2 | 2026-03-05 | ✅ Complete | Stage visualization + profile |
| v0.3 | 2026-03-08 | ✅ Complete | Landing page + 4 connected subpages |
| v0.4 | 2026-03-09 | ✅ Complete | Interactive demo with animations |

---

## v0.4 - Interactive Demo

### What We Built

**Complete interactive demo located in `/docs/v0.4/`:**

**Landing Pages (2 languages):**
- German: `index.html` - With scroll animations, hover effects
- English: `index-en.html` - Full i18n support

**Interactive Pages (8 total):**
1. **Landing** - Scroll progress bar, animated cards, shimmer effects
2. **Discussion** - Live voting, filter buttons, sort dropdown
3. **Idea Detail** - Comment posting, voting with progress bar
4. **Marketplace** - Investment calculator, team cards, modals
5. **Team Apply** - Dynamic milestones, budget calculator, validation
6. **Teams** - Tab navigation, progress tracking, member lists
7. **Profile** - Wallet display, earnings chart, investment list
8. **Process** - (Existing) Process visualization

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

---

## v0.3 - Static Pages

### What We Built

**Landing Page (2 languages):**
- German: `index.html`
- English: `index-en.html`

**Subpages (4 total):**
1. **Discussion** (`discussion.html`) - Browse ideas in discussion phase
2. **Marketplace** (`marketplace.html`) - Invest in validated ideas
3. **Teams** (`teams.html`) - Manage teams you lead or belong to
4. **Profile** (`profile.html`) - User dashboard

**Features:**
- Consistent navigation across all pages
- Mobile-responsive design
- Language switcher
- Access level badges (Frei/Login/Mitglied)

---

## Build Instructions

### Step 1: Project Setup

**Create folder structure:**
```bash
mkdir -p ideenschmiede/docs
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
        
        /* Mobile menu */
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
            }
            .nav-menu.active { display: flex; }
            .mobile-menu-btn { display: block; }
        }
        
        /* Page content */
        .page-header {
            padding: 100px 24px 40px;
            text-align: center;
            background: var(--bg-secondary);
        }
        
        .page-title {
            font-size: clamp(32px, 5vw, 48px);
            font-weight: 700;
            margin-bottom: 12px;
        }
        
        .content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 24px;
        }
    </style>
</head>
<body>
    <nav class="main-nav">
        <div class="main-nav-container">
            <a href="index.html" class="nav-logo">
                <div class="nav-logo-icon">⚡</div>
                <span>Ideenschmiede</span>
            </a>
            
            <button class="mobile-menu-btn" onclick="toggleMenu()">☰</button>
            
            <div class="nav-menu" id="navMenu">
                <a href="discussion.html" class="nav-item">
                    💡 Ideen-Diskussion
                    <span class="nav-badge badge-free">Frei</span>
                </a>
                <a href="marketplace.html" class="nav-item">
                    🛒 Ideen-Marktplatz
                    <span class="nav-badge badge-member">Mitglied</span>
                </a>
                <a href="teams.html" class="nav-item">
                    👥 Meine Teams
                    <span class="nav-badge badge-member">Mitglied</span>
                </a>
                <a href="profile.html" class="nav-item">
                    👤 Mein Profil
                    <span class="nav-badge badge-login">Login</span>
                </a>
            </div>
        </div>
    </nav>

    <script>
        function toggleMenu() {
            document.getElementById('navMenu').classList.toggle('active');
        }
    </script>

    <!-- PAGE CONTENT HERE -->

</body>
</html>
```

---

### Step 3: Build Landing Page

**Structure:**
1. Hero section (full viewport)
2. "So profitierst du" (3 cards)
3. Timeline (6 steps)
4. CTA section (3 options)
5. Footer

**Key CSS for Hero:**
```css
.hero {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 100px 24px 80px;
    background: linear-gradient(180deg, var(--bg-primary), var(--bg-secondary));
}

.hero h1 {
    font-size: clamp(40px, 10vw, 96px);
    font-weight: 800;
    background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
```

**Timeline Implementation:**
- Vertical line on left side (desktop: 60px circles, mobile: 36px)
- Alternating content left/right on desktop
- Stacked on mobile
- Use CSS `position: relative` + `::before` for line

---

### Step 4: Build Subpages

**Discussion Page:**
- List of idea cards
- Each card: title, description, author, stats
- Badge showing "In Diskussion"

**Marketplace Page:**
- Idea cards with funding progress
- Stats grid: Raised, Goal, Investors, Teams
- Progress bar with percentage
- CTA button: "Idea-Shares kaufen"

**Teams Page:**
- Tab navigation: "Geleitete Teams" / "Team-Mitglied"
- Team cards with status indicator (● Aktiv / ● Bewerbung)
- Stats: Funding Goal, Fortschritt, Entwicklung
- Action buttons

**Profile Page:**
- Profile header with avatar
- Stats grid (4 metrics)
- Sections: Meine Ideen, Meine Investments
- List items with values

---

### Step 5: Add i18n Support

**Create English Version:**
1. Copy `index.html` → `index-en.html`
2. Translate all German text
3. Update language switcher links
4. Change `lang="de"` to `lang="en"`

**Language Switcher:**
```html
<div class="lang-switch">
    <a href="index.html" class="lang-btn active">DE</a>
    <a href="index-en.html" class="lang-btn">EN</a>
</div>
```

---

### Step 6: Mobile Optimization

**Breakpoints:**
```css
/* Tablet */
@media (max-width: 1024px) {
    .cards-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Mobile */
@media (max-width: 768px) {
    .cards-grid { grid-template-columns: 1fr; }
    .nav-menu { display: none; }
    .mobile-menu-btn { display: block; }
    .timeline { padding-left: 40px; }
}

/* Small mobile (iPhone 13 mini) */
@media (max-width: 375px) {
    .hero h1 { font-size: 36px; }
    .card { padding: 24px 16px; }
}
```

---

### Step 7: Deploy to GitHub Pages

**Setup:**
1. Create GitHub repository
2. Push code to `main` branch
3. Enable GitHub Pages in settings
4. Set source to `main` branch / `docs` folder

**File Structure for Deployment:**
```
docs/
├── index.html          # German landing (root)
├── index-en.html       # English landing
├── discussion.html     # Discussion page
├── marketplace.html    # Marketplace page
├── teams.html          # Teams page
├── profile.html        # Profile page
└── (other files...)
```

**Deploy:**
```bash
git add docs/
git commit -m "Deploy v0.3"
git push origin main
```

**Verify:**
- Visit `https://YOUR_USERNAME.github.io/ideenschmiede/`
- Check all pages load
- Test navigation
- Test mobile responsiveness

---

## Component Library

### Card
```css
.card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 40px 32px;
}
```

### Button
```css
.btn {
    display: inline-block;
    padding: 14px 28px;
    border-radius: 12px;
    font-weight: 600;
    background: var(--accent-primary);
    color: white;
    border: none;
    cursor: pointer;
}

.btn-secondary {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
}
```

### Badge
```css
.badge {
    display: inline-flex;
    padding: 4px 12px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 600;
}
```

### Progress Bar
```css
.progress-bar {
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-green), var(--accent-primary));
}
```

---

## Testing Checklist

### Desktop (Chrome, Firefox, Safari)
- [ ] All pages load without errors
- [ ] Navigation links work correctly
- [ ] Language switcher functional
- [ ] Responsive at 1920px, 1440px, 1024px

### Mobile (iOS Safari, Chrome Android)
- [ ] Hamburger menu opens/closes
- [ ] All touch targets 44px+
- [ ] No horizontal scroll
- [ ] Text readable at 100% zoom
- [ ] Tested on iPhone 13 mini (375px)

### Cross-Browser
- [ ] CSS custom properties work
- [ ] Flexbox/grid layouts correct
- [ ] Emoji render properly

---

## Next Version (v0.4)

**Planned Features:**
- [ ] Backend API (Node.js/Express)
- [ ] Database (PostgreSQL)
- [ ] Authentication system
- [ ] Real WebSocket implementation
- [ ] Actual Bitcoin payment integration
- [ ] User registration/login
- [ ] Idea creation form
- [ ] Investment flow
- [ ] Team application system

**Architecture Changes:**
- Migrate from static HTML to React/Vue
- Add state management
- API integration
- Authentication (JWT or SIWE)

---

## Resources

**Reference Implementations:**
- v0.3 Landing: `docs/index.html`
- v0.3 Discussion: `docs/discussion.html`
- v0.3 Marketplace: `docs/marketplace.html`
- v0.3 Teams: `docs/teams.html`
- v0.3 Profile: `docs/profile.html`

**Documentation:**
- VISION.md - Core principles and decisions
- ARCHITECTURE.md - Technical specifications
- This file - Build instructions

---

*For questions or issues, refer to the live demo or existing page implementations.*
