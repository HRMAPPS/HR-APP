import { useState } from 'react'
import { ArrowLeft, MapPin } from 'lucide-react'

function formatTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
}

// Detail view for a single Clock In or Clock Out event: map + selfie side by
// side, then the same field list style as the reference app's "Detail Clock In".
export default function AttendanceDetail({ type, attendance, shift, onBack }) {
  const [address, setAddress] = useState(null)
  const [loadingAddress, setLoadingAddress] = useState(false)

  const time = type === 'in' ? attendance?.clock_in : attendance?.clock_out
  const lat = type === 'in' ? attendance?.clock_in_lat : attendance?.clock_out_lat
  const lng = type === 'in' ? attendance?.clock_in_lng : attendance?.clock_out_lng
  const photo = type === 'in' ? attendance?.clock_in_photo_url : attendance?.clock_out_photo_url
  const hasLocation = lat != null && lng != null

  async function loadAddress() {
    if (!hasLocation) return
    setLoadingAddress(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const json = await res.json()
      setAddress(json.display_name || null)
    } catch {
      setAddress(null)
    } finally {
      setLoadingAddress(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Detail {type === 'in' ? 'Clock In' : 'Clock Out'}</h1>
        <span style={{ width: 22 }} />
      </div>

      <div style={{ display: 'flex', height: 200 }}>
        <div style={{ flex: 1 }}>
          {hasLocation ? (
            <iframe
              title="map"
              style={{ width: '100%', height: '100%', border: 0 }}
              src={`https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13 }}>
              Lokasi tidak tersedia
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          {photo ? (
            <img src={photo} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13 }}>
              Tidak ada foto
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#fff' }}>
        <DetailRow label={`Waktu ${type === 'in' ? 'clock in' : 'clock out'}`} value={`${formatTime(time)} (${formatDate(time)})`} />
        <DetailRow label="Shift" value={shift ? `${shift.shift_name} (${shift.start_time?.slice(0,5)} - ${shift.end_time?.slice(0,5)})` : '-'} />
        <DetailRow label="Jadwal shift" value={shift?.work_date ? formatDate(shift.work_date + 'T00:00:00') : '-'} />
        <DetailRow
          label="Alamat"
          value={
            !hasLocation ? '-' :
            address ? address :
            <button onClick={loadAddress} disabled={loadingAddress}
              style={{ background: 'none', border: 'none', color: '#4356C4', padding: 0, fontSize: 15, cursor: 'pointer' }}>
              {loadingAddress ? 'Memuat alamat...' : 'Lihat alamat'}
            </button>
          }
        />
        {hasLocation && (
          <DetailRow
            label="Koordinat"
            value={
              <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                style={{ color: '#4356C4', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={14} /> {lat.toFixed(5)}, {lng.toFixed(5)}
              </a>
            }
          />
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15 }}>{value}</div>
    </div>
  )
}
