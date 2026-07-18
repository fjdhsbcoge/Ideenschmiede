import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useStore, fmtSat, type TeamAllocation } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { ideas, type Idea } from '@/lib/data'
import { Page, PageHeader, Paywall, Modal, SplitBar, BtcAmount, StageBadge } from '@/components/bits'
import { ShareButton } from '@/components/ShareMenu'

export default function Marketplace() {
  const t = useT()
  const T = t.pages.marketplace
  const { can, role } = useStore()
  const [tab, setTab] = useState(0)
  const [investIdea, setInvestIdea] = useState<Idea | null>(null)
  const [voteIdea, setVoteIdea] = useState<Idea | null>(null)

  const list = useMemo(() => {
    let l = ideas.filter((i) => i.stage !== 'discussion')
    const tabName = T.tabs[tab]
    if (tabName === 'Voting') l = l.filter((i) => i.stage === 'voting')
    if (tabName === 'Funding') l = l.filter((i) => i.stage === 'funding')
    if (tabName === 'Building') l = l.filter((i) => i.stage === 'building')
    if (tabName === 'Abgeschlossen') l = l.filter((i) => i.stage === 'completed')
    return l
  }, [tab, T.tabs])

  if (!can('marketplace')) {
    return (
      <Page>
        <PageHeader title={T.title} subtitle={T.subtitleLocked} />
        <div style={{ filter: 'blur(6px)', opacity: .5, pointerEvents: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {ideas.filter((i) => i.stage !== 'discussion').slice(0, 3).map((i) => (
            <div key={i.id} className="is-card" style={{ padding: 26, height: 220 }} />
          ))}
        </div>
        <Paywall feature={`${T.paywallFeature}${role === 'user' ? T.paywallFeatureSuffix : ''}`} />
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title={T.title}
        subtitle={T.subtitle}
        action={<Link to="/investments" className="btn-secondary">{T.myInvestments}</Link>}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 26, flexWrap: 'wrap' }}>
        {T.tabs.map((tabName, i) => (
          <button key={tabName} className={`is-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{tabName}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
        {list.map((idea) => (
          <MarketCard key={idea.id} idea={idea} onInvest={() => setInvestIdea(idea)} onVote={() => setVoteIdea(idea)} />
        ))}
      </div>

      <InvestModal idea={investIdea} onClose={() => setInvestIdea(null)} />
      <VotingModal idea={voteIdea} onClose={() => setVoteIdea(null)} />
    </Page>
  )
}

function MarketCard({ idea, onInvest, onVote }: { idea: Idea; onInvest: () => void; onVote: () => void }) {
  const t = useT()
  const T = t.pages.marketplace
  const { votes, allocations } = useStore()
  const fundingPct = idea.fundingGoal ? Math.min(100, Math.round(((idea.raised || 0) / idea.fundingGoal) * 100)) : 0
  const myVote = votes[`vote-${idea.id}`]
  const up = idea.votes.up + (myVote === 'yes' ? 1 : 0)
  const down = idea.votes.down + (myVote === 'no' ? 1 : 0)
  const votePct = Math.round((up / Math.max(1, up + down)) * 100)
  const myAlloc = allocations[idea.id]

  return (
    <div className="is-card is-card-hover reveal" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 15 }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <StageBadge stage={idea.stage} />
        {idea.tags.slice(0, 2).map((tag) => <span key={tag} className="badge badge-neutral">{tag}</span>)}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{idea.time}</span>
      </div>

      <Link to={`/idea/${idea.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <h3 className="font-display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3, marginBottom: 7 }}>{idea.title}</h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{idea.description}</p>
      </Link>

      {idea.stage === 'voting' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 7 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{T.votingEndsIn(idea.votingEndsIn || '')}</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{votePct}{T.yesSuffix}</span>
          </div>
          <div className="progress-track"><div className="progress-fill green" style={{ width: `${votePct}%` }} /></div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {T.votesCount(up + down)}{myVote ? ` · ${T.yourVotePrefix}${myVote === 'yes' ? T.yourVoteYes : T.yourVoteNo}` : ''}
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
            <span>👥 {idea.investors} {T.investorsSuffix}</span>
            <span>🛠️ {idea.teams?.length || 0} {T.teamsSuffix}</span>
            {idea.closesIn && <span>⏳ {idea.closesIn}</span>}
          </div>
          {myAlloc && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-green)', background: 'rgba(46,204,113,.08)', border: '1px solid rgba(46,204,113,.3)', borderRadius: 9, padding: '8px 11px' }}>
              {T.allocPrefix}{myAlloc.map((a) => `${a.teamName.replace('Team ', '')} ${a.pct} %`).join(' · ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 9, marginTop: 'auto', paddingTop: 6 }}>
        {idea.stage === 'voting' ? (
          <>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13.5, padding: '11px 16px' }} onClick={onVote}>
              {myVote ? T.changeVote : T.vote}
            </button>
            <Link to={`/idea/${idea.id}`} className="btn-ghost" style={{ fontSize: 13, textDecoration: 'none' }}>{T.details}</Link>
          </>
        ) : (
          <>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13.5, padding: '11px 16px' }} onClick={onInvest} disabled={idea.stage === 'completed'}>
              {idea.stage === 'completed' ? T.completed : myAlloc ? T.reinvest : T.buyIdeaShares}
            </button>
            <Link to={`/team-apply?idea=${idea.id}`} className="btn-secondary" style={{ justifyContent: 'center', fontSize: 13.5, padding: '11px 16px' }}>{T.applyAsTeam}</Link>
          </>
        )}
        <ShareButton compact ideaId={idea.id} title={idea.title} description={idea.description} />
      </div>
    </div>
  )
}

/* ---------- Echtes Marktplatz-Voting ---------- */
function VotingModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const t = useT()
  const T = t.pages.marketplace
  const { votes, castVote, toast } = useStore()
  if (!idea) return null
  const key = `vote-${idea.id}`
  const myVote = votes[key]

  const vote = (v: 'yes' | 'no') => {
    castVote(key, v)
    toast(v === 'yes' ? T.voteYesToast : T.voteNoToast)
    onClose()
  }

  return (
    <Modal open={!!idea} onClose={onClose} title={T.voteModalTitle}>
      <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        {T.voteQuestionA} <strong style={{ color: 'var(--text-primary)' }}>„{idea.title}“</strong> {T.voteQuestionB}
      </p>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 11, padding: '13px 15px', fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 18, border: '1px solid var(--border-color)', display: 'grid', gap: 6 }}>
        <div>{T.voteRules[0]}</div>
        <div>⏳ {T.voteRunsSuffix} {idea.votingEndsIn}</div>
        <div>{T.voteRules[1]}</div>
        {myVote && <div style={{ color: 'var(--accent-green)' }}>{T.currentVoteNote(myVote === 'yes' ? T.yes : T.no)}</div>}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => vote('yes')}>{T.voteYes}</button>
        <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => vote('no')}>{T.voteNo}</button>
      </div>
    </Modal>
  )
}

