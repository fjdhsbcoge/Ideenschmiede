import { Link } from 'react-router';
import { useStore, ROLE_CONFIG, fmtSat } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { myInvestments, earningsByMonth, wallet, ideas } from '@/lib/data';
import { Page, PageHeader, StatCard, BtcAmount } from '@/components/bits';

export default function Dashboard() {
  const { role } = useStore();
  const t = useT();
  const T = t.pages.dashboard;
  const cfg = ROLE_CONFIG[role];
  const isVisitor = role === 'visitor';
  const totalInvested = myInvestments.reduce((s, i) => s + i.amount, 0);
  const totalEarnings = myInvestments.reduce((s, i) => s + i.earnings, 0);
  const maxBar = Math.max(...earningsByMonth.map(e => e.value));

  return (
    <Page>
      <PageHeader
        title="📊 Dashboard"
        subtitle={isVisitor ? T.guestSubtitle : T.welcomeBack(cfg.handle)}
        action={<Link to="/investments" className="btn-secondary">{T.allInvestments}</Link>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 22 }}>
        <StatCard icon="💼" label={T.statInvested} value={isVisitor ? '–' : fmtBtcShort(totalInvested)} sub={isVisitor ? T.loginNeeded : `${myInvestments.length} Investments`} />
        <StatCard icon="📈" label={T.statEarnings} value={isVisitor ? '–' : fmtBtcShort(totalEarnings)} sub={T.statEarningsSub} accent="var(--accent-green)" />
        <StatCard icon="💡" label={T.statIdeas} value={isVisitor ? '–' : '1'} sub={isVisitor ? '' : T.statIdeasSub} />
        <StatCard icon="⭐" label={T.statStatus} value={t.roles[role].name} sub={t.roles[role].description} accent={role === 'subscriber' ? 'var(--accent-orange)' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        {/* Wallet */}
        {!isVisitor && (
          <div className="is-card reveal" style={{ padding: '26px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{T.walletTitle}</h3>
              <span className="badge badge-orange">{T.nonCustodial}</span>
            </div>
            <div className="font-display" style={{ fontSize: 30, fontWeight: 700, color: 'var(--accent-bitcoin)', marginBottom: 4 }}>{fmtBtcShort(wallet.balance)}</div>
            <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', wordBreak: 'break-all', marginBottom: 16 }}>{wallet.address.slice(0, 24)}…</div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn-primary" style={{ flex: 1, fontSize: 13.5, padding: '11px' }} onClick={() => navigator.clipboard?.writeText(wallet.address)}>{T.copyAddress}</button>
              <a className="btn-secondary" style={{ flex: 1, fontSize: 13.5, padding: '11px', justifyContent: 'center' }} href="https://mempool.space" target="_blank" rel="noreferrer">{T.explorer}</a>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 14, lineHeight: 1.6 }}>
              {T.walletNote}
            </p>
          </div>
        )}

        {/* Earnings chart */}
        <div className="is-card reveal" style={{ padding: '26px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{T.earningsTitle}</h3>
            <Link to="/earnings" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>{T.details}</Link>
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
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{T.ideasTitle}</h3>
            <Link to="/create-idea" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>{T.newIdea}</Link>
          </div>
          {isVisitor ? (
            <LockedHint text={T.lockedHint} />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {ideas.filter(i => i.author === '@senator-thunfisch').map(i => (
                <Link key={i.id} to={`/idea/${i.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>⚙️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{i.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtSat(i.raised || 0)} / {fmtSat(i.fundingGoal || 0)} sat · {i.investors} {T.investorsSuffix}</div>
                    </div>
                    <span className="badge badge-orange">{T.fundingBadge}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My investments preview */}
        <div className="is-card reveal" style={{ padding: '26px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{T.lastInvestments}</h3>
            <Link to="/investments" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>{T.all}</Link>
          </div>
          {isVisitor ? (
            <LockedHint text={T.lockedHint} />
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

function LockedHint({ text }: { text: string }) {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: '22px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--text-tertiary)' }}>
      {text}
    </div>
  );
}
