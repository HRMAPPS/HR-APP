import { useEffect, useState } from 'react'
import { ArrowLeft, LogIn, LogOut, ChevronRight, Info, MapPin, Camera as CameraIcon } from 'lucide-react'
import { useAttendance } from '../lib/useAttendance'
import CameraCapture from '../components/CameraCapture'
import AttendanceDetail from '../components/AttendanceDetail'

function formatTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function PresensiOnline({ employee, onBack, onToast }) {
  const { data, busy, cameraMode, setCameraMode, handleCapture } = useAttendance(employee)
  const [now, setNow] = useState(new Date())
  const [detailType, setDetailType] = useState(null) // 'in' | 'out' | null

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(t)
  }, [])

  const shift = data?.shift
  const att = data?.attendance_today

  if (detailType) {
    return (
      <AttendanceDetail
        type={detailType}
        attendance={att}
        shift={shift}
        onBack={() => setDetailType(null)}
      />
    )
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Presensi Online</h1>
        <span style={{ width: 22 }} />
      </div>

      <div style={{ background: 'var(--red)', color: '#fff', textAlign: 'center', padding: '18px 16px 60px' }}>
        <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>
          {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{ marginTop: 6, fontSize: 14.5, opacity: .9 }}>
          {now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}
        </div>
      </div>

      <div style={{ margin: '-46px 16px 0', background: '#fff', borderRadius: 18, padding: '18px 16px', boxShadow: '0 6px 18px rgba(0,0,0,.08)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Jadwal: {shift?.work_date ? new Date(shift.work_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
          </div>
          {shift?.is_day_off ? (
            <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0' }}>Hari libur</div>
          ) : shift ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0 2px' }}>{shift.shift_name}</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}</div>
            </>
          ) : (
            <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0' }}>Belum ada jadwal</div>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, background: '#eef1fb', color: '#4356C4',
          borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '14px 0',
        }}>
          <Info size={16} /> Foto selfie diperlukan untuk Clock In/Out
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setCameraMode('in')}
            disabled={busy || !!att?.clock_in}
            style={presensiBtnStyle(busy || !!att?.clock_in)}
          >
            <LogIn size={17} /> Clock In
          </button>
          <button
            onClick={() => setCameraMode('out')}
            disabled={busy || !att?.clock_in || !!att?.clock_out}
            style={presensiBtnStyle(busy || !att?.clock_in || !!att?.clock_out)}
          >
            <LogOut size={17} /> Clock Out
          </button>
        </div>

        {att?.clock_in && (
          <div style={{ textAlign: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
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

      <div style={{ padding: '20px 16px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 17 }}>Daftar absensi</strong>
      </div>

      {!att?.clock_in && !att?.clock_out ? (
        <div className="empty-state"><p>Belum ada aktivitas absensi hari ini.</p></div>
      ) : (
        <div>
          {att?.clock_in && (
            <button className="list-item" style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setDetailType('in')}>
              <div className="info">
                <div className="name">{formatTime(att.clock_in)}</div>
                <div className="sub">{new Date(att.clock_in).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</div>
              </div>
              <div style={{ fontWeight: 600 }}>Clock In</div>
              <ChevronRight size={18} color="#ccc" />
            </button>
          )}
          {att?.clock_out && (
            <button className="list-item" style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setDetailType('out')}>
              <div className="info">
                <div className="name">{formatTime(att.clock_out)}</div>
                <div className="sub">{new Date(att.clock_out).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</div>
              </div>
              <div style={{ fontWeight: 600 }}>Clock Out</div>
              <ChevronRight size={18} color="#ccc" />
            </button>
          )}
        </div>
      )}

      {cameraMode && (
        <CameraCapture
          title={cameraMode === 'in' ? 'Foto Clock In' : 'Foto Clock Out'}
          onCapture={(blob) => handleCapture(blob, (r) => onToast?.(r.message))}
          onClose={() => setCameraMode(null)}
        />
      )}
    </div>
  )
}

function presensiBtnStyle(disabled) {
  return {
    flex: 1, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12,
    padding: '13px', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? .45 : 1,
  }
}
