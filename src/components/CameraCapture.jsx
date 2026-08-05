import { useEffect, useRef, useState } from 'react'
import { X, MapPin, ChevronRight, AlignLeft } from 'lucide-react'

function formatSchedule(shift) {
  if (!shift) return null
  if (shift.is_day_off) return 'Hari libur'
  const date = shift.work_date
    ? new Date(shift.work_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''
  const start = shift.start_time?.slice(0, 5)
  const end = shift.end_time?.slice(0, 5)
  if (start && end) return `${date} (${start} - ${end})`
  return date || null
}

// Full-screen selfie capture screen used for Clock In / Clock Out, styled to
// match the reference app: red header, shift info card, live camera with a
// face-position guide, and a bottom sheet with an optional note, a "lihat
// lokasi" row, and a single Kirim button that captures + submits in one tap.
export default function CameraCapture({ mode, employee, shift, onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [notes, setNotes] = useState('')
  const [coords, setCoords] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const title = mode === 'out' ? 'Clock Out' : 'Clock In'
  const scheduleText = formatSchedule(shift)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }, audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setReady(true)
      } catch (e) {
        setError('Tidak bisa mengakses kamera. Izinkan akses kamera di browser, lalu coba lagi.')
      }
    }
    start()
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords(null),
        { timeout: 6000, enableHighAccuracy: true }
      )
    }
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function captureBlob() {
    return new Promise((resolve) => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return resolve(null)
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
    })
  }

  async function handleSubmit() {
    if (submitting || !ready || error) return
    setSubmitting(true)
    const blob = await captureBlob()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (!blob) { setSubmitting(false); return }
    onCapture(blob, notes.trim())
  }

  function openLocation() {
    if (!coords) return
    window.open(`https://maps.google.com/?q=${coords.lat},${coords.lng}`, '_blank', 'noopener')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#111', zIndex: 80, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--red)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            <X size={22} />
          </button>
          <strong style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, marginRight: 22 }}>{title}</strong>
        </div>
      </div>

      {(employee?.position || scheduleText) && (
        <div style={{ background: '#fff', padding: '12px 18px', flexShrink: 0 }}>
          {employee?.position && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{employee.position}</div>
          )}
          {scheduleText && (
            <div style={{ fontWeight: 700, fontSize: 16.5, marginTop: 2 }}>{scheduleText}</div>
          )}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', background: '#2b2f36', overflow: 'hidden' }}>
        {error ? (
          <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>{error}</div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {!error && (
          <svg viewBox="0 0 300 400" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <ellipse cx="150" cy="190" rx="95" ry="130" fill="none" stroke="#fff" strokeWidth="3"
              strokeDasharray="10 8" opacity="0.85" />
          </svg>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '18px 18px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderBottom: '1px solid var(--border)' }}>
          <AlignLeft size={18} color="#8a847c" />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan (opsional)"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14.5 }}
          />
        </div>

        <button onClick={openLocation} disabled={!coords} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 2px',
          background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
          cursor: coords ? 'pointer' : 'default', textAlign: 'left',
        }}>
          <MapPin size={18} color="#8a847c" />
          <span style={{ flex: 1, fontSize: 14.5 }}>Lihat lokasi</span>
          <ChevronRight size={18} color="#ccc" />
        </button>

        <button onClick={handleSubmit} disabled={!ready || !!error || submitting} style={{
          width: '100%', marginTop: 18, background: 'var(--blue)', color: '#fff', border: 'none',
          borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15.5,
          cursor: (!ready || error || submitting) ? 'not-allowed' : 'pointer',
          opacity: (!ready || error || submitting) ? 0.6 : 1,
        }}>
          {submitting ? 'Mengirim...' : 'Kirim'}
        </button>
      </div>
    </div>
  )
}
