import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileQuestion, Receipt, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useBackHandler } from '../lib/backStack'
import { useIsDesktop } from '../lib/useIsDesktop'

import { tx, locale } from '../lib/i18n'
const STATUS_LABEL = { pending: tx("Menunggu"), approved: tx("Disetujui"), rejected: tx("Ditolak") }
const rupiah = (n) => Number(n || 0).toLocaleString('id-ID')

export default function Reimbursement(props) {
  const isDesktop = useIsDesktop()
  return isDesktop ? <ReimbursementDesktop {...props} /> : <ReimbursementMobile {...props} />
}

function ReimbursementMobile({ onBack, startNew, onToast }) {
  const [showForm, setShowForm] = useState(!!startNew)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useBackHandler(() => setShowForm(false), showForm)

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
        <h1>{tx("Benefit Reimbursement")}</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="section" style={{ margin: '10px 16px 0' }}>
        <h4 style={{ margin: '0 0 10px' }}>{tx("Saldo saya")}</h4>
        <div style={{ textAlign: 'center', color: '#a39c94', padding: '10px 0' }}>
          <FileQuestion size={40} />
          <p style={{ fontWeight: 700, color: '#262220', margin: '10px 0 4px' }}>{tx("Tidak ada kebijakan yang dibuat")}</p>
          <p style={{ fontSize: 13.5 }}>{tx("Kebijakan reimburse akan muncul jika Anda telah membuatnya.")}</p>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {loading && <p style={{ color: '#a39c94' }}>{tx("Memuat...")}</p>}
        {!loading && items.length === 0 && (
          <div className="empty-state">
            <FileQuestion size={40} color="#c8c1b9" />
            <h3>{tx("Tidak ada pengajuan")}</h3>
            <p>{tx("Anda dapat mengajukan reimburse melalui tombol di bawah ini.")}</p>
          </div>
        )}
        {!loading && items.map((it) => (
          <div key={it.id} className="shift-hist-row" style={{ borderRadius: 12, marginBottom: 8 }}>
            <div className="top">
              <div>
                <div className="date">{it.reimbursement_categories?.name || tx("Reimbursement")}</div>
                <div className="desc">Rp {rupiah(it.amount)}</div>
              </div>
              <span className={`status-${it.status}`}>{STATUS_LABEL[it.status] || it.status}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="fab-bottom-btn" onClick={() => setShowForm(true)}>{tx("Ajukan reimburse")}</button>
    </div>
  )
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
    if (!amount || Number(amount) <= 0) { setError(tx("Masukkan nominal yang valid")); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_reimbursement_request', {
      p_category_id: categoryId || null, p_amount: Number(amount), p_description: description, p_receipt_url: null,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast(tx("Pengajuan reimburse terkirim"))
    onDone()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>{tx("Ajukan Reimburse")}</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>{tx("Kategori")}</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{tx(c.name)}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{tx("Nominal (Rp)")}</label>
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div className="field">
          <label>{tx("Keterangan")}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tx("Tambahkan keterangan...")} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>{loading ? tx("Mengirim...") : tx("Kirim pengajuan")}</button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------
// Versi desktop: ringkasan + tabel, mengikuti bahasa desain Cuti/Kalender.
// ---------------------------------------------------------------------
function ReimbursementDesktop({ startNew, onToast }) {
  const [items, setItems] = useState(null)
  const [categories, setCategories] = useState([])
  const [modal, setModal] = useState(!!startNew)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('reimbursement_requests')
      .select('id, amount, description, status, created_at, reimbursement_categories(name)')
      .order('created_at', { ascending: false })
    if (error) { onToast?.(error.message); setItems([]); return }
    setItems(data || [])
  }
  useEffect(() => { load(); supabase.from('reimbursement_categories').select('*').then(({ data }) => setCategories(data || [])) }, [])

  const summary = useMemo(() => {
    const list = items || []
    return {
      pending: list.filter((i) => i.status === 'pending').length,
      approvedTotal: list.filter((i) => i.status === 'approved').reduce((s, i) => s + Number(i.amount), 0),
      count: list.length,
    }
  }, [items])

  const rows = useMemo(() => (items || []).filter((r) => {
    if (status && r.status !== status) return false
    if (q && !`${r.reimbursement_categories?.name || ''} ${r.description || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [items, status, q])

  const loading = items === null

  return (
    <div className="dsk-page">
      <h1 className="dsk-title">{tx("Benefit Reimbursement")}</h1>
      <p className="dsk-sub">{tx("Ringkasan pengajuan reimburse Anda")}</p>

      <div className="dsk-stats">
        <div><b>{summary.count}</b><span>{tx("total pengajuan")}</span></div>
        <div><b>{summary.pending}</b><span>{tx("menunggu")}</span></div>
        <div><b>Rp {rupiah(summary.approvedTotal)}</b><span>{tx("disetujui")}</span></div>
      </div>

      <div className="dsk-toolbar">
        <button className="dsk-outline-btn" onClick={() => setModal(true)}>{tx("AJUKAN REIMBURSE")}</button>
        <div className="dsk-filters">
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{tx("-- Semua --")}</option>
              {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label style={{ width: 220 }}>{tx("Cari")}<div className="dsk-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </label>
        </div>
      </div>

      <div className="dsk-table-wrap">
        <table className="dsk-table">
          <thead><tr><th>{tx("Tanggal")}</th><th>{tx("Kategori")}</th><th>{tx("Keterangan")}</th><th>{tx("Nominal")}</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="empty">{tx("Memuat...")}</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="empty">{tx("Tidak ada data.")}</td></tr>
              : rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{r.reimbursement_categories?.name || tx("Reimbursement")}</td>
                  <td className="wrap">{r.description || '-'}</td>
                  <td>Rp {rupiah(r.amount)}</td>
                  <td><span className={`status-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ReimbursementModal categories={categories} onClose={() => setModal(false)}
          onDone={() => { setModal(false); onToast?.('Pengajuan reimburse terkirim'); load() }} />
      )}
    </div>
  )
}

function ReimbursementModal({ categories, onClose, onDone }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = !!(amount || description)
  const guard = () => { if (!dirty || confirm(tx("Batalkan pengisian formulir?"))) onClose() }

  async function submit() {
    setError('')
    if (!amount || Number(amount) <= 0) { setError(tx("Masukkan nominal yang valid")); return }
    setBusy(true)
    const { error } = await supabase.rpc('submit_reimbursement_request', {
      p_category_id: categoryId || null, p_amount: Number(amount), p_description: description, p_receipt_url: null,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    onDone()
  }

  return (
    <div className="modal-overlay dcuti-overlay" onClick={guard}>
      <div className="dcuti-modal narrow" onClick={(e) => e.stopPropagation()}>
        <div className="dcuti-modal-body">
          <h2>{tx("Ajukan Reimburse")}</h2>
          <label className="fld">{tx("Kategori")}<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{tx(c.name)}</option>)}
            </select>
          </label>
          <label className="fld" style={{ marginTop: 18 }}>{tx("Nominal (Rp)")}<input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </label>
          <label className="fld" style={{ marginTop: 18 }}>{tx("Keterangan")}<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
        </div>
        <div className="dcuti-modal-foot">
          <button className="dcal-outline-btn" disabled={busy} onClick={submit}>{busy ? tx("MENGIRIM...") : tx("KIRIM")}</button>
          <button className="dcal-outline-btn" onClick={guard}>{tx("BATAL")}</button>
        </div>
      </div>
    </div>
  )
}
