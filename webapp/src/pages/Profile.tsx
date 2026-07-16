import { Link } from 'react-router';
import { useStore, ROLE_CONFIG } from '@/lib/store';
import { myInvestments, wallet } from '@/lib/data';
import { Page, StatCard, BtcAmount } from '@/components/bits';
import { RoleSwitcher } from '@/components/Layout';

export default function Profile() {
  const { role, setRole, toast } = useStore();
  const cfg = ROLE_CONFIG[role];
  const isVisitor = role === 'visitor';
  const isSub = role === 'subscriber';

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
            <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>{cfg.handle}</h1>
            <span className={`badge ${isSub ? 'badge-orange' : role === 'user' ? 'badge-blue' : 'badge-neutral'}`}>{cfg.icon} {cfg.name}</span>
            {isSub && <span className="badge badge-green">✓ Verifizierter Reporter</span>}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {isVisitor ? 'Gast-Modus – melde dich an, um dein Profil zu aktivieren.' : `Mitglied seit März 2026 · ${cfg.description}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <RoleSwitcher />
          {isVisitor && <button className="btn-primary" onClick={() => { setRole('user'); toast('Willkommen! Du bist jetzt als User angemeldet 👤'); }}>Kostenlos anmelden</button>}
        </div>
      </div>

      {/* Subscription */}
      <div className="is-card reveal" style={{ padding: '26px 30px', marginBottom: 22, borderColor: isSub ? 'rgba(243,156,18,.4)' : 'var(--border-color)' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 34 }}>💎</span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>
              {isSub ? 'Subscriber-Mitgliedschaft aktiv' : 'Werde Subscriber'}
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              {isSub
                ? `Gültig bis ${wallet.subscribedUntil}. Voller Zugriff auf Marktplatz, Voting, Investments und Teams.`
                : '$120/Jahr (in BTC zum Tageskurs): Marktplatz-Zugang, Voting, Idea- & Team-Shares, Team-Gründung. Die Subscription verhindert Sybil-Angriffe – 1 Person = 1 Stimme.'}
            </p>
          </div>
          {isSub ? (
            <span className="badge badge-green" style={{ fontSize: 13, padding: '7px 14px' }}>✓ Aktiv</span>
          ) : (
            <button className="btn-primary" onClick={() => { setRole('subscriber'); toast('⭐ Willkommen als Subscriber! Marktplatz & Voting freigeschaltet.'); }}>
              Für $120/Jahr upgraden (Demo)
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 22 }}>
        <StatCard icon="💡" label="Ideen" value={isVisitor ? '–' : '1'} sub={isVisitor ? '' : 'im Funding'} />
        <StatCard icon="💼" label="Investments" value={isVisitor ? '–' : String(myInvestments.length)} sub={isVisitor ? '' : '4 aktiv · 1 abgeschlossen'} />
        <StatCard icon="🧠" label="Chain-of-Thought" value={isVisitor ? '–' : '47 Pkte'} sub="5 %-Pool berechtigt" />
        <StatCard icon="🏆" label="Reputation" value={isVisitor ? '–' : 'A+'} sub="100 % Milestone-Quote" accent="var(--accent-green)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        {/* Wallet */}
        {!isVisitor && (
          <div className="is-card reveal" style={{ padding: '26px 28px' }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>⚡ Wallet</h3>
            <div className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-bitcoin)' }}>₿ {(wallet.balance / 1e8).toFixed(4)}</div>
            <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0 14px', wordBreak: 'break-all' }}>{wallet.address}</div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn-secondary" style={{ flex: 1, fontSize: 13, justifyContent: 'center' }} onClick={() => { navigator.clipboard?.writeText(wallet.address); toast('Adresse kopiert 📋'); }}>📋 Kopieren</button>
              <Link to="/earnings" className="btn-secondary" style={{ flex: 1, fontSize: 13, justifyContent: 'center' }}>📈 Erträge</Link>
            </div>
          </div>
        )}

        {/* Access matrix */}
        <div className="is-card reveal" style={{ padding: '26px 28px' }}>
          <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>🔑 Deine Berechtigungen</h3>
          <div style={{ display: 'grid', gap: 9, fontSize: 13.5 }}>
            {[
              ['Ideen lesen', true],
              ['Ideen posten & kommentieren', role !== 'visitor'],
              ['Idee auf Marktplatz verschieben', isSub],
              ['Voting (Marktplatz)', isSub],
              ['Investieren (Idea-/Team-Shares)', isSub],
              ['Teams gründen & beitreten', isSub],
            ].map(([label, ok]) => (
              <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: ok ? 'var(--accent-green)' : 'var(--text-tertiary)', width: 18 }}>{ok ? '✓' : '✕'}</span>
                <span style={{ color: ok ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Investments */}
        {!isVisitor && (
          <div className="is-card reveal" style={{ padding: '26px 28px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>💰 Meine Investments</h3>
              <Link to="/investments" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>Alle anzeigen →</Link>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="is-table">
                <thead><tr><th>Idee</th><th>Typ</th><th>Betrag</th><th>Ertrag</th><th>ROI</th><th>Status</th></tr></thead>
                <tbody>
                  {myInvestments.slice(0, 4).map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.ideaTitle}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{inv.type}</td>
                      <td><BtcAmount sat={inv.amount} size={12.5} /></td>
                      <td style={{ color: 'var(--accent-green)' }}><BtcAmount sat={inv.earnings} size={12.5} /></td>
                      <td style={{ color: inv.roi >= 0 ? 'var(--accent-green)' : 'var(--accent-primary)', fontWeight: 700 }}>+{inv.roi}%</td>
                      <td><span className={`badge ${inv.status === 'aktiv' ? 'badge-green' : inv.status === 'pending' ? 'badge-orange' : 'badge-neutral'}`}>{inv.status}</span></td>
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
