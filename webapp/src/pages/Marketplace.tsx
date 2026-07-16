import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore, fmtSat, type TeamAllocation } from '@/lib/store';
import { ideas, type Idea } from '@/lib/data';
import { Page, PageHeader, Paywall, Modal, SplitBar, BtcAmount, StageBadge } from '@/components/bits';

const TABS = ['Alle', 'Voting', 'Funding', 'Building', 'Abgeschlossen'] as const;

export default function Marketplace() {
  const { can, role } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Alle');
  const [investIdea, setInvestIdea] = useState<Idea | null>(null);
  const [voteIdea, setVoteIdea] = useState<Idea | null>(null);

  const list = useMemo(() => {
    let l = ideas.filter(i => i.stage !== 'discussion');
    if (tab === 'Voting') l = l.filter(i => i.stage === 'voting');
    if (tab === 'Funding') l = l.filter(i => i.stage === 'funding');
    if (tab === 'Building') l = l.filter(i => i.stage === 'building');
    if (tab === 'Abgeschlossen') l = l.filter(i => i.stage === 'completed');
    return l;
  }, [tab]);

  if (!can('marketplace')) {
    return (
      <Page>
        <PageHeader title="🛒 Ideen-Marktplatz" subtitle="Investiere in von der Community validierte Ideen." />
        <div style={{ filter: 'blur(6px)', opacity: .5, pointerEvents: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {ideas.filter(i => i.stage !== 'discussion').slice(0, 3).map(i => <div key={i.id} className="is-card" style={{ padding: 26, height: 220 }} />)}
        </div>
        <Paywall feature={`Der Ideen-Marktplatz${role === 'user' ? ' (Investieren, Voting & Teams)' : ''}`} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="🛒 Ideen-Marktplatz"
        subtitle="Community-validierte Ideen mit Idea- & Team-Shares. Milestone-gesichert, transparent, Bitcoin-nativ."
        action={<Link to="/investments" className="btn-secondary">📈 Meine Investments</Link>}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 26, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} className={`is-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
        {list.map(idea => (
          <MarketCard key={idea.id} idea={idea} onInvest={() => setInvestIdea(idea)} onVote={() => setVoteIdea(idea)} />
        ))}
      </div>

      <InvestModal idea={investIdea} onClose={() => setInvestIdea(null)} />
      <VotingModal idea={voteIdea} onClose={() => setVoteIdea(null)} />
    </Page>
  );
}

function MarketCard({ idea, onInvest, onVote }: { idea: Idea; onInvest: () => void; onVote: () => void }) {
  const { votes, allocations } = useStore();
  const fundingPct = idea.fundingGoal ? Math.min(100, Math.round(((idea.raised || 0) / idea.fundingGoal) * 100)) : 0;
  const myVote = votes[`vote-${idea.id}`];
  const up = idea.votes.up + (myVote === 'yes' ? 1 : 0);
  const down = idea.votes.down + (myVote === 'no' ? 1 : 0);
  const votePct = Math.round(up / Math.max(1, up + down) * 100);
  const myAlloc = allocations[idea.id];

  return (
    <div className="is-card is-card-hover reveal" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 15 }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <StageBadge stage={idea.stage} />
        {idea.tags.slice(0, 2).map(t => <span key={t} className="badge badge-neutral">{t}</span>)}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{idea.time}</span>
      </div>

      <Link to={`/idea/${idea.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <h3 className="font-display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3, marginBottom: 7 }}>{idea.title}</h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{idea.description}</p>
      </Link>

      {idea.stage === 'voting' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 7 }}>
            <span style={{ color: 'var(--text-secondary)' }}>⏳ Voting endet in {idea.votingEndsIn}</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{votePct}% Ja</span>
          </div>
          <div className="progress-track"><div className="progress-fill green" style={{ width: `${votePct}%` }} /></div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {up + down} Stimmen{myVote ? ` · Deine Stimme: ${myVote === 'yes' ? '✓ Ja' : '✗ Nein'}` : ''}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 7 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{fmtSat(idea.raised || 0)} / {fmtSat(idea.fundingGoal || 0)} sat</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-orange)' }}>{fundingPct}%</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${fundingPct}%` }} /></div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7, flexWrap: 'wrap' }}>
            <span>👥 {idea.investors} Investoren</span>
            <span>🛠️ {idea.teams?.length || 0} Teams</span>
            {idea.closesIn && <span>⏳ {idea.closesIn}</span>}
          </div>
          {myAlloc && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-green)', background: 'rgba(46,204,113,.08)', border: '1px solid rgba(46,204,113,.3)', borderRadius: 9, padding: '8px 11px' }}>
              ✓ Deine Team-Auswahl: {myAlloc.map(a => `${a.teamName.replace('Team ', '')} ${a.pct} %`).join(' · ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 9, marginTop: 'auto', paddingTop: 6 }}>
        {idea.stage === 'voting' ? (
          <>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13.5, padding: '11px 16px' }} onClick={onVote}>
              🗳️ {myVote ? 'Stimme ändern' : 'Abstimmen'}
            </button>
            <Link to={`/idea/${idea.id}`} className="btn-ghost" style={{ fontSize: 13, textDecoration: 'none' }}>Details →</Link>
          </>
        ) : (
          <>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13.5, padding: '11px 16px' }} onClick={onInvest} disabled={idea.stage === 'completed'}>
              {idea.stage === 'completed' ? '✓ Abgeschlossen' : myAlloc ? '💰 Erneut investieren' : '💰 Idea-Shares kaufen'}
            </button>
            <Link to={`/team-apply?idea=${idea.id}`} className="btn-secondary" style={{ justifyContent: 'center', fontSize: 13.5, padding: '11px 16px' }}>🛠️ Als Team bewerben</Link>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Echtes Marktplatz-Voting ---------- */
function VotingModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const { votes, castVote, toast } = useStore();
  if (!idea) return null;
  const key = `vote-${idea.id}`;
  const myVote = votes[key];

  const vote = (v: 'yes' | 'no') => {
    castVote(key, v);
    toast(v === 'yes' ? '🗳️ Stimme abgegeben: Ja ✓' : '🗳️ Stimme abgegeben: Nein');
    onClose();
  };

  return (
    <Modal open={!!idea} onClose={onClose} title="🗳️ Community-Voting">
      <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        Soll <strong style={{ color: 'var(--text-primary)' }}>„{idea.title}“</strong> auf dem Marktplatz finanzierbar werden?
      </p>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 11, padding: '13px 15px', fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 18, border: '1px solid var(--border-color)', display: 'grid', gap: 6 }}>
        <div>🗳️ 1 Person = 1 Stimme (Subscription verhindert Sybil-Angriffe)</div>
        <div>⏳ Voting läuft noch {idea.votingEndsIn}</div>
        <div>🔁 Deine Stimme kann bis zum Ende geändert werden</div>
        {myVote && <div style={{ color: 'var(--accent-green)' }}>✓ Du hast aktuell mit „{myVote === 'yes' ? 'Ja' : 'Nein'}“ gestimmt – erneuter Klick auf dieselbe Wahl nimmt die Stimme zurück.</div>}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => vote('yes')}>✓ Ja, finanzierbar</button>
        <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => vote('no')}>✗ Nein</button>
      </div>
    </Modal>
  );
}

