import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Page, PageHeader } from '@/components/bits'

export default function Settings() {
  const t = useT()
  const T = t.pages.settings
  const { role, setRole, toast, settings, saveSettings, resetDemo } = useStore()

  const [form, setForm] = useState({
    handle: settings.handle,
    displayName: settings.displayName,
    bio: settings.bio,
    payoutAddress: settings.payoutAddress,
    xpub: settings.xpub,
    email: settings.email,
    notifications: [...settings.notifications],
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const toggleNotification = (i: number) =>
    setForm((f) => ({ ...f, notifications: f.notifications.map((n, j) => (j === i ? !n : n)) }))

  const save = () => {
    const handle = form.handle.trim()
    if (!/^@.{2,}$/.test(handle)) {
      toast(T.invalidHandleToast)
      return
    }
    saveSettings({ ...form, handle })
    toast(T.savedToast)
  }

  if (role === 'visitor') {
    return (
      <Page narrow>
        <PageHeader title={T.title} subtitle={T.visitorText} />
        <div className="is-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
          <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{T.visitorTitle}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 22, fontSize: 15 }}>{T.visitorText}</p>
          <button className="btn-primary" onClick={() => setRole('user')}>{T.visitorCta}</button>
        </div>
      </Page>
    )
  }

  return (
    <Page narrow>
      <PageHeader title={T.title} subtitle={T.subtitle} />

      <div style={{ display: 'grid', gap: 20 }}>
        {/* Profil */}
        <div className="is-card" style={{ padding: '26px 28px' }}>
          <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 18 }}>{T.profileTitle}</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label className="is-label">{T.labelHandle}</label>
              <input className="is-input font-mono" value={form.handle} onChange={(e) => set('handle', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>{T.hintHandle}</div>
            </div>
            <div>
              <label className="is-label">{T.labelDisplayName}</label>
              <input className="is-input" placeholder={T.placeholderDisplayName} value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
            </div>
            <div>
              <label className="is-label">{T.labelBio}</label>
              <textarea className="is-textarea" rows={3} maxLength={160} placeholder={T.placeholderBio} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className="is-card" style={{ padding: '26px 28px' }}>
          <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 6 }}>{T.walletTitle}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 18 }}>{T.walletNote}</p>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label className="is-label">{T.labelPayout}</label>
              <input className="is-input font-mono" placeholder={T.placeholderPayout} value={form.payoutAddress} onChange={(e) => set('payoutAddress', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>{T.hintPayout}</div>
            </div>
            <div>
              <label className="is-label">{T.labelXpub}</label>
              <input className="is-input font-mono" placeholder={T.placeholderXpub} value={form.xpub} onChange={(e) => set('xpub', e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>{T.hintXpub}</div>
            </div>
          </div>
        </div>

        {/* Benachrichtigungen */}
        <div className="is-card" style={{ padding: '26px 28px' }}>
          <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 18 }}>{T.notificationsTitle}</h3>
          <div style={{ marginBottom: 18 }}>
            <label className="is-label">{T.labelEmail}</label>
            <input className="is-input" type="email" placeholder={T.placeholderEmail} value={form.email} onChange={(e) => set('email', e.target.value)} />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>{T.hintEmail}</div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {T.notify.map(([label, desc], i) => (
              <button
                key={label}
                onClick={() => toggleNotification(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  borderRadius: 12, padding: '13px 16px', cursor: 'pointer', color: 'inherit',
                }}
              >
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>
                </span>
                <span
                  style={{
                    width: 42, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative',
                    background: form.notifications[i] ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                    border: `1px solid ${form.notifications[i] ? 'var(--accent-green)' : 'var(--border-strong)'}`,
                    transition: 'all .2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', top: 2, left: form.notifications[i] ? 20 : 2,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      transition: 'left .2s',
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sprache */}
        <div className="is-card" style={{ padding: '26px 28px' }}>
          <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 6 }}>{T.languageTitle}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>{T.languageNote}</p>
          <select className="is-select" disabled>
            <option>{T.languageValue}</option>
          </select>
        </div>

        {/* Demo-Bereich */}
        <div className="is-card" style={{ padding: '22px 26px', borderColor: 'rgba(84, 118, 58,.3)' }}>
          <h3 className="font-display" style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>{T.demoTitle}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>{T.demoNote}</p>
          <button
            className="btn-secondary"
            style={{ fontSize: 13 }}
            onClick={() => { if (window.confirm(T.resetConfirm)) { toast(T.resetToast); setTimeout(resetDemo, 600) } }}
          >
            {T.resetCta}
          </button>
        </div>

        <button className="btn-primary" style={{ padding: '15px 26px', fontSize: 15.5 }} onClick={save}>
          {T.saveCta}
        </button>
      </div>
    </Page>
  )
}
