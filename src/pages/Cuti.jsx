import { useEffect, useState } from 'react'
import { ArrowLeft, FileQuestion, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useIsDesktop } from '../lib/useIsDesktop'

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export default function Cuti({ onBack, startNew, onToast }) {
  const [showForm, setShowForm] = useState(!!startNew)
  const [tab, setTab] = useState('saya')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [query, setQuery] = useState('')
  const [detailRow, setDetailRow] = useState(null)
  const isDesktop = useIsDesktop()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, total_days, reason, status, created_at, decided_at, leave_types(name)')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (showForm) {
    return <CutiForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  const filtered = items.filter((it) => {
    if (statusFilter && it.status !== statusFilter) return false
    if (monthFilter && String(new Date(it.start_date).getMonth()) !== monthFilter) return false
    if (query && !(`${it.leave_types?.name || ''} ${it.start_date} ${it.reason || ''}`).toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  if (isDesktop) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, margin: '4px 0' }}>Cuti</h1>
          <button className="primary-btn" style={{ width: 'auto', padding: '11px 20px' }} onClick={() => setShowForm(true)}>
            <Plus size={16} style={{ verticalAlign: -2 }} /> Ajukan Cuti
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 20px' }}>Riwayat pengajuan cuti Anda.</p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13.5 }}>
              <option value="">-- Semua Status --</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Bulan</label>
            <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13.5 }}>
              <option value="">-- Semua Bulan --</option>
              {MONTHS_ID.map((m, i) => <option key={m} value={String(i)}>{m}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Cari</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari jenis / alasan..."
                style={{ border: 'none', outline: 'none', fontSize: 13.5, width: 200 }} />
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 0.8fr 0.8fr', gap: 10, padding: '10px 16px',
            background: '#faf8f5', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
            borderBottom: '1px solid var(--border)',
          }}>
            <div>Tanggal Diajukan</div>
            <div>Jenis Cuti</div>
            <div>Mulai</div>
            <div>Selesai</div>
            <div>Status</div>
            <div>Aksi</div>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>Memuat...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>Tidak ada data.</div>
          ) : (
            filtered.map((it) => (
              <div key={it.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 0.8fr 0.8fr', gap: 10, padding: '12px 16px',
                borderBottom: '1px solid #f1ece6', fontSize: 13.5, alignItems: 'center',
              }}>
                <div>{it.created_at ? new Date(it.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                <div>{it.leave_types?.name || 'Cuti'}</div>
                <div>{it.start_date}</div>
                <div>{it.end_date}</div>
                <div><span className={`status-${it.status}`}>{statusLabel(it.status)}</span></div>
                <div>
                  <button onClick={() => setDetailRow(it)} style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px',
                    fontSize: 12.5, cursor: 'pointer', color: 'var(--text)',
                  }}>
                    Detail
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>
          Menampilkan {filtered.length} dari {items.length} pengajuan.
        </p>

        {detailRow && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,.45)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setDetailRow(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, padding: 24,
              boxShadow: '0 20px 60px rgba(20,15,10,.3)',
            }}>
              <h3 style={{ margin: '0 0 14px', color: 'var(--red)' }}>Detail Pengajuan Cuti</h3>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, fontSize: 14, lineHeight: 1.8 }}>
                <div>Jenis cuti: <strong>{detailRow.leave_types?.name || 'Cuti'}</strong></div>
                <div>Tanggal: <strong>{detailRow.start_date} – {detailRow.end_date} ({detailRow.total_days} hari)</strong></div>
                <div>Status: <strong>{statusLabel(detailRow.status)}</strong></div>
                {detailRow.decided_at && (
                  <div>Diputuskan pada: <strong>{new Date(detailRow.decided_at).toLocaleString('id-ID')}</strong></div>
                )}
                <div style={{ marginTop: 8 }}>Alasan:<br />{detailRow.reason || '-'}</div>
              </div>
              <button onClick={() => setDetailRow(null)} style={{
                marginTop: 20, background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                padding: '8px 16px', fontSize: 13.5, cursor: 'pointer', float: 'right',
              }}>
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    )
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
