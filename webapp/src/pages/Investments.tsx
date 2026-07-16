import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore, fmtSat } from '@/lib/store';
import { myInvestments } from '@/lib/data';
import { Page, PageHeader, StatCard, BtcAmount, EmptyState } from '@/components/bits';

const FILTERS = ['Alle', 'Aktiv', 'Pending', 'Abgeschlossen'] as const;
const SORTS = [['date', 'Datum'], ['amount', 'Betrag'], ['roi', 'ROI'], ['earnings', 'Ertrag']] as const;

export default function Investments() {
  const { role } = useStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Alle');
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>('date');

  const list = useMemo(() => {
    let l = [...myInvestments];
    if (filter === 'Aktiv') l = l.filter(i => i.status === 'aktiv');
    if (filter === 'Pending') l = l.filter(i => i.status === 'pending');
    if (filter === 'Abgeschlossen') l = l.filter(i => i.status === 'abgeschlossen');
    l.sort((a, b) => {
      if (sort === 'amount') return b.amount - a.amount;
      if (sort === 'roi') return b.roi - a.roi;
      if (sort === 'earnings') return b.earnings - a.earnings;
      return b.date.localeCompare(a.date);
    });
    return l;
  }, [filter, sort]);

  const total = myInvestments.reduce((s, i) => s + i.amount, 0);
  const earned = myInvestments.reduce((s, i) => s + i.earnings, 0);
  const roi = total > 0 ? (earned / total) * 100 : 0;

  if (role === 'visitor') {
    return (
      <Page narrow>
        <PageHeader title="📈 Meine Investments" />
        <EmptyState icon="🔒" title="Anmeldung erforderlich" text="Melde dich an, um deine Investments zu sehen." action={<Link to="/profile" className="btn-primary">Anmelden</Link>} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="📈 Meine Investments" subtitle="Vollständige Übersicht: Idea-Shares, Team-Shares, Erträge und ROI." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 26 }}>
        <StatCard icon="💼" label="Investiert" value={`${fmtSat(total)} sat`} sub={`${myInvestments.length} Positionen`} />
        <StatCard icon="📈" label="Erträge" value={`${fmtSat(earned)} sat`} sub="seit März 2026" accent="var(--accent-green)" />
        <StatCard icon="🚀" label="ROI gesamt" value={`+${roi.toFixed(1)} %`} accent="var(--accent-green)" />
        <StatCard icon="⏳" label="Aktiv" value={String(myInvestments.filter(i => i.status === 'aktiv').length)} sub={`${myInvestments.filter(i => i.status === 'pending').length} pending`} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map(f => (
          <button key={f} className={`is-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
        <select className="is-select" style={{ width: 170, marginLeft: 'auto', padding: '9px 13px', fontSize: 13.5 }} value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>Sortieren: {l}</option>)}
        </select>
      </div>

      <div className="is-card reveal" style={{ padding: '8px 18px', overflowX: 'auto' }}>
        <table className="is-table">
          <thead>
            <tr><th>Idee</th><th>Typ</th><th>Datum</th><th>Betrag</th><th>Shares</th><th>Ertrag</th><th>ROI</th><th>Status</th></tr>
          </thead>
          <tbody>
            {list.map(inv => (
              <tr key={inv.id}>
                <td>
                  <Link to={`/idea/${inv.ideaId}`} style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}>{inv.ideaTitle}</Link>
                  {inv.team && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{inv.team}</div>}
                </td>
                <td>
                  <span className={`badge ${inv.type === 'Idea-Shares' ? 'badge-blue' : 'badge-orange'}`} style={{ fontSize: 10.5 }}>
                    {inv.type === 'Idea-Shares' ? '💡' : '🛠️'} {inv.type}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{inv.date}</td>
                <td><BtcAmount sat={inv.amount} size={12.5} /></td>
                <td className="font-mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{inv.shares > 0 ? `${inv.shares.toLocaleString('de-DE')}k` : '–'}</td>
                <td><span style={{ color: 'var(--accent-green)' }}><BtcAmount sat={inv.earnings} size={12.5} /></span></td>
                <td style={{ fontWeight: 700, color: inv.roi > 0 ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>{inv.roi > 0 ? `+${inv.roi}%` : '–'}</td>
                <td><span className={`badge ${inv.status === 'aktiv' ? 'badge-green' : inv.status === 'pending' ? 'badge-orange' : 'badge-neutral'}`}>{inv.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 16, textAlign: 'center' }}>
        Alle Positionen non-custodial – die Keys liegen bei dir. Transaktionen on-chain verifizierbar.
      </p>
    </Page>
  );
}
