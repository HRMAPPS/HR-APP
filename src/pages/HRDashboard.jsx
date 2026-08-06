import { useEffect, useState } from 'react'
import { ArrowLeft, Search, Check, X, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const TABS = [
  { key: 'attendance', label: 'Absensi' },
  { key: 'overtime', label: 'Lembur' },
  { key: 'payslip', label: 'Slip Gaji' },
]

export default function HRDashboard({ onBack, onToast }) {
  const [tab, setTab] = useState('attendance')
  const [employees, setEmployees] = useState([])

  useEffect(() => {
    supabase.rpc('get_hr_employees').then(({ data, error }) => {
      if (error) { onToast(error.message); return }
      setEmployees(data || [])
    })
  }, [])

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>HR Dashboard</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'attendance' && <AttendanceTab onToast={onToast} />}
      {tab === 'overtime' && <OvertimeTab onToast={onToast} />}
      {tab === 'payslip' && <PayslipTab employees={employees} onToast={onToast} />}
    </div>
  )
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function rupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID')
}

// ---------------------------------------------------------------------
// Absensi — semua karyawan, filter tanggal + cari nama
// ---------------------------------------------------------------------
function AttendanceTab({ onToast }) {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'
  const [start, setStart] = useState(firstOfMonth)
  const [end, setEnd] = useState(today)
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')

  async function load() {
    const { data, error } = await supabase.rpc('get_hr_attendance', { p_start: start, p_end: end })
    if (error) { onToast(error.message); return }
    setRows(data)
  }
  useEffect(() => { load() }, [start, end])

  const filtered = (rows || []).filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="form-page">
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div className="field" style={{ flex: 1, margin: 0 }}>
          <label>Dari</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, margin: 0 }}>
          <label>Sampai</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="search-box" style={{ margin: '0 0 14px' }}>
        <Search size={16} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama karyawan..."
          style={{ border: 'none', outline: 'none', background: 'none', flex: 1, fontSize: 14.5 }} />
      </div>

      {rows === null ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>Tidak ada data absensi pada rentang ini.</p></div>
      ) : (
        filtered.map((r) => (
          <div key={r.id} className="list-item">
            <div className="info">
              <div className="name">{r.full_name}</div>
              <div className="sub">{fmtDate(r.work_date)} · masuk {fmtTime(r.clock_in)} · keluar {fmtTime(r.clock_out)}</div>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 8,
              background: r.status === 'late' ? '#FBE1DD' : '#E1F3EA',
              color: r.status === 'late' ? '#C0392B' : '#1E8E5A',
            }}>
              {r.status === 'late' ? 'Telat' : 'Tepat waktu'}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Lembur — lihat semua pengajuan lembur, approve/reject
// ---------------------------------------------------------------------
function OvertimeTab({ onToast }) {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState(null)

  async function load() {
    const { data, error } = await supabase.rpc('get_hr_overtime', { p_status: status || null })
    if (error) { onToast(error.message); return }
    setRows(data)
  }
  useEffect(() => { load() }, [status])

  async function decide(id, approve) {
    const { error } = await supabase.rpc('decide_request', { p_table: 'overtime_requests', p_request_id: id, p_approve: approve })
    if (error) { onToast(error.message); return }
    onToast(approve ? 'Lembur disetujui' : 'Lembur ditolak')
    load()
  }

  return (
    <div className="form-page">
      <div className="tabs" style={{ padding: 0, marginBottom: 14 }}>
        {[['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak'], ['', 'Semua']].map(([v, l]) => (
          <button key={v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>

      {rows === null ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><p>Tidak ada pengajuan lembur.</p></div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="shift-hist-row">
            <div className="top">
              <div>
                <div className="date">{r.full_name}</div>
                <div className="desc">{fmtDate(r.work_date)} · {r.start_time?.slice(0, 5)} - {r.end_time?.slice(0, 5)}</div>
                {r.reason && <div className="desc">{r.reason}</div>}
              </div>
              {r.status === 'pending' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => decide(r.id, true)} style={{ background: '#1E8E5A', border: 'none', borderRadius: 8, color: '#fff', padding: 6, cursor: 'pointer' }}><Check size={16} /></button>
                  <button onClick={() => decide(r.id, false)} style={{ background: '#C0392B', border: 'none', borderRadius: 8, color: '#fff', padding: 6, cursor: 'pointer' }}><X size={16} /></button>
                </div>
              ) : (
                <span className={r.status === 'approved' ? 'status-approved' : 'status-rejected'}>
                  {r.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Slip Gaji — input & kelola slip gaji karyawan
// ---------------------------------------------------------------------
function PayslipTab({ employees, onToast }) {
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null) // null closed, {} new, {...} edit

  async function load() {
    const { data, error } = await supabase.rpc('get_hr_payslips', {})
    if (error) { onToast(error.message); return }
    setRows(data)
  }
  useEffect(() => { load() }, [])

  async function remove(id) {
    const { error } = await supabase.rpc('delete_payslip_hr', { p_id: id })
    if (error) { onToast(error.message); return }
    onToast('Slip gaji dihapus')
    load()
  }

  return (
    <div className="form-page">
      <button
        className="primary-btn"
        style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={() => setEditing({})}
      >
        <Plus size={18} /> Input slip gaji
      </button>

      {rows === null ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><p>Belum ada slip gaji yang diinput.</p></div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="list-item">
            <div className="info">
              <div className="name">{r.full_name}</div>
              <div className="sub">{new Date(r.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} · {rupiah(r.net_salary)}</div>
            </div>
            <div className="actions">
              <button onClick={() => setEditing(r)}><Pencil size={17} /></button>
              <button onClick={() => remove(r.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))
      )}

      {editing !== null && (
        <PayslipForm
          row={editing}
          employees={employees}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onToast('Slip gaji disimpan') }}
        />
      )}
    </div>
  )
}

function PayslipForm({ row, employees, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee_id: row.employee_id || '', period: row.period ? row.period.slice(0, 7) : new Date().toISOString().slice(0, 7),
    basic_salary: row.basic_salary || '', allowances: row.allowances || '', deductions: row.deductions || '', notes: row.notes || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!row.id && !form.employee_id) { setError('Pilih karyawan terlebih dahulu'); return }
    setSaving(true)
    const { error } = await supabase.rpc('upsert_payslip_hr', {
      p_id: row.id || null,
      p_employee_id: form.employee_id || row.employee_id,
      p_period: form.period + '-01',
      p_basic_salary: Number(form.basic_salary) || 0,
      p_allowances: Number(form.allowances) || 0,
      p_deductions: Number(form.deductions) || 0,
      p_notes: form.notes || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.id ? 'Edit Slip Gaji' : 'Input Slip Gaji'}</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Karyawan</label>
            <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} disabled={!!row.id}>
              <option value="">- Pilih karyawan -</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
            </select>
          </div>
          <div className="field"><label>Periode (bulan)</label><input type="month" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} /></div>
          <div className="field"><label>Gaji pokok</label><input type="number" value={form.basic_salary} onChange={(e) => setForm((f) => ({ ...f, basic_salary: e.target.value }))} /></div>
          <div className="field"><label>Tunjangan</label><input type="number" value={form.allowances} onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))} /></div>
          <div className="field"><label>Potongan</label><input type="number" value={form.deductions} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} /></div>
          <div className="field"><label>Catatan</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </form>
      </div>
    </div>
  )
}
