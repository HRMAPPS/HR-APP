import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, ChevronLeft, ChevronRight, Paperclip, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import { openLeaveAttachment } from '../lib/leaveAttachment'

import { tx } from '../lib/i18n'
const MONTHS_LONG = [tx("Januari"), tx("Februari"), tx("Maret"), 'April', tx("Mei"), tx("Juni"), tx("Juli"), tx("Agustus"), 'September', tx("Oktober"), 'November', tx("Desember")]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', tx("Mei"), 'Jun', 'Jul', tx("Agu"), 'Sep', tx("Okt"), 'Nov', tx("Des")]
const STATUS_LABEL = { pending: tx("Menunggu"), approved: tx("Disetujui"), rejected: tx("Ditolak"), cancelled: tx("Dibatalkan"), accepted: 'Diterima' }
const TYPE_LABEL = { full_day: tx("Hari penuh"), half_day: tx("Setengah hari") }
const MAX_FILE = 5 * 1024 * 1024

const fmtDate = (s) => { if (!s) return '-'; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]} ${y}` }
const fmtStamp = (ts) => (ts ? fmtDate(new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })) : '-')
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1

// ---------------------------------------------------------------------
// Halaman Cuti versi desktop: ringkasan, 3 tab (Pengajuan Cuti / Delegasi / Cuti Diambil),
// filter + tabel, serta modal "Ajukan Cuti" dan "Ajukan Delegasi".
// ---------------------------------------------------------------------
export default function CutiDesktop({ employee, startNew, onToast }) {
  const [tab, setTab] = useState('request')
  const [items, setItems] = useState(null)
  const [delegs, setDelegs] = useState(null)
  const [modal, setModal] = useState(startNew ? 'leave' : null)
  const [detail, setDetail] = useState(null)
  const [f, setF] = useState({ status: '', month: '', year: '', size: 10, q: '' })
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })
  const [page, setPage] = useState(1)
  const today = todayStr()
  const thisYear = Number(today.slice(0, 4))

  async function loadItems() {
    if (!employee?.id) return
    const { data, error } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, total_days, reason, status, created_at, decided_at, request_type, attachment_path, attachment_name, leave_types(name), approver:employees!leave_requests_approver_id_fkey(full_name)')
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
    if (error) { onToast?.(tx("Gagal memuat cuti: ") + error.message); setItems([]); return }
    setItems(data || [])
  }
  async function loadDelegs() {
    const { data, error } = await supabase.rpc('get_my_delegations')
    if (error) { onToast?.(tx("Gagal memuat delegasi: ") + error.message); setDelegs([]); return }
    setDelegs(data || [])
  }
  const reload = () => { loadItems(); loadDelegs() }
  useEffect(() => { reload() }, [employee?.id])
  useEffect(() => { setPage(1) }, [tab, f, sort])

  // ---- ringkasan ----
  const summary = useMemo(() => {
    const list = items || []
    const approvedThisYear = list.filter((i) => i.status === 'approved' && i.start_date.startsWith(String(thisYear)))
    return {
      taken: approvedThisYear.filter((i) => i.start_date <= today).reduce((s, i) => s + Number(i.total_days), 0),
      upcoming: approvedThisYear.filter((i) => i.start_date > today).reduce((s, i) => s + Number(i.total_days), 0),
      pending: list.filter((i) => i.status === 'pending').length,
    }
  }, [items, today, thisYear])

  // ---- baris yang tampil ----
  const isDeleg = tab === 'delegation'
  const rows = useMemo(() => {
    const base = isDeleg ? delegs || [] : (items || []).filter((i) => tab !== 'taken' || (i.status === 'approved' && i.start_date <= today))
    const q = f.q.trim().toLowerCase()
    const out = base.filter((r) => {
      const start = r.start_date || ''
      if (f.status && r.status !== f.status) return false
      if (f.month !== '' && Number(start.slice(5, 7)) - 1 !== Number(f.month)) return false
      if (f.year && start.slice(0, 4) !== f.year) return false
      if (q) {
        const hay = isDeleg
          ? `${r.other_name} ${r.other_code || ''} ${r.notes || ''}`
          : `${tx(r.leave_types?.name) || ''} ${r.reason || ''} ${r.approver?.full_name || ''}`
        if (!hay.toLowerCase().includes(q)) return false
      }
      return true
    })
    const get = (r) => (sort.key === 'type' ? tx(r.leave_types?.name) || '' : r[sort.key] ?? '')
    out.sort((a, b) => (get(a) < get(b) ? -1 : get(a) > get(b) ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1))
    return out
  }, [items, delegs, tab, f, sort, today, isDeleg])

  const yearOptions = useMemo(() => {
    const ys = new Set([String(thisYear)])
    for (const r of [...(items || []), ...(delegs || [])]) if (r.start_date) ys.add(r.start_date.slice(0, 4))
    return [...ys].sort().reverse()
  }, [items, delegs, thisYear])

  const pages = Math.max(1, Math.ceil(rows.length / f.size))
  const cur = Math.min(page, pages)
  const shown = rows.slice((cur - 1) * f.size, cur * f.size)
  const from = rows.length ? (cur - 1) * f.size + 1 : 0
  const to = Math.min(cur * f.size, rows.length)
  const loading = isDeleg ? delegs === null : items === null

  const setFilter = (k) => (e) => setF((p) => ({ ...p, [k]: k === 'size' ? Number(e.target.value) : e.target.value }))
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const Th = ({ k, children }) => (
    <th className={k ? 'sortable' : ''} onClick={k ? () => toggleSort(k) : undefined}>
      {children}{k && <ArrowUpDown size={12} style={{ opacity: sort.key === k ? 1 : 0.35, marginLeft: 5 }} />}
    </th>
  )

  async function cancelLeave(r) {
    if (!confirm(tx("Batalkan pengajuan cuti ini?"))) return
    const { error } = await supabase.rpc('cancel_leave_request', { p_id: r.id })
    if (error) { onToast?.(error.message); return }
    onToast?.('Pengajuan cuti dibatalkan')
    reload()
  }
  async function respond(d, accept) {
    const { error } = await supabase.rpc('respond_delegation', { p_id: d.id, p_accept: accept })
    if (error) { onToast?.(error.message); return }
    onToast?.(accept ? tx("Delegasi diterima") : tx("Delegasi ditolak"))
    loadDelegs()
  }
  async function cancelDeleg(d) {
    if (!confirm(tx("Batalkan delegasi ini?"))) return
    const { error } = await supabase.rpc('cancel_delegation', { p_id: d.id })
    if (error) { onToast?.(error.message); return }
    onToast?.('Delegasi dibatalkan')
    loadDelegs()
  }
  const canCancel = (r) => r.status === 'pending' || (r.status === 'approved' && r.start_date > today)

  return (
    <div className="dcuti">
      <h1 className="dcuti-title">{tx("Informasi cuti Anda")}</h1>
      <p className="dcuti-sub">{tx("Ringkasan cuti Anda tahun")}{' '}{thisYear}</p>

      <div className="dcuti-stats">
        <div><b>{summary.taken}</b><span>{tx("hari sudah diambil")}</span></div>
        <div><b>{summary.upcoming}</b><span>{tx("hari akan datang")}</span></div>
        <div><b>{summary.pending}</b><span>{tx("pengajuan menunggu")}</span></div>
      </div>

      <div className="dcuti-btns">
        <button className="dcal-outline-btn" onClick={() => setModal('leave')}>{tx("AJUKAN CUTI")}</button>
        <button className="dcal-outline-btn" onClick={() => setModal('delegation')}>{tx("AJUKAN DELEGASI")}</button>
      </div>

      <div className="dcuti-tabs">
        {[['request', tx("PENGAJUAN CUTI")], ['delegation', 'DELEGASI'], ['taken', tx("CUTI DIAMBIL")]].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div className="dcuti-filters">
        <label>Status
          <select value={f.status} onChange={setFilter('status')}>
            <option value="">{tx("-- Semua Status --")}</option>
            {(isDeleg ? ['pending', 'accepted', 'rejected', 'cancelled'] : ['pending', 'approved', 'rejected', 'cancelled']).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label>{tx("Periode Bulan")}<select value={f.month} onChange={setFilter('month')}>
            <option value="">{tx("-- Semua --")}</option>
            {MONTHS_LONG.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </label>
        <label>{tx("Periode Tahun")}<select value={f.year} onChange={setFilter('year')}>
            <option value="">{tx("-- Semua --")}</option>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <label style={{ width: 90 }}>{tx("Tampilkan")}<select value={f.size} onChange={setFilter('size')}>{[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label style={{ width: 210 }}>{tx("Cari")}<div className="dcuti-search"><Search size={15} /><input value={f.q} onChange={setFilter('q')} /></div>
        </label>
      </div>

      <div className="dcuti-table-wrap">
        {isDeleg ? (
          <table className="dcuti-table">
            <thead><tr><Th k="created_at">{tx("Dibuat")}</Th><Th>{tx("Arah")}</Th><Th>{tx("Karyawan")}</Th><Th k="start_date">{tx("Mulai")}</Th><Th k="end_date">{tx("Selesai")}</Th><Th>{tx("Catatan")}</Th><Th k="status">Status</Th><Th>{tx("Aksi")}</Th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="empty">{tx("Memuat...")}</td></tr>
                : shown.length === 0 ? <tr><td colSpan={8} className="empty">{tx("Tidak ada data.")}</td></tr>
                : shown.map((d) => (
                  <tr key={d.id}>
                    <td>{fmtStamp(d.created_at)}</td>
                    <td>{d.direction === 'out' ? tx("Dari saya") : tx("Untuk saya")}</td>
                    <td>{d.other_code ? `${d.other_code} - ` : ''}{d.other_name}</td>
                    <td>{fmtDate(d.start_date)}</td>
                    <td>{fmtDate(d.end_date)}</td>
                    <td className="wrap">{d.notes || '-'}</td>
                    <td><span className={`status-${d.status === 'accepted' ? 'approved' : d.status}`}>{STATUS_LABEL[d.status] || d.status}</span></td>
                    <td className="acts">
                      {d.direction === 'in' && d.status === 'pending' && (<><button onClick={() => respond(d, true)}>{tx("Terima")}</button><button className="muted" onClick={() => respond(d, false)}>{tx("Tolak")}</button></>)}
                      {d.direction === 'out' && ['pending', 'accepted'].includes(d.status) && <button className="muted" onClick={() => cancelDeleg(d)}>{tx("Batalkan")}</button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <table className="dcuti-table">
            <thead><tr><Th k="created_at">{tx("Dibuat")}</Th><Th k="type">{tx("Jenis Cuti")}</Th><Th k="start_date">{tx("Mulai")}</Th><Th k="end_date">{tx("Selesai")}</Th><Th k="total_days">{tx("Hari")}</Th><Th>{tx("Tipe")}</Th><Th>{tx("Catatan")}</Th><Th k="status">Status</Th><Th>{tx("Persetujuan")}</Th><Th>{tx("Lampiran")}</Th><Th>{tx("Aksi")}</Th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={11} className="empty">{tx("Memuat...")}</td></tr>
                : shown.length === 0 ? <tr><td colSpan={11} className="empty">{tx("Tidak ada data.")}</td></tr>
                : shown.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtStamp(r.created_at)}</td>
                    <td>{tx(r.leave_types?.name) || tx("Cuti")}</td>
                    <td>{fmtDate(r.start_date)}</td>
                    <td>{fmtDate(r.end_date)}</td>
                    <td>{Number(r.total_days)}{' '}{tx("hari")}</td>
                    <td>{TYPE_LABEL[r.request_type] || '-'}</td>
                    <td className="wrap">{r.reason || '-'}</td>
                    <td><span className={`status-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                    <td>{r.approver?.full_name || '-'}</td>
                    <td>{r.attachment_path ? <button className="link" onClick={() => openLeaveAttachment(r.attachment_path, onToast)}><Paperclip size={13} />{' '}{tx("Lihat")}</button> : '-'}</td>
                    <td className="acts">
                      <button onClick={() => setDetail(r)}>Detail</button>
                      {tab === 'request' && canCancel(r) && <button className="muted" onClick={() => cancelLeave(r)}>{tx("Batalkan")}</button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dcuti-foot">
        <em>{tx("Menampilkan")}{' '}{from}{' '}{tx("sampai")}{' '}{to}{' '}{tx("dari")}{' '}{rows.length}{' '}{tx("data")}</em>
        <div className="pager">
          <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label={tx("Sebelumnya")}><ChevronLeft size={18} /></button>
          <span>{cur} / {pages}</span>
          <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label={tx("Berikutnya")}><ChevronRight size={18} /></button>
        </div>
      </div>

      {modal === 'leave' && <LeaveModal employee={employee} onClose={() => setModal(null)} onDone={() => { setModal(null); onToast?.('Pengajuan cuti terkirim'); reload() }} />}
      {modal === 'delegation' && <DelegationModal employee={employee} onClose={() => setModal(null)} onDone={() => { setModal(null); onToast?.('Permintaan delegasi terkirim'); setTab('delegation'); loadDelegs() }} />}
      {detail && <DetailModal row={detail} deleg={(delegs || []).find((d) => d.request_id === detail.id)} onClose={() => setDetail(null)} onToast={onToast} />}
    </div>
  )
}

