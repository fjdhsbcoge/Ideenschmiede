import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { getIdea, votePercent, type Comment } from '@/lib/data'
import { Page, StageBadge, SplitBar, EmptyState, Modal, BtcAmount } from '@/components/bits'
import { ShareButton } from '@/components/ShareMenu'

interface UiComment {
  id: string
  author: string
  text: string
  time: string
  likes: number
  score: number
  role: 'user' | 'subscriber'
  replies: UiComment[]
}

function toUi(c: Comment): UiComment {
  return { id: c.id, author: c.author, text: c.text, time: c.time, likes: c.likes, score: c.score, role: c.role, replies: (c.replies || []).map(toUi) }
}

export default function IdeaDetail() {
  const t = useT()
  const T = t.pages.ideaDetail
  const C = t.pages.common
  const { id } = useParams()
  const idea = getIdea(id || '')
  const { role, can, toast, settings } = useStore()
  const [comment, setComment] = useState('')
  const [posted, setPosted] = useState<UiComment[]>([])
  const [postedReplies, setPostedReplies] = useState<Record<string, UiComment[]>>({})
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moved, setMoved] = useState(false)
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())

  if (!idea) {
    return (
      <Page narrow>
        <EmptyState
          icon="🤷"
          title={T.notFoundTitle}
          text={T.notFoundText}
          action={<Link to="/discussion" className="btn-primary">{T.backToDiscussion}</Link>}
        />
      </Page>
    )
  }

  const pct = votePercent(idea)
  const inMarketplace = ['voting', 'funding', 'building', 'completed'].includes(idea.stage) || moved
  const canMove = role === 'subscriber' && idea.stage === 'discussion' && !moved

  const threads: UiComment[] = [
    ...idea.comments.map((c) => {
      const ui = toUi(c)
      ui.replies = [...ui.replies, ...(postedReplies[c.id] || [])]
      return ui
    }),
    ...posted.map((p) => ({ ...p, replies: [...p.replies, ...(postedReplies[p.id] || [])] })),
  ]
  const totalComments = threads.reduce((n, c) => n + 1 + c.replies.length, 0)

  const submitComment = () => {
    if (!comment.trim()) return
    setPosted((p) => [...p, { id: `p-${Date.now()}`, author: settings.handle, text: comment.trim(), time: T.justNow, likes: 0, score: 1, role: role === 'subscriber' ? 'subscriber' : 'user', replies: [] }])
    setComment('')
    toast(T.commentToast)
  }

  const submitReply = (parentId: string) => {
    if (!replyText.trim()) return
    const reply: UiComment = { id: `r-${Date.now()}`, author: settings.handle, text: replyText.trim(), time: T.justNow, likes: 0, score: 1, role: role === 'subscriber' ? 'subscriber' : 'user', replies: [] }
    setPostedReplies((prev) => ({ ...prev, [parentId]: [...(prev[parentId] || []), reply] }))
    setReplyText('')
    setReplyTo(null)
    toast(T.replyToast)
  }

  const likeComment = (cid: string) => {
    if (!can('comment')) { toast(T.likeToast); return }
    setLikedComments((s) => {
      const n = new Set(s)
      if (n.has(cid)) n.delete(cid); else n.add(cid)
      return n
    })
  }

  const openReply = (cid: string) => {
    if (!can('comment')) { toast(T.likeToast); return }
    setReplyTo((cur) => (cur === cid ? null : cid))
    setReplyText('')
  }

  const renderComment = (c: UiComment, depth: 0 | 1) => (
    <div
      key={c.id}
      style={
        depth === 0
          ? { background: 'var(--bg-primary)', borderRadius: 13, padding: '16px 18px', border: '1px solid var(--border-color)' }
          : { borderLeft: '2px solid var(--border-strong)', paddingLeft: 16, marginLeft: 8 }
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
          {c.author[1]?.toUpperCase() || '?'}
        </div>
        <strong style={{ fontSize: 13.5 }}>{c.author}</strong>
        {c.role === 'subscriber' && <span className="badge badge-orange" style={{ fontSize: 10 }}>{T.subscriberBadge}</span>}
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.time}</span>
        <span className="badge badge-blue" style={{ marginLeft: 'auto', fontSize: 10.5 }}>🧠 {c.score} {T.pointsSuffix}</span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 10 }}>{c.text}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          style={{ fontSize: 12.5, padding: '5px 11px', color: likedComments.has(c.id) ? 'var(--accent-primary)' : undefined }}
          onClick={() => likeComment(c.id)}
        >
          {likedComments.has(c.id) ? '❤️' : '🤍'} {c.likes + (likedComments.has(c.id) ? 1 : 0)} · {T.helpful}
        </button>
        {depth === 0 && (
          <button
            className="btn-ghost"
            style={{ fontSize: 12.5, padding: '5px 11px', color: replyTo === c.id ? 'var(--accent-primary)' : undefined }}
            onClick={() => openReply(c.id)}
          >
            💬 {T.reply}
          </button>
        )}
      </div>

      {replyTo === c.id && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <textarea
            className="is-textarea"
            rows={2}
            autoFocus
            placeholder={T.replyPlaceholder}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            style={{ flex: 1, minWidth: 220, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
            <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => submitReply(c.id)} disabled={!replyText.trim()}>
              {T.replySend}
            </button>
            <button className="btn-ghost" style={{ padding: '9px 12px', fontSize: 13 }} onClick={() => setReplyTo(null)}>
              {T.replyCancel}
            </button>
          </div>
        </div>
      )}

      {c.replies.length > 0 && (
        <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
          {c.replies.map((r) => renderComment(r, 1))}
        </div>
      )}
    </div>
  )

  return (
    <Page narrow>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/discussion" style={{ fontSize: 13.5, color: 'var(--text-tertiary)', textDecoration: 'none' }}>{T.back}</Link>
        <ShareButton ideaId={idea.id} title={idea.title} description={idea.description} />
      </div>

      <div className="is-card reveal visible" style={{ padding: '30px 32px', marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <StageBadge stage={moved ? 'voting' : idea.stage} />
          {idea.tags.map((tag) => <span key={tag} className="badge badge-neutral">{tag}</span>)}
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            {idea.time} · {T.by} <strong style={{ color: 'var(--text-secondary)' }}>{idea.author}</strong>
          </span>
        </div>

        <h1 className="font-display" style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, marginBottom: 18 }}>{idea.title}</h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: 26 }}>{idea.description}</p>

        <div style={{ display: 'grid', gap: 16 }}>
          {[idea.problem, idea.solution, idea.market].map((txt, i) => (
            <div key={T.sections[i]} style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border-color)' }}>
              <h3 className="font-display" style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 7 }}>{T.sections[i]}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{txt}</p>
            </div>
          ))}
        </div>

        {/* Voting status */}
        <div style={{ marginTop: 26, background: 'var(--bg-primary)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{T.moodTitle}</span>
            <span style={{ fontWeight: 700, color: pct >= 50 ? 'var(--accent-green)' : 'var(--accent-primary)' }}>
              {T.approval(pct, idea.votes.up + idea.votes.down)}
            </span>
          </div>
          <div className="progress-track"><div className="progress-fill green" style={{ width: `${pct}%` }} /></div>
          {pct >= 50 && idea.stage === 'discussion' && !moved && (
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 9 }}>{T.readyNote}</p>
          )}
        </div>

        {/* Marketplace info */}
        {inMarketplace && idea.fundingGoal && (
          <div style={{ marginTop: 20, background: 'linear-gradient(160deg, rgba(243,156,18,.1), rgba(84, 118, 58,.07))', borderRadius: 14, padding: '20px 22px', border: '1px solid rgba(243,156,18,.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700 }}>{T.marketStatus}</h3>
              <Link to="/marketplace" className="btn-primary" style={{ fontSize: 13, padding: '9px 18px' }}>{T.toMarketplace}</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, fontSize: 13 }}>
              <div><div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{T.fundingGoal}</div><BtcAmount sat={idea.fundingGoal} size={15} /></div>
              <div><div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{T.invested}</div><BtcAmount sat={idea.raised || 0} size={15} /></div>
              <div><div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{T.investors}</div><strong>{idea.investors}</strong></div>
              <div><div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{T.teams}</div><strong>{idea.teams?.length || 0}</strong></div>
            </div>
          </div>
        )}

        {/* Move to marketplace CTA */}
        {canMove && (
          <div style={{ marginTop: 20, background: 'rgba(84, 118, 58,.08)', borderRadius: 14, padding: '18px 22px', border: '1px solid rgba(84, 118, 58,.35)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 24 }}>🚀</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <strong style={{ fontSize: 14.5 }}>{T.moveTitle}</strong>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{T.moveText}</p>
            </div>
            <button className="btn-primary" onClick={() => setShowMoveModal(true)}>{T.moveCta}</button>
          </div>
        )}
      </div>

      {/* Investment split */}
      <div className="is-card reveal" style={{ padding: '24px 28px', marginTop: 22 }}>
        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{T.splitTitle}</h3>
        <SplitBar />
      </div>

      {/* Comments */}
      <div className="is-card reveal" style={{ padding: '28px 30px', marginTop: 22 }}>
        <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          {T.commentsTitle} ({totalComments})
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
          {T.commentsPointsRule}
        </p>

        {can('comment') ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            <textarea className="is-textarea" rows={2} placeholder={T.commentPlaceholder} value={comment} onChange={(e) => setComment(e.target.value)} style={{ flex: 1, resize: 'vertical' }} />
            <button className="btn-primary" style={{ alignSelf: 'flex-end', padding: '11px 20px' }} onClick={submitComment} disabled={!comment.trim()}>{T.send}</button>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: '14px 18px', marginBottom: 26, fontSize: 13.5, color: 'var(--text-secondary)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>🔒</span>
            <span style={{ flex: 1, minWidth: 200 }}>{T.loginToComment}</span>
            <Link to="/profile" className="btn-secondary" style={{ fontSize: 12.5, padding: '8px 14px' }}>{C.loginCta}</Link>
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          {threads.map((c) => renderComment(c, 0))}
        </div>
      </div>

      {/* Move modal */}
      <Modal open={showMoveModal} onClose={() => setShowMoveModal(false)} title={T.moveModalTitle}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18 }}>
          {T.moveModalA} <strong style={{ color: 'var(--text-primary)' }}>„{idea.title}“</strong> {T.moveModalB}
        </p>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 16, marginBottom: 18, display: 'grid', gap: 10, fontSize: 13.5 }}>
          {T.moveRows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <strong style={label === T.moveRows[2][0] ? { color: 'var(--accent-primary)' } : undefined}>{value}</strong>
            </div>
          ))}
        </div>
        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={() => { setMoved(true); setShowMoveModal(false); toast(T.movedToast) }}
        >
          {T.moveConfirm}
        </button>
      </Modal>
    </Page>
  )
}
