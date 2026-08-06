import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('install-banner-dismissed') === '1')

  useEffect(() => {
    if (isStandalone()) return
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    if (isIos()) setShowIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  function dismiss() {
    setDismissed(true)
    sessionStorage.setItem('install-banner-dismissed', '1')
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  if (dismissed || isStandalone() || (!deferredPrompt && !showIosHint)) return null

  return (
    <div style={{
      margin: '10px 16px 0', background: 'linear-gradient(165deg, #fff, #faf7f3)', borderRadius: 14,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: 'var(--red)', color: '#fff', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Download size={18} />
      </div>
      <div style={{ flex: 1, fontSize: 13 }}>
        {deferredPrompt ? (
          <>
            <strong>Install aplikasi ini</strong>
            <div style={{ color: 'var(--text-muted)', marginTop: 1 }}>Akses lebih cepat langsung dari layar utama HP.</div>
          </>
        ) : (
          <>
            <strong>Tambahkan ke Layar Utama</strong>
            <div style={{ color: 'var(--text-muted)', marginTop: 1 }}>Tap tombol Share di Safari, lalu pilih "Add to Home Screen".</div>
          </>
        )}
      </div>
      {deferredPrompt && (
        <button onClick={install} style={{
          background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px',
          fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
        }}>
          Install
        </button>
      )}
      <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  )
}
