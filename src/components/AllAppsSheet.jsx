import Sheet from './Sheet'
import { ALL_APPS } from '../lib/menuConfig'

export default function AllAppsSheet({ onClose, onNavigate, onToast, employee }) {
  const isHr = employee?.role === 'hr' || employee?.role === 'admin'
  return (
    <Sheet title="Semua Aplikasi" onClose={onClose}>
      <div className="app-grid">
        {ALL_APPS.filter((a) => a.key !== 'semua' && (!a.hrOnly || isHr)).map((app) => {
          const Icon = app.icon
          return (
            <button
              key={app.key}
              className="quick-item"
              onClick={() => {
                if (app.page) { onNavigate(app.page); onClose() }
                else { onToast(`${app.label} segera hadir`); onClose() }
              }}
            >
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
