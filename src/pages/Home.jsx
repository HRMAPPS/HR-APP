import { useEffect, useState } from 'react'
import { Gift, LogIn, LogOut, User, ClipboardList, Building2, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { HOME_QUICK_APPS } from '../lib/menuConfig'
import { useAttendance } from '../lib/useAttendance'
import { useIsDesktop } from '../lib/useIsDesktop'
import CameraCapture from '../components/CameraCapture'
import { jakartaHour, greetingID } from '../lib/dateUtils'

// Small "Oleh <avatar> <name>" byline used under each announcement in
// the list. Falls back to a generic person icon when there's no photo.
function AnnouncementByline({ author, authorAvatarUrl }) {
  if (!author) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      {authorAvatarUrl
        ? <img src={authorAvatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
        : <span className="avatar" style={{ width: 20, height: 20 }}><User size={11} /></span>}
      <span style={{ fontSize: 12.5, color: '#a39c94' }}>{author}</span>
    </div>
  )
}

function formatTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

// Small overlapping avatar row used by the "Laporan tim saya" card, one
// circle per direct report (up to 4) plus a "+N" circle for the rest.
function TeamAvatarStack({ team, size = 40 }) {
  const shown = team.slice(0, 4)
  const extra = team.length - shown.length
  return (
    <div style={{ display: 'flex' }}>
      {shown.map((t, i) => (
        <div key={t.id} style={{ marginLeft: i === 0 ? 0 : -10, border: '2px solid #fff', borderRadius: '50%' }}>
          {t.avatar_url
            ? <img src={t.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
            : <div className="avatar" style={{ width: size, height: size, fontSize: 12 }}>{initials(t.full_name)}</div>}
        </div>
      ))}
      {extra > 0 && (
        <div style={{ marginLeft: -10, border: '2px solid #fff', borderRadius: '50%' }}>
          <div className="avatar" style={{ width: size, height: size, fontSize: 12 }}>+{extra}</div>
        </div>
      )}
    </div>
  )
}

export default function Home({ employee, onNavigate, onOpenAllApps }) {
  const { data, busy, cameraMode, setCameraMode, handleCapture } = useAttendance(employee)
  const [toast, setToast] = useState('')
  const [announcements, setAnnouncements] = useState([])
  const [team, setTeam] = useState([])
  const isDesktop = useIsDesktop()

  useEffect(() => {
    supabase.from('announcements').select('*').order('published_at', { ascending: false }).limit(5)
      .then(({ data }) => setAnnouncements(data || []))
  }, [])

  useEffect(() => {
    if (!employee?.id) return
    supabase.from('employees').select('id, full_name, avatar_url').eq('manager_id', employee.id).order('full_name')
      .then(({ data }) => setTeam(data || []))
  }, [employee?.id])

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
  const hour = jakartaHour()
  const greeting = hour < 11 ? 'Good morning' : hour < 15 ? 'Good afternoon' : hour < 19 ? 'Good evening' : 'Good night'

  const overlays = (
    <>
      {cameraMode && (
        <CameraCapture
          mode={cameraMode}
          employee={employee}
          shift={shift}
          onCapture={(blob, notes, faceDescriptor) => handleCapture(blob, (r) => flash(r.message), notes, faceDescriptor)}
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

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
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

          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Announcement</div>
              <a href="#" style={{ fontSize: 13, color: 'var(--blue)', textDecoration: 'none' }}>Lihat semua</a>
            </div>
            {announcements.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Belum ada pengumuman.</p>
            ) : announcements.map((a) => (
              <div
                key={a.id}
                onClick={() => onNavigate(`announcement:${a.id}`)}
                style={{ display: 'flex', gap: 12, padding: '16px 0', borderTop: '1px solid #f1ece6', cursor: 'pointer' }}
              >
                {a.author_avatar_url
                  ? <img src={a.author_avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <span className="avatar" style={{ width: 40, height: 40, flexShrink: 0 }}><User size={18} /></span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.author || 'napocut'}</span>
                    <span style={{ fontSize: 12, color: '#a39c94', whiteSpace: 'nowrap' }}>
                      {new Date(a.published_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                    <strong style={{ fontSize: 14.5 }}>{a.title}</strong>
                    {a.category && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--blue)', background: '#eef2ff',
                        borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap', height: 'fit-content',
                      }}>
                        {a.category}
                      </span>
                    )}
                  </div>
                  {a.body && (
                    <p style={{
                      fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {a.body}
                    </p>
                  )}
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
          {greetingID()},
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

      {team.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Laporan tim saya</h2>
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('team-report') }}>Lihat aktivitas</a>
          </div>
          <TeamAvatarStack team={team} />
        </div>
      )}

      {announcements.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Pengumuman</h2>
            <a href="#">Lihat semua</a>
          </div>
          {announcements.map((a) => (
            <div
              key={a.id}
              onClick={() => onNavigate(`announcement:${a.id}`)}
              style={{ padding: '10px 0', borderTop: '1px solid #f1ece6', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong style={{ fontSize: 14.5 }}>{a.title}</strong>
                <span style={{ fontSize: 12, color: '#a39c94', whiteSpace: 'nowrap' }}>
                  {new Date(a.published_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                </span>
              </div>
              <AnnouncementByline author={a.author} authorAvatarUrl={a.author_avatar_url} />
            </div>
          ))}
        </div>
      )}

      {overlays}
    </div>
  )
}
