import { useEffect, useState } from 'react'
import { ArrowLeft, FileQuestion, Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function Cuti({ onBack, startNew, onToast }) {
  const [showForm, setShowForm] = useState(!!startNew)
  const [tab, setTab] = useState('saya')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, total_days, reason, status, leave_types(name)')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (showForm) {
    return <CutiForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Cuti</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="tabs">
        <button className={tab === 'saya' ? 'active' : ''} onClick={() => setTab('saya')}>Pengajuan saya</button>
        <button className={tab === 'delegasi' ? 'active' : ''} onClick={() => setTab('delegasi')}>Delegasi</button>
      </div>

      <div className="balance-card">
        <h4>Saldo saya</h4>
        <FileQuestion size={40} color="#c0392b" />
        <p style={{ fontWeight: 700, margin: '10px 0 4px' }}>Tidak ada kebijakan</p>
        <p style={{ fontSize: 13.5, color: '#6b5f56' }}>Kebijakan cuti yang diterapkan akan muncul di sini.</p>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {tab === 'saya' && (
          loading ? <p style={{ color: '#a39c94' }}>Memuat...</p> :
          items.length === 0 ? (
            <div className="empty-state">
              <FileQuestion size={40} color="#c8c1b9" />
              <h3>Tidak ada pengajuan</h3>
              <p>Pengajuan cuti Anda akan muncul di sini.</p>
            </div>
          ) : items.map((it) => (
            <div key={it.id} className="shift-hist-row" style={{ borderRadius: 12, marginBottom: 8 }}>
              <div className="top">
                <div>
                  <div className="date">{it.leave_types?.name || 'Cuti'}</div>
                  <div className="desc">{it.start_date} – {it.end_date} ({it.total_days} hari)</div>
                </div>
                <span className={`status-${it.status}`}>{statusLabel(it.status)}</span>
              </div>
            </div>
          ))
        )}
        {tab === 'delegasi' && (
          <div className="empty-state"><h3>Tidak ada delegasi</h3><p>Delegasi cuti yang diterima akan muncul di sini.</p></div>
        )}
      </div>

      <button className="fab-bottom-btn" onClick={() => setShowForm(true)}><Plus size={16} style={{verticalAlign:'-2px'}}/> Ajukan</button>
    </div>
  )
}

function statusLabel(s) {
  return { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' }[s] || s
}

function CutiForm({ onDone, onCancel, onToast }) {
  const [types, setTypes] = useState([])
  const [typeId, setTypeId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('leave_types').select('*').then(({ data }) => {
      setTypes(data || [])
      if (data?.[0]) setTypeId(data[0].id)
    })
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!start || !end) { setError('Lengkapi tanggal mulai dan selesai'); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_leave_request', {
      p_leave_type_id: typeId || null, p_start_date: start, p_end_date: end, p_reason: reason,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast('Pengajuan cuti terkirim')
    onDone()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>Ajukan Cuti</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>Jenis cuti</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Tanggal mulai</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>Tanggal selesai</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
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
