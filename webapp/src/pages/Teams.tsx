import { useState } from 'react';
import { Link } from 'react-router';
import { useStore, fmtSat } from '@/lib/store';
import { ideas, type Team } from '@/lib/data';
import { Page, PageHeader, BtcAmount, EmptyState } from '@/components/bits';
import { JoinTeamModal } from '@/pages/TeamDetail';

const ALL_TEAMS: (Team & { ideaTitle: string })[] = ideas.flatMap(i => (i.teams || []).map(t => ({ ...t, ideaTitle: i.title })));

const STATUS_LABEL: Record<Team['status'], string> = { funding: 'Funding läuft', building: 'Im Aufbau', completed: 'Abgeschlossen' };
const STATUS_CLASS: Record<Team['status'], string> = { funding: 'badge-orange', building: 'badge-green', completed: 'badge-neutral' };

export default function Teams() {
  const { can, role, applications, withdrawApplication, toast } = useStore();
  const [tab, setTab] = useState<'all' | 'leading' | 'member' | 'applications'>('all');
  const [joinTeam, setJoinTeam] = useState<(Team & { ideaTitle: string }) | null>(null);
  const isSub = can('teams');

  return (
    <Page>
      <PageHeader
        title="👥 Teams"
        subtitle="Macher-Teams mit Meilensteinen, Funding-Status und öffentlichem Track Record. Mehrere Teams pro Idee = gesunder Wettbewerb."
        action={isSub ? <Link to="/team-create" className="btn-primary">+ Team gründen</Link> : undefined}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 26, flexWrap: 'wrap' }}>
        {([
          ['all', '🌐 Alle Teams'],
          ['leading', '👑 Von mir geleitet'],
          ['member', '🤝 Mitglied'],
          ['applications', `📨 Meine Bewerbungen${applications.length ? ` (${applications.length})` : ''}`],
        ] as const).map(([k, l]) => (
          <button key={k} className={`is-tab ${tab === k ? 'active' : ''}`}
            style={k !== 'all' && !isSub ? { opacity: .5 } : {}}
            onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab !== 'all' && !isSub ? (
        <div className="is-card" style={{ padding: '44px 30px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>💎</div>
          <h3 className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Subscriber-Feature</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 420, margin: '0 auto 20px' }}>
            Upgrade auf Subscriber, um eigene Teams zu gründen, Funding zu erhalten und deine Mitgliedschaften zu verwalten.
          </p>
          <Link to="/profile" className="btn-primary">Mehr erfahren</Link>
        </div>
      ) : tab === 'applications' ? (
        applications.length === 0 ? (
          <EmptyState icon="📨" title="Keine offenen Bewerbungen"
            text="Sobald du dich bei Teams bewirbst, siehst du hier den Status – offen, angenommen oder abgelehnt."
            action={<button className="btn-primary" onClick={() => setTab('all')}>Teams entdecken</button>} />
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {applications.map(a => {
              return (
                <div key={a.id} className="is-card reveal" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 24 }}>🛠️</span>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <Link to={`/team/${a.teamId}`} style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{a.teamName}</Link>
                      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Projekt: {a.ideaTitle} · Beworben am {a.date} · ⏱ {a.hours} h/Woche</div>
                    </div>
                    <span className={`badge ${a.status === 'offen' ? 'badge-orange' : a.status === 'angenommen' ? 'badge-green' : 'badge-red'}`}>{a.status}</span>
                    {a.status === 'offen' && (
                      <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={() => { withdrawApplication(a.id); toast('Bewerbung zurückgezogen.'); }}>Zurückziehen</button>
                    )}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-primary)', borderRadius: 10, padding: '11px 14px', border: '1px solid var(--border-color)' }}>
                    <strong>Skills:</strong> {a.skills}<br />„{a.message}"
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === 'leading' || tab === 'member' ? (
        <EmptyState
          icon={tab === 'leading' ? '👑' : '🤝'}
          title={tab === 'leading' ? 'Du leitest noch kein Team' : 'Du bist noch in keinem Team'}
          text={tab === 'leading' ? 'Gründe dein eigenes Team für eine Marktplatz-Idee und erhalte Funding über Meilensteine.' : 'Stöbere durch die aktiven Teams und bewirb dich mit deinen Skills.'}
          action={tab === 'leading' ? <Link to="/team-create" className="btn-primary">Team gründen</Link> : <button className="btn-primary" onClick={() => setTab('all')}>Teams entdecken</button>}
        />
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {ALL_TEAMS.map(team => <TeamCard key={team.id} team={team} onJoin={() => setJoinTeam(team)} />)}
        </div>
      )}

      {role !== 'subscriber' && tab === 'all' && (
        <div className="is-card reveal" style={{ marginTop: 28, padding: '20px 26px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 24 }}>💎</span>
          <p style={{ flex: 1, fontSize: 13.5, color: 'var(--text-secondary)', minWidth: 220 }}>
            Teams anschauen ist frei. Gründen, beitreten und finanzieren ist Subscribern vorbehalten.
          </p>
          <Link to="/profile" className="btn-secondary" style={{ fontSize: 13 }}>Upgrade ansehen</Link>
        </div>
      )}

      <JoinTeamModal team={joinTeam} ideaTitle={joinTeam?.ideaTitle || ''} onClose={() => setJoinTeam(null)} />
    </Page>
  );
}

function TeamCard({ team, onJoin }: { team: Team & { ideaTitle: string }; onJoin: () => void }) {
  const { can, toast, applications } = useStore();
  const pct = Math.min(100, Math.round(team.raised / team.fundingGoal * 100));
  const doneMilestones = team.milestones.filter(m => m.done).length;
  const [invested, setInvested] = useState(false);
  const myApp = applications.find(a => a.teamId === team.id);

  return (
    <div className="is-card is-card-hover reveal" style={{ padding: '26px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <Link to={`/team/${team.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3 className="font-display" style={{ fontSize: 19, fontWeight: 700 }}>{team.name}</h3>
            </Link>
            <span className={`badge ${STATUS_CLASS[team.status]}`}>{STATUS_LABEL[team.status]}</span>
            {team.verified && <span className="badge badge-green">✓ Verifiziert</span>}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 5 }}>
            baut: <Link to={`/idea/${team.ideaId}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>{team.ideaTitle}</Link>
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
          <div>👑 {team.leader}</div>
          <div style={{ marginTop: 3 }}>👥 {team.members} Mitglieder</div>
        </div>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}><strong style={{ color: 'var(--text-primary)' }}>Fokus:</strong> {team.focus}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 11, padding: '12px 14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>Funding</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtSat(team.raised)} / {fmtSat(team.fundingGoal)} sat</div>
          <div className="progress-track" style={{ marginTop: 8, height: 6 }}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 11, padding: '12px 14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>Skin-in-the-game</div>
          <BtcAmount sat={team.skinInGame} size={14} />
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{(team.skinInGame / team.fundingGoal * 100).toFixed(1)} % des Ziels</div>
        </div>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 11, padding: '12px 14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>Meilensteine</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{doneMilestones} / {team.milestones.length} ✓</div>
          <div className="progress-track" style={{ marginTop: 8, height: 6 }}><div className="progress-fill green" style={{ width: `${team.milestones.length ? doneMilestones / team.milestones.length * 100 : 0}%` }} /></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/team/${team.id}`} className="btn-primary" style={{ fontSize: 13.5, padding: '11px 20px', textDecoration: 'none' }}>
          Team ansehen →
        </Link>
        <button className="btn-secondary" style={{ fontSize: 13.5, padding: '11px 20px' }}
          disabled={team.status === 'completed' || invested}
          onClick={() => {
            if (!can('invest')) { toast('Team-Shares kaufen ist ein Subscriber-Feature ⭐'); return; }
            setInvested(true);
            toast(`✅ Team-Shares in ${team.name} simuliert (Demo)`);
          }}>
          {invested ? '✓ Investiert' : '💰 Team-Shares'}
        </button>
        <button className="btn-secondary" style={{ fontSize: 13.5, padding: '11px 20px' }} disabled={!!myApp}
          onClick={() => can('teams') ? onJoin() : toast('Teambeitritt ist ein Subscriber-Feature ⭐')}>
          {myApp ? `📨 ${myApp.status}` : '🤝 Bewerben'}
        </button>
      </div>
    </div>
  );
}
