import { useEffect, useState } from 'react'
import { ArrowLeft, ScrollText } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function Lembur({ onBack, startNew, onToast }) {
  const [showForm, setShowForm] = useState(!!startNew)
  const [tab, setTab] = useState('pengajuan')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('overtime_requests')
      .select('id, work_date, start_time, end_time, reason, status')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (showForm) {
    return <LemburForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Lembur</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="tabs on-red" style={{ background: 'var(--red)', margin: 0, padding: '0 16px 10px' }}>
        <button className={tab === 'pengajuan' ? 'active' : ''} onClick={() => setTab('pengajuan')}>Pengajuan</button>
        <button className={tab === 'ditugaskan' ? 'active' : ''} onClick={() => setTab('ditugaskan')}>Ditugaskan</button>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {tab === 'pengajuan' && (
          loading ? <p style={{ color: '#a39c94' }}>Memuat...</p> :
          items.length === 0 ? (
            <div className="empty-state">
              <ScrollText size={40} color="#c8c1b9" />
              <h3>Belum ada pengajuan</h3>
              <p>Pengajuan lembur Anda akan tampil di sini.</p>
            </div>
          ) : items.map((it) => (
            <div key={it.id} className="shift-hist-row" style={{ borderRadius: 12, marginBottom: 8 }}>
              <div className="top">
                <div>
                  <div className="date">{it.work_date}</div>
                  <div className="desc">{it.start_time?.slice(0,5)} – {it.end_time?.slice(0,5)}</div>
                </div>
                <span className={`status-${it.status}`}>{statusLabel(it.status)}</span>
              </div>
            </div>
          ))
        )}
        {tab === 'ditugaskan' && (
          <div className="empty-state"><h3>Belum ada tugas lembur</h3><p>Lembur yang ditugaskan kepada Anda akan tampil di sini.</p></div>
        )}
      </div>

      <button className="fab-bottom-btn" onClick={() => setShowForm(true)}>Ajukan Lembur</button>
    </div>
  )
}

function statusLabel(s) {
  return { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }[s] || s
}

function LemburForm({ onDone, onCancel, onToast }) {
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!date || !start || !end) { setError('Lengkapi tanggal dan jam lembur'); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_overtime_request', {
      p_work_date: date, p_start_time: start, p_end_time: end, p_reason: reason,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast('Pengajuan lembur terkirim')
    onDone()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>Ajukan Lembur</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>Tanggal</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Jam mulai</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>Jam selesai</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="field">
          <label>Alasan</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tambahkan alasan..." />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>{loading ? 'Mengirim...' : 'Kirim pengajuan'}</button>
      </form>
    </div>
  )
}
