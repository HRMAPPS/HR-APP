import { useEffect, useState } from 'react'
import { ArrowLeft, FileQuestion, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useBackHandler } from '../lib/backStack'
import { useIsDesktop } from '../lib/useIsDesktop'
import CutiRequestDesktop from './CutiRequestDesktop'
import { RequestListPage, DetailDrawer, SelectFilter, SearchFilter, RowChevron, StatusPill, fmtDate, fmtStamp, fmtDateTime } from '../components/RequestDesktop'

import { tx } from '../lib/i18n'
const MONTHS_ID = [tx("Januari"), tx("Februari"), tx("Maret"), 'April', tx("Mei"), tx("Juni"), tx("Juli"), tx("Agustus"), 'September', tx("Oktober"), 'November', tx("Desember")]

export default function Cuti({ onBack, startNew, onToast, employee }) {
  const [showForm, setShowForm] = useState(!!startNew)
  const [tab, setTab] = useState('saya')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [query, setQuery] = useState('')
  const [detailRow, setDetailRow] = useState(null)
  const [balances, setBalances] = useState([]) // hanya jenis cuti yang kuotanya diaktifkan HR
  useBackHandler(() => setShowForm(false), showForm)
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
  useEffect(() => {
    supabase.rpc('get_leave_balances').then(({ data }) => setBalances(Array.isArray(data) ? data : []))
  }, [items.length])

  if (showForm && isDesktop) {
    return <CutiRequestDesktop employee={employee} onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  if (showForm) {
    return <CutiForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  const filtered = items.filter((it) => {
    if (statusFilter && it.status !== statusFilter) return false
    if (monthFilter && String(new Date(it.start_date).getMonth()) !== monthFilter) return false
    if (query && !(`${tx(it.leave_types?.name) || ''} ${it.start_date} ${it.reason || ''}`).toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  if (isDesktop) {
    const yr = String(new Date().getFullYear())
    const approvedDays = items.filter((i) => i.status === 'approved' && i.start_date?.startsWith(yr)).reduce((s, i) => s + Number(i.total_days || 0), 0)
    const pendingN = items.filter((i) => i.status === 'pending').length
    return (
      <RequestListPage
        title={tx("Cuti")} subtitle={tx("Riwayat pengajuan cuti Anda.")} actionLabel={tx("Ajukan Cuti")} onAction={() => setShowForm(true)}
        kpis={[
          { label: tx("Cuti disetujui {0}", [yr]), value: tx("{0} hari", [approvedDays]), tone: 'g' },
          { label: tx("Menunggu persetujuan"), value: pendingN, tone: pendingN ? 'w' : '' },
          { label: tx("Total pengajuan"), value: items.length },
          ...balances.map((b) => ({ label: tx("Sisa {0}", [tx(b.name)]), value: tx("{0} hari", [Number(b.remaining)]), tone: Number(b.remaining) <= 0 ? 'w' : '' })),
        ]}
        filters={
          <>
            <SelectFilter label="Status" value={statusFilter} onChange={setStatusFilter} options={[['', tx("Semua status")], ['pending', tx("Menunggu")], ['approved', tx("Disetujui")], ['rejected', tx("Ditolak")], ['cancelled', tx("Dibatalkan")]]} />
            <SelectFilter label={tx("Bulan")} value={monthFilter} onChange={setMonthFilter} options={[['', tx("Semua bulan")], ...MONTHS_ID.map((m, i) => [String(i), m])]} />
            <SearchFilter value={query} onChange={setQuery} placeholder={tx("Cari jenis atau alasan...")} />
          </>
        }
        columns={[tx("Diajukan"), tx("Jenis cuti"), tx("Periode"), tx("Durasi"), 'Status']}
        loading={loading} rows={filtered} total={items.length} empty={tx("Tidak ada pengajuan cuti yang cocok.")}
        renderRow={(it) => (
          <tr key={it.id} tabIndex={0} onClick={() => setDetailRow(it)} onKeyDown={(e) => { if (e.key === 'Enter') setDetailRow(it) }}>
            <td>{fmtStamp(it.created_at)}</td>
            <td><b>{tx(it.leave_types?.name) || tx("Cuti")}</b></td>
            <td>{fmtDate(it.start_date)}{it.end_date !== it.start_date ? ` – ${fmtDate(it.end_date)}` : ''}</td>
            <td>{Number(it.total_days)}{' '}{tx("hari")}</td>
            <td><StatusPill status={it.status} /></td>
            <RowChevron />
          </tr>
        )}
        drawer={detailRow && (
          <DetailDrawer title={tx("Detail pengajuan cuti")} status={detailRow.status} reason={detailRow.reason} onClose={() => setDetailRow(null)}
            items={[
              [tx("Jenis cuti"), tx(detailRow.leave_types?.name) || tx("Cuti")],
              [tx("Mulai"), fmtDate(detailRow.start_date)],
              [tx("Selesai"), fmtDate(detailRow.end_date)],
              [tx("Durasi"), tx("{0} hari", [Number(detailRow.total_days)])],
              [tx("Diajukan"), fmtStamp(detailRow.created_at)],
              [tx("Diputuskan"), detailRow.decided_at ? fmtDateTime(detailRow.decided_at) : tx("Belum diputuskan")],
            ]} />
        )}
      />
    )
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>{tx("Cuti")}</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="tabs">
        <button className={tab === 'saya' ? 'active' : ''} onClick={() => setTab('saya')}>{tx("Pengajuan saya")}</button>
        <button className={tab === 'delegasi' ? 'active' : ''} onClick={() => setTab('delegasi')}>{tx("Delegasi")}</button>
      </div>

      <div className="balance-card">
        <h4>{tx("Saldo saya")}</h4>
        {balances.length > 0 ? balances.map((b) => {
          const total = Number(b.used) + Number(b.pending)
          const pct = Number(b.quota) > 0 ? Math.min(100, (total / Number(b.quota)) * 100) : 100
          return (
            <div key={b.leave_type_id} style={{ textAlign: 'left', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{tx(b.name)}</span><span>{tx("{0} hari", [Number(b.remaining)])}</span>
              </div>
              <div style={{ height: 6, background: '#ece7e1', borderRadius: 4, margin: '6px 0' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#c0392b', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12.5, color: '#6b5f56' }}>
                {tx("Terpakai {0} · menunggu {1} · kuota {2} hari", [Number(b.used), Number(b.pending), Number(b.quota)])}
              </div>
            </div>
          )
        }) : (
          <>
            <FileQuestion size={40} color="#c0392b" />
            <p style={{ fontWeight: 700, margin: '10px 0 4px' }}>{tx("Tidak ada kebijakan")}</p>
            <p style={{ fontSize: 13.5, color: '#6b5f56' }}>{tx("Kebijakan cuti yang diterapkan akan muncul di sini.")}</p>
          </>
        )}
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {tab === 'saya' && (
          loading ? <p style={{ color: '#a39c94' }}>{tx("Memuat...")}</p> :
          items.length === 0 ? (
            <div className="empty-state">
              <FileQuestion size={40} color="#c8c1b9" />
              <h3>{tx("Tidak ada pengajuan")}</h3>
              <p>{tx("Pengajuan cuti Anda akan muncul di sini.")}</p>
            </div>
          ) : items.map((it) => (
            <div key={it.id} className="shift-hist-row" style={{ borderRadius: 12, marginBottom: 8 }}>
              <div className="top">
                <div>
                  <div className="date">{tx(it.leave_types?.name) || tx("Cuti")}</div>
                  <div className="desc">{it.start_date} – {it.end_date} ({it.total_days}{' '}{tx("hari)")}</div>
                </div>
                <span className={`status-${it.status}`}>{statusLabel(it.status)}</span>
              </div>
            </div>
          ))
        )}
        {tab === 'delegasi' && (
          <div className="empty-state"><h3>{tx("Tidak ada delegasi")}</h3><p>{tx("Delegasi cuti yang diterima akan muncul di sini.")}</p></div>
        )}
      </div>

      <button className="fab-bottom-btn" onClick={() => setShowForm(true)}><Plus size={16} style={{verticalAlign:'-2px'}}/>{' '}{tx("Ajukan")}</button>
    </div>
  )
}

function statusLabel(s) {
  return { pending: tx("Menunggu"), approved: tx("Disetujui"), rejected: tx("Ditolak"), cancelled: tx("Dibatalkan") }[s] || s
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
    if (!start || !end) { setError(tx("Lengkapi tanggal mulai dan selesai")); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_leave_request', {
      p_leave_type_id: typeId || null, p_start_date: start, p_end_date: end, p_reason: reason,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast(tx("Pengajuan cuti terkirim"))
    onDone()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>{tx("Ajukan Cuti")}</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>{tx("Jenis cuti")}</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => <option key={t.id} value={t.id}>{tx(t.name)}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{tx("Tanggal mulai")}</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>{tx("Tanggal selesai")}</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="field">
          <label>{tx("Alasan")}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("Tambahkan alasan...")} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>{loading ? tx("Mengirim...") : tx("Kirim pengajuan")}</button>
      </form>
    </div>
  )
}
