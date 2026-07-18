import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useStore, ROLE_CONFIG, type Role } from '@/lib/store';
import { useT } from '@/lib/i18n';

export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const { role, setRole, toast } = useStore();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const cfg = ROLE_CONFIG[role];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-secondary"
        style={{ padding: compact ? '8px 14px' : '9px 16px', fontSize: 13, gap: 7 }}
        aria-label={t.roles.switcherAria}
      >
        <span>{cfg.icon}</span>
        <span className="hidden sm:inline">{t.roles[role].name}</span>
        <span style={{ opacity: .55, fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 1500,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
          borderRadius: 14, padding: 6, width: 250,
          boxShadow: '0 20px 50px -12px rgba(0,0,0,.7)',
        }}>
          {(Object.keys(ROLE_CONFIG) as Role[]).map(r => {
            const c = ROLE_CONFIG[r];
            return (
              <button
                key={r}
                onClick={() => { setRole(r); setOpen(false); toast(t.roles.switchedToast(t.roles[r].name)); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: r === role ? 'rgba(233,69,96,.12)' : 'transparent',
                  color: 'var(--text-primary)', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.roles[r].name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.roles[r].description}</div>
                </span>
                {r === role && <span style={{ color: 'var(--accent-primary)' }}>✓</span>}
              </button>
            );
          })}
          <div style={{ padding: '8px 12px 6px', fontSize: 11, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-color)', marginTop: 6 }}>
            {t.roles.switcherNote}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useStore();
  const t = useT();

  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  const NAV_ITEMS = [
    { to: '/discussion', icon: '💡', label: t.nav.discussion, badge: t.nav.badges.free, badgeClass: 'badge-green' },
    { to: '/marketplace', icon: '🛒', label: t.nav.marketplace, badge: t.nav.badges.member, badgeClass: 'badge-red' },
    { to: '/teams', icon: '👥', label: t.nav.teams, badge: t.nav.badges.member, badgeClass: 'badge-red' },
    { to: '/dashboard', icon: '📊', label: t.nav.dashboard, badge: t.nav.badges.login, badgeClass: 'badge-blue' },
    { to: '/profile', icon: '👤', label: t.nav.profile, badge: t.nav.badges.login, badgeClass: 'badge-blue' },
    { to: '/settings', icon: '⚙️', label: t.nav.settings, badge: t.nav.badges.login, badgeClass: 'badge-blue' },
  ];

  const FOOTER_LINKS: [string, string][] = [
    [t.footer.links.discussion, '/discussion'],
    [t.footer.links.marketplace, '/marketplace'],
    [t.footer.links.teams, '/teams'],
    [t.footer.links.process, '/#prozess'],
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(10,10,15,.88)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)', flexShrink: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--accent-primary), #ff6b6b)', fontSize: 17,
              boxShadow: '0 6px 18px -4px rgba(233,69,96,.5)',
            }}>⚡</div>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.01em' }}>Ideenschmiede</span>
          </Link>

          <div className="hidden lg:flex" style={{ gap: 4, marginLeft: 12, flex: 1 }}>
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 10,
                  textDecoration: 'none', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                  transition: 'all .2s',
                })}>
                <span>{item.icon}</span> {item.label}
                <span className={`badge ${item.badgeClass}`} style={{ fontSize: 10, padding: '2px 7px' }}>{item.badge}</span>
              </NavLink>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {role === 'visitor' && (
              <button className="btn-primary" style={{ padding: '9px 18px', fontSize: 13.5 }} onClick={() => navigate('/profile')}>
                {t.nav.login}
              </button>
            )}
            <RoleSwitcher compact />
            <button
              className="lg:hidden"
              onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 24, cursor: 'pointer', padding: '2px 6px' }}
              aria-label={t.nav.menuAria}
            >{menuOpen ? '✕' : '☰'}</button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '12px 18px 18px' }}>
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 11,
                  textDecoration: 'none', fontSize: 15, fontWeight: 500, marginBottom: 4,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                })}>
                <span>{item.icon}</span> {item.label}
                <span className={`badge ${item.badgeClass}`} style={{ marginLeft: 'auto' }}>{item.badge}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <main style={{ flex: 1, paddingTop: 62 }}>
        <Outlet />
      </main>

      <footer style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', marginTop: 80 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '40px 22px 34px', display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-primary), #ff6b6b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚡</div>
              <span className="font-display" style={{ fontWeight: 700 }}>Ideenschmiede</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
              {t.footer.taglineA}<br />{t.footer.taglineB}
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>{t.footer.platform}</div>
            {FOOTER_LINKS.map(([l, to]) => (
              <Link key={l} to={to} style={{ display: 'block', fontSize: 13.5, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>{l}</Link>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>{t.footer.principlesTitle}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 2 }}>
              {t.footer.principles.map(p => <div key={p}>{p}</div>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>{t.footer.ossTitle}</div>
            <a href="https://github.com/fjdhsbcoge/Ideenschmiede" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
              {t.footer.ossRepo}
            </a>
            <a href={`${import.meta.env.BASE_URL}Ideenschmiede_Whitepaper.pdf`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>
              📄 {t.footer.ossWhitepaper}
            </a>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>{t.footer.ossDocs}</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)', padding: '18px 22px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          {t.footer.legal}
        </div>
      </footer>
    </div>
  );
}
