import { useEffect, useRef, useState } from 'react'
import { X, Camera, RotateCcw, Check } from 'lucide-react'

// Full-screen selfie capture modal used for Clock In / Clock Out.
// Calls onCapture(blob) once the user confirms a shot, or onClose() if cancelled.
export default function CameraCapture({ title, onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [error, setError] = useState('')

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
      } catch (e) {
        setError('Tidak bisa mengakses kamera. Izinkan akses kamera di browser, lalu coba lagi.')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function takeShot() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    // mirror horizontally so the preview matches what the user saw
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85))
  }

  function retake() {
    setPhotoDataUrl(null)
  }

  function confirm() {
    canvasRef.current.toBlob((blob) => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      onCapture(blob)
    }, 'image/jpeg', 0.85)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#111', zIndex: 80,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', color: '#fff',
      }}>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', background: '#000' }}>
        {error ? (
          <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>{error}</div>
        ) : photoDataUrl ? (
          <img src={photoDataUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div style={{ padding: '22px 24px 30px', display: 'flex', justifyContent: 'center', gap: 24 }}>
        {!error && (
          photoDataUrl ? (
            <>
              <button onClick={retake} style={btnStyle('#fff', '#333')}>
                <RotateCcw size={18} /> Ambil ulang
              </button>
              <button onClick={confirm} style={btnStyle('#fff', '#1E8E5A')}>
                <Check size={18} /> Gunakan foto
              </button>
            </>
          ) : (
            <button onClick={takeShot} style={btnStyle('#fff', '#C0392B', true)}>
              <Camera size={22} />
            </button>
          )
        )}
      </div>
    </div>
  )
}

function btnStyle(color, bg, round = false) {
  return {
    display: 'flex', alignItems: 'center', gap: 8, color, background: bg,
    border: 'none', borderRadius: round ? '50%' : 12,
    padding: round ? 18 : '12px 20px', fontWeight: 700, fontSize: 14.5, cursor: 'pointer',
  }
}
