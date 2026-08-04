import { useEffect, useState } from 'react'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function Reimbursement({ onBack, startNew, onToast }) {
  const [showForm, setShowForm] = useState(!!startNew)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('reimbursement_requests')
      .select('id, amount, description, status, created_at, reimbursement_categories(name)')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (showForm) {
    return <ReimbursementForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Benefit Reimbursement</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="section" style={{ margin: '10px 16px 0' }}>
        <h4 style={{ margin: '0 0 10px' }}>Saldo saya</h4>
        <div style={{ textAlign: 'center', color: '#a39c94', padding: '10px 0' }}>
          <FileQuestion size={40} />
          <p style={{ fontWeight: 700, color: '#262220', margin: '10px 0 4px' }}>Tidak ada kebijakan yang dibuat</p>
          <p style={{ fontSize: 13.5 }}>Kebijakan reimburse akan muncul jika Anda telah membuatnya.</p>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {loading && <p style={{ color: '#a39c94' }}>Memuat...</p>}
        {!loading && items.length === 0 && (
          <div className="empty-state">
            <FileQuestion size={40} color="#c8c1b9" />
            <h3>Tidak ada pengajuan</h3>
            <p>Anda dapat mengajukan reimburse melalui tombol di bawah ini.</p>
          </div>
        )}
        {!loading && items.map((it) => (
          <div key={it.id} className="shift-hist-row" style={{ borderRadius: 12, marginBottom: 8 }}>
            <div className="top">
              <div>
                <div className="date">{it.reimbursement_categories?.name || 'Reimbursement'}</div>
                <div className="desc">Rp {Number(it.amount).toLocaleString('id-ID')}</div>
              </div>
              <span className={`status-${it.status}`}>{statusLabel(it.status)}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="fab-bottom-btn" onClick={() => setShowForm(true)}>Ajukan reimburse</button>
    </div>
  )
}

function statusLabel(s) {
  return { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }[s] || s
}

function ReimbursementForm({ onDone, onCancel, onToast }) {
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('reimbursement_categories').select('*').then(({ data }) => {
      setCategories(data || [])
      if (data?.[0]) setCategoryId(data[0].id)
    })
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!amount || Number(amount) <= 0) { setError('Masukkan nominal yang valid'); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_reimbursement_request', {
      p_category_id: categoryId || null, p_amount: Number(amount), p_description: description, p_receipt_url: null,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast('Pengajuan reimburse terkirim')
    onDone()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>Ajukan Reimburse</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>Kategori</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Nominal (Rp)</label>
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div className="field">
          <label>Keterangan</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tambahkan keterangan..." />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>{loading ? 'Mengirim...' : 'Kirim pengajuan'}</button>
      </form>
    </div>
  )
}
