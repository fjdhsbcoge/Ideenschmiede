import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '@/lib/store';
import { ideas, votePercent } from '@/lib/data';
import { Page, PageHeader, LoginNotice, EmptyState } from '@/components/bits';

const FILTERS = ['Alle', 'Trending', 'Neueste', 'Kontrovers'] as const;

export default function Discussion() {
  const { role, can, toast } = useStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Alle');
  const [sort, setSort] = useState('comments');
  const [search, setSearch] = useState('');

  const discussionIdeas = useMemo(() => {
    let list = ideas.filter(i => i.stage === 'discussion' || i.stage === 'voting');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q)) || i.description.toLowerCase().includes(q));
    }
    switch (filter) {
      case 'Trending': list = [...list].sort((a, b) => b.votes.up - a.votes.up); break;
      case 'Kontrovers': list = [...list].sort((a, b) => (b.votes.up + b.votes.down) * (100 - votePercent(b)) - (a.votes.up + a.votes.down) * (100 - votePercent(a))); break;
      default: break;
    }
    if (sort === 'votes') list = [...list].sort((a, b) => b.votes.up - a.votes.up);
    if (sort === 'comments') list = [...list].sort((a, b) => b.comments.length - a.comments.length);
    return list;
  }, [filter, sort, search]);

  const guard = (fn: () => void) => () => {
    if (!can('post')) { toast('Anmeldung erforderlich – als User kannst du filtern & posten.'); return; }
    fn();
  };

  return (
    <Page>
      <PageHeader
        title="💡 Ideen-Diskussion"
        subtitle="Offene Bühne für neue Ideen. Gib Feedback, hilf Konzepten zu reifen – frühe Mitdenker werden am Funding beteiligt (Chain-of-Thought Rewards)."
        action={can('post')
          ? <Link to="/create-idea" className="btn-primary">+ Neue Idee</Link>
          : <button className="btn-primary" onClick={() => toast('Melde dich an, um eine Idee zu posten.')}>+ Neue Idee</button>}
      />

      <LoginNotice />

      <div className="is-card" style={{ padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} className={`is-tab ${filter === f ? 'active' : ''}`}
              style={!can('post') && f !== 'Alle' ? { opacity: .5 } : {}}
              onClick={f === 'Alle' ? () => setFilter(f) : guard(() => setFilter(f))}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="is-input" style={{ width: 200, padding: '9px 13px', fontSize: 13.5 }} placeholder="🔍 Suche…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="is-select" style={{ width: 170, padding: '9px 13px', fontSize: 13.5 }} value={sort}
            onChange={e => can('post') ? setSort(e.target.value) : toast('Anmeldung erforderlich')}>
            <option value="comments">Meiste Kommentare</option>
            <option value="votes">Meiste Stimmen</option>
          </select>
        </div>
      </div>

      {discussionIdeas.length === 0 ? (
        <EmptyState icon="🔍" title="Keine Ideen gefunden" text="Passe Suche oder Filter an – oder sei die erste Person, die diese Idee postet." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {discussionIdeas.map(idea => <DiscussionCard key={idea.id} ideaId={idea.id} />)}
        </div>
      )}

      <div className="is-card reveal" style={{ marginTop: 36, padding: '24px 28px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', borderColor: 'rgba(243,156,18,.35)' }}>
        <span style={{ fontSize: 26 }}>🧠</span>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 5 }}>Chain-of-Thought Rewards</h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Kommentare (×1) und Upvotes auf deine Kommentare (×2) sammeln Punkte. Ab 3 Punkten erhältst du einen Anteil von 5 % jeder Investition in diese Idee.
          </p>
        </div>
        <span className="badge badge-orange">5 % Pool</span>
      </div>

      {role === 'user' && (
        <div className="is-card" style={{ marginTop: 18, padding: '18px 24px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>⭐</span>
          <p style={{ flex: 1, fontSize: 13.5, color: 'var(--text-secondary)', minWidth: 220 }}>
            Als <strong>Subscriber</strong> kannst du eigene Ideen auf den Marktplatz verschieben, abstimmen und investieren.
          </p>
          <Link to="/profile" className="btn-secondary" style={{ fontSize: 13 }}>Upgrade ansehen</Link>
        </div>
      )}
    </Page>
  );
}

function DiscussionCard({ ideaId }: { ideaId: string }) {
  const idea = ideas.find(i => i.id === ideaId)!;
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [votes, setVotes] = useState(idea.votes);
  const { can, toast } = useStore();
  const pct = Math.round(votes.up / Math.max(1, votes.up + votes.down) * 100);

  const vote = (e: React.MouseEvent, type: 'up' | 'down') => {
    e.stopPropagation();
    if (!can('vote')) {
      toast(can('post') ? 'Voting ist ein Subscriber-Feature ⭐' : 'Bitte melde dich an, um abzustimmen.');
      return;
    }
    setVotes(v => {
      const next = { ...v };
      if (userVote === type) { next[type]--; setUserVote(null); }
      else {
        if (userVote) next[userVote]--;
        next[type]++;
        setUserVote(type);
      }
      return next;
    });
  };

  return (
    <div className="is-card is-card-hover reveal" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {idea.tags.slice(0, 3).map(t => <span key={t} className="badge badge-neutral">{t}</span>)}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{idea.time}</span>
      </div>

      <Link to={`/idea/${idea.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <h3 className="font-display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3, marginBottom: 7 }}>{idea.title}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {idea.description}
        </p>
      </Link>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 7 }}>
          <span style={{ color: 'var(--text-secondary)' }}>💬 {idea.comments.length} Kommentare</span>
          <span style={{ fontWeight: 700, color: pct >= 50 ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{pct}% Zustimmung</span>
        </div>
        <div className="progress-track"><div className="progress-fill green" style={{ width: `${pct}%` }} /></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={(e) => vote(e, 'up')} className="btn-secondary"
            style={{ padding: '7px 14px', fontSize: 13, borderColor: userVote === 'up' ? 'var(--accent-green)' : undefined, color: userVote === 'up' ? 'var(--accent-green)' : undefined }}>
            👍 {votes.up}
          </button>
          <button onClick={(e) => vote(e, 'down')} className="btn-secondary"
            style={{ padding: '7px 14px', fontSize: 13, borderColor: userVote === 'down' ? 'var(--accent-primary)' : undefined, color: userVote === 'down' ? 'var(--accent-primary)' : undefined }}>
            👎 {votes.down}
          </button>
        </div>
        <Link to={`/idea/${idea.id}`} style={{ fontSize: 13.5, color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>Diskutieren →</Link>
      </div>
    </div>
  );
}
