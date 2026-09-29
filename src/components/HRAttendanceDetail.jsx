import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useSignedPhoto } from '../lib/signedUrl'

const fmtClock = (iso) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':') : '-')
const fmtLong = (d) => new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

// Modal detail absensi (dipakai HR): foto selfie, peta, koordinat, alamat, jarak ke lokasi kantor, catatan
export default function HRAttendanceDetail({ attendanceId, onClose }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('in')
  const [address, setAddress] = useState({})
  const [zoomPhoto, setZoomPhoto] = useState(null)

  useEffect(() => {
    supabase.rpc('get_hr_attendance_detail', { p_id: attendanceId }).then(({ data, error }) => {
      if (error) setError(error.message); else if (!data) setError('Data absensi tidak ditemukan'); else setD(data)
    })
  }, [attendanceId])

  const isIn = tab === 'in'
  const time = d && (isIn ? d.clock_in : d.clock_out)
  const lat = d && (isIn ? d.clock_in_lat : d.clock_out_lat)
  const lng = d && (isIn ? d.clock_in_lng : d.clock_out_lng)
  const rawPhoto = d && (isIn ? d.clock_in_photo_url : d.clock_out_photo_url)
  const photo = useSignedPhoto(rawPhoto)
  const notes = d && (isIn ? d.clock_in_notes : d.clock_out_notes)
  const locName = d && (isIn ? d.clock_in_location : d.clock_out_location)
  const dist = d && (isIn ? d.clock_in_distance_m : d.clock_out_distance_m)
  const radius = d && (isIn ? d.clock_in_radius_m : d.clock_out_radius_m)
  const hasLoc = lat != null && lng != null

  async function loadAddress() {
    setAddress((a) => ({ ...a, [tab]: 'loading' }))
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const json = await res.json()
      setAddress((a) => ({ ...a, [tab]: json.display_name || '-' }))
    } catch { setAddress((a) => ({ ...a, [tab]: '-' })) }
  }

  const inRange = dist != null && radius != null ? dist <= radius : null

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {error && <p className="error-text">{error}</p>}
        {!d && !error && <p style={{ textAlign: 'center', color: '#888', padding: 24 }}>Memuat...</p>}
        {d && (
          <>
            <div className="sheet-title-row"><h3>Detail Absensi</h3></div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{d.full_name} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13 }}>· {d.employee_code}</span></div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{[d.position, d.department].filter(Boolean).join(' · ')}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {fmtLong(d.work_date)}
                <span style={{
                  marginLeft: 8, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
                  background: d.status === 'late' ? '#FBE1DD' : '#E1F3EA', color: d.status === 'late' ? '#C0392B' : '#1E8E5A',
                }}>{d.status === 'late' ? 'Telat' : 'Tepat waktu'}</span>
              </div>
            </div>

            <div className="tabs" style={{ marginBottom: 12 }}>
              <button className={isIn ? 'active' : ''} onClick={() => setTab('in')}>Clock In</button>
              <button className={!isIn ? 'active' : ''} onClick={() => setTab('out')}>Clock Out</button>
            </div>

            {!time ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '24px 0' }}>Belum ada data {isIn ? 'clock in' : 'clock out'}.</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, height: 220, marginBottom: 12 }}>
                  <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', background: '#eee' }}>
                    {hasLoc ? (
                      <iframe title="peta" style={{ width: '100%', height: '100%', border: 0 }}
                        src={`https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`} />
                    ) : <Empty text="Lokasi tidak tersedia" />}
                  </div>
                  <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', background: '#ddd' }}>
                    {photo ? (
                      <img src={photo} alt="Selfie" onClick={() => setZoomPhoto(photo)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
                    ) : <Empty text={rawPhoto ? 'Memuat foto...' : 'Tidak ada foto'} />}
                  </div>
                </div>

                <Row label={`Waktu clock ${isIn ? 'in' : 'out'}`} value={fmtClock(time)} />
                <Row label="Shift" value={d.shift_name ? `${d.shift_name} (${d.shift_start?.slice(0, 5)} - ${d.shift_end?.slice(0, 5)})` : '-'} />
                <Row label="Lokasi absen terdekat" value={
                  locName ? (
                    <span>
                      {locName} — {dist} m dari titik{' '}
                      <span style={{ fontWeight: 700, color: inRange ? '#1E8E5A' : '#C0392B' }}>
                        ({inRange ? `dalam radius ${radius} m` : `di luar radius ${radius} m`})
                      </span>
                    </span>
                  ) : '-'
                } />
                <Row label="Koordinat" value={hasLoc ? (
                  <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                    style={{ color: '#4356C4', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={14} /> {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                  </a>
                ) : '-'} />
                <Row label="Alamat" value={
                  !hasLoc ? '-' : address[tab] && address[tab] !== 'loading' ? address[tab] :
                    <button onClick={loadAddress} disabled={address[tab] === 'loading'}
                      style={{ background: 'none', border: 'none', color: '#4356C4', padding: 0, fontSize: 14, cursor: 'pointer' }}>
                      {address[tab] === 'loading' ? 'Memuat alamat...' : 'Lihat alamat'}
                    </button>
                } />
                <Row label="Catatan" value={notes || '-'} />
              </>
            )}
            <button className="primary-btn" style={{ marginTop: 14 }} onClick={onClose}>Tutup</button>
          </>
        )}
      </div>

      {zoomPhoto && (
        <div onClick={(e) => { e.stopPropagation(); setZoomPhoto(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={zoomPhoto} alt="Selfie" style={{ maxWidth: '92%', maxHeight: '92%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13 }}>{text}</div>
}
function Row({ label, value }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14.5 }}>{value}</div>
    </div>
  )
}