/* ---------- Investment + Investor Team Selection ---------- */
function InvestModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const t = useT()
  const T = t.pages.marketplace
  const { toast, saveAllocation } = useStore()
  const [step, setStep] = useState(0)
  const [amount, setAmount] = useState('100000')
  const [pcts, setPcts] = useState<Record<string, number>>({})
  const [confirmed, setConfirmed] = useState(false)

  if (!idea) return null
  const teams = idea.teams || []
  const sat = Math.max(0, Number(amount) || 0)
  const price = idea.sharePrice || 100
  const shares = Math.floor((sat / price) * 1000)
  const totalRaised = (idea.raised || 0) + sat
  const ownership = totalRaised > 0 ? (sat / totalRaised) * 100 : 0
  const pool80 = Math.round(sat * 0.8)
  const pctSum = teams.reduce((s, tm) => s + (pcts[tm.id] || 0), 0)
  const allocOk = teams.length === 0 || (pctSum === 100 && confirmed)

  const close = () => { setStep(0); setPcts({}); setConfirmed(false); setAmount('100000'); onClose() }

  const finish = () => {
    if (teams.length > 0) {
      const alloc: TeamAllocation[] = teams
        .filter((tm) => (pcts[tm.id] || 0) > 0)
        .map((tm) => ({ teamId: tm.id, teamName: tm.name, pct: pcts[tm.id], sat: Math.round((pool80 * pcts[tm.id]) / 100) }))
      saveAllocation(idea.id, alloc)
    }
    toast(T.doneToast)
    close()
  }

  return (
    <Modal open={!!idea} onClose={close} title={step === 0 ? T.investTitle : T.selectTeamsTitle}>
      {step === 0 && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.65 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{idea.title}</strong><br />
            {T.investBodyA} <strong>{T.investBodyB}</strong> {T.investBodyC}
          </p>

          <label className="is-label">{T.labelAmount}</label>
          <input className="is-input font-mono" type="number" min="1000" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, margin: '10px 0 18px', flexWrap: 'wrap' }}>
            {[50_000, 100_000, 500_000, 1_000_000].map((v) => (
              <button key={v} className="btn-secondary" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={() => setAmount(String(v))}>{fmtSat(v)} sat</button>
            ))}
          </div>

          <div style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: 17, border: '1px solid var(--border-color)', display: 'grid', gap: 9, fontSize: 13.5, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>{T.youInvest}</span><BtcAmount sat={sat} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>{T.pricePer1k}</span><span className="font-mono">{price} sat</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>{T.youReceive}</span><strong>{shares.toLocaleString('de-DE')} {T.ideaSharesSuffix}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>{T.yourPoolShare}</span><strong style={{ color: 'var(--accent-orange)' }}>{ownership.toFixed(2)} %</strong></div>
            <hr className="is-divider" style={{ margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>{T.toCreator}</span><BtcAmount sat={Math.round(sat * 0.15)} size={12.5} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>{T.toThinkers}</span><BtcAmount sat={Math.round(sat * 0.05)} size={12.5} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>{T.toTeamPool}</span><BtcAmount sat={pool80} size={12.5} /></div>
          </div>

          <SplitBar compact />
          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 20 }}
            disabled={sat < 1000}
            onClick={() => (teams.length > 0 ? setStep(1) : finish())}
          >
            {teams.length > 0 ? T.nextToTeams : T.confirmInvest}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, textAlign: 'center' }}>
            {teams.length === 0 ? T.noTeamsNote : T.nonCustodialNote}
          </p>
        </div>
      )}

      {step === 1 && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 6 }}>
            {T.selectionBodyA} (<BtcAmount sat={pool80} size={13} />) {T.selectionBodyB}{' '}
            <strong>{T.selectionBodyC}</strong>
          </p>
          <div style={{ display: 'grid', gap: 12, margin: '18px 0' }}>
            {teams.map((tm) => {
              const p = pcts[tm.id] || 0
              const tpct = Math.min(100, Math.round((tm.raised / tm.fundingGoal) * 100))
              return (
                <div key={tm.id} style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '15px 17px', border: `1px solid ${p > 0 ? 'rgba(243,156,18,.45)' : 'var(--border-color)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Link to={`/team/${tm.id}`} style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)', textDecoration: 'none' }}>{tm.name}</Link>
                    {tm.verified && <span className="badge badge-green" style={{ fontSize: 10 }}>{T.verifiedBadge}</span>}
                    <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{T.fundingPrefix}{tpct} % · 👑 {tm.leader}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>{tm.focus}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="range" min="0" max="100" step="5" value={p}
                      onChange={(e) => setPcts((prev) => ({ ...prev, [tm.id]: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: 'var(--accent-orange)' }}
                    />
                    <span className="font-mono" style={{ width: 52, textAlign: 'right', fontSize: 14, fontWeight: 700, color: p > 0 ? 'var(--accent-orange)' : 'var(--text-tertiary)' }}>{p} %</span>
                    <BtcAmount sat={Math.round((pool80 * p) / 100)} size={12} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: 'var(--bg-primary)', borderRadius: 11, marginBottom: 14, fontSize: 13.5, border: `1px solid ${pctSum === 100 ? 'rgba(46,204,113,.4)' : 'var(--border-color)'}` }}>
            <span style={{ color: 'var(--text-secondary)' }}>{T.distributed}<strong style={{ color: pctSum === 100 ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{pctSum} %</strong> {T.of100}</span>
            {pctSum !== 100 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{T.adjustSliders}</span>}
          </div>

          <label style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, cursor: 'pointer', lineHeight: 1.5 }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--accent-primary)' }} />
            <span>{T.confirmCheckboxA} <strong>{T.confirmCheckboxB}</strong> {T.confirmCheckboxC}</span>
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={() => setStep(0)}>{T.back}</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!allocOk} onClick={finish}>
              {T.confirmAndInvest}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
