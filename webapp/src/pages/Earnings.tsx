import { Link } from 'react-router';
import { useStore, fmtSat } from '@/lib/store';
import { earningsByMonth, earningsEvents } from '@/lib/data';
import { Page, PageHeader, StatCard, BtcAmount, EmptyState } from '@/components/bits';

export default function Earnings() {
  const { role } = useStore();
  const total = earningsEvents.reduce((s, e) => s + e.amount, 0);
  const maxBar = Math.max(...earningsByMonth.map(e => e.value));

  if (role === 'visitor') {
    return (
      <Page narrow>
        <PageHeader title="💸 Erträge" />
        <EmptyState icon="🔒" title="Anmeldung erforderlich" text="Melde dich an, um deine Erträge zu sehen." action={<Link to="/profile" className="btn-primary">Anmelden</Link>} />
      </Page>
    );
  }

  return (
    <Page narrow>
      <PageHeader title="💸 Erträge im Detail" subtitle="Revenue-Shares, Milestone-Boni und Chain-of-Thought Rewards – vollständig transparent." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 26 }}>
        <StatCard icon="💰" label="Gesamt" value={`${fmtSat(total)} sat`} sub="letzte 3 Monate" accent="var(--accent-green)" />
        <StatCard icon="📊" label="Ø pro Monat" value={`${fmtSat(Math.round(earningsByMonth.reduce((s, e) => s + e.value, 0) / earningsByMonth.length))} sat`} />
        <StatCard icon="🥇" label="Bester Monat" value={`${fmtSat(maxBar)} sat`} sub="Juli 2026" />
      </div>

      <div className="is-card reveal" style={{ padding: '26px 28px', marginBottom: 20 }}>
        <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>📈 6-Monats-Verlauf</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          {earningsByMonth.map(e => (
            <div key={e.month} className="bar-col">
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtSat(e.value)}</span>
              <div className="bar-wrap"><div className={`bar ${e.value === maxBar ? 'green' : ''}`} style={{ height: `${(e.value / maxBar) * 100}%` }} /></div>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>{e.month}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="is-card reveal" style={{ padding: '26px 28px' }}>
        <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>🧾 Auszahlungen</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {earningsEvents.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--bg-primary)', borderRadius: 12, padding: '13px 16px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 19 }}>{e.type.includes('Chain') ? '🧠' : e.type.includes('Milestone') ? '🎯' : '📈'}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.type}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{e.source}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <BtcAmount sat={e.amount} size={13.5} />
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{e.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="is-card reveal" style={{ padding: '22px 26px', marginTop: 20, borderColor: 'rgba(46,204,113,.3)' }}>
        <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 22 }}>🔍</span>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Radikale Transparenz:</strong> Alle Umsatzberichte der Teams sind öffentlich,
            alle Auszahlungen on-chain nachprüfbar. Teams mit konsistenter Berichterstattung erhalten das Badge
            <span className="badge badge-green" style={{ marginLeft: 5, fontSize: 10.5 }}>✓ Verifizierter Reporter</span>.
          </p>
        </div>
      </div>
    </Page>
  );
}
