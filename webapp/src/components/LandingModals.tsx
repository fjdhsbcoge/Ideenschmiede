import { Link } from 'react-router'
import { useT } from '@/lib/i18n'
import { Modal, SplitBar } from '@/components/bits'

const ROLE_LINKS = ['/create-idea', '/marketplace', '/teams']
const EXAMPLE_COLORS = ['var(--accent-primary)', 'var(--accent-blue)', 'var(--accent-orange)']

const bulletStyle: React.CSSProperties = { display: 'flex', gap: 10, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }

/** Detail-Modal zu den drei Rollen („Mehr Informationen") */
export function RoleDetailModal({ index, onClose }: { index: number | null; onClose: () => void }) {
  const t = useT()
  const L = t.landing
  if (index === null) return null
  const role = L.rolesSection[index]
  const detail = L.roleDetails[index]

  return (
    <Modal open onClose={onClose} title={`${role.icon} ${role.title}`}>
      <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18 }}>{detail.intro}</p>
      <div style={{ display: 'grid', gap: 11, marginBottom: 18 }}>
        {detail.bullets.map((b) => (
          <div key={b} style={bulletStyle}><span style={{ color: 'var(--accent-green)', flexShrink: 0 }}>✓</span>{b}</div>
        ))}
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 20, lineHeight: 1.6 }}>{detail.outro}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link to={ROLE_LINKS[index]} className="btn-primary" style={{ textDecoration: 'none' }}>{role.cta} →</Link>
        <button className="btn-secondary" onClick={onClose}>{L.closeModal}</button>
      </div>
    </Modal>
  )
}

/** Detail-Modal zu den sechs Prozess-Schritten (Klick) */
export function StepDetailModal({ index, onClose }: { index: number | null; onClose: () => void }) {
  const t = useT()
  const L = t.landing
  if (index === null) return null
  const step = L.steps[index]

  return (
    <Modal open onClose={onClose} title={`${index + 1}. ${step.title}`}>
      <div style={{ display: 'grid', gap: 14 }}>
        {step.details.map((p) => (
          <p key={p.slice(0, 24)} style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{p}</p>
        ))}

        {/* Schritt 2 (Voting): ehemalige Sektion „Dein Abo ist dein Stimmrecht" */}
        {index === 1 && (
          <div style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '18px 20px', border: '1px solid var(--border-color)' }}>
            <div className="badge badge-orange" style={{ marginBottom: 10 }}>{L.subscription.badge}</div>
            <h4 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{L.subscription.title}</h4>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 6 }}>
              {L.subscription.body} <strong style={{ color: 'var(--text-primary)' }}>{L.subscription.bodyHighlight}</strong>
            </p>
            <h5 className="font-display" style={{ fontSize: 13.5, fontWeight: 700, margin: '14px 0 8px' }}>{L.subscription.tableTitle}</h5>
            <table className="is-table" style={{ fontSize: 12.5 }}>
              <thead>
                <tr><th>{L.subscription.tableHead[0]}</th><th>{L.subscription.tableHead[1]}</th></tr>
              </thead>
              <tbody>
                {L.subscription.tableRows.map(([mech, cost], i) => (
                  <tr key={mech} style={i === L.subscription.tableRows.length - 1 ? { background: 'rgba(46,204,113,.07)' } : {}}>
                    <td style={{ fontWeight: 600 }}>{mech}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--accent-green)', fontWeight: 600 }}>{L.subscription.promise}</p>
          </div>
        )}

        {/* Schritt 3 (Idea-Shares): ehemalige Sektion „Wohin das Geld fließt" (Investition) */}
        {index === 2 && (
          <div style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '18px 20px', border: '1px solid var(--border-color)' }}>
            <h4 className="font-display" style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>{L.moneyInvestTitle}</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 14 }}>{L.moneyInvestSub}</p>
            <SplitBar compact />
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 14 }}>
              {L.moneyInvestExamplePre}{' '}
              {L.moneyInvestExampleParts.map((p, i) => (
                <span key={p.amount}>
                  <span style={{ color: EXAMPLE_COLORS[i], fontWeight: 700 }}>{p.amount}</span>{' '}{p.text}{' '}
                </span>
              ))}
            </p>
          </div>
        )}

        {/* Schritt 6 (Revenue): ehemalige Sektion „Wohin das Geld fließt" (Umsatz) */}
        {index === 5 && (
          <div style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '18px 20px', border: '1px solid var(--border-color)' }}>
            <h4 className="font-display" style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>{L.moneyRevenueTitle}</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 14 }}>{L.moneyRevenueSub}</p>
            <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', gap: 2, fontSize: 12.5, fontWeight: 700 }}>
              <div style={{ width: '20%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>20 %</div>
              <div style={{ width: '80%', background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>80 %</div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent-primary)' }} />
                <strong>{L.moneyRevenueIdea}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent-green)' }} />
                <strong>{L.moneyRevenueTeam}</strong>
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.65, marginTop: 12 }}>{L.moneyRevenueNote}</p>
          </div>
        )}

        <button className="btn-secondary" onClick={onClose} style={{ justifySelf: 'start' }}>{L.closeModal}</button>
      </div>
    </Modal>
  )
}
