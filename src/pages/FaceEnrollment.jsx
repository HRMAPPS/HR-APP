import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ScanFace, CheckCircle2, RefreshCcw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { loadFaceModels, extractFaceDescriptor } from '../lib/faceRecognition'

// Self-service face registration: employee looks at the camera, we detect
// exactly one face and turn it into a 128-number descriptor, then send it
// to enroll_face() which stores it against their own employee_id. This is
// required once before Clock In / Clock Out will accept a face match.
export default function FaceEnrollment({ employee, onBack, onToast }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [modelsReady, setModelsReady] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(null) // null while loading, then boolean
  const [detecting, setDetecting] = useState(false)
  const [preview, setPreview] = useState(null) // { descriptor } once a good capture is found
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadFaceModels()
      .then(() => { if (!cancelled) setModelsReady(true) })
      .catch(() => { if (!cancelled) setError('Gagal memuat model pengenalan wajah. Periksa koneksi internet dan coba lagi.') })

    supabase.rpc('get_my_face_status').then(({ data, error: e }) => {
      if (!cancelled && !e) setStatus(!!data)
    })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!modelsReady) return
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCameraReady(true)
      } catch (e) {
        setError('Tidak bisa mengakses kamera. Izinkan akses kamera di browser, lalu coba lagi.')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [modelsReady])

  async function handleScan() {
    if (!videoRef.current || detecting) return
    setDetecting(true)
    setError('')
    try {
      const descriptor = await extractFaceDescriptor(videoRef.current)
      if (!descriptor) {
        setError('Wajah tidak terdeteksi dengan jelas. Pastikan wajah terlihat penuh dan pencahayaan cukup, lalu coba lagi.')
        return
      }
      setPreview({ descriptor })
      streamRef.current?.getTracks().forEach((t) => t.stop())
    } finally {
      setDetecting(false)
    }
  }

  async function handleConfirm() {
    if (!preview || submitting) return
    setSubmitting(true)
    const { error: e } = await supabase.rpc('enroll_face', { p_descriptor: preview.descriptor })
    setSubmitting(false)
    if (e) {
      onToast?.(e.message || 'Gagal mendaftarkan wajah')
      return
    }
    onToast?.('Wajah berhasil didaftarkan')
    setStatus(true)
    onBack()
  }

  function handleRetake() {
    setPreview(null)
    setError('')
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then((stream) => {
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraReady(true)
    }).catch(() => setError('Tidak bisa mengakses kamera. Izinkan akses kamera di browser, lalu coba lagi.'))
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Daftar Wajah</h1>
        <span style={{ width: 22 }} />
      </div>

      <div style={{ padding: '4px 16px 20px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, background: '#eef1fb', color: '#4356C4',
          borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 16,
        }}>
          <ScanFace size={18} />
          {status
            ? 'Wajah kamu sudah terdaftar. Kamu bisa mendaftar ulang jika wajahmu berubah signifikan (kacamata, jenggot, dll).'
            : 'Daftarkan wajahmu sekali di sini. Setelah terdaftar, Clock In/Out akan memverifikasi wajahmu setiap kali absen.'}
        </div>

        {!preview ? (
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '3 / 4', background: '#2b2f36',
            borderRadius: 16, overflow: 'hidden',
          }}>
            {error ? (
              <div style={{ color: '#fff', padding: 24, textAlign: 'center', fontSize: 14 }}>{error}</div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            )}
            {!error && (
              <svg viewBox="0 0 300 400" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <ellipse cx="150" cy="190" rx="95" ry="130" fill="none" stroke="#fff" strokeWidth="3"
                  strokeDasharray="10 8" opacity="0.85" />
              </svg>
            )}
            {!modelsReady && !error && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13.5 }}>
                Memuat model wajah...
              </div>
            )}
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '100%', aspectRatio: '3 / 4', background: '#E1F3EA', borderRadius: 16, gap: 10,
          }}>
            <CheckCircle2 size={48} color="#1E8E5A" />
            <div style={{ color: '#1E8E5A', fontWeight: 700, fontSize: 15.5 }}>Wajah terdeteksi</div>
            <div style={{ color: '#1E8E5A', fontSize: 13, textAlign: 'center', padding: '0 24px' }}>
              Pastikan ini benar-benar wajahmu, lalu simpan.
            </div>
          </div>
        )}

        {!preview ? (
          <button onClick={handleScan} disabled={!cameraReady || !modelsReady || !!error || detecting} style={{
            width: '100%', marginTop: 18, background: 'var(--blue)', color: '#fff', border: 'none',
            borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15.5,
            cursor: (!cameraReady || !modelsReady || error || detecting) ? 'not-allowed' : 'pointer',
            opacity: (!cameraReady || !modelsReady || error || detecting) ? 0.6 : 1,
          }}>
            {detecting ? 'Mendeteksi wajah...' : 'Ambil Foto'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={handleRetake} disabled={submitting} style={{
              flex: 1, background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15, display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
            }}>
              <RefreshCcw size={16} /> Ambil Ulang
            </button>
            <button onClick={handleConfirm} disabled={submitting} style={{
              flex: 1, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12,
              padding: '14px', fontWeight: 700, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
