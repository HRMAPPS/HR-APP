import { Home, Users, Plus, Bell, User } from 'lucide-react'

import { tx } from '../lib/i18n'
import './BottomNav.css'
export const TABS = [
  { key: 'home', label: tx("Beranda"), icon: Home },
  { key: 'employees', label: tx("Karyawan"), icon: Users },
  { key: 'request', label: tx("Pengajuan"), icon: Plus },
  { key: 'inbox', label: 'Inbox', icon: Bell },
  { key: 'account', label: tx("Akun"), icon: User },
]

export default function BottomNav({ active, onChange, unread = 0 }) {
  return (
    <nav className="bottom-nav hd-nav" aria-label="Menu utama">
      {TABS.map((t) => {
        const Icon = t.icon
        const cta = t.key === 'request'
        return (
          <button
            key={t.key}
            type="button"
            className={(active === t.key ? 'active' : '') + (cta ? ' is-cta' : '')}
            aria-current={active === t.key ? 'page' : undefined}
            onClick={() => onChange(t.key)}
          >
            {cta ? (
              <span className="hd-cta"><Icon size={24} strokeWidth={2.4} /></span>
            ) : (
              <span className="hd-nav-ic">
                <Icon className="nav-ic" size={22} />
                {t.key === 'inbox' && unread > 0 && <span className="hd-nav-badge">{unread > 99 ? '99+' : unread}</span>}
              </span>
            )}
            <span className="hd-nav-l">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
