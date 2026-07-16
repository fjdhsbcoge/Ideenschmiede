import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '@/lib/store';
import { Page, PageHeader } from '@/components/bits';

const STEPS = ['Inhalt', 'Tags', 'Ziel & Bewertung', 'Prüfen'];
const SUGGESTED_TAGS = ['Hardware', 'Software', 'Open Source', 'Energie', 'Nachhaltigkeit', '3D-Druck', 'Community', 'Plattform', 'Materialwissenschaft', 'Bildung', 'KI', 'Mobilität'];

export default function CreateIdea() {
  const { can, toast } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: '', description: '', problem: '', solution: '', market: '',
    tags: [] as string[], goal: '10000000', valuation: '100000000', skinInGame: '1000000',
  });

  const set = (k: string, v: string | string[]) => setForm(f => ({ ...f, [k]: v }));
  const toggleTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : f.tags.length < 5 ? [...f.tags, t] : f.tags }));

  const stepValid = [
    form.title.trim().length >= 8 && form.description.trim().length >= 40 && form.problem.trim().length >= 20,
    form.tags.length >= 1,
    Number(form.goal) >= 1_000_000 && Number(form.skinInGame) >= Number(form.valuation) * 0.01 / 100,
    true,
  ][step];

  if (!can('post')) {
    return (
      <Page narrow>
        <PageHeader title="💡 Neue Idee einreichen" subtitle="Das Posten von Ideen ist kostenlos – du brauchst nur ein Konto." />
        <div className="is-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 22, fontSize: 15 }}>Melde dich kostenlos an, um deine Idee mit der Community zu teilen.</p>
          <button className="btn-primary" onClick={() => navigate('/profile')}>Kostenlos anmelden</button>
        </div>
      </Page>
    );
  }

  return (
    <Page narrow>
      <PageHeader title="💡 Neue Idee einreichen" subtitle="Kostenlos und unverbindlich. Die Community hilft dir, die Idee zu schärfen – bevor sie auf den Marktplatz darf." />

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 5, borderRadius: 999, background: i <= step ? 'linear-gradient(90deg, var(--accent-primary), var(--accent-orange))' : 'rgba(255,255,255,.08)', marginBottom: 7, transition: 'all .3s' }} />
            <div style={{ fontSize: 11.5, fontWeight: 600, color: i <= step ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{i + 1}. {s}</div>
          </div>
        ))}
      </div>

      <div className="is-card" style={{ padding: '30px 32px' }}>
        {step === 0 && (
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <label className="is-label">Titel der Idee *</label>
              <input className="is-input" placeholder="z. B. Open-Source Röhren-Linearmotor für Makers" value={form.title} onChange={e => set('title', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>Mindestens 8 Zeichen</div>
            </div>
            <div>
              <label className="is-label">Kurzbeschreibung * (erscheint auf der Karte)</label>
              <textarea className="is-textarea" rows={3} placeholder="In 2–3 Sätzen: Was ist die Idee, was macht sie besonders?" value={form.description} onChange={e => set('description', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>Mindestens 40 Zeichen</div>
            </div>
            <div>
              <label className="is-label">🎯 Problem *</label>
              <textarea className="is-textarea" rows={3} placeholder="Welches Problem löst die Idee? Wem tut es heute weh?" value={form.problem} onChange={e => set('problem', e.target.value)} />
            </div>
            <div>
              <label className="is-label">💊 Lösung</label>
              <textarea className="is-textarea" rows={3} placeholder="Wie löst deine Idee das Problem konkret?" value={form.solution} onChange={e => set('solution', e.target.value)} />
            </div>
            <div>
              <label className="is-label">📊 Markt & Zielgruppe</label>
              <textarea className="is-textarea" rows={2} placeholder="Wer würde das kaufen/nutzen? Wie groß ist der Markt grob?" value={form.market} onChange={e => set('market', e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <label className="is-label">Wähle 1–5 Tags *</label>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 6 }}>
              {SUGGESTED_TAGS.map(t => (
                <button key={t} onClick={() => toggleTag(t)} className="btn-secondary"
                  style={{
                    padding: '9px 16px', fontSize: 13.5,
                    borderColor: form.tags.includes(t) ? 'var(--accent-primary)' : undefined,
                    background: form.tags.includes(t) ? 'rgba(233,69,96,.14)' : undefined,
                    color: form.tags.includes(t) ? '#ff8ba0' : undefined,
                  }}>
                  {form.tags.includes(t) ? '✓ ' : ''}{t}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 16 }}>Tags helfen Investoren und Teams, deine Idee zu finden. Gewählt: {form.tags.length}/5</p>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <label className="is-label">Funding-Ziel (in sat) *</label>
              <input className="is-input font-mono" type="number" min="1000000" step="100000" value={form.goal} onChange={e => set('goal', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>= ₿ {(Number(form.goal) / 1e8).toFixed(4)} · mindestens 1.000.000 sat</div>
            </div>
            <div>
              <label className="is-label">Selbst gesetzte Bewertung der Idee (in sat)</label>
              <input className="is-input font-mono" type="number" min="10000000" step="1000000" value={form.valuation} onChange={e => set('valuation', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>Bestimmt den Preis der 100M Idea-Shares: {Math.floor(Number(form.valuation) / 100_000)} sat pro 1.000 Shares</div>
            </div>
            <div>
              <label className="is-label">Dein Skin-in-the-game (in sat) *</label>
              <input className="is-input font-mono" type="number" value={form.skinInGame} onChange={e => set('skinInGame', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>
                Mindestens 1 % der Bewertung = {(Number(form.valuation) * 0.01).toLocaleString('de-DE')} sat. Deine Idee-Shares-Quote: {Math.min(99, Math.round(Number(form.skinInGame) / Math.max(1, Number(form.valuation)) * 10000) / 100)} %
              </div>
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 16, fontSize: 13.5, color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Dein Deal als Ideengeber:</strong> 15 % jeder externen Investition sofort + Idea-Shares gemäß deiner Quote + 20 % Revenue-Share auf alle Team-Umsätze (verteilt auf alle Idea-Share-Halter).
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gap: 14 }}>
            <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>Alles prüfen & veröffentlichen</h3>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: 18, border: '1px solid var(--border-color)', display: 'grid', gap: 10, fontSize: 14 }}>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Titel:</span> <strong>{form.title}</strong></div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Tags:</span> {form.tags.map(t => <span key={t} className="badge badge-neutral" style={{ marginRight: 5 }}>{t}</span>)}</div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Funding-Ziel:</span> <span className="font-mono" style={{ color: 'var(--accent-bitcoin)' }}>₿ {(Number(form.goal) / 1e8).toFixed(4)}</span></div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Skin-in-the-game:</span> <span className="font-mono" style={{ color: 'var(--accent-bitcoin)' }}>₿ {(Number(form.skinInGame) / 1e8).toFixed(4)}</span></div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Deine Idee erscheint zunächst in der <strong>Diskussion</strong> (kostenlos). Sobald die Community-Feedback-Phase genug Zustimmung zeigt, kannst du sie als Subscriber auf den Marktplatz verschieben.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30, gap: 12 }}>
          <button className="btn-secondary" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← Zurück</button>
          {step < 3 ? (
            <button className="btn-primary" disabled={!stepValid} onClick={() => setStep(s => s + 1)}>Weiter →</button>
          ) : (
            <button className="btn-primary" onClick={() => { toast('🎉 Idee veröffentlicht! Die Diskussion ist eröffnet.'); navigate('/discussion'); }}>
              🚀 Idee veröffentlichen
            </button>
          )}
        </div>
      </div>
    </Page>
  );
}
