import { useState } from 'react';
import { Link } from 'react-router';
import { useReveal } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { RoleDetailModal, StepDetailModal } from '@/components/LandingModals';

const ROLE_COLORS = ['var(--accent-primary)', 'var(--accent-orange)', 'var(--accent-green)'];
const ROLE_LINKS = ['/create-idea', '/marketplace', '/teams'];

export default function Landing() {
  useReveal();
  const t = useT();
  const L = t.landing;
  const [roleModal, setRoleModal] = useState<number | null>(null);
  const [stepModal, setStepModal] = useState<number | null>(null);

  return (
    <div>
      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '96px 22px 84px', textAlign: 'center' }}>
        <div className="ember-glow" style={{ width: 520, height: 520, background: 'rgba(84, 118, 58,.16)', top: -180, left: '50%', transform: 'translateX(-78%)' }} />
        <div className="ember-glow" style={{ width: 420, height: 420, background: 'rgba(243,156,18,.12)', bottom: -160, left: '50%', transform: 'translateX(-18%)' }} />
        <div style={{ position: 'relative', maxWidth: 880, margin: '0 auto' }}>
          <div className="badge badge-orange reveal" style={{ marginBottom: 22, fontSize: 12, padding: '6px 14px' }}>
            {L.heroBadge}
          </div>
          <h1 className="font-display reveal" style={{ fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.05, marginBottom: 24 }}>
            {L.heroTitleA}<br /><span className="text-gradient">{L.heroTitleB}</span>
          </h1>
          <p className="reveal" style={{ fontSize: 'clamp(16px, 2.2vw, 19px)', color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto 38px', lineHeight: 1.7 }}>
            {L.heroSubA} <strong style={{ color: 'var(--text-primary)' }}>{L.heroSubHighlight}</strong>
          </p>
          <div className="reveal" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/discussion" className="btn-primary" style={{ fontSize: 16, padding: '15px 32px' }}>{L.heroCtaPrimary}</Link>
            <Link to="/marketplace" className="btn-secondary" style={{ fontSize: 16, padding: '14px 30px' }}>{L.heroCtaSecondary}</Link>
          </div>
          <div className="reveal" style={{ display: 'flex', gap: 30, justifyContent: 'center', marginTop: 52, flexWrap: 'wrap' }}>
            {L.stats.map(([v, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: 27, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ padding: '70px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="font-display reveal" style={{ fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 700, letterSpacing: '-.02em', textAlign: 'center', marginBottom: 14 }}>
            {L.problemTitle}
          </h2>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 620, margin: '0 auto 44px', fontSize: 15.5 }}>
            {L.problemSub}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 }}>
            {L.problems.map(p => (
              <div key={p.title} className="is-card reveal" style={{ padding: 26 }}>
                <div style={{ fontSize: 30, marginBottom: 12 }}>{p.icon}</div>
                <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 8 }}>{p.title}</h3>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section style={{ padding: '80px 22px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="font-display reveal" style={{ fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 700, letterSpacing: '-.02em', textAlign: 'center', marginBottom: 14 }}>
            {L.rolesTitle}
          </h2>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto 46px', fontSize: 15.5 }}>
            {L.rolesSub}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20 }}>
            {L.rolesSection.map((r, i) => (
              <div key={r.title} className="is-card is-card-hover reveal" style={{ padding: 32, display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: 54, height: 54, borderRadius: 15, background: `color-mix(in srgb, ${ROLE_COLORS[i]} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${ROLE_COLORS[i]} 35%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 18 }}>{r.icon}</div>
                <h3 className="font-display" style={{ fontSize: 21, fontWeight: 700, marginBottom: 10, color: ROLE_COLORS[i] }}>{r.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18 }}>{r.text}</p>
                <ul style={{ listStyle: 'none', marginBottom: 24, display: 'grid', gap: 8 }}>
                  {r.points.map(p => (
                    <li key={p} style={{ fontSize: 13.5, color: 'var(--text-secondary)', display: 'flex', gap: 9 }}>
                      <span style={{ color: ROLE_COLORS[i], fontWeight: 700 }}>✓</span>{p}
                    </li>
                  ))}
                </ul>
                <button className="btn-secondary" style={{ marginTop: 'auto', justifyContent: 'center', marginBottom: 10 }} onClick={() => setRoleModal(i)}>
                  ℹ️ {L.moreInfo}
                </button>
                <Link to={ROLE_LINKS[i]} className="btn-primary" style={{ justifyContent: 'center', textDecoration: 'none' }}>{r.cta} →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS TIMELINE */}
      <section id="prozess" style={{ padding: '80px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <h2 className="font-display reveal" style={{ fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 700, letterSpacing: '-.02em', textAlign: 'center', marginBottom: 14 }}>
            {L.processTitle}
          </h2>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto 10px', fontSize: 15.5 }}>
            {L.processSub}
          </p>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--text-tertiary)', maxWidth: 580, margin: '0 auto 40px', fontSize: 13 }}>
            {L.processHint}
          </p>
          <div style={{ position: 'relative' }}>
            <div className="timeline-line" />
            <div style={{ display: 'grid', gap: 18 }}>
              {L.steps.map((s, i) => (
                <div
                  key={s.title}
                  className="reveal step-hover"
                  style={{ display: 'flex', gap: 20, position: 'relative' }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.title} – ${L.moreInfo}`}
                  onClick={() => setStepModal(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStepModal(i); } }}
                >
                  <span className="step-tip">{s.tip}</span>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, flexShrink: 0, zIndex: 1,
                    background: 'linear-gradient(160deg, var(--bg-elevated), var(--bg-tertiary))',
                    border: '1px solid var(--border-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19,
                    color: 'var(--accent-orange)',
                  }}>{i + 1}</div>
                  <div className="is-card" style={{ padding: '20px 24px', flex: 1 }}>
                    <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.title}
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>ℹ️</span>
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEDERATION */}
      <section style={{ padding: '80px 22px', position: 'relative', overflow: 'hidden' }}>
        <div className="ember-glow" style={{ width: 400, height: 400, background: 'rgba(52,152,219,.1)', top: -100, right: -80 }} />
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div className="badge badge-blue reveal" style={{ marginBottom: 16, fontSize: 12, padding: '6px 14px' }}>{L.federation.badge}</div>
            <h2 className="font-display reveal" style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-.02em', marginBottom: 18 }}>
              {L.federation.title}
            </h2>
            <p className="reveal" style={{ color: 'var(--text-secondary)', fontSize: 15.5, lineHeight: 1.75, maxWidth: 700, margin: '0 auto' }}>
              {L.federation.body}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            {L.federation.points.map(p => (
              <div key={p.title} className="is-card reveal" style={{ padding: 26, display: 'flex', gap: 15 }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>{p.icon}</div>
                <div>
                  <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{p.title}</h3>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{p.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="is-card reveal" style={{ marginTop: 26, padding: '26px 30px', textAlign: 'center', borderColor: 'rgba(52,152,219,.35)', background: 'linear-gradient(160deg, rgba(52,152,219,.08), var(--bg-secondary))' }}>
            <p className="font-display" style={{ fontSize: 'clamp(17px, 2.6vw, 22px)', fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.4 }}>
              „{L.federation.vision}“
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 10 }}>{L.federation.startNote}</p>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section style={{ padding: '80px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="font-display reveal" style={{ fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 700, letterSpacing: '-.02em', textAlign: 'center', marginBottom: 46 }}>
            {L.principlesTitle}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            {L.principles.map(p => (
              <div key={p.title} className="is-card reveal" style={{ padding: 26, display: 'flex', gap: 16 }}>
                <div style={{ fontSize: 26, flexShrink: 0 }}>{p.icon}</div>
                <div>
                  <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{p.title}</h3>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '90px 22px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="ember-glow" style={{ width: 460, height: 460, background: 'rgba(84, 118, 58,.13)', top: -120, left: '50%', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
          <h2 className="font-display reveal" style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-.02em', marginBottom: 16 }}>
            {L.ctaTitle}
          </h2>
          <p className="reveal" style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 36, lineHeight: 1.7 }}>
            {L.ctaSubA}<br />{L.ctaSubB}
          </p>
          <div className="reveal" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/discussion" className="btn-primary" style={{ fontSize: 16, padding: '15px 32px' }}>{L.ctaPrimary}</Link>
            <Link to="/profile" className="btn-secondary" style={{ fontSize: 16, padding: '14px 30px' }}>{L.ctaSecondary}</Link>
          </div>
        </div>
      </section>

      <RoleDetailModal index={roleModal} onClose={() => setRoleModal(null)} />
      <StepDetailModal index={stepModal} onClose={() => setStepModal(null)} />
    </div>
  );
}
