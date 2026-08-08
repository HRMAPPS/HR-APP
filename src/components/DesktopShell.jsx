import { Bell, Grid3x3, Plus } from 'lucide-react'
import { TABS } from './BottomNav'

function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function DesktopShell({ employee, active, onChange, onOpenAllApps, unread = 0, children }) {
  return (
    <div className="desktop-shell">
      <header className="desktop-topbar">
        <div className="desktop-logo">napocut</div>
        <div className="desktop-org">HRIS <span className="caret">▾</span></div>
        <div className="desktop-topbar-spacer" />
        <button className="desktop-icon-btn" onClick={() => onChange('request')} title="Pengajuan"><Plus size={19} /></button>
        <button className="desktop-icon-btn" onClick={() => onChange('inbox')} title="Notifikasi" style={{ position: 'relative' }}>
          <Bell size={19} />
          {unread > 0 && <span className="desktop-badge">{unread}</span>}
        </button>
        <button className="desktop-icon-btn" onClick={onOpenAllApps} title="Semua Aplikasi"><Grid3x3 size={19} /></button>
        <button className="desktop-account" onClick={() => onChange('account')}>
          <span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(employee?.full_name)}</span>
          <span className="desktop-account-text">
            <strong>{employee?.full_name}</strong>
            <span>{employee?.department || employee?.position}</span>
          </span>
        </button>
      </header>

      <div className="desktop-body">
        <nav className="desktop-sidebar">
          {TABS.filter((t) => t.key !== 'request').map((t) => {
            const Icon = t.icon
            return (
              <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => onChange(t.key)} title={t.label}>
                <Icon size={22} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>

        <main className="desktop-main">
          <div className="desktop-main-inner">{children}</div>
        </main>
      </div>
    </div>
  )
}