// ---------------------------------------------------------------------
function Modal({ title, onClose, dirty, children, footer, narrow }) {
  // Klik latar menutup (dan tombol back HP/peramban lewat .modal-overlay), tapi minta konfirmasi bila form sudah diisi.
  const guard = () => { if (!dirty || confirm(tx("Batalkan pengisian formulir?"))) onClose() }
  return (
    <div className="modal-overlay dcuti-overlay" onClick={guard}>
      <div className={`dcuti-modal ${narrow ? 'narrow' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="dcuti-modal-body">
          <h2>{title}</h2>
          {children}
        </div>
        <div className="dcuti-modal-foot">{footer(guard)}</div>
      </div>
    </div>
  )
}

function useEmployees(employee) {
  const [list, setList] = useState([])
  useEffect(() => {
    supabase.from('employees').select('id, employee_code, full_name, employment_status').order('full_name')
      .then(({ data }) => setList((data || []).filter((e) => e.id !== employee?.id && (e.employment_status || 'active') === 'active')))
  }, [employee?.id])
  return list
}

function LeaveModal({ employee, onClose, onDone }) {
  const [types, setTypes] = useState([])
  const people = useEmployees(employee)
  const [typeId, setTypeId] = useState('')
  const [reqType, setReqType] = useState('full_day')
  const [start, setStart] = useState(todayStr())
  const [end, setEnd] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [useDelegate, setUseDelegate] = useState(false)
  const [delegateTo, setDelegateTo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { supabase.from('leave_types').select('id, name').order('name').then(({ data }) => setTypes(data || [])) }, [])
  const half = reqType === 'half_day'
  const effEnd = half ? start : end
  const days = start && effEnd && effEnd >= start ? (half ? 0.5 : daysBetween(start, effEnd)) : null
  const dirty = !!(typeId || notes || file || useDelegate)

  function pickFile(e) {
    const fl = e.target.files?.[0]
    if (!fl) return
    if (fl.size > MAX_FILE) { setError(tx("Ukuran lampiran maksimal 5 MB")); e.target.value = ''; return }
    setError(''); setFile(fl)
  }

  async function submit() {
    setError('')
    if (!typeId) { setError(tx("Pilih jenis cuti")); return }
    if (!start || !effEnd) { setError(tx("Lengkapi tanggal mulai dan selesai")); return }
    if (effEnd < start) { setError(tx("Tanggal selesai tidak boleh sebelum tanggal mulai")); return }
    if (useDelegate && !delegateTo) { setError(tx("Pilih karyawan untuk delegasi")); return }
    setBusy(true)
    let path = null
    if (file) {
      const { data: u } = await supabase.auth.getUser()
      path = `${u?.user?.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('leave-attachments').upload(path, file)
      if (upErr) { setBusy(false); setError(tx("Gagal unggah lampiran: ") + upErr.message); return }
    }
    const { error: err } = await supabase.rpc('submit_leave_request', {
      p_leave_type_id: typeId, p_start_date: start, p_end_date: effEnd, p_reason: notes,
      p_request_type: reqType, p_attachment_path: path, p_attachment_name: file?.name || null,
      p_delegate_to: useDelegate ? delegateTo : null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDone()
  }

  return (
    <Modal title={tx("Ajukan Cuti")} onClose={onClose} dirty={dirty} footer={(close) => (
      <>
        <button className="dcal-outline-btn" disabled={busy} onClick={submit}>{busy ? tx("MENGIRIM...") : tx("AJUKAN CUTI")}</button>
        <button className="dcal-outline-btn" onClick={close}>{tx("BATAL")}</button>
      </>
    )}>
      <div className="dcuti-form">
        <div className="col">
          <label className="fld">{tx("Jenis Cuti")}<select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">{tx("--Pilih--")}</option>
              {types.map((t) => <option key={t.id} value={t.id}>{tx(t.name)}</option>)}
            </select>
          </label>
          <label className="fld">{tx("Tipe Pengajuan")}<select value={reqType} onChange={(e) => setReqType(e.target.value)}>
              <option value="full_day">{tx("Hari Penuh")}</option>
              <option value="half_day">{tx("Setengah Hari")}</option>
            </select>
          </label>
          <div className="two">
            <label className="fld">{tx("Tanggal Mulai")}<input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value) }} />
            </label>
            <label className="fld">{tx("Tanggal Selesai")}<input type="date" min={start} value={effEnd} disabled={half} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          {days !== null && <p className="hint">Total: <b>{days}{' '}{tx("hari")}</b></p>}
        </div>

        <div className="col">
          <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={pickFile} />
          <div className="attach">
            <button type="button" className="dcal-outline-btn" onClick={() => fileRef.current?.click()}>{tx("LAMPIRKAN FILE")}</button>
            {file && (
              <span className="chip"><Paperclip size={13} /> {file.name}
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}><X size={13} /></button>
              </span>
            )}
          </div>
          <label className="chk"><input type="checkbox" checked={useDelegate} onChange={(e) => setUseDelegate(e.target.checked)} />{' '}{tx("Delegasikan ke")}</label>
          {useDelegate && (
            <select className="under" value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)}>
              <option value="">{tx("Pilih karyawan...")}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.employee_code ? `${p.employee_code} - ` : ''}{p.full_name}</option>)}
            </select>
          )}
          <label className="fld">{tx("Catatan")}<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
      </div>
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
    </Modal>
  )
}

