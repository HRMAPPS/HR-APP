import { useState } from 'react'
import { Bell, Grid3x3, Plus, ExternalLink } from 'lucide-react'
import { TABS } from './BottomNav'

function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

const REQUEST_MENU = [
  ['Time off', 'cuti-new'],
  ['Attendance', 'absensi-new'],
  ['Live attendance', 'presensi'],
  ['Overtime', 'lembur-new'],
  ['Change shift', 'shift-new'],
]

function requestItemStyle() {
  return {
    display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
    color: '#fff', fontSize: 14, padding: '10px 14px', cursor: 'pointer', borderRadius: 8,
  }
}

function accountItemStyle() {
  return {
    display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', background: 'none',
    border: 'none', color: 'var(--text)', fontSize: 13.5, padding: '10px 16px', cursor: 'pointer',
    textDecoration: 'none',
  }
}

export default function DesktopShell({ employee, active, onChange, onNavigate, onOpenAllApps, onSignOut, unread = 0, wide, children }) {
  const [openMenu, setOpenMenu] = useState(null) // 'request' | 'account' | null

  function goRequest(target) {
    setOpenMenu(null)
    onNavigate(target)
  }

  function goTab(target) {
    setOpenMenu(null)
    onChange(target)
  }

  return (
    <div className="desktop-shell">
      <header className="desktop-topbar">
        <div className="desktop-logo">napocut</div>
        <div className="desktop-org">HRIS <span className="caret">▾</span></div>
        <div className="desktop-topbar-spacer" />

        <div style={{ position: 'relative' }}>
          <button className="desktop-icon-btn" onClick={() => setOpenMenu(openMenu === 'request' ? null : 'request')} title="Pengajuan">
            <Plus size={19} />
          </button>
          {openMenu === 'request' && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setOpenMenu(null)} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: '#1e2029', color: '#fff',
                borderRadius: 14, padding: '14px 6px', boxShadow: '0 12px 32px rgba(0,0,0,.25)', zIndex: 30,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .6, color: '#8a8fa3', padding: '4px 14px 10px' }}>REQUEST</div>
                {REQUEST_MENU.map(([label, target]) => (
                  <button
                    key={label}
                    onClick={() => goRequest(target)}
                    style={requestItemStyle()}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.08)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button className="desktop-icon-btn" onClick={() => onChange('inbox')} title="Notifikasi" style={{ position: 'relative' }}>
          <Bell size={19} />
          {unread > 0 && <span className="desktop-badge">{unread}</span>}
        </button>
        <button className="desktop-icon-btn" onClick={onOpenAllApps} title="Semua Aplikasi"><Grid3x3 size={19} /></button>

        <div style={{ position: 'relative' }}>
          <button className="desktop-account" onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(employee?.full_name)}</span>
            <span className="desktop-account-text">
              <strong>{employee?.full_name}</strong>
              <span>{employee?.department || employee?.position}</span>
            </span>
          </button>
          {openMenu === 'account' && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setOpenMenu(null)} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 270, background: '#fff',
                borderRadius: 14, padding: '20px 0 14px', boxShadow: '0 12px 32px rgba(0,0,0,.18)', zIndex: 30,
                border: '1px solid var(--border)',
              }}>
                <div style={{ textAlign: 'center', padding: '0 16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', background: 'var(--blue)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17,
                    margin: '0 auto 10px',
                  }}>
                    {initials(employee?.full_name)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{employee?.full_name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {employee?.department || employee?.position}
                  </div>
                </div>

                <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <button
                    onClick={() => goTab('account')}
                    style={accountItemStyle()}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f4f0' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                  >
                    Account settings
                  </button>
                </div>

                <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  {[
                    ['Support center', true],
                    ["What's new", false],
                  ].map(([label, isNew]) => (
                    <button
                      key={label}
                      style={accountItemStyle()}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f4f0' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                    >
                      <span style={{ flex: 1 }}>{label}</span>
                      {isNew && (
                        <span style={{
                          background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700,
                          borderRadius: 5, padding: '2px 6px',
                        }}>
                          New
                        </span>
                      )}
                      <ExternalLink size={13} color="var(--text-muted)" />
                    </button>
                  ))}
                  <button
                    style={accountItemStyle()}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f4f0' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                  >
                    Help
                  </button>
                </div>

                <div style={{ padding: '6px 0' }}>
                  <button
                    onClick={() => { setOpenMenu(null); onSignOut?.() }}
                    style={accountItemStyle()}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f4f0' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                  >
                    Sign out
                  </button>
                </div>

                <div style={{ padding: '10px 16px 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Privacy · Terms of Use · About Mekari Account
                  <div>napocut © {new Date().getFullYear()}</div>
                </div>
              </div>
            </>
          )}
        </div>
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
          <div className={wide === 'full' ? 'desktop-main-inner-full' : wide === 'chart' ? 'desktop-main-inner-chart' : wide ? 'desktop-main-inner-wide' : 'desktop-main-inner'}>{children}</div>
        </main>
      </div>
    </div>
  )
}
