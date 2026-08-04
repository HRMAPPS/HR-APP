import { Home, Users, Plus, Bell, User } from 'lucide-react'

const TABS = [
  { key: 'home', label: 'Beranda', icon: Home },
  { key: 'employees', label: 'Karyawan', icon: Users },
  { key: 'request', label: 'Pengajuan', icon: Plus },
  { key: 'inbox', label: 'Inbox', icon: Bell },
  { key: 'account', label: 'Akun', icon: User },
]

export default function BottomNav({ active, onChange, unread = 0 }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.key}
            className={active === t.key ? 'active' : ''}
            onClick={() => onChange(t.key)}
          >
            <span style={{ position: 'relative' }}>
              <Icon className="nav-ic" size={24} />
              {t.key === 'inbox' && unread > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6, background: '#C0392B',
                  color: '#fff', fontSize: 9, borderRadius: 10, minWidth: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'
                }}>{unread}</span>
              )}
            </span>
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