function DelegationModal({ employee, onClose, onDone }) {
  const people = useEmployees(employee)
  const [to, setTo] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = !!(to || start || end || notes)

  async function submit() {
    setError('')
    if (!to) { setError(tx("Pilih karyawan tujuan delegasi")); return }
    if (!start || !end) { setError(tx("Lengkapi tanggal mulai dan selesai")); return }
    if (end < start) { setError(tx("Tanggal selesai tidak boleh sebelum tanggal mulai")); return }
    setBusy(true)
    const { error: err } = await supabase.rpc('request_delegation', { p_to: to, p_start: start, p_end: end, p_notes: notes })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDone()
  }

  return (
    <Modal title={tx("Ajukan Delegasi")} onClose={onClose} dirty={dirty} narrow footer={(close) => (
      <>
        <button className="dcal-outline-btn" disabled={busy} onClick={submit}>{busy ? tx("MENGIRIM...") : tx("AJUKAN")}</button>
        <button className="dcal-outline-btn" onClick={close}>{tx("TUTUP")}</button>
      </>
    )}>
      <div className="dcuti-rows">
        <div><span>{tx("DELEGASI DARI")}</span><b>{employee?.employee_code ? `${employee.employee_code} - ` : ''}{employee?.full_name}</b></div>
        <div><span>{tx("DELEGASI KE")}</span>
          <select className="under" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{tx("Pilih karyawan...")}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.employee_code ? `${p.employee_code} - ` : ''}{p.full_name}</option>)}
          </select>
        </div>
        <div><span>{tx("TANGGAL MULAI")}</span><input className="under" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end && end < e.target.value) setEnd(e.target.value) }} /></div>
        <div><span>{tx("TANGGAL SELESAI")}</span><input className="under" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div><span>{tx("CATATAN")}</span><textarea className="under" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
    </Modal>
  )
}

