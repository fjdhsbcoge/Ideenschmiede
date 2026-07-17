import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useStore, fmtSat } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { getIdea, ideas } from '@/lib/data'
import { Page, PageHeader, Paywall, BtcAmount } from '@/components/bits'

interface Milestone { title: string; date: string; budget: string }

export function TeamForm({ mode }: { mode: 'apply' | 'create' }) {
  const t = useT()
  const T = t.pages.teamForm
  const M = t.pages.marketplace
  const { toast } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preselect = params.get('idea') || ''
  const [ideaId, setIdeaId] = useState(preselect || ideas.find((i) => i.stage === 'funding' || i.stage === 'building')?.id || '')
  const [name, setName] = useState('')
  const [focus, setFocus] = useState('')
  const [goal, setGoal] = useState('5000000')
  const [skin, setSkin] = useState('250000')
  const [milestones, setMilestones] = useState<Milestone[]>([
    { title: '', date: '', budget: '1500000' },
    { title: '', date: '', budget: '2000000' },
    { title: '', date: '', budget: '1500000' },
  ])

  const idea = getIdea(ideaId)
  const totalBudget = useMemo(() => milestones.reduce((s, m) => s + (Number(m.budget) || 0), 0), [milestones])
  const skinPct = Number(goal) > 0 ? (Number(skin) / Number(goal)) * 100 : 0
  const skinOk = skinPct >= 5
  const budgetOk = totalBudget <= Number(goal)
  const milestonesOk = milestones.every((m) => m.title.trim() && m.date && Number(m.budget) > 0)
  const formOk = name.trim().length >= 3 && focus.trim().length >= 10 && skinOk && budgetOk && milestonesOk

  const setM = (i: number, k: keyof Milestone, v: string) =>
    setMilestones((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)))
  const addM = () => setMilestones((ms) => [...ms, { title: '', date: '', budget: '1000000' }])
  const removeM = (i: number) => setMilestones((ms) => (ms.length > 1 ? ms.filter((_, j) => j !== i) : ms))

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Idea selection */}
      <div className="is-card" style={{ padding: '26px 28px' }}>
        <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 16 }}>{T.step1}</h3>
        <select className="is-select" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
          {ideas.filter((i) => ['funding', 'building', 'voting'].includes(i.stage)).map((i) => (
            <option key={i.id} value={i.id}>{i.title}</option>
          ))}
        </select>
        {idea && (
          <div style={{ marginTop: 14, background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', fontSize: 13.5, color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            {idea.description.slice(0, 160)}…
            <div style={{ marginTop: 8, display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
              <span>{T.goalLabel}<BtcAmount sat={idea.fundingGoal || 0} size={12} /></span>
              <span>👥 {idea.investors} {M.investorsSuffix}</span>
              <span>🛠️ {idea.teams?.length || 0} {M.teamsSuffix}</span>
            </div>
          </div>
        )}
        {(idea?.teams?.length || 0) > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--accent-orange)', marginTop: 10 }}>
            {T.competingNote(idea!.teams!.length)}
          </p>
        )}
      </div>

      {/* Team details */}
      <div className="is-card" style={{ padding: '26px 28px' }}>
        <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 16 }}>{T.step2}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label className="is-label">{T.labelName}</label>
            <input className="is-input" placeholder={T.placeholderName} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="is-label">{T.labelFocus}</label>
            <textarea className="is-textarea" rows={3} placeholder={T.placeholderFocus} value={focus} onChange={(e) => setFocus(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label className="is-label">{T.labelGoal}</label>
              <input className="is-input font-mono" type="number" value={goal} onChange={(e) => setGoal(e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>₿ {(Number(goal) / 1e8).toFixed(4)}</div>
            </div>
            <div>
              <label className="is-label">{T.labelSkin}</label>
              <input className="is-input font-mono" type="number" value={skin} onChange={(e) => setSkin(e.target.value)} />
              <div style={{ fontSize: 12, marginTop: 5, color: skinOk ? 'var(--accent-green)' : 'var(--accent-primary)' }}>
                {skinPct.toFixed(1)} % {skinOk ? T.skinOk : T.skinTooLow}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="is-card" style={{ padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
          <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700 }}>{T.step3}</h3>
          <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }} onClick={addM}>{T.addMilestone}</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          {T.milestonesNote}
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {milestones.map((m, i) => (
            <div key={i} style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '16px 18px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-orange))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                <input className="is-input" style={{ flex: 1 }} placeholder={T.milestonePlaceholder(i + 1)} value={m.title} onChange={(e) => setM(i, 'title', e.target.value)} />
                <button className="btn-ghost" style={{ color: 'var(--text-tertiary)' }} onClick={() => removeM(i)} aria-label={T.removeAria}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                  <label className="is-label" style={{ fontSize: 12 }}>{T.dueDate}</label>
                  <input className="is-input" type="date" value={m.date} onChange={(e) => setM(i, 'date', e.target.value)} />
                </div>
                <div>
                  <label className="is-label" style={{ fontSize: 12 }}>{T.budget}</label>
                  <input className="is-input font-mono" type="number" value={m.budget} onChange={(e) => setM(i, 'budget', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '13px 16px', background: 'var(--bg-primary)', borderRadius: 11, fontSize: 13.5, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {T.milestoneSum}<strong style={{ color: budgetOk ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{fmtSat(totalBudget)} sat</strong> {T.goalPrefix}{fmtSat(Number(goal))} sat
          </span>
          {!budgetOk && <span style={{ color: 'var(--accent-primary)', fontSize: 12.5 }}>{T.budgetTooHigh}</span>}
          {budgetOk && <span style={{ color: 'var(--accent-green)', fontSize: 12.5 }}>{T.budgetOk}</span>}
        </div>
      </div>

      {/* Safeguards */}
      <div className="is-card" style={{ padding: '22px 26px', borderColor: 'rgba(46,204,113,.3)' }}>
        <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{T.safeguardsTitle}</h3>
        <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          {T.safeguards.map((s, i) => (
            <div key={i}>✓ <strong>{T.safeguardsBold[i]}</strong> {s}</div>
          ))}
        </div>
      </div>

      <button
        className="btn-primary"
        style={{ padding: '15px 26px', fontSize: 15.5 }}
        disabled={!formOk}
        onClick={() => {
          toast(mode === 'apply' ? T.applyToast : T.createToast)
          navigate('/teams')
        }}
      >
        {mode === 'apply' ? T.submitApply : T.submitCreate}
      </button>
      {!formOk && (
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: -8 }}>
          {T.validationNote}
        </p>
      )}
    </div>
  )
}

export default function TeamApply() {
  const t = useT()
  const T = t.pages.teamForm
  const { can } = useStore()
  if (!can('teams')) {
    return (
      <Page narrow>
        <PageHeader title={T.applyTitle} />
        <Paywall feature={T.paywallApply} />
      </Page>
    )
  }
  return (
    <Page narrow>
      <PageHeader title={T.applyTitle} subtitle={T.applySubtitle} />
      <TeamForm mode="apply" />
    </Page>
  )
}

export function TeamCreate() {
  const t = useT()
  const T = t.pages.teamForm
  const { can } = useStore()
  if (!can('teams')) {
    return (
      <Page narrow>
        <PageHeader title={T.createTitle} />
        <Paywall feature={T.paywallCreate} />
      </Page>
    )
  }
  return (
    <Page narrow>
      <PageHeader title={T.createTitle} subtitle={T.createSubtitle} />
      <TeamForm mode="create" />
    </Page>
  )
}
