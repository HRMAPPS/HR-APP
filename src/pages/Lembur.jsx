import { useEffect, useState } from 'react'
import { ArrowLeft, ScrollText, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useBackHandler } from '../lib/backStack'
import { useIsDesktop } from '../lib/useIsDesktop'
import LemburRequestDesktop from './LemburRequestDesktop'
import { RequestListPage, DetailDrawer, SelectFilter, SearchFilter, RowChevron, StatusPill, fmtDate, fmtStamp, fmtDateTime, weekday, overtimeMinutes, fmtDur } from '../components/RequestDesktop'

import { tx } from '../lib/i18n'
export default function Lembur({ onBack, startNew, onToast }) {
  const [showForm, setShowForm] = useState(!!startNew)
  const [tab, setTab] = useState('pengajuan')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [detailRow, setDetailRow] = useState(null)
  useBackHandler(() => setShowForm(false), showForm)
  const isDesktop = useIsDesktop()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('overtime_requests')
      .select('id, work_date, start_time, end_time, reason, status, created_at, decided_at')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (showForm && isDesktop) {
    return <LemburRequestDesktop onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  if (showForm) {
    return <LemburForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  const filtered = items.filter((it) => {
    if (statusFilter && it.status !== statusFilter) return false
    if (query && !(`${it.work_date} ${it.reason || ''}`).toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  if (isDesktop) {
    const ym = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
    const dur = (it) => overtimeMinutes(it.start_time, it.end_time)
    const approvedMin = items.filter((i) => i.status === 'approved' && i.work_date?.startsWith(ym)).reduce((s, i) => s + dur(i), 0)
    const pendingN = items.filter((i) => i.status === 'pending').length
    return (
      <RequestListPage
        title={tx("Lembur")} subtitle={tx("Riwayat pengajuan lembur Anda.")} actionLabel={tx("Ajukan Lembur")} onAction={() => setShowForm(true)}
        kpis={[
          { label: tx("Lembur disetujui bulan ini"), value: fmtDur(approvedMin), tone: 'g' },
          { label: tx("Menunggu persetujuan"), value: pendingN, tone: pendingN ? 'w' : '' },
          { label: tx("Total pengajuan"), value: items.length },
        ]}
        filters={
          <>
            <SelectFilter label="Status" value={statusFilter} onChange={setStatusFilter} options={[['', tx("Semua status")], ['pending', tx("Menunggu")], ['approved', tx("Disetujui")], ['rejected', tx("Ditolak")]]} />
            <SearchFilter value={query} onChange={setQuery} placeholder={tx("Cari tanggal atau alasan...")} />
          </>
        }
        columns={[tx("Diajukan"), tx("Tanggal lembur"), tx("Jam"), tx("Durasi"), 'Status']}
        loading={loading} rows={filtered} total={items.length} empty={tx("Tidak ada pengajuan lembur yang cocok.")}
        renderRow={(it) => (
          <tr key={it.id} tabIndex={0} onClick={() => setDetailRow(it)} onKeyDown={(e) => { if (e.key === 'Enter') setDetailRow(it) }}>
            <td>{fmtStamp(it.created_at)}</td>
            <td><b>{fmtDate(it.work_date)}</b><small>{weekday(it.work_date)}</small></td>
            <td>{it.start_time?.slice(0, 5)} – {it.end_time?.slice(0, 5)}</td>
            <td>{fmtDur(dur(it))}</td>
            <td><StatusPill status={it.status} /></td>
            <RowChevron />
          </tr>
        )}
        drawer={detailRow && (
          <DetailDrawer title={tx("Detail pengajuan lembur")} status={detailRow.status} reason={detailRow.reason} onClose={() => setDetailRow(null)}
            items={[
              [tx("Tanggal lembur"), `${weekday(detailRow.work_date)}, ${fmtDate(detailRow.work_date)}`],
              [tx("Jam"), `${detailRow.start_time?.slice(0, 5)} – ${detailRow.end_time?.slice(0, 5)}`],
              [tx("Durasi"), fmtDur(dur(detailRow))],
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
        <h1>{tx("Lembur")}</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="tabs on-red" style={{ background: 'var(--red)', margin: 0, padding: '0 16px 10px' }}>
        <button className={tab === 'pengajuan' ? 'active' : ''} onClick={() => setTab('pengajuan')}>{tx("Pengajuan")}</button>
        <button className={tab === 'ditugaskan' ? 'active' : ''} onClick={() => setTab('ditugaskan')}>{tx("Ditugaskan")}</button>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {tab === 'pengajuan' && (
          loading ? <p style={{ color: '#a39c94' }}>{tx("Memuat...")}</p> :
          items.length === 0 ? (
            <div className="empty-state">
              <ScrollText size={40} color="#c8c1b9" />
              <h3>{tx("Belum ada pengajuan")}</h3>
              <p>{tx("Pengajuan lembur Anda akan tampil di sini.")}</p>
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
          <div className="empty-state"><h3>{tx("Belum ada tugas lembur")}</h3><p>{tx("Lembur yang ditugaskan kepada Anda akan tampil di sini.")}</p></div>
        )}
      </div>

      <button className="fab-bottom-btn" onClick={() => setShowForm(true)}>{tx("Ajukan Lembur")}</button>
    </div>
  )
}

function statusLabel(s) {
  return { pending: tx("Menunggu"), approved: tx("Disetujui"), rejected: tx("Ditolak") }[s] || s
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
    if (!date || !start || !end) { setError(tx("Lengkapi tanggal dan jam lembur")); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_overtime_request', {
      p_work_date: date, p_start_time: start, p_end_time: end, p_reason: reason,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast(tx("Pengajuan lembur terkirim"))
    onDone()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>{tx("Ajukan Lembur")}</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>{tx("Tanggal")}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>{tx("Jam mulai")}</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>{tx("Jam selesai")}</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
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
