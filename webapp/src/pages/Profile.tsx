import { Link } from 'react-router';
import { useStore, ROLE_CONFIG } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { myInvestments, wallet } from '@/lib/data';
import { Page, StatCard, BtcAmount } from '@/components/bits';
import { RoleSwitcher } from '@/components/Layout';

export default function Profile() {
  const { role, setRole, toast } = useStore();
  const t = useT();
  const T = t.pages.profile;
  const cfg = ROLE_CONFIG[role];
  const isVisitor = role === 'visitor';
  const isSub = role === 'subscriber';
  const handle = isVisitor ? t.roles.visitor.name : cfg.handle;
  const permissionsOk = [true, role !== 'visitor', isSub, isSub, isSub, isSub];

  return (
    <Page>
      {/* Profile header */}
      <div className="is-card reveal visible" style={{ padding: '30px 32px', marginBottom: 22, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          width: 84, height: 84, borderRadius: 24, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-orange))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38,
          boxShadow: '0 12px 30px -8px rgba(233,69,96,.4)',
        }}>{cfg.icon}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>{handle}</h1>
            <span className={`badge ${isSub ? 'badge-orange' : role === 'user' ? 'badge-blue' : 'badge-neutral'}`}>{cfg.icon} {t.roles[role].name}</span>
            {isSub && <span className="badge badge-green">{T.verifiedReporter}</span>}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {isVisitor ? T.guestHint : `${T.memberSince} · ${t.roles[role].description}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <RoleSwitcher />
          {isVisitor && <button className="btn-primary" onClick={() => { setRole('user'); toast(T.loginToast); }}>{T.loginCta}</button>}
        </div>
      </div>

      {/* Subscription */}
      <div className="is-card reveal" style={{ padding: '26px 30px', marginBottom: 22, borderColor: isSub ? 'rgba(243,156,18,.4)' : 'var(--border-color)' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 34 }}>💎</span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>
              {isSub ? T.subActive : T.subInactive}
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              {isSub ? T.subActiveText(wallet.subscribedUntil) : T.subInactiveText}
            </p>
          </div>
          {isSub ? (
            <span className="badge badge-green" style={{ fontSize: 13, padding: '7px 14px' }}>{T.subActiveBadge}</span>
          ) : (
            <button className="btn-primary" onClick={() => { setRole('subscriber'); toast(T.upgradeToast); }}>
              {T.upgradeCta}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 22 }}>
        <StatCard icon="💡" label={T.statIdeas} value={isVisitor ? '–' : '1'} sub={isVisitor ? '' : T.statIdeasSub} />
        <StatCard icon="💼" label={T.statInvestments} value={isVisitor ? '–' : String(myInvestments.length)} sub={isVisitor ? '' : T.statInvestmentsSub} />
        <StatCard icon="🧠" label={T.statCot} value={isVisitor ? '–' : '47 Pkte'} sub={T.statCotSub} />
        <StatCard icon="🏆" label={T.statReputation} value={isVisitor ? '–' : 'A+'} sub={T.statReputationSub} accent="var(--accent-green)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        {/* Wallet */}
        {!isVisitor && (
          <div className="is-card reveal" style={{ padding: '26px 28px' }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{T.walletTitle}</h3>
            <div className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-bitcoin)' }}>₿ {(wallet.balance / 1e8).toFixed(4)}</div>
            <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0 14px', wordBreak: 'break-all' }}>{wallet.address}</div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn-secondary" style={{ flex: 1, fontSize: 13, justifyContent: 'center' }} onClick={() => { navigator.clipboard?.writeText(wallet.address); toast(T.copiedToast); }}>{T.copy}</button>
              <Link to="/earnings" className="btn-secondary" style={{ flex: 1, fontSize: 13, justifyContent: 'center' }}>{T.earningsLink}</Link>
            </div>
          </div>
        )}

        {/* Access matrix */}
        <div className="is-card reveal" style={{ padding: '26px 28px' }}>
          <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{T.permissionsTitle}</h3>
          <div style={{ display: 'grid', gap: 9, fontSize: 13.5 }}>
            {T.permissions.map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: permissionsOk[i] ? 'var(--accent-green)' : 'var(--text-tertiary)', width: 18 }}>{permissionsOk[i] ? '✓' : '✕'}</span>
                <span style={{ color: permissionsOk[i] ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Investments */}
        {!isVisitor && (
          <div className="is-card reveal" style={{ padding: '26px 28px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{T.investmentsTitle}</h3>
              <Link to="/investments" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>{T.showAll}</Link>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="is-table">
                <thead><tr>{T.table.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {myInvestments.slice(0, 4).map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.ideaTitle}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{inv.type}</td>
                      <td><BtcAmount sat={inv.amount} size={12.5} /></td>
                      <td style={{ color: 'var(--accent-green)' }}><BtcAmount sat={inv.earnings} size={12.5} /></td>
                      <td style={{ color: inv.roi >= 0 ? 'var(--accent-green)' : 'var(--accent-primary)', fontWeight: 700 }}>+{inv.roi}%</td>
                      <td><span className={`badge ${inv.status === 'aktiv' ? 'badge-green' : inv.status === 'pending' ? 'badge-orange' : 'badge-neutral'}`}>{t.pages.investments.status[inv.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
