import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore, fmtSat } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { myInvestments } from '@/lib/data';
import { Page, PageHeader, StatCard, BtcAmount, EmptyState } from '@/components/bits';

const SORT_KEYS = ['date', 'amount', 'roi', 'earnings'] as const;

export default function Investments() {
  const { role } = useStore();
  const t = useT();
  const T = t.pages.investments;
  const [filter, setFilter] = useState(0);
  const [sort, setSort] = useState<(typeof SORT_KEYS)[number]>('date');

  const list = useMemo(() => {
    let l = [...myInvestments];
    if (filter === 1) l = l.filter(i => i.status === 'aktiv');
    if (filter === 2) l = l.filter(i => i.status === 'pending');
    if (filter === 3) l = l.filter(i => i.status === 'abgeschlossen');
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
        <PageHeader title={T.title} />
        <EmptyState icon="🔒" title={t.pages.common.loginRequired} text={T.loginText} action={<Link to="/profile" className="btn-primary">{t.pages.common.loginCta}</Link>} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title={T.title} subtitle={T.subtitle} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 26 }}>
        <StatCard icon="💼" label={T.statInvested} value={`${fmtSat(total)} sat`} sub={T.statPositions(myInvestments.length)} />
        <StatCard icon="📈" label={T.statEarnings} value={`${fmtSat(earned)} sat`} sub={T.statEarningsSub} accent="var(--accent-green)" />
        <StatCard icon="🚀" label={T.statRoi} value={`+${roi.toFixed(1)} %`} accent="var(--accent-green)" />
        <StatCard icon="⏳" label={T.statActive} value={String(myInvestments.filter(i => i.status === 'aktiv').length)} sub={T.statPending(myInvestments.filter(i => i.status === 'pending').length)} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        {T.filters.map((f, i) => (
          <button key={f} className={`is-tab ${filter === i ? 'active' : ''}`} onClick={() => setFilter(i)}>{f}</button>
        ))}
        <select className="is-select" style={{ width: 190, marginLeft: 'auto', padding: '9px 13px', fontSize: 13.5 }} value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          {SORT_KEYS.map((k, i) => <option key={k} value={k}>{T.sortLabel}{T.sorts[i]}</option>)}
        </select>
      </div>

      <div className="is-card reveal" style={{ padding: '8px 18px', overflowX: 'auto' }}>
        <table className="is-table">
          <thead>
            <tr>{T.table.map(h => <th key={h}>{h}</th>)}</tr>
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
                <td><span className={`badge ${inv.status === 'aktiv' ? 'badge-green' : inv.status === 'pending' ? 'badge-orange' : 'badge-neutral'}`}>{T.status[inv.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 16, textAlign: 'center' }}>
        {T.footerNote}
      </p>
    </Page>
  );
}
