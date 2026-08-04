import { useEffect, useState } from 'react'
import { Gift, LogIn, LogOut, MapPin, Camera as CameraIcon } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { HOME_QUICK_APPS } from '../lib/menuConfig'
import { useAttendance } from '../lib/useAttendance'
import CameraCapture from '../components/CameraCapture'

function formatTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function Home({ employee, onNavigate, onOpenAllApps }) {
  const { data, busy, cameraMode, setCameraMode, handleCapture } = useAttendance(employee)
  const [toast, setToast] = useState('')
  const [announcements, setAnnouncements] = useState([])

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
          {shift?.is_day_off ? (
            <div className="shift-card__role">Hari libur</div>
          ) : shift ? (
            <>
              <div className="shift-card__role">{shift.shift_name}</div>
              <div className="shift-card__time">
                {shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}
              </div>
            </>
          ) : (
            <div className="shift-card__role">Belum ada jadwal</div>
          )}

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
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {att.clock_in_lat != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: '#5b554f' }}>
                    <MapPin size={13} /> {att.clock_in_lat.toFixed(4)}, {att.clock_in_lng.toFixed(4)}
                  </span>
                )}
                {att.clock_in_photo_url && (
                  <a href={att.clock_in_photo_url} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: '#5b554f' }}>
                    <CameraIcon size={13} /> Lihat foto clock in
                  </a>
                )}
                {att.clock_out_photo_url && (
                  <a href={att.clock_out_photo_url} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: '#5b554f' }}>
                    <CameraIcon size={13} /> Lihat foto clock out
                  </a>
                )}
              </div>
            </div>
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

      {cameraMode && (
        <CameraCapture
          title={cameraMode === 'in' ? 'Foto Clock In' : 'Foto Clock Out'}
          onCapture={(blob) => handleCapture(blob, (r) => flash(r.message))}
          onClose={() => setCameraMode(null)}
        />
      )}

      {busy && !cameraMode && <div className="toast">Memproses absensi...</div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
