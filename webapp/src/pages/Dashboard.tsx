import { Link } from 'react-router';
import { useStore, ROLE_CONFIG, fmtSat } from '@/lib/store';
import { myInvestments, earningsByMonth, wallet, ideas } from '@/lib/data';
import { Page, PageHeader, StatCard, BtcAmount } from '@/components/bits';

export default function Dashboard() {
  const { role } = useStore();
  const cfg = ROLE_CONFIG[role];
  const isVisitor = role === 'visitor';
  const totalInvested = myInvestments.reduce((s, i) => s + i.amount, 0);
  const totalEarnings = myInvestments.reduce((s, i) => s + i.earnings, 0);
  const maxBar = Math.max(...earningsByMonth.map(e => e.value));

  return (
    <Page>
      <PageHeader
        title={`📊 Dashboard`}
        subtitle={isVisitor ? 'Du siehst das Dashboard als Gast. Melde dich an, um deine Daten zu sehen.' : `Willkommen zurück, ${cfg.handle}. Hier ist dein Überblick.`}
        action={<Link to="/investments" className="btn-secondary">📈 Alle Investments</Link>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 22 }}>
        <StatCard icon="💼" label="Investiert" value={isVisitor ? '–' : fmtBtcShort(totalInvested)} sub={isVisitor ? 'Anmeldung erforderlich' : `${myInvestments.length} Investments`} />
        <StatCard icon="📈" label="Erträge gesamt" value={isVisitor ? '–' : fmtBtcShort(totalEarnings)} sub="Revenue + Milestone-Boni" accent="var(--accent-green)" />
        <StatCard icon="💡" label="Meine Ideen" value={isVisitor ? '–' : '1'} sub={isVisitor ? '' : '1 im Funding'} />
        <StatCard icon="⭐" label="Status" value={cfg.name} sub={cfg.description} accent={role === 'subscriber' ? 'var(--accent-orange)' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        {/* Wallet */}
        {!isVisitor && (
          <div className="is-card reveal" style={{ padding: '26px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>⚡ Bitcoin-Wallet</h3>
              <span className="badge badge-orange">Non-custodial</span>
            </div>
            <div className="font-display" style={{ fontSize: 30, fontWeight: 700, color: 'var(--accent-bitcoin)', marginBottom: 4 }}>{fmtBtcShort(wallet.balance)}</div>
            <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', wordBreak: 'break-all', marginBottom: 16 }}>{wallet.address.slice(0, 24)}…</div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn-primary" style={{ flex: 1, fontSize: 13.5, padding: '11px' }} onClick={() => navigator.clipboard?.writeText(wallet.address)}>📋 Adresse kopieren</button>
              <a className="btn-secondary" style={{ flex: 1, fontSize: 13.5, padding: '11px', justifyContent: 'center' }} href="https://mempool.space" target="_blank" rel="noreferrer">Explorer ↗</a>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 14, lineHeight: 1.6 }}>
              Die Plattform hält niemals deine Keys. Zahlungen laufen direkt zwischen Wallets. Verifikation via mempool.space API.
            </p>
          </div>
        )}

        {/* Earnings chart */}
        <div className="is-card reveal" style={{ padding: '26px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>📈 Erträge (6 Monate)</h3>
            <Link to="/earnings" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>Details →</Link>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {earningsByMonth.map(e => (
              <div key={e.month} className="bar-col">
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }} className="font-mono">{fmtSat(e.value)}</span>
                <div className="bar-wrap"><div className="bar" style={{ height: `${(e.value / maxBar) * 100}%` }} /></div>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>{e.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* My ideas */}
        <div className="is-card reveal" style={{ padding: '26px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>💡 Meine Ideen</h3>
            <Link to="/create-idea" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>+ Neue Idee</Link>
          </div>
          {isVisitor ? (
            <LockedHint />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {ideas.filter(i => i.author === '@senator-thunfisch').map(i => (
                <Link key={i.id} to={`/idea/${i.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>⚙️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{i.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtSat(i.raised || 0)} / {fmtSat(i.fundingGoal || 0)} sat · {i.investors} Investoren</div>
                    </div>
                    <span className="badge badge-orange">Funding</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My investments preview */}
        <div className="is-card reveal" style={{ padding: '26px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>💰 Letzte Investments</h3>
            <Link to="/investments" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>Alle →</Link>
          </div>
          {isVisitor ? (
            <LockedHint />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {myInvestments.slice(0, 3).map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5 }}>
                  <span style={{ fontSize: 17 }}>{inv.type === 'Idea-Shares' ? '💡' : '🛠️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.ideaTitle}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{inv.type}{inv.team ? ` · ${inv.team}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <BtcAmount sat={inv.amount} size={12.5} />
                    <div style={{ fontSize: 11.5, color: inv.roi >= 0 ? 'var(--accent-green)' : 'var(--accent-primary)' }}>+{inv.roi}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function fmtBtcShort(sat: number) {
  return '₿ ' + (sat / 1e8).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 4 });
}

function LockedHint() {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: '22px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--text-tertiary)' }}>
      🔒 Melde dich an, um deine Daten zu sehen.
    </div>
  );
}