/* ---------- Investment + Investor Team Selection ---------- */
function InvestModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const { toast, saveAllocation } = useStore();
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState('100000');
  const [pcts, setPcts] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState(false);

  if (!idea) return null;
  const teams = idea.teams || [];
  const sat = Math.max(0, Number(amount) || 0);
  const price = idea.sharePrice || 100;
  const shares = Math.floor(sat / price * 1000);
  const totalRaised = (idea.raised || 0) + sat;
  const ownership = totalRaised > 0 ? (sat / totalRaised * 100) : 0;
  const pool80 = Math.round(sat * .8);
  const pctSum = teams.reduce((s, t) => s + (pcts[t.id] || 0), 0);
  const allocOk = teams.length === 0 || (pctSum === 100 && confirmed);

  const close = () => { setStep(0); setPcts({}); setConfirmed(false); setAmount('100000'); onClose(); };

  const finish = () => {
    if (teams.length > 0) {
      const alloc: TeamAllocation[] = teams
        .filter(t => (pcts[t.id] || 0) > 0)
        .map(t => ({ teamId: t.id, teamName: t.name, pct: pcts[t.id], sat: Math.round(pool80 * pcts[t.id] / 100) }));
      saveAllocation(idea.id, alloc);
    }
    toast('✅ Investment & Team-Auswahl gespeichert (Demo)');
    close();
  };

  return (
    <Modal open={!!idea} onClose={close} title={step === 0 ? '💰 Idea-Shares kaufen' : '🎯 Wähle deine Teams'}>
      {step === 0 && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.65 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{idea.title}</strong><br />
            Idea-Shares verzinsen dich an <strong>allen Teams</strong> dieser Idee: 20 % jedes Team-Umsatzes (und Exits) fließen an die Idea-Share-Halter.
          </p>

          <label className="is-label">Investment (in sat)</label>
          <input className="is-input font-mono" type="number" min="1000" step="1000" value={amount} onChange={e => setAmount(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, margin: '10px 0 18px', flexWrap: 'wrap' }}>
            {[50_000, 100_000, 500_000, 1_000_000].map(v => (
              <button key={v} className="btn-secondary" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={() => setAmount(String(v))}>{fmtSat(v)} sat</button>
            ))}
          </div>

          <div style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: 17, border: '1px solid var(--border-color)', display: 'grid', gap: 9, fontSize: 13.5, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Du investierst</span><BtcAmount sat={sat} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Preis pro 1.000 Shares</span><span className="font-mono">{price} sat</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Du erhältst</span><strong>{shares.toLocaleString('de-DE')} Idea-Shares</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Dein Anteil am Idea-Pool</span><strong style={{ color: 'var(--accent-orange)' }}>{ownership.toFixed(2)} %</strong></div>
            <hr className="is-divider" style={{ margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>→ Ideengeber (15 %)</span><BtcAmount sat={Math.round(sat * .15)} size={12.5} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>→ Mitdenker (5 %)</span><BtcAmount sat={Math.round(sat * .05)} size={12.5} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>→ Team-Pool (80 %)</span><BtcAmount sat={pool80} size={12.5} /></div>
          </div>

          <SplitBar compact />
          <button className="btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={sat < 1000}
            onClick={() => teams.length > 0 ? setStep(1) : finish()}>
            {teams.length > 0 ? 'Weiter zur Team-Auswahl →' : 'Investment bestätigen (Demo)'}
          </button>
          {teams.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, textAlign: 'center' }}>
              Noch kein Team angetreten – dein 80 %-Pool wird gehalten, bis Teams sich bewerben.
            </p>
          )}
        </div>
      )}

      {step === 1 && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 6 }}>
            Verteile deinen 80 %-Pool (<BtcAmount sat={pool80} size={13} />) auf die Teams deiner Wahl.
            Du kannst diversifizieren – <strong>die Auswahl ist unwiderruflich (non-refundable)</strong>.
          </p>
          <div style={{ display: 'grid', gap: 12, margin: '18px 0' }}>
            {teams.map(t => {
              const p = pcts[t.id] || 0;
              const tpct = Math.min(100, Math.round(t.raised / t.fundingGoal * 100));
              return (
                <div key={t.id} style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '15px 17px', border: `1px solid ${p > 0 ? 'rgba(243,156,18,.45)' : 'var(--border-color)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Link to={`/team/${t.id}`} style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)', textDecoration: 'none' }}>{t.name}</Link>
                    {t.verified && <span className="badge badge-green" style={{ fontSize: 10 }}>✓ Verifiziert</span>}
                    <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Funding: {tpct} % · 👑 {t.leader}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>{t.focus}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="range" min="0" max="100" step="5" value={p}
                      onChange={e => setPcts(prev => ({ ...prev, [t.id]: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: 'var(--accent-orange)' }} />
                    <span className="font-mono" style={{ width: 52, textAlign: 'right', fontSize: 14, fontWeight: 700, color: p > 0 ? 'var(--accent-orange)' : 'var(--text-tertiary)' }}>{p} %</span>
                    <BtcAmount sat={Math.round(pool80 * p / 100)} size={12} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: 'var(--bg-primary)', borderRadius: 11, marginBottom: 14, fontSize: 13.5, border: `1px solid ${pctSum === 100 ? 'rgba(46,204,113,.4)' : 'var(--border-color)'}` }}>
            <span style={{ color: 'var(--text-secondary)' }}>Verteilt: <strong style={{ color: pctSum === 100 ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{pctSum} %</strong> von 100 %</span>
            {pctSum !== 100 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Passe die Slider an, bis 100 % erreicht sind</span>}
          </div>

          <label style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, cursor: 'pointer', lineHeight: 1.5 }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--accent-primary)' }} />
            <span>Ich verstehe: Die Team-Auswahl ist <strong>non-refundable</strong> und fließt direkt an die Teams.</span>
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={() => setStep(0)}>← Zurück</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!allocOk} onClick={finish}>
              Bestätigen & investieren (Demo)
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
