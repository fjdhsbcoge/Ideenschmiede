import React from 'react';
import { Link, useNavigate } from 'react-router';
import { useStore, fmtSat, fmtBtc, useReveal } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { STAGE_LABELS, votePercent, type Idea, type IdeaStage } from '@/lib/data';

export function StageBadge({ stage }: { stage: IdeaStage }) {
  const map: Record<IdeaStage, string> = {
    discussion: 'badge-blue',
    voting: 'badge-purple',
    funding: 'badge-orange',
    building: 'badge-green',
    completed: 'badge-neutral',
  };
  return <span className={`badge ${map[stage]}`}>{STAGE_LABELS[stage]}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 30 }}>
      <div style={{ maxWidth: 640 }}>
        <h1 className="font-display" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 15 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Page({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  useReveal();
  return (
    <div style={{ maxWidth: narrow ? 860 : 1240, margin: '0 auto', padding: '44px 22px 20px' }}>
      {children}
    </div>
  );
}

export function IdeaCard({ idea, marketplace = false }: { idea: Idea; marketplace?: boolean }) {
  const navigate = useNavigate();
  const pct = votePercent(idea);
  const fundingPct = idea.fundingGoal ? Math.min(100, Math.round(((idea.raised || 0) / idea.fundingGoal) * 100)) : 0;

  return (
    <div
      className="is-card is-card-hover reveal"
      onClick={() => navigate(`/idea/${idea.id}`)}
      style={{ padding: 26, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <StageBadge stage={idea.stage} />
          {idea.tags.slice(0, 3).map(t => <span key={t} className="badge badge-neutral">{t}</span>)}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{idea.time}</span>
      </div>

      <div>
        <h3 className="font-display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3, marginBottom: 7 }}>{idea.title}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {idea.description}
        </p>
      </div>

      {idea.stage === 'discussion' && (
        <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--text-tertiary)' }}>
          <span>💬 {idea.comments.length} Kommentare</span>
          <span>👍 {idea.votes.up} · 👎 {idea.votes.down}</span>
        </div>
      )}

      {idea.stage === 'voting' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 7 }}>
            <span>Voting läuft · endet in {idea.votingEndsIn}</span>
            <span style={{ fontWeight: 700, color: pct >= 50 ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{pct}% Zustimmung</span>
          </div>
          <div className="progress-track"><div className="progress-fill green" style={{ width: `${pct}%` }} /></div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{idea.votes.up + idea.votes.down} Stimmen · 1 Person = 1 Stimme</div>
        </div>
      )}

      {(idea.stage === 'funding' || idea.stage === 'building' || idea.stage === 'completed') && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 7 }}>
            <span>{fmtSat(idea.raised || 0)} / {fmtSat(idea.fundingGoal || 0)} sat</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-orange)' }}>{fundingPct}%</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${fundingPct}%` }} /></div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7, flexWrap: 'wrap' }}>
            <span>👥 {idea.investors} Investoren</span>
            <span>🛠️ {idea.teams?.length || 0} Team{(idea.teams?.length || 0) !== 1 ? 's' : ''}</span>
            {idea.closesIn && <span>⏳ {idea.closesIn}</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>von <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{idea.author}</span></span>
        <span style={{ fontSize: 13.5, color: 'var(--accent-primary)', fontWeight: 600 }}>{marketplace ? 'Investieren →' : 'Details →'}</span>
      </div>
    </div>
  );
}

export function Paywall({ feature }: { feature: string }) {
  const { setRole, toast } = useStore();
  const navigate = useNavigate();
  const t = useT();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,8,13,.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, overflowY: 'auto' }}>
      <div className="paywall-shimmer" style={{ position: 'relative', maxWidth: 580, width: '100%', background: 'linear-gradient(165deg, var(--bg-tertiary), var(--bg-secondary))', border: '2px solid var(--accent-primary)', borderRadius: 26, padding: '46px 38px', textAlign: 'center', overflow: 'hidden', margin: 'auto' }}>
        <div style={{ fontSize: 52, marginBottom: 14 }}>💎</div>
        <h2 className="font-display" style={{ fontSize: 27, fontWeight: 700, marginBottom: 12 }}>{t.paywall.title}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, marginBottom: 22 }}>
          {feature} {t.paywall.bodyA} <strong style={{ color: 'var(--text-primary)' }}>{t.paywall.bodyHighlight}</strong>.
        </p>
        <div className="font-display" style={{ fontSize: 46, fontWeight: 700 }}>{t.paywall.price}</div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 13.5, marginBottom: 24 }}>{t.paywall.priceNote}</div>
        <div style={{ textAlign: 'left', maxWidth: 380, margin: '0 auto 28px', display: 'grid', gap: 10 }}>
          {t.paywall.features.map(f => (
            <div key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>✓</span> {f}
            </div>
          ))}
        </div>
        <button className="btn-primary" style={{ width: '100%', maxWidth: 380, padding: '15px 26px', fontSize: 15.5 }}
          onClick={() => { setRole('subscriber'); toast(t.paywall.welcomeToast); }}>
          {t.paywall.cta}
        </button>
        <div style={{ marginTop: 16 }}>
          <button className="btn-ghost" onClick={() => navigate('/discussion')}>{t.paywall.back}</button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 20, cursor: 'pointer' }} aria-label="Schließen">✕</button>
        {title && <h3 className="font-display" style={{ fontSize: 21, fontWeight: 700, marginBottom: 18, paddingRight: 30 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/** 15/5/80 Investment-Split Visualisierung */
export function SplitBar({ compact = false }: { compact?: boolean }) {
  const parts = [
    { pct: 15, label: 'Ideengeber', color: 'var(--accent-primary)', desc: 'Sofortige Vergütung' },
    { pct: 5, label: 'Mitdenker', color: 'var(--accent-blue)', desc: 'Chain-of-Thought' },
    { pct: 80, label: 'Team', color: 'var(--accent-orange)', desc: 'Umsetzungs-Budget' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: compact ? 10 : 14, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        {parts.map(p => <div key={p.label} style={{ width: `${p.pct}%`, background: p.color }} />)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        {parts.map(p => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: compact ? 12 : 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.pct}% {p.label}</span>
            {!compact && <span style={{ color: 'var(--text-tertiary)' }}>· {p.desc}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="is-card reveal" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      </div>
      <div className="font-display" style={{ fontSize: 27, fontWeight: 700, color: accent || 'var(--text-primary)', letterSpacing: '-.01em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function BtcAmount({ sat, size = 14 }: { sat: number; size?: number }) {
  return <span className="font-mono" style={{ fontSize: size, color: 'var(--accent-bitcoin)', fontWeight: 600 }}>{fmtBtc(sat)}</span>;
}

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="is-card" style={{ padding: '52px 30px', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>{icon}</div>
      <h3 className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 420, margin: '0 auto 20px' }}>{text}</p>
      {action}
    </div>
  );
}

export function LoginNotice() {
  const { role } = useStore();
  if (role !== 'visitor') return null;
  return (
    <div className="is-card" style={{ padding: '15px 20px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderColor: 'rgba(52,152,219,.4)' }}>
      <span style={{ fontSize: 20 }}>🌐</span>
      <p style={{ flex: 1, fontSize: 14, color: 'var(--text-secondary)', minWidth: 220 }}>
        Du besuchst die Ideenschmiede als <strong style={{ color: 'var(--text-primary)' }}>Gast</strong>. Melde dich kostenlos an, um Ideen zu posten und zu kommentieren.
      </p>
      <Link to="/profile" className="btn-secondary" style={{ fontSize: 13 }}>Kostenlos anmelden</Link>
    </div>
  );
}
