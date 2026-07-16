import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useStore, fmtSat } from '@/lib/store';
import { getIdea, ideas } from '@/lib/data';
import { Page, PageHeader, Paywall, BtcAmount } from '@/components/bits';

interface Milestone { title: string; date: string; budget: string }

export function TeamForm({ mode }: { mode: 'apply' | 'create' }) {
  const { toast } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselect = params.get('idea') || '';
  const [ideaId, setIdeaId] = useState(preselect || ideas.find(i => i.stage === 'funding' || i.stage === 'building')?.id || '');
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [goal, setGoal] = useState('5000000');
  const [skin, setSkin] = useState('250000');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { title: '', date: '', budget: '1500000' },
    { title: '', date: '', budget: '2000000' },
    { title: '', date: '', budget: '1500000' },
  ]);

  const idea = getIdea(ideaId);
  const totalBudget = useMemo(() => milestones.reduce((s, m) => s + (Number(m.budget) || 0), 0), [milestones]);
  const skinPct = Number(goal) > 0 ? (Number(skin) / Number(goal)) * 100 : 0;
  const skinOk = skinPct >= 5;
  const budgetOk = totalBudget <= Number(goal);
  const milestonesOk = milestones.every(m => m.title.trim() && m.date && Number(m.budget) > 0);
  const formOk = name.trim().length >= 3 && focus.trim().length >= 10 && skinOk && budgetOk && milestonesOk;

  const setM = (i: number, k: keyof Milestone, v: string) =>
    setMilestones(ms => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const addM = () => setMilestones(ms => [...ms, { title: '', date: '', budget: '1000000' }]);
  const removeM = (i: number) => setMilestones(ms => ms.length > 1 ? ms.filter((_, j) => j !== i) : ms);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Idea selection */}
      <div className="is-card" style={{ padding: '26px 28px' }}>
        <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 16 }}>1️⃣ Idee auswählen</h3>
        <select className="is-select" value={ideaId} onChange={e => setIdeaId(e.target.value)}>
          {ideas.filter(i => ['funding', 'building', 'voting'].includes(i.stage)).map(i => (
            <option key={i.id} value={i.id}>{i.title}</option>
          ))}
        </select>
        {idea && (
          <div style={{ marginTop: 14, background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', fontSize: 13.5, color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            {idea.description.slice(0, 160)}…
            <div style={{ marginTop: 8, display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
              <span>Ziel: <BtcAmount sat={idea.fundingGoal || 0} size={12} /></span>
              <span>👥 {idea.investors} Investoren</span>
              <span>🛠️ {idea.teams?.length || 0} konkurrierende Teams</span>
            </div>
          </div>
        )}
        {(idea?.teams?.length || 0) > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--accent-orange)', marginTop: 10 }}>
            ⚔️ Für diese Idee existiert bereits {idea!.teams!.length} Team(s) – parallele Teams sind erwünscht: Wettbewerb erhöht die Erfolgschance.
          </p>
        )}
      </div>

      {/* Team details */}
      <div className="is-card" style={{ padding: '26px 28px' }}>
        <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 16 }}>2️⃣ Team-Details</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label className="is-label">Team-Name *</label>
            <input className="is-input" placeholder="z. B. Team Kernspalt" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="is-label">Fokus & Vorgehen *</label>
            <textarea className="is-textarea" rows={3} placeholder="Was baut euer Team konkret? Warum seid ihr die Richtigen dafür?" value={focus} onChange={e => setFocus(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label className="is-label">Funding-Ziel (sat) *</label>
              <input className="is-input font-mono" type="number" value={goal} onChange={e => setGoal(e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>₿ {(Number(goal) / 1e8).toFixed(4)}</div>
            </div>
            <div>
              <label className="is-label">Skin-in-the-game (sat) *</label>
              <input className="is-input font-mono" type="number" value={skin} onChange={e => setSkin(e.target.value)} />
              <div style={{ fontSize: 12, marginTop: 5, color: skinOk ? 'var(--accent-green)' : 'var(--accent-primary)' }}>
                {skinPct.toFixed(1)} % {skinOk ? '✓ (mind. 5 %)' : '✗ Mindestens 5 % erforderlich'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="is-card" style={{ padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
          <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700 }}>3️⃣ Meilensteine & Budget</h3>
          <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }} onClick={addM}>+ Meilenstein</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          Gelder werden in Tranchen freigegeben. Investoren stimmen über die Erfüllung jedes Meilensteins ab.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {milestones.map((m, i) => (
            <div key={i} style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '16px 18px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-orange))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                <input className="is-input" style={{ flex: 1 }} placeholder={`Meilenstein ${i + 1}: Titel`} value={m.title} onChange={e => setM(i, 'title', e.target.value)} />
                <button className="btn-ghost" style={{ color: 'var(--text-tertiary)' }} onClick={() => removeM(i)} aria-label="Entfernen">✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                  <label className="is-label" style={{ fontSize: 12 }}>Fällig bis</label>
                  <input className="is-input" type="date" value={m.date} onChange={e => setM(i, 'date', e.target.value)} />
                </div>
                <div>
                  <label className="is-label" style={{ fontSize: 12 }}>Budget (sat)</label>
                  <input className="is-input font-mono" type="number" value={m.budget} onChange={e => setM(i, 'budget', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '13px 16px', background: 'var(--bg-primary)', borderRadius: 11, fontSize: 13.5, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Meilenstein-Summe: <strong style={{ color: budgetOk ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{fmtSat(totalBudget)} sat</strong> / Ziel: {fmtSat(Number(goal))} sat</span>
          {!budgetOk && <span style={{ color: 'var(--accent-primary)', fontSize: 12.5 }}>⚠️ Budget übersteigt Funding-Ziel</span>}
          {budgetOk && <span style={{ color: 'var(--accent-green)', fontSize: 12.5 }}>✓ Budget plausibel</span>}
        </div>
      </div>

      {/* Safeguards */}
      <div className="is-card" style={{ padding: '22px 26px', borderColor: 'rgba(46,204,113,.3)' }}>
        <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🛡️ Investoren-Schutz (automatisch aktiv)</h3>
        <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <div>✓ <strong>Mindest-Funding:</strong> Wird dein Ziel nicht rechtzeitig erreicht, erhalten Investoren automatisch eine Rückerstattung.</div>
          <div>✓ <strong>Tranchen-Freigabe:</strong> Gelder fließen nur bei bestätigten Meilensteinen.</div>
          <div>✓ <strong>Reputation:</strong> Dein Track Record ist öffentlich – dein Skin-in-the-game steht auf dem Spiel.</div>
        </div>
      </div>

      <button className="btn-primary" style={{ padding: '15px 26px', fontSize: 15.5 }} disabled={!formOk}
        onClick={() => { toast(mode === 'apply' ? '🚀 Team-Bewerbung eingereicht! Investoren können jetzt abstimmen.' : '🚀 Team gegründet! Das Funding läuft.'); navigate('/teams'); }}>
        {mode === 'apply' ? 'Bewerbung einreichen' : 'Team gründen & Funding starten'}
      </button>
      {!formOk && (
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: -8 }}>
          Bitte alle Pflichtfelder ausfüllen: Name, Fokus (≥10 Zeichen), alle Meilensteine, Budget ≤ Ziel, Skin-in-the-game ≥ 5 %.
        </p>
      )}
    </div>
  );
}

export default function TeamApply() {
  const { can } = useStore();
  if (!can('teams')) {
    return (
      <Page narrow>
        <PageHeader title="🛠️ Als Team bewerben" />
        <Paywall feature="Team-Bewerbungen" />
      </Page>
    );
  }
  return (
    <Page narrow>
      <PageHeader title="🛠️ Als Team bewerben" subtitle="Stelle dein Team vor, definiere Meilensteine und erhalte Funding direkt in Bitcoin. Non-custodial, reputationsbasiert." />
      <TeamForm mode="apply" />
    </Page>
  );
}

export function TeamCreate() {
  const { can } = useStore();
  if (!can('teams')) {
    return (
      <Page narrow>
        <PageHeader title="➕ Team gründen" />
        <Paywall feature="Team-Gründung" />
      </Page>
    );
  }
  return (
    <Page narrow>
      <PageHeader title="➕ Neues Team gründen" subtitle="Wähle eine Marktplatz-Idee, formiere dein Team und starte das Funding." />
      <TeamForm mode="create" />
    </Page>
  );
}
