import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { ideas, votePercent } from '@/lib/data';
import { Page, PageHeader, LoginNotice, EmptyState } from '@/components/bits';
import { ShareButton } from '@/components/ShareMenu';

export default function Discussion() {
  const { role, can, toast } = useStore();
  const t = useT();
  const T = t.pages.discussion;
  const [filter, setFilter] = useState(0);
  const [sort, setSort] = useState(0);
  const [search, setSearch] = useState('');

  const discussionIdeas = useMemo(() => {
    let list = ideas.filter(i => i.stage === 'discussion' || i.stage === 'voting');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.tags.some(tg => tg.toLowerCase().includes(q)) || i.description.toLowerCase().includes(q));
    }
    if (filter === 1) list = [...list].sort((a, b) => b.votes.up - a.votes.up); // Trending
    if (filter === 3) list = [...list].sort((a, b) => (b.votes.up + b.votes.down) * (100 - votePercent(b)) - (a.votes.up + a.votes.down) * (100 - votePercent(a))); // Kontrovers
    if (sort === 1) list = [...list].sort((a, b) => b.votes.up - a.votes.up);
    if (sort === 0) list = [...list].sort((a, b) => b.comments.length - a.comments.length);
    return list;
  }, [filter, sort, search]);

  const guard = (fn: () => void) => () => {
    if (!can('post')) { toast(T.guardToast); return; }
    fn();
  };

  return (
    <Page>
      <PageHeader
        title={T.title}
        subtitle={T.subtitle}
        action={can('post')
          ? <Link to="/create-idea" className="btn-primary">{T.newIdea}</Link>
          : <button className="btn-primary" onClick={() => toast(T.loginToPostToast)}>{T.newIdea}</button>}
      />

      <LoginNotice />

      <div className="is-card" style={{ padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {T.filters.map((f, i) => (
            <button key={f} className={`is-tab ${filter === i ? 'active' : ''}`}
              style={!can('post') && i !== 0 ? { opacity: .5 } : {}}
              onClick={i === 0 ? () => setFilter(0) : guard(() => setFilter(i))}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="is-input" style={{ width: 200, padding: '9px 13px', fontSize: 13.5 }} placeholder={T.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="is-select" style={{ width: 190, padding: '9px 13px', fontSize: 13.5 }} value={sort}
            onChange={e => can('post') ? setSort(Number(e.target.value)) : toast(T.sortGuardToast)}>
            {T.sorts.map((s, i) => <option key={s} value={i}>{s}</option>)}
          </select>
        </div>
      </div>

      {discussionIdeas.length === 0 ? (
        <EmptyState icon="🔍" title={T.emptyTitle} text={T.emptyText} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {discussionIdeas.map(idea => <DiscussionCard key={idea.id} ideaId={idea.id} />)}
        </div>
      )}

      <div className="is-card reveal" style={{ marginTop: 36, padding: '24px 28px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', borderColor: 'rgba(243,156,18,.35)' }}>
        <span style={{ fontSize: 26 }}>🧠</span>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 5 }}>{T.cotTitle}</h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{T.cotText}</p>
        </div>
        <span className="badge badge-orange">{T.cotBadge}</span>
      </div>

      {role === 'user' && (
        <div className="is-card" style={{ marginTop: 18, padding: '18px 24px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>⭐</span>
          <p style={{ flex: 1, fontSize: 13.5, color: 'var(--text-secondary)', minWidth: 220 }}>
            {T.upgradeTextA} <strong>{T.upgradeTextB}</strong> {T.upgradeTextC}
          </p>
          <Link to="/profile" className="btn-secondary" style={{ fontSize: 13 }}>{T.upgradeCta}</Link>
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
  const t = useT();
  const T = t.pages.discussion;
  const pct = Math.round(votes.up / Math.max(1, votes.up + votes.down) * 100);

  const vote = (e: React.MouseEvent, type: 'up' | 'down') => {
    e.stopPropagation();
    if (!can('vote')) {
      toast(can('post') ? T.voteSubToast : T.voteGuestToast);
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
          {idea.tags.slice(0, 3).map(tg => <span key={tg} className="badge badge-neutral">{tg}</span>)}
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
          <span style={{ color: 'var(--text-secondary)' }}>💬 {idea.comments.length} {T.commentsSuffix}</span>
          <span style={{ fontWeight: 700, color: pct >= 50 ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{pct}{T.approvalSuffix}</span>
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
          <ShareButton compact ideaId={idea.id} title={idea.title} description={idea.description} />
        </div>
        <Link to={`/idea/${idea.id}`} style={{ fontSize: 13.5, color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>{T.discussCta}</Link>
      </div>
    </div>
  );
}
