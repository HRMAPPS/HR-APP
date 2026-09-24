import { useEffect, useState } from 'react'
import { ArrowLeft, LogIn, LogOut, ChevronRight, Info, MapPin, MapPinOff } from 'lucide-react'
import { useAttendance } from '../lib/useAttendance'
import { useIsDesktop } from '../lib/useIsDesktop'
import CameraCapture from '../components/CameraCapture'
import AttendanceDetail from '../components/AttendanceDetail'

function formatTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function PresensiOnline({ employee, onBack, onToast, onNavigate }) {
  const { data, busy, cameraMode, setCameraMode, handleCapture, locationStatus } = useAttendance(employee)
  const [now, setNow] = useState(new Date())
  const [detailType, setDetailType] = useState(null) // 'in' | 'out' | null
  const [notes, setNotes] = useState('')
  const isDesktop = useIsDesktop()

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

  const cameraOverlay = cameraMode && (
    <CameraCapture
      mode={cameraMode}
      employee={employee}
      shift={shift}
      initialNotes={notes}
      onCapture={(blob, capturedNotes, faceDescriptor) => handleCapture(blob, (r) => onToast?.(r.message), capturedNotes, faceDescriptor)}
      onClose={() => setCameraMode(null)}
    />
  )

  if (isDesktop) {
    return (
      <div>
        <h1 style={{ fontSize: 26, margin: '4px 0 24px' }}>Live Attendance</h1>

        <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: 'var(--shadow-sm)', maxWidth: 500 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 34, fontWeight: 700 }}>
              {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 20, textAlign: 'center' }}>
            {(!shift || shift?.is_day_off) ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 16, margin: '4px 0' }}>Tidak ada shift hari ini</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Selamat menikmati hari libur!</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Schedule, {new Date(shift.work_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, margin: '4px 0' }}>{shift.shift_name}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                  {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                </div>
              </>
            )}
          </div>

          {shift && !shift.is_day_off && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, background: '#eef1fb', color: '#4356C4',
                borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '18px 0 0',
              }}>
                <Info size={16} /> Foto selfie diperlukan untuk Clock In/Out
              </div>

              {locationStatus && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '10px 0 0',
                  background: locationStatus.withinRadius ? '#E1F3EA' : '#FBE1DD',
                  color: locationStatus.withinRadius ? '#1E8E5A' : '#C0392B',
                }}>
                  {locationStatus.withinRadius ? <MapPin size={16} /> : <MapPinOff size={16} />}
                  {locationStatus.withinRadius
                    ? `Anda dalam radius ${locationStatus.nearestName} (±${Math.round(locationStatus.distance)} m)`
                    : `Anda ${Math.round(locationStatus.distance)} m dari ${locationStatus.nearestName}, di luar radius ${locationStatus.radius} m`}
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Catatan (opsional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tulis catatan..."
                  rows={3}
                  style={{
                    width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
                    fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
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
            </>
          )}

          {att?.clock_in && (
            <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                Anda telah berhasil clock in pada pukul {formatTime(att.clock_in)}
                {att.clock_out && <> · clock out pukul {formatTime(att.clock_out)}</>}
              </div>
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <strong style={{ fontSize: 15 }}>Attendance log</strong>
            {!att?.clock_in && !att?.clock_out ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}>Belum ada aktivitas absensi hari ini.</p>
            ) : (
              <div style={{ marginTop: 6 }}>
                {att?.clock_in && (
                  <div onClick={() => setDetailType('in')} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid #f1ece6', cursor: 'pointer',
                  }}>
                    <div style={{ minWidth: 70 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{formatTime(att.clock_in)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {new Date(att.clock_in).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    <div style={{ flex: 1, fontSize: 13.5 }}>Clock In</div>
                    <span style={{ fontSize: 13, color: 'var(--blue)' }}>Detail</span>
                  </div>
                )}
                {att?.clock_out && (
                  <div onClick={() => setDetailType('out')} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid #f1ece6', cursor: 'pointer',
                  }}>
                    <div style={{ minWidth: 70 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{formatTime(att.clock_out)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {new Date(att.clock_out).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    <div style={{ flex: 1, fontSize: 13.5 }}>Clock Out</div>
                    <span style={{ fontSize: 13, color: 'var(--blue)' }}>Detail</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {cameraOverlay}
      </div>
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
          {(!shift || shift?.is_day_off) ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0' }}>Tidak ada shift hari ini</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Selamat menikmati hari libur!</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{shift.shift_name}</div>
              <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0' }}>
                {new Date(shift.work_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ({shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)})
              </div>
            </>
          )}
        </div>

        {shift && !shift.is_day_off && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, background: '#eef1fb', color: '#4356C4',
              borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '14px 0',
            }}>
              <Info size={16} /> Foto selfie diperlukan untuk Clock In/Out
            </div>

            {locationStatus && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14,
                background: locationStatus.withinRadius ? '#E1F3EA' : '#FBE1DD',
                color: locationStatus.withinRadius ? '#1E8E5A' : '#C0392B',
              }}>
                {locationStatus.withinRadius ? <MapPin size={16} /> : <MapPinOff size={16} />}
                {locationStatus.withinRadius
                  ? `Anda dalam radius ${locationStatus.nearestName} (±${Math.round(locationStatus.distance)} m)`
                  : `Anda ${Math.round(locationStatus.distance)} m dari ${locationStatus.nearestName}, di luar radius ${locationStatus.radius} m`}
              </div>
            )}

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
          </>
        )}

        {att?.clock_in && (
          <div style={{ textAlign: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
              Anda telah berhasil clock in pada pukul {formatTime(att.clock_in)}
              {att.clock_out && <> · clock out pukul {formatTime(att.clock_out)}</>}
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

      {cameraOverlay}
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
