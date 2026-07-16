import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useStore } from '@/lib/store';
import { getIdea, votePercent } from '@/lib/data';
import { Page, StageBadge, SplitBar, EmptyState, Modal, BtcAmount } from '@/components/bits';

export default function IdeaDetail() {
  const { id } = useParams();
  const idea = getIdea(id || '');
  const { role, can, toast } = useStore();
  const [comment, setComment] = useState('');
  const [posted, setPosted] = useState<{ author: string; text: string; time: string; likes: number }[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moved, setMoved] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  if (!idea) {
    return <Page narrow><EmptyState icon="🤷" title="Idee nicht gefunden" text="Diese Idee existiert nicht (mehr)." action={<Link to="/discussion" className="btn-primary">Zur Diskussion</Link>} /></Page>;
  }

  const pct = votePercent(idea);
  const inMarketplace = ['voting', 'funding', 'building', 'completed'].includes(idea.stage) || moved;
  const canMove = role === 'subscriber' && idea.stage === 'discussion' && !moved;

  const submitComment = () => {
    if (!comment.trim()) return;
    setPosted(p => [...p, { author: '@tobias_r', text: comment.trim(), time: 'gerade eben', likes: 0 }]);
    setComment('');
    toast('Kommentar veröffentlicht · +1 Chain-of-Thought-Punkt 🧠');
  };

  const likeComment = (cid: string) => {
    if (!can('comment')) { toast('Anmeldung erforderlich'); return; }
    setLikedComments(s => {
      const n = new Set(s);
      if (n.has(cid)) n.delete(cid); else n.add(cid);
      return n;
    });
  };

  return (
    <Page narrow>
      <Link to="/discussion" style={{ fontSize: 13.5, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← Zurück zur Diskussion</Link>

      <div className="is-card reveal visible" style={{ padding: '30px 32px', marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <StageBadge stage={moved ? 'voting' : idea.stage} />
          {idea.tags.map(t => <span key={t} className="badge badge-neutral">{t}</span>)}
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-tertiary)' }}>{idea.time} · von <strong style={{ color: 'var(--text-secondary)' }}>{idea.author}</strong></span>
        </div>

        <h1 className="font-display" style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, marginBottom: 18 }}>{idea.title}</h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: 26 }}>{idea.description}</p>

        <div style={{ display: 'grid', gap: 16 }}>
          {[['🎯 Problem', idea.problem], ['💊 Lösung', idea.solution], ['📊 Markt', idea.market]].map(([t, txt]) => (
            <div key={t} style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border-color)' }}>
              <h3 className="font-display" style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 7 }}>{t}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{txt}</p>
            </div>
          ))}
        </div>

        {/* Voting status */}
        <div style={{ marginTop: 26, background: 'var(--bg-primary)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Community-Stimmung</span>
            <span style={{ fontWeight: 700, color: pct >= 50 ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{pct}% Zustimmung ({idea.votes.up + idea.votes.down} Stimmen)</span>
          </div>
          <div className="progress-track"><div className="progress-fill green" style={{ width: `${pct}%` }} /></div>
          {pct >= 50 && idea.stage === 'discussion' && !moved && (
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 9 }}>✅ Über 50 % Zustimmung – diese Idee ist bereit für den Marktplatz.</p>
          )}
        </div>

        {/* Marketplace info */}
        {inMarketplace && idea.fundingGoal && (
          <div style={{ marginTop: 20, background: 'linear-gradient(160deg, rgba(243,156,18,.1), rgba(233,69,96,.07))', borderRadius: 14, padding: '20px 22px', border: '1px solid rgba(243,156,18,.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700 }}>🛒 Marktplatz-Status</h3>
              <Link to="/marketplace" className="btn-primary" style={{ fontSize: 13, padding: '9px 18px' }}>Zum Marktplatz →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, fontSize: 13 }}>
              <div><div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Funding-Ziel</div><BtcAmount sat={idea.fundingGoal} size={15} /></div>
              <div><div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Investiert</div><BtcAmount sat={idea.raised || 0} size={15} /></div>
              <div><div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Investoren</div><strong>{idea.investors}</strong></div>
              <div><div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Teams</div><strong>{idea.teams?.length || 0}</strong></div>
            </div>
          </div>
        )}

        {/* Move to marketplace CTA */}
        {canMove && (
          <div style={{ marginTop: 20, background: 'rgba(233,69,96,.08)', borderRadius: 14, padding: '18px 22px', border: '1px solid rgba(233,69,96,.35)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 24 }}>🚀</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <strong style={{ fontSize: 14.5 }}>Du bist Subscriber.</strong>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Als Urheber kannst du diese Idee auf den Marktplatz verschieben und Idea-Shares anbieten.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowMoveModal(true)}>Auf den Marktplatz →</button>
          </div>
        )}
      </div>

      {/* Investment split */}
      <div className="is-card reveal" style={{ padding: '24px 28px', marginTop: 22 }}>
        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>💸 So verteilt sich jede Investition in diese Idee</h3>
        <SplitBar />
      </div>

      {/* Comments */}
      <div className="is-card reveal" style={{ padding: '28px 30px', marginTop: 22 }}>
        <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>💬 Diskussion ({idea.comments.length + posted.length})</h3>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
          Wertvolle Beiträge sammeln Chain-of-Thought-Punkte: Kommentar = 1 Punkt, Upvote = 2 Punkte. Ab 3 Punkten bist du am 5 %-Pool beteiligt.
        </p>

        {can('comment') ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            <textarea className="is-textarea" rows={2} placeholder="Teile deine Gedanken, Verbesserungen oder Bedenken…" value={comment} onChange={e => setComment(e.target.value)} style={{ flex: 1, resize: 'vertical' }} />
            <button className="btn-primary" style={{ alignSelf: 'flex-end', padding: '11px 20px' }} onClick={submitComment} disabled={!comment.trim()}>Senden</button>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: '14px 18px', marginBottom: 26, fontSize: 13.5, color: 'var(--text-secondary)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>🔒</span>
            <span style={{ flex: 1, minWidth: 200 }}>Melde dich kostenlos an, um mitzudiskutieren und Chain-of-Thought-Punkte zu sammeln.</span>
            <Link to="/profile" className="btn-secondary" style={{ fontSize: 12.5, padding: '8px 14px' }}>Anmelden</Link>
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          {[...idea.comments.map(c => ({ id: c.id, author: c.author, text: c.text, time: c.time, likes: c.likes, score: c.score, role: c.role })),
            ...posted.map((p, i) => ({ id: `p${i}`, author: p.author, text: p.text, time: p.time, likes: p.likes, score: 1, role: 'user' as const }))].map(c => (
            <div key={c.id} style={{ background: 'var(--bg-primary)', borderRadius: 13, padding: '16px 18px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  {c.author[1].toUpperCase()}
                </div>
                <strong style={{ fontSize: 13.5 }}>{c.author}</strong>
                {c.role === 'subscriber' && <span className="badge badge-orange" style={{ fontSize: 10 }}>⭐ Subscriber</span>}
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.time}</span>
                <span className="badge badge-blue" style={{ marginLeft: 'auto', fontSize: 10.5 }}>🧠 {c.score} Punkte</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 10 }}>{c.text}</p>
              <button className="btn-ghost" style={{ fontSize: 12.5, padding: '5px 11px', color: likedComments.has(c.id) ? 'var(--accent-primary)' : undefined }}
                onClick={() => likeComment(c.id)}>
                {likedComments.has(c.id) ? '❤️' : '🤍'} {c.likes + (likedComments.has(c.id) ? 1 : 0)} · Hilfreich
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Move modal */}
      <Modal open={showMoveModal} onClose={() => setShowMoveModal(false)} title="🚀 Idee auf den Marktplatz verschieben">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18 }}>
          Du verschiebst <strong style={{ color: 'var(--text-primary)' }}>„{idea.title}“</strong> in die Voting-Phase des Marktplatzes.
          Das kann nur der Urheber – und ist unwiderruflich.
        </p>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 16, marginBottom: 18, display: 'grid', gap: 10, fontSize: 13.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Voting-Dauer</span><strong>8 Tage</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Idea-Shares</span><strong>100M (fix)</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Dein Sofort-Anteil</span><strong style={{ color: 'var(--accent-primary)' }}>15 % jeder Investition</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Dein Skin-in-the-game</span><strong>min. 1 % der Bewertung</strong></div>
        </div>
        <button className="btn-primary" style={{ width: '100%' }} onClick={() => { setMoved(true); setShowMoveModal(false); toast('🎉 Idee ist jetzt auf dem Marktplatz im Voting!'); }}>
          Bestätigen & verschieben
        </button>
      </Modal>
    </Page>
  );
}
