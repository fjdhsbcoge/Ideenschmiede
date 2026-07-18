import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Page, PageHeader } from '@/components/bits'

export default function CreateIdea() {
  const t = useT()
  const T = t.pages.createIdea
  const { can, toast } = useStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    title: '', description: '', problem: '', solution: '', market: '',
    tags: [] as string[], goal: '10000000', valuation: '100000000', skinInGame: '1000000',
  })

  const set = (k: string, v: string | string[]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleTag = (tag: string) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((x) => x !== tag) : f.tags.length < 5 ? [...f.tags, tag] : f.tags,
    }))

  const stepValid = [
    form.title.trim().length >= 8 && form.description.trim().length >= 40 && form.problem.trim().length >= 20,
    form.tags.length >= 1,
    Number(form.goal) >= 1_000_000 && Number(form.skinInGame) >= (Number(form.valuation) * 0.01) / 100,
    true,
  ][step]

  if (!can('post')) {
    return (
      <Page narrow>
        <PageHeader title={T.loginTitle} subtitle={T.loginSubtitle} />
        <div className="is-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 22, fontSize: 15 }}>{T.loginText}</p>
          <button className="btn-primary" onClick={() => navigate('/profile')}>{T.loginCta}</button>
        </div>
      </Page>
    )
  }

  return (
    <Page narrow>
      <PageHeader title={T.title} subtitle={T.subtitle} />

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {T.steps.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div
              style={{
                height: 5, borderRadius: 999, marginBottom: 7, transition: 'all .3s',
                background: i <= step ? 'linear-gradient(90deg, var(--accent-primary), var(--accent-orange))' : 'rgba(255,255,255,.08)',
              }}
            />
            <div style={{ fontSize: 11.5, fontWeight: 600, color: i <= step ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              {i + 1}. {s}
            </div>
          </div>
        ))}
      </div>

      <div className="is-card" style={{ padding: '30px 32px' }}>
        {step === 0 && (
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <label className="is-label">{T.labelTitle}</label>
              <input className="is-input" placeholder={T.placeholderTitle} value={form.title} onChange={(e) => set('title', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>{T.hintTitle}</div>
            </div>
            <div>
              <label className="is-label">{T.labelDescription}</label>
              <textarea className="is-textarea" rows={3} placeholder={T.placeholderDescription} value={form.description} onChange={(e) => set('description', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>{T.hintDescription}</div>
            </div>
            <div>
              <label className="is-label">{T.labelProblem}</label>
              <textarea className="is-textarea" rows={3} placeholder={T.placeholderProblem} value={form.problem} onChange={(e) => set('problem', e.target.value)} />
            </div>
            <div>
              <label className="is-label">{T.labelSolution}</label>
              <textarea className="is-textarea" rows={3} placeholder={T.placeholderSolution} value={form.solution} onChange={(e) => set('solution', e.target.value)} />
            </div>
            <div>
              <label className="is-label">{T.labelMarket}</label>
              <textarea className="is-textarea" rows={2} placeholder={T.placeholderMarket} value={form.market} onChange={(e) => set('market', e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <label className="is-label">{T.labelTags}</label>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 6 }}>
              {T.suggestedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="btn-secondary"
                  style={{
                    padding: '9px 16px', fontSize: 13.5,
                    borderColor: form.tags.includes(tag) ? 'var(--accent-primary)' : undefined,
                    background: form.tags.includes(tag) ? 'rgba(84, 118, 58,.14)' : undefined,
                    color: form.tags.includes(tag) ? '#ff8ba0' : undefined,
                  }}
                >
                  {form.tags.includes(tag) ? '✓ ' : ''}{tag}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 16 }}>{T.tagsHint(form.tags.length)}</p>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <label className="is-label">{T.labelGoal}</label>
              <input className="is-input font-mono" type="number" min="1000000" step="100000" value={form.goal} onChange={(e) => set('goal', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>
                {T.hintGoal((Number(form.goal) / 1e8).toFixed(4))}
              </div>
            </div>
            <div>
              <label className="is-label">{T.labelValuation}</label>
              <input className="is-input font-mono" type="number" min="10000000" step="1000000" value={form.valuation} onChange={(e) => set('valuation', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>
                {T.hintValuation(Math.floor(Number(form.valuation) / 100_000))}
              </div>
            </div>
            <div>
              <label className="is-label">{T.labelSkin}</label>
              <input className="is-input font-mono" type="number" value={form.skinInGame} onChange={(e) => set('skinInGame', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>
                {T.hintSkin(
                  (Number(form.valuation) * 0.01).toLocaleString('de-DE'),
                  Math.min(99, Math.round((Number(form.skinInGame) / Math.max(1, Number(form.valuation))) * 10000) / 100)
                )}
              </div>
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 16, fontSize: 13.5, color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{T.dealTitle}</strong> {T.dealText}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gap: 14 }}>
            <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>{T.reviewTitle}</h3>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: 18, border: '1px solid var(--border-color)', display: 'grid', gap: 10, fontSize: 14 }}>
              <div><span style={{ color: 'var(--text-tertiary)' }}>{T.reviewLabels[0]}</span> <strong>{form.title}</strong></div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>{T.reviewLabels[1]}</span>{' '}
                {form.tags.map((tag) => (
                  <span key={tag} className="badge badge-neutral" style={{ marginRight: 5 }}>{tag}</span>
                ))}
              </div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>{T.reviewLabels[2]}</span> <span className="font-mono" style={{ color: 'var(--accent-bitcoin)' }}>₿ {(Number(form.goal) / 1e8).toFixed(4)}</span></div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>{T.reviewLabels[3]}</span> <span className="font-mono" style={{ color: 'var(--accent-bitcoin)' }}>₿ {(Number(form.skinInGame) / 1e8).toFixed(4)}</span></div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              {T.reviewNoteA} <strong>{T.reviewNoteB}</strong> {T.reviewNoteC}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30, gap: 12 }}>
          <button className="btn-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            {T.back}
          </button>
          {step < 3 ? (
            <button className="btn-primary" disabled={!stepValid} onClick={() => setStep((s) => s + 1)}>
              {T.next}
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => {
                toast(T.publishToast)
                navigate('/discussion')
              }}
            >
              {T.publish}
            </button>
          )}
        </div>
      </div>
    </Page>
  )
}
