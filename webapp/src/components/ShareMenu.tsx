import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { SHARE_TARGETS, emailShareUrl, ideaShareUrl } from '@/lib/share'
import { Modal } from '@/components/bits'

interface ShareButtonProps {
  ideaId: string
  title: string
  description: string
  /** compact = kleiner Icon-Button für Karten */
  compact?: boolean
}

export function ShareButton({ ideaId, title, description, compact = false }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useStore()
  const t = useT()
  const S = t.pages.share

  const url = ideaShareUrl(ideaId)
  const text = `${title} – Ideenschmiede`
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const copy = async (e: React.MouseEvent) => {
    stop(e)
    try {
      await navigator.clipboard.writeText(url)
      toast(S.copiedToast)
    } catch {
      window.prompt(S.copyFallback, url)
    }
    setOpen(false)
  }

  const native = async (e: React.MouseEvent) => {
    stop(e)
    try {
      await navigator.share({ title: text, text: description, url })
    } catch {
      /* Nutzer hat abgebrochen */
    }
    setOpen(false)
  }

  return (
    <>
      <button
        className={compact ? 'btn-secondary' : 'btn-secondary'}
        style={compact ? { padding: '7px 12px', fontSize: 13 } : { padding: '9px 16px', fontSize: 13.5 }}
        aria-label={S.button}
        onClick={(e) => {
          stop(e)
          if (canNative) native(e)
          else setOpen(true)
        }}
      >
        📤 {compact ? '' : S.button}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={S.title}>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {title}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 9 }}>
          {SHARE_TARGETS.map((target) => (
            <a
              key={target.name}
              href={target.buildUrl(url, text)}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
              style={{ justifyContent: 'center', fontSize: 13.5, padding: '11px 10px', textDecoration: 'none' }}
            >
              {target.icon} {target.name}
            </a>
          ))}
          <a
            href={emailShareUrl(url, text, description)}
            className="btn-secondary"
            style={{ justifyContent: 'center', fontSize: 13.5, padding: '11px 10px', textDecoration: 'none' }}
          >
            ✉️ {S.viaEmail}
          </a>
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={copy}>
          {S.copyLink}
        </button>
      </Modal>
    </>
  )
}
