import { useEffect, useState } from 'react'
import { Gift, LogIn, LogOut, User, ClipboardList, Building2, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { HOME_QUICK_APPS, ALL_APPS } from '../lib/menuConfig'
import { useAttendance } from '../lib/useAttendance'
import { useIsDesktop } from '../lib/useIsDesktop'
import CameraCapture from '../components/CameraCapture'

function formatTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function Home({ employee, onNavigate, onOpenAllApps }) {
  const { data, busy, cameraMode, setCameraMode, handleCapture } = useAttendance(employee)
  const [toast, setToast] = useState('')
  const [announcements, setAnnouncements] = useState([])
  const isDesktop = useIsDesktop()

  useEffect(() => {
    supabase.from('announcements').select('*').order('published_at', { ascending: false }).limit(3)
      .then(({ data }) => setAnnouncements(data || []))
  }, [])

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const shift = data?.shift
  const att = data?.attendance_today
  const today = new Date()
  const todayLabel = today.toLocaleDateString('id-ID', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  }).replace('.', '')
  const hour = today.getHours()
  const greeting = hour < 11 ? 'Good morning' : hour < 15 ? 'Good afternoon' : hour < 19 ? 'Good evening' : 'Good night'

  const overlays = (
    <>
      {cameraMode && (
        <CameraCapture
          mode={cameraMode}
          employee={employee}
          shift={shift}
          onCapture={(blob, notes) => handleCapture(blob, (r) => flash(r.message), notes)}
          onClose={() => setCameraMode(null)}
        />
      )}
      {busy && !cameraMode && <div className="toast">Memproses absensi...</div>}
      {toast && <div className="toast">{toast}</div>}
    </>
  )

  if (isDesktop) {
    return (
      <div>
        <h1 style={{ fontSize: 26, margin: '4px 0 2px' }}>{greeting}, {employee?.full_name?.split(' ')[0] || ''}!</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 24px' }}>It's {todayLabel}</p>

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>Shortcut</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
          {[
            ['Live attendance', 'presensi'],
            ['Request time off', 'cuti-new'],
            ['Request overtime', 'lembur-new'],
            ['More request', '__ALL_APPS__'],
          ].map(([label, target]) => (
            <button key={label} onClick={() => target === '__ALL_APPS__' ? onOpenAllApps() : onNavigate(target)} style={{
              padding: '11px 20px', borderRadius: 24, border: '1px solid var(--border)', background: '#fff',
              fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: 'var(--shadow-xs)',
            }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 20, alignItems: 'start' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Quick Links</div>
            {[
              [User, 'Employee profile', 'account'],
              [ClipboardList, 'My Attendance Logs', 'absensi'],
              [Building2, 'Struktur Organisasi', 'org-chart'],
            ].map(([Icon, label, target]) => (
              <button key={label} onClick={() => onNavigate(target)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none',
                padding: '9px 0', fontSize: 13.5, color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
              }}>
                <Icon size={16} color="var(--text-muted)" /> {label}
              </button>
            ))}
          </div>

          <div className="shift-card" style={{ margin: 0 }}>
            <div className="shift-card__header">Jadwal shift untuk {todayLabel}</div>
            <div className="shift-card__body">
              {(!shift || shift?.is_day_off) ? (
                <>
                  <div className="shift-card__role">Tidak ada shift hari ini</div>
                  <div className="shift-card__time">Selamat menikmati hari libur!</div>
                </>
              ) : (
                <>
                  <div className="shift-card__role">{shift.shift_name}</div>
                  <div className="shift-card__time">{shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}</div>
                  <div className="clock-buttons">
                    <button onClick={() => setCameraMode('in')} disabled={busy || !!att?.clock_in}>
                      <LogIn size={18} /> Clock In
                    </button>
                    <button onClick={() => setCameraMode('out')} disabled={busy || !att?.clock_in || !!att?.clock_out}>
                      <LogOut size={18} /> Clock Out
                    </button>
                  </div>
                  {att?.clock_in && (
                    <div className="shift-card__status">
                      <div>
                        Anda telah berhasil clock in pada pukul {formatTime(att.clock_in)}
                        {att.clock_out && <> · clock out pukul {formatTime(att.clock_out)}</>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: '18px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Applications</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {ALL_APPS.filter((a) => a.key !== 'semua').slice(0, 8).map((app) => {
                  const Icon = app.icon
                  return (
                    <button key={app.key} className="quick-item" style={{ padding: 0 }}
                      onClick={() => app.page ? onNavigate(app.page) : flash(`${app.label} segera hadir`)}>
                      <span className="ic" style={{ background: app.bg, color: app.fg, width: 42, height: 42 }}>
                        <Icon size={19} />
                      </span>
                      <span style={{ fontSize: 11 }}>{app.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Announcement</div>
            {announcements.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Belum ada pengumuman.</p>
            ) : announcements.map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderTop: '1px solid #f1ece6' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 11.5, color: '#a39c94', marginTop: 2 }}>
                  {new Date(a.published_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {overlays}
      </div>
    )
  }

  return (
    <div>
      <div className="topbar">
        <div className="greeting">
          Selamat pagi,
          <strong>{employee?.full_name || '...'}</strong>
        </div>
        <button className="icon-btn"><Gift size={24} color="#C0392B" /></button>
      </div>

      <div className="shift-card">
        <div className="shift-card__header">
          Jadwal shift untuk {todayLabel}
        </div>
        <div className="shift-card__body">
          {(!shift || shift?.is_day_off) ? (
            <>
              <div className="shift-card__role">Tidak ada shift hari ini</div>
              <div className="shift-card__time">Selamat menikmati hari libur!</div>
            </>
          ) : (
            <>
              <div className="shift-card__role">{shift.shift_name}</div>
              <div className="shift-card__time">
                {shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}
              </div>

              <div className="clock-buttons">
                <button onClick={() => setCameraMode('in')} disabled={busy || !!att?.clock_in}>
                  <LogIn size={18} /> Clock In
                </button>
                <button onClick={() => setCameraMode('out')} disabled={busy || !att?.clock_in || !!att?.clock_out}>
                  <LogOut size={18} /> Clock Out
                </button>
              </div>

              {att?.clock_in && (
                <div className="shift-card__status">
                  <div>
                    Anda telah berhasil clock in pada pukul {formatTime(att.clock_in)}
                    {att.clock_out && <> · clock out pukul {formatTime(att.clock_out)}</>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="quick-grid">
        {HOME_QUICK_APPS.map((app) => {
          const Icon = app.icon
          return (
            <button
              key={app.key}
              className="quick-item"
              onClick={() => app.page === '__ALL_APPS__' ? onOpenAllApps() : (app.page ? onNavigate(app.page) : flash(`${app.label} segera hadir`))}
            >
              <span className="ic" style={{ background: app.bg, color: app.fg }}>
                <Icon size={22} />
              </span>
              {app.label}
            </button>
          )
        })}
      </div>

      {announcements.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Pengumuman</h2>
            <a href="#">Lihat semua</a>
          </div>
          {announcements.map((a) => (
            <div key={a.id} style={{ padding: '10px 0', borderTop: '1px solid #f1ece6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong style={{ fontSize: 14.5 }}>{a.title}</strong>
                <span style={{ fontSize: 12, color: '#a39c94', whiteSpace: 'nowrap' }}>
                  {new Date(a.published_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {overlays}
    </div>
  )
}
