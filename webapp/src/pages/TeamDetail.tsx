import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useStore, fmtSat } from '@/lib/store';
import { ideas, type Team, type TeamApplication } from '@/lib/data';
import { Page, Modal, BtcAmount, EmptyState } from '@/components/bits';

const STATUS_LABEL: Record<Team['status'], string> = { funding: 'Funding läuft', building: 'Im Aufbau', completed: 'Abgeschlossen' };
const STATUS_CLASS: Record<Team['status'], string> = { funding: 'badge-orange', building: 'badge-green', completed: 'badge-neutral' };

export function findTeam(teamId: string): { team: Team; ideaTitle: string } | null {
  for (const i of ideas) {
    const t = (i.teams || []).find(t => t.id === teamId);
    if (t) return { team: t, ideaTitle: i.title };
  }
  return null;
}

/* ---------- Bewerbungs-Modal (auch in Teams.tsx genutzt) ---------- */
export function JoinTeamModal({ team, ideaTitle, onClose }: { team: Team | null; ideaTitle: string; onClose: () => void }) {
  const { addApplication, toast, can } = useStore();
  const [skills, setSkills] = useState('');
  const [hours, setHours] = useState('6');
  const [message, setMessage] = useState('');
  const valid = skills.trim().length >= 3 && message.trim().length >= 20 && Number(hours) >= 1;

  if (!team) return null;
  return (
    <Modal open={!!team} onClose={onClose} title={`🤝 Bei ${team.name} bewerben`}>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
        Projekt: <Link to={`/idea/${team.ideaId}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>{ideaTitle}</Link>
        {' · '}Deine Bewerbung ist unverbindlich – der Team-Leader entscheidet.
      </p>
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <label className="is-label">Deine Skills *</label>
          <input className="is-input" placeholder="z. B. CAD, Wicklungstechnik, React, Community-Aufbau…" value={skills} onChange={e => setSkills(e.target.value)} />
        </div>
        <div>
          <label className="is-label">Zeitbudget (Stunden/Woche) *</label>
          <input className="is-input" type="number" min="1" max="60" value={hours} onChange={e => setHours(e.target.value)} />
        </div>
        <div>
          <label className="is-label">Motivation & Beitrag * (mind. 20 Zeichen)</label>
          <textarea className="is-textarea" rows={4} placeholder="Warum du? Was wirst du konkret beitragen?" value={message} onChange={e => setMessage(e.target.value)} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', background: 'var(--bg-primary)', borderRadius: 10, padding: '11px 14px', border: '1px solid var(--border-color)' }}>
          💡 Tipp: Konkrete Beiträge („Ich bestücke die Platinen“) werden deutlich öfter angenommen als generische („Ich helfe gern“).
        </div>
        <button className="btn-primary" disabled={!valid} onClick={() => {
          if (!can('teams')) { toast('Teambeitritt ist ein Subscriber-Feature ⭐'); onClose(); return; }
          addApplication({ teamId: team.id, teamName: team.name, ideaTitle, skills, hours: Number(hours), message });
          toast(`📨 Bewerbung an ${team.name} gesendet!`);
          onClose();
        }}>Bewerbung absenden</button>
      </div>
    </Modal>
  );
}

/* ---------- Team-Detailseite ---------- */
export default function TeamDetail() {
  const { id } = useParams();
  const found = findTeam(id || '');
  const { can, toast, votes, castVote, applications } = useStore();
  const [tab, setTab] = useState<'overview' | 'reports' | 'shares' | 'applications'>('overview');
  const [joinOpen, setJoinOpen] = useState(false);
  const [investOpen, setInvestOpen] = useState(false);
  const [invested, setInvested] = useState(false);
  const [apps, setApps] = useState<TeamApplication[]>(found?.team.incomingApplications || []);
  const [voteTarget, setVoteTarget] = useState<number | null>(null);

  const myApp = useMemo(() => applications.find(a => a.teamId === id), [applications, id]);

  if (!found) {
    return <Page narrow><EmptyState icon="🤷" title="Team nicht gefunden" text="Dieses Team existiert nicht (mehr)." action={<Link to="/teams" className="btn-primary">Zu den Teams</Link>} /></Page>;
  }
  const { team, ideaTitle } = found;
  const pct = Math.min(100, Math.round(team.raised / team.fundingGoal * 100));
  const doneCount = team.milestones.filter(m => m.done).length;
  const openApps = apps.filter(a => a.status === 'offen');

  const decideApp = (appId: string, decision: 'angenommen' | 'abgelehnt') => {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: decision } : a));
    toast(decision === 'angenommen' ? '✅ Bewerbung angenommen – Mitglied wird informiert.' : 'Bewerbung abgelehnt.');
  };

  return (
    <Page>
      <Link to="/teams" style={{ fontSize: 13.5, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← Alle Teams</Link>

      {/* Header */}
      <div className="is-card" style={{ padding: '28px 30px', marginTop: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <h1 className="font-display" style={{ fontSize: 'clamp(22px, 3.4vw, 30px)', fontWeight: 700, letterSpacing: '-.02em' }}>{team.name}</h1>
              <span className={`badge ${STATUS_CLASS[team.status]}`}>{STATUS_LABEL[team.status]}</span>
              {team.verified && <span className="badge badge-green">✓ Verifizierter Reporter</span>}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              baut: <Link to={`/idea/${team.ideaId}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>{ideaTitle}</Link>
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}><strong style={{ color: 'var(--text-primary)' }}>Fokus:</strong> {team.focus}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 210 }}>
            <button className="btn-primary" style={{ justifyContent: 'center' }} disabled={team.status === 'completed' || invested}
              onClick={() => can('invest') ? setInvestOpen(true) : toast('Team-Shares kaufen ist ein Subscriber-Feature ⭐')}>
              {invested ? '✓ Investiert' : team.status === 'completed' ? 'Abgeschlossen' : '💰 Team-Shares kaufen'}
            </button>
            <button className="btn-secondary" style={{ justifyContent: 'center' }} disabled={!!myApp}
              onClick={() => can('teams') ? setJoinOpen(true) : toast('Teambeitritt ist ein Subscriber-Feature ⭐')}>
              {myApp ? `📨 Bewerbung ${myApp.status}` : '🤝 Team beitreten'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginTop: 22 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>Funding</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtSat(team.raised)} / {fmtSat(team.fundingGoal)} sat</div>
            <div className="progress-track" style={{ marginTop: 8, height: 6 }}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          </div>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>Skin-in-the-game</div>
            <BtcAmount sat={team.skinInGame} size={15} />
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{(team.skinInGame / team.fundingGoal * 100).toFixed(1)} % des Ziels</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>Meilensteine</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{doneCount} / {team.milestones.length} ✓</div>
            <div className="progress-track" style={{ marginTop: 8, height: 6 }}><div className="progress-fill green" style={{ width: `${doneCount / team.milestones.length * 100}%` }} /></div>
          </div>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>Mitglieder</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>👥 {team.members}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>👑 {team.leader}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
        {([
          ['overview', '📋 Übersicht'],
          ['reports', `📊 Revenue-Reports${team.revenueReports?.length ? ` (${team.revenueReports.length})` : ''}`],
          ['shares', '📈 Shareholder'],
          ['applications', `📨 Bewerbungen${openApps.length ? ` (${openApps.length})` : ''}`],
        ] as const).map(([k, l]) => (
          <button key={k} className={`is-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
          {/* Milestones */}
          <div className="is-card" style={{ padding: '26px 28px' }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>🎯 Meilensteine & Tranchen</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 18 }}>
              Gelder fließen nur bei bestätigten Meilensteinen. Investoren stimmen über die Erfüllung ab.
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              {team.milestones.map((m, i) => {
                const vKey = `ms-${team.id}-${i}`;
                const myVote = votes[vKey];
                const base = m.done ? { yes: 94, no: 6 } : { yes: 0, no: 0 };
                return (
                  <div key={i} style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '16px 18px', border: `1px solid ${m.done ? 'rgba(46,204,113,.35)' : 'var(--border-color)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        background: m.done ? 'rgba(46,204,113,.18)' : 'var(--bg-tertiary)',
                        border: `1px solid ${m.done ? 'rgba(46,204,113,.5)' : 'var(--border-strong)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5,
                        color: m.done ? 'var(--accent-green)' : 'var(--text-secondary)', fontWeight: 700,
                      }}>{m.done ? '✓' : i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14.5, textDecoration: m.done ? 'line-through' : 'none', color: m.done ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{m.title}</strong>
                          <BtcAmount sat={m.budget} size={13} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 10px' }}>Fällig: {m.dueDate}</div>
                        {m.deliverables && (
                          <div style={{ display: 'grid', gap: 5, marginBottom: 10 }}>
                            {m.deliverables.map(d => (
                              <div key={d} style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', gap: 7 }}>
                                <span style={{ color: m.done ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>{m.done ? '✓' : '○'}</span>{d}
                              </div>
                            ))}
                          </div>
                        )}
                        {m.done ? (
                          <span className="badge badge-green" style={{ fontSize: 10.5 }}>✓ Von Investoren bestätigt ({base.yes}% Ja)</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="badge badge-orange" style={{ fontSize: 10.5 }}>In Arbeit</span>
                            <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}
                              onClick={() => can('invest') ? setVoteTarget(i) : toast('Milestone-Voting ist ein Subscriber-Feature ⭐')}>
                              🗳️ {myVote ? `Deine Stimme: ${myVote === 'yes' ? 'Erfüllt' : 'Nicht erfüllt'}` : 'Über Erfüllung abstimmen'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Updates + members */}
          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <div className="is-card" style={{ padding: '26px 28px' }}>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>📣 Team-Updates</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {(team.updates || []).map((u, i) => (
                  <div key={i} style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '15px 17px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14 }}>{u.title}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.date}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{u.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="is-card" style={{ padding: '26px 28px' }}>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>👥 Mitglieder</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {(team.memberList || []).map(m => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                      {m.name[1].toUpperCase()}
                    </div>
                    <strong>{m.name}</strong>
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-tertiary)' }}>{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="is-card" style={{ padding: '26px 28px' }}>
          <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>📊 Monatliche Revenue-Reports</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
            Öffentlich und on-chain nachprüfbar – 20 % fließen an Idea-Share-Halter, 80 % an Team-Share-Halter.
          </p>
          {team.revenueReports?.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="is-table">
                <thead><tr><th>Monat</th><th>Umsatz</th><th>→ Idea-Pool (20 %)</th><th>→ Team-Pool (80 %)</th><th>Notiz</th><th>TX</th></tr></thead>
                <tbody>
                  {team.revenueReports.map(r => (
                    <tr key={r.month}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.month}</td>
                      <td><BtcAmount sat={r.revenue} size={12.5} /></td>
                      <td style={{ color: 'var(--accent-primary)' }}><BtcAmount sat={Math.round(r.revenue * .2)} size={12.5} /></td>
                      <td style={{ color: 'var(--accent-green)' }}><BtcAmount sat={Math.round(r.revenue * .8)} size={12.5} /></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.note}</td>
                      <td><a href="https://mempool.space" target="_blank" rel="noreferrer" className="font-mono" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none' }}>{r.tx} ↗</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="📊" title="Noch keine Reports" text="Das Team befindet sich noch im Aufbau. Der erste Revenue-Report erscheint mit dem ersten Umsatz – spätestens einen Monat nach Launch." />
          )}
        </div>
      )}

      {tab === 'shares' && (
        <div className="is-card" style={{ padding: '26px 28px' }}>
          <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>📈 Team-Share-Verteilung</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
            Anteil = Investment / Gesamt-Team-Investment. Team-Shares verzinsen an 80 % des Team-Umsatzes.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {(team.shareholders || []).map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ width: 220, fontSize: 13.5, fontWeight: s.isLeader ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.isLeader ? '👑 ' : ''}{s.name}
                </span>
                <div className="progress-track" style={{ flex: 1 }}><div className={`progress-fill ${s.isLeader ? 'green' : ''}`} style={{ width: `${s.pct}%` }} /></div>
                <span className="font-mono" style={{ fontSize: 13, width: 60, textAlign: 'right', color: 'var(--text-secondary)' }}>{s.pct} %</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 18 }}>
            Team-Shares sind jederzeit kaufbar – der Preis folgt derselben dynamischen Formel wie Idea-Shares.
          </p>
        </div>
      )}

      {tab === 'applications' && (
        <div className="is-card" style={{ padding: '26px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>📨 Eingehende Bewerbungen</h3>
            <span className="badge badge-blue">Leader-Ansicht (Demo)</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
            So sieht der Team-Leader eingehende Bewerbungen. Annahme und Ablehnung werden dem Bewerber gemeldet.
          </p>
          {apps.length === 0 ? (
            <EmptyState icon="📭" title="Keine Bewerbungen" text="Aktuell liegen diesem Team keine Bewerbungen vor." />
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {apps.map(a => (
                <div key={a.id} style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '18px 20px', border: `1px solid ${a.status === 'offen' ? 'var(--border-color)' : a.status === 'angenommen' ? 'rgba(46,204,113,.4)' : 'rgba(233,69,96,.3)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple, #9b59b6))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{a.applicant[1].toUpperCase()}</div>
                    <strong style={{ fontSize: 14.5 }}>{a.applicant}</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.date} · ⏱ {a.hours} h/Woche</span>
                    <span className={`badge ${a.status === 'offen' ? 'badge-orange' : a.status === 'angenommen' ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto' }}>{a.status}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 7 }}><strong>Skills:</strong> {a.skills}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: a.status === 'offen' ? 13 : 0 }}>„{a.message}"</p>
                  {a.status === 'offen' && (
                    <div style={{ display: 'flex', gap: 9 }}>
                      <button className="btn-primary" style={{ fontSize: 13, padding: '9px 18px' }} onClick={() => decideApp(a.id, 'angenommen')}>✓ Annehmen</button>
                      <button className="btn-secondary" style={{ fontSize: 13, padding: '9px 18px' }} onClick={() => decideApp(a.id, 'abgelehnt')}>Ablehnen</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <JoinTeamModal team={joinOpen ? team : null} ideaTitle={ideaTitle} onClose={() => setJoinOpen(false)} />

      {/* Invest modal */}
      <Modal open={investOpen} onClose={() => setInvestOpen(false)} title="💰 Team-Shares kaufen">
        <InvestForm team={team} onDone={() => { setInvestOpen(false); setInvested(true); toast(`✅ Team-Shares in ${team.name} simuliert (Demo)`); }} />
      </Modal>

      {/* Milestone vote modal */}
      <Modal open={voteTarget !== null} onClose={() => setVoteTarget(null)} title="🗳️ Meilenstein-Freigabe abstimmen">
        {voteTarget !== null && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
              Ist Meilenstein <strong style={{ color: 'var(--text-primary)' }}>„{team.milestones[voteTarget].title}“</strong> erfüllt?
              Bei Mehrheit wird die Tranche von <BtcAmount sat={team.milestones[voteTarget].budget} size={13} /> freigegeben.
            </p>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 11, padding: '13px 15px', fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 18, border: '1px solid var(--border-color)' }}>
              Bei Ablehnung stimmen Investoren anschließend ab: Team weitermachen lassen oder Restbetrag erstatten (Refund). 1 Person = 1 Stimme, gewichtet nach Team-Shares.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { castVote(`ms-${team.id}-${voteTarget}`, 'yes'); setVoteTarget(null); toast('🗳️ Stimme abgegeben: Erfüllt ✓'); }}>✓ Erfüllt</button>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { castVote(`ms-${team.id}-${voteTarget}`, 'no'); setVoteTarget(null); toast('🗳️ Stimme abgegeben: Nicht erfüllt'); }}>✗ Nicht erfüllt</button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}

function InvestForm({ team, onDone }: { team: Team; onDone: () => void }) {
  const [amount, setAmount] = useState('250000');
  const sat = Math.max(0, Number(amount) || 0);
  const sharePct = team.raised + sat > 0 ? (sat / (team.raised + sat)) * 100 : 0;
  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.65 }}>
        Team-Shares verzinsen dich an <strong>80 % des Umsatzes von {team.name}</strong> – nur dieses eine Team, dafür direkter Hebel.
      </p>
      <label className="is-label">Investment (in sat)</label>
      <input className="is-input font-mono" type="number" min="1000" step="1000" value={amount} onChange={e => setAmount(e.target.value)} />
      <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 15, marginTop: 14, display: 'grid', gap: 8, fontSize: 13.5, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Du investierst</span><BtcAmount sat={sat} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Dein Team-Share</span><strong style={{ color: 'var(--accent-orange)' }}>{sharePct.toFixed(2)} %</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Geht an</span><strong>{team.name}</strong></div>
      </div>
      <button className="btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={sat < 1000} onClick={onDone}>Investment bestätigen (Demo)</button>
    </div>
  );
}
