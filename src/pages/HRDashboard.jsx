import { useEffect, useState } from 'react'
import { ArrowLeft, Search, Check, X, Plus, Pencil, Trash2, Download, Upload, Users, ClipboardList, Wallet, CalendarDays, AlarmClock, Receipt, Bell, FileDown } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const TABS = [
  { key: 'overview', label: 'Ringkasan', icon: Users },
  { key: 'karyawan', label: 'Karyawan', icon: Users },
  { key: 'attendance', label: 'Absensi', icon: ClipboardList },
  { key: 'leave', label: 'Cuti', icon: CalendarDays },
  { key: 'overtime', label: 'Lembur', icon: AlarmClock },
  { key: 'reimbursement', label: 'Reimburse', icon: Receipt },
  { key: 'payslip', label: 'Slip Gaji', icon: Wallet },
]

export default function HRDashboard({ onBack, onToast }) {
  const [tab, setTab] = useState('overview')
  const [employees, setEmployees] = useState([])

  async function loadEmployees() {
    const { data, error } = await supabase.rpc('get_hr_employees')
    if (error) { onToast(error.message); return }
    setEmployees(data || [])
  }
  useEffect(() => { loadEmployees() }, [])

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>HR Dashboard</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="tabs" style={{ overflowX: 'auto', whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab onToast={onToast} onGo={setTab} />}
      {tab === 'karyawan' && <KaryawanTab employees={employees} onReload={loadEmployees} onToast={onToast} />}
      {tab === 'attendance' && <AttendanceTab onToast={onToast} />}
      {tab === 'leave' && <LeaveTab onToast={onToast} />}
      {tab === 'overtime' && <OvertimeTab onToast={onToast} />}
      {tab === 'reimbursement' && <ReimbursementTab onToast={onToast} />}
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

// Generic Excel export — columns: [[label, key-or-fn], ...]
async function exportToExcel(filename, sheetName, rows, columns) {
  const XLSX = await import('xlsx')
  const data = rows.map((r) => {
    const obj = {}
    columns.forEach(([label, fn]) => { obj[label] = typeof fn === 'function' ? fn(r) : r[fn] })
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

function ExportButton({ onClick, label = 'Export Excel' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--border)',
        borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
        boxShadow: 'var(--shadow-xs)', marginBottom: 14,
      }}
    >
      <FileDown size={15} /> {label}
    </button>
  )
}

// ---------------------------------------------------------------------
// Ringkasan — angka penting untuk HR
// ---------------------------------------------------------------------
function OverviewTab({ onToast, onGo }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    supabase.rpc('get_hr_overview').then(({ data, error }) => {
      if (error) { onToast(error.message); return }
      setStats(data)
    })
  }, [])

  if (!stats) return <div className="empty-state"><p>Memuat...</p></div>

  const cards = [
    { label: 'Total Karyawan Aktif', value: stats.total_employees, go: 'karyawan' },
    { label: 'Hadir Hari Ini', value: stats.present_today, go: 'attendance' },
    { label: 'Cuti Menunggu', value: stats.pending_leave, go: 'leave' },
    { label: 'Lembur Menunggu', value: stats.pending_overtime, go: 'overtime' },
    { label: 'Reimburse Menunggu', value: stats.pending_reimbursement, go: 'reimbursement' },
  ]

  return (
    <div className="form-page">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {cards.map((c) => (
          <button key={c.label} onClick={() => onGo(c.go)} style={{
            textAlign: 'left', background: '#fff', border: 'none', borderRadius: 14, padding: 16,
            boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
          }}>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{c.value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{c.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Karyawan — kelola roster (tambah, edit, nonaktifkan, ubah role)
// ---------------------------------------------------------------------
function KaryawanTab({ employees, onReload, onToast }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // null closed, {} new, {...} edit

  const filtered = employees.filter((e) =>
    e.full_name.toLowerCase().includes(query.toLowerCase()) || (e.employee_code || '').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="form-page">
      <div className="search-box" style={{ margin: '0 0 14px' }}>
        <Search size={16} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama / kode karyawan..."
          style={{ border: 'none', outline: 'none', background: 'none', flex: 1, fontSize: 14.5 }} />
      </div>

      <button className="primary-btn" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setEditing({})}>
        <Plus size={18} /> Tambah karyawan
      </button>

      <ExportButton onClick={() => exportToExcel('data-karyawan.xlsx', 'Karyawan', filtered, [
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Jabatan', 'position'], ['Departemen', 'department'],
        ['Role', 'role'], ['Status', (r) => r.employment_status || 'active'], ['No HP', 'phone'], ['Email', 'email'],
      ])} />

      {filtered.map((e) => (
        <div key={e.id} className="list-item">
          <div className="info">
            <div className="name">{e.full_name} {e.role !== 'employee' && <span style={{ fontSize: 11, background: '#FBE8D6', color: '#B4650C', padding: '2px 7px', borderRadius: 6, marginLeft: 6 }}>{e.role?.toUpperCase()}</span>}</div>
            <div className="sub">{e.employee_code} · {e.position || '-'}{e.employment_status === 'inactive' ? ' · Nonaktif' : ''}</div>
          </div>
          <div className="actions">
            <button onClick={() => setEditing(e)}><Pencil size={17} /></button>
          </div>
        </div>
      ))}

      {editing !== null && (
        <EmployeeForm
          row={editing}
          employees={employees}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); onReload(); onToast(msg) }}
        />
      )}
    </div>
  )
}

function EmployeeForm({ row, employees, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee_code: row.employee_code || '', full_name: row.full_name || '', position: row.position || '',
    department: row.department || '', manager_id: row.manager_id || '', phone: row.phone || '', email: row.email || '',
    role: row.role || 'employee', employment_status: row.employment_status || 'active',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const managerOptions = employees.filter((e) => e.id !== row.id)

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.full_name.trim() || (!row.id && !form.employee_code.trim())) { setError('Nama dan kode karyawan wajib diisi'); return }
    setSaving(true)
    let res
    if (row.id) {
      res = await supabase.rpc('update_employee_hr', {
        p_id: row.id, p_full_name: form.full_name, p_position: form.position || null, p_department: form.department || null,
        p_manager_id: form.manager_id || null, p_employment_status: form.employment_status,
        p_phone: form.phone || null, p_email: form.email || null, p_role: form.role,
      })
    } else {
      res = await supabase.rpc('create_employee_hr', {
        p_employee_code: form.employee_code, p_full_name: form.full_name, p_position: form.position || null,
        p_department: form.department || null, p_manager_id: form.manager_id || null,
        p_phone: form.phone || null, p_email: form.email || null, p_role: form.role,
      })
    }
    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    onSaved(row.id ? 'Data karyawan diperbarui' : 'Karyawan ditambahkan')
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.id ? 'Edit Karyawan' : 'Tambah Karyawan'}</h3></div>
        <form onSubmit={submit}>
          <div className="field"><label>Kode karyawan</label><input value={form.employee_code} onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))} disabled={!!row.id} /></div>
          <div className="field"><label>Nama lengkap</label><input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
          <div className="field"><label>Jabatan</label><input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} /></div>
          <div className="field"><label>Departemen (teks)</label><input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} /></div>
          <div className="field">
            <label>Atasan langsung</label>
            <select value={form.manager_id} onChange={(e) => setForm((f) => ({ ...f, manager_id: e.target.value }))}>
              <option value="">- Tidak ada -</option>
              {managerOptions.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div className="field"><label>No. HP</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
          <div className="field"><label>Email</label><input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div className="field">
            <label>Role akses</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="employee">Employee</option>
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {row.id && (
            <div className="field">
              <label>Status</label>
              <select value={form.employment_status} onChange={(e) => setForm((f) => ({ ...f, employment_status: e.target.value }))}>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </form>
      </div>
    </div>
  )
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

      <ExportButton onClick={() => exportToExcel(`absensi-${start}_${end}.xlsx`, 'Absensi', filtered, [
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Tanggal', (r) => fmtDate(r.work_date)],
        ['Jam Masuk', (r) => fmtTime(r.clock_in)], ['Jam Keluar', (r) => fmtTime(r.clock_out)],
        ['Status', (r) => (r.status === 'late' ? 'Telat' : 'Tepat waktu')],
      ])} />

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
// Generic approval list (dipakai untuk Cuti, Lembur, Reimburse)
// ---------------------------------------------------------------------
function ApprovalTab({ onToast, rpcName, table, statusOptions, renderRow, exportColumns, exportFilename }) {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState(null)

  async function load() {
    const { data, error } = await supabase.rpc(rpcName, { p_status: status || null })
    if (error) { onToast(error.message); return }
    setRows(data)
  }
  useEffect(() => { load() }, [status])

  async function decide(id, approve) {
    const { error } = await supabase.rpc('decide_request', { p_table: table, p_request_id: id, p_approve: approve })
    if (error) { onToast(error.message); return }
    onToast(approve ? 'Disetujui' : 'Ditolak')
    load()
  }

  return (
    <div className="form-page">
      <div className="tabs" style={{ padding: 0, marginBottom: 14 }}>
        {statusOptions.map(([v, l]) => (
          <button key={v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>

      {rows && rows.length > 0 && (
        <ExportButton onClick={() => exportToExcel(`${exportFilename}-${status || 'semua'}.xlsx`, 'Data', rows, exportColumns)} />
      )}

      {rows === null ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><p>Tidak ada pengajuan.</p></div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="shift-hist-row">
            <div className="top">
              {renderRow(r)}
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

const STATUS_OPTS = [['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak'], ['', 'Semua']]

function LeaveTab({ onToast }) {
  return (
    <ApprovalTab
      onToast={onToast} rpcName="get_hr_leave" table="leave_requests" statusOptions={STATUS_OPTS}
      exportFilename="cuti" exportColumns={[
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Jenis Cuti', 'leave_type_name'],
        ['Mulai', (r) => fmtDate(r.start_date)], ['Selesai', (r) => fmtDate(r.end_date)], ['Total Hari', 'total_days'],
        ['Alasan', 'reason'], ['Status', 'status'],
      ]}
      renderRow={(r) => (
        <div>
          <div className="date">{r.full_name}</div>
          <div className="desc">{r.leave_type_name || 'Cuti'} · {fmtDate(r.start_date)} - {fmtDate(r.end_date)} ({r.total_days} hari)</div>
          {r.reason && <div className="desc">{r.reason}</div>}
        </div>
      )}
    />
  )
}

function OvertimeTab({ onToast }) {
  return (
    <ApprovalTab
      onToast={onToast} rpcName="get_hr_overtime" table="overtime_requests" statusOptions={STATUS_OPTS}
      exportFilename="lembur" exportColumns={[
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Tanggal', (r) => fmtDate(r.work_date)],
        ['Jam Mulai', (r) => r.start_time?.slice(0, 5)], ['Jam Selesai', (r) => r.end_time?.slice(0, 5)],
        ['Alasan', 'reason'], ['Status', 'status'],
      ]}
      renderRow={(r) => (
        <div>
          <div className="date">{r.full_name}</div>
          <div className="desc">{fmtDate(r.work_date)} · {r.start_time?.slice(0, 5)} - {r.end_time?.slice(0, 5)}</div>
          {r.reason && <div className="desc">{r.reason}</div>}
        </div>
      )}
    />
  )
}

function ReimbursementTab({ onToast }) {
  return (
    <ApprovalTab
      onToast={onToast} rpcName="get_hr_reimbursement" table="reimbursement_requests" statusOptions={STATUS_OPTS}
      exportFilename="reimbursement" exportColumns={[
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Kategori', 'category_name'],
        ['Jumlah', 'amount'], ['Deskripsi', 'description'], ['Bulan', 'submitted_month'], ['Status', 'status'],
      ]}
      renderRow={(r) => (
        <div>
          <div className="date">{r.full_name}</div>
          <div className="desc">{r.category_name || 'Reimburse'} · {rupiah(r.amount)}</div>
          {r.description && <div className="desc">{r.description}</div>}
        </div>
      )}
    />
  )
}

// ---------------------------------------------------------------------
// Slip Gaji — input manual, atau import massal dari template Excel
// ---------------------------------------------------------------------
const PENDAPATAN_FIELDS = [
  ['Tunjangan Jabatan', 'tunjangan_jabatan'],
  ['Tunjangan Kinerja', 'tunjangan_kinerja'],
  ['Tunjangan Fullshift', 'tunjangan_fullshift'],
  ['Business Trip Allowance', 'business_trip_allowance'],
  ['Lembur', 'lembur'],
  ['Insentif Penjualan', 'insentif_penjualan'],
  ['Insentif Event', 'insentif_event'],
  ['Lain-Lain (Pendapatan)', 'lain_lain'],
  ['Medical Claim', 'medical_claim'],
  ['Subsidi BPJS Kesehatan', 'subsidi_bpjs_kesehatan'],
]
const POTONGAN_FIELDS = [
  ['Unpaid Leave', 'unpaid_leave'],
  ['Hutang Karyawan', 'hutang_karyawan'],
  ['Cicilan Seragam', 'cicilan_seragam'],
  ['Potongan Stock Opname', 'potongan_stock_opname'],
  ['Potongan Lain-Lain', 'potongan_lain_lain'],
  ['BPJS Kesehatan Karyawan', 'bpjs_kesehatan_karyawan'],
  ['JHT Karyawan', 'jht_karyawan'],
  ['JP Karyawan', 'jp_karyawan'],
  ['PPH 21', 'pph21'],
]

const TEMPLATE_COLUMNS = [
  'Kode Karyawan', 'Nama (referensi saja)', 'Periode (YYYY-MM)', 'PTKP', 'Badan Usaha',
  'Gaji Pokok', ...PENDAPATAN_FIELDS.map(([label]) => label), ...POTONGAN_FIELDS.map(([label]) => label), 'Catatan',
]

async function downloadTemplate(employees) {
  const XLSX = await import('xlsx')
  const base = { 'Periode (YYYY-MM)': new Date().toISOString().slice(0, 7), 'PTKP': 'TK/0', 'Badan Usaha': 'CV Napocut', 'Gaji Pokok': 5000000 }
  PENDAPATAN_FIELDS.forEach(([label]) => { base[label] = 0 })
  POTONGAN_FIELDS.forEach(([label]) => { base[label] = 0 })
  const rows = employees.slice(0, 5).map((e) => ({
    'Kode Karyawan': e.employee_code, 'Nama (referensi saja)': e.full_name, ...base, 'Catatan': '',
  }))
  if (rows.length === 0) rows.push(Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c, ''])))

  const wsData = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_COLUMNS })
  const wsRef = XLSX.utils.aoa_to_sheet([
    ['Kode Karyawan', 'Nama'],
    ...employees.map((e) => [e.employee_code, e.full_name]),
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsData, 'Slip Gaji')
  XLSX.utils.book_append_sheet(wb, wsRef, 'Daftar Kode Karyawan')
  XLSX.writeFile(wb, 'template-slip-gaji.xlsx')
}

function parseTemplateRows(rawRows) {
  return rawRows.map((r) => {
    const components = {}
    let allowances = 0, deductions = 0
    PENDAPATAN_FIELDS.forEach(([label, key]) => { const v = Number(r[label] || 0); components[key] = v; allowances += v })
    POTONGAN_FIELDS.forEach(([label, key]) => { const v = Number(r[label] || 0); components[key] = v; deductions += v })
    const period = String(r['Periode (YYYY-MM)'] || '').trim()
    return {
      employee_code: String(r['Kode Karyawan'] || '').trim(),
      period: period ? `${period}-01` : null,
      basic_salary: Number(r['Gaji Pokok'] || 0),
      allowances, deductions,
      notes: r['Catatan'] || null,
      ptkp_status: r['PTKP'] || null,
      business_entity: r['Badan Usaha'] || null,
      components,
    }
  }).filter((r) => r.employee_code && r.period)
}

function PayslipTab({ employees, onToast }) {
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null) // null closed, {} new, {...} edit
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

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

  async function resend(row) {
    const { error } = await supabase.rpc('notify_payslip', { p_employee_id: row.employee_id, p_period: row.period })
    if (error) { onToast(error.message); return }
    onToast(`Notifikasi dikirim ke ${row.full_name}`)
  }

  async function handleImportFile(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json(ws)
      const parsed = parseTemplateRows(rawRows)
      if (parsed.length === 0) {
        onToast('Tidak ada baris valid di file ini (cek kolom Kode Karyawan & Periode)')
        setImporting(false)
        return
      }
      const { data, error } = await supabase.rpc('bulk_upsert_payslips', { p_rows: parsed })
      if (error) { onToast(error.message); setImporting(false); return }
      setImportResult(data)
      onToast(`${data.ok.length} slip gaji berhasil diimpor${data.failed.length ? `, ${data.failed.length} gagal` : ''}`)
      load()
    } catch (err) {
      onToast('Gagal membaca file: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="form-page">
      <div style={{ background: '#eef1fb', color: '#4356C4', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
        Download template Excel, isi rincian gaji &amp; tunjangan per karyawan, lalu unggah lagi di sini untuk input massal.
        Setiap kali slip gaji disimpan/diimpor, karyawan otomatis dapat notifikasi di app (ikon 🔔 untuk kirim ulang).
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <button className="primary-btn" style={{ flex: 1, background: '#eee', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => downloadTemplate(employees)}>
          <Download size={17} /> Template Excel
        </button>
        <label className="primary-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
          <Upload size={17} /> {importing ? 'Mengimpor...' : 'Unggah Excel'}
          <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
        </label>
      </div>

      {importResult?.failed?.length > 0 && (
        <div style={{ background: '#FBE1DD', color: '#C0392B', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
          Gagal: {importResult.failed.map((f) => `${f.employee_code} (${f.error})`).join(', ')}
        </div>
      )}

      <button
        className="primary-btn"
        style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={() => setEditing({})}
      >
        <Plus size={18} /> Input manual
      </button>

      {rows && rows.length > 0 && (
        <ExportButton onClick={() => exportToExcel('data-slip-gaji.xlsx', 'Slip Gaji', rows, [
          ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Jabatan', 'position'], ['Departemen', 'department'],
          ['Periode', (r) => new Date(r.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })],
          ['Gaji Pokok', 'basic_salary'], ['Total Tunjangan', 'allowances'], ['Total Potongan', 'deductions'],
          ['Take Home Pay', 'net_salary'], ['PTKP', 'ptkp_status'], ['Badan Usaha', 'business_entity'], ['Catatan', 'notes'],
        ])} />
      )}

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
              <button onClick={() => resend(r)} title="Kirim ulang notifikasi"><Bell size={17} /></button>
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
          <div className="field"><label>Tunjangan (total)</label><input type="number" value={form.allowances} onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))} /></div>
          <div className="field"><label>Potongan (total)</label><input type="number" value={form.deductions} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} /></div>
          <div className="field"><label>Catatan</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          {error && <p className="error-text">{error}</p>}
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Untuk rincian tunjangan/potongan per item, gunakan import Excel.</p>
          <button className="primary-btn" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </form>
      </div>
    </div>
  )
}
