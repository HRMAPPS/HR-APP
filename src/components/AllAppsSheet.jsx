import { X } from 'lucide-react'
import Sheet from './Sheet'
import { ALL_APPS } from '../lib/menuConfig'
import { useIsDesktop } from '../lib/useIsDesktop'

export default function AllAppsSheet({ onClose, onNavigate, onToast, employee }) {
  const isHr = employee?.role === 'hr' || employee?.role === 'admin'
  const isDesktop = useIsDesktop()
  const apps = ALL_APPS.filter((a) => a.key !== 'semua' && (!a.hrOnly || isHr))

  function go(app) {
    if (app.page) { onNavigate(app.page); onClose() }
    else { onToast(`${app.label} segera hadir`); onClose() }
  }

  if (isDesktop) {
    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(20,15,10,.45)', zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 680, maxHeight: '82vh', overflowY: 'auto', background: '#fff',
            borderRadius: 22, padding: '24px 28px 30px', boxShadow: '0 20px 60px rgba(20,15,10,.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>Semua Aplikasi</h3>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', borderRadius: '50%', padding: 4, display: 'flex' }}
            >
              <X size={22} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '26px 10px' }}>
            {apps.map((app) => {
              const Icon = app.icon
              return (
                <button key={app.key} className="quick-item" onClick={() => go(app)}>
                  <span className="ic" style={{ background: app.bg, color: app.fg }}>
                    <Icon size={22} />
                  </span>
                  {app.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Sheet title="Semua Aplikasi" onClose={onClose}>
      <div className="app-grid">
        {apps.map((app) => {
          const Icon = app.icon
          return (
            <button key={app.key} className="quick-item" onClick={() => go(app)}>
              <span className="ic" style={{ background: app.bg, color: app.fg }}>
                <Icon size={22} />
              </span>
              {app.label}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