function DetailModal({ row, deleg, onClose, onToast }) {
  const line = (label, value) => (
    <div className="dl"><span>{label}</span><div>{value}</div></div>
  )
  return (
    <Modal title={tx("Detail Pengajuan Cuti")} onClose={onClose} narrow footer={(close) => <button className="dcal-outline-btn" onClick={close}>{tx("TUTUP")}</button>}>
      <div className="dcuti-detail">
        {line('Jenis cuti', tx(row.leave_types?.name) || tx("Cuti"))}
        {line('Tipe', TYPE_LABEL[row.request_type] || '-')}
        {line('Tanggal', tx("{0}{1} ({2} hari)", [fmtDate(row.start_date), row.end_date !== row.start_date ? ' – ' + fmtDate(row.end_date) : '', Number(row.total_days)]))}
        {line('Status', <span className={`status-${row.status}`}>{STATUS_LABEL[row.status] || row.status}</span>)}
        {line('Diajukan', fmtStamp(row.created_at))}
        {row.approver?.full_name && line('Diputuskan oleh', `${row.approver.full_name}${row.decided_at ? ' · ' + fmtStamp(row.decided_at) : ''}`)}
        {deleg && line('Delegasi ke', `${deleg.other_name} (${STATUS_LABEL[deleg.status] || deleg.status})`)}
        {line('Catatan', row.reason || '-')}
        {row.attachment_path && line('Lampiran', <button className="link" onClick={() => openLeaveAttachment(row.attachment_path, onToast)}><Paperclip size={13} /> {row.attachment_name || tx("Buka lampiran")}</button>)}
      </div>
    </Modal>
  )
}
