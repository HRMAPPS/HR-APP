import { useEffect, useState } from 'react'
import { ArrowLeft, Search, Check, X, Plus, Pencil, Trash2, Download, Upload, Users, ClipboardList, Wallet, CalendarDays, AlarmClock, Receipt, Bell, FileDown, CalendarClock, MapPin, Crosshair, Paperclip, Copy, GitBranch } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import { useIsDesktop } from '../lib/useIsDesktop'
import { linkifyText } from '../lib/linkify'
import CalendarEventsTab from '../components/CalendarEventsTab'
import EmployeeImportModal from '../components/EmployeeImportModal'
import HRAttendanceDetail from '../components/HRAttendanceDetail'
import { FlagBadge } from '../components/AttendanceFlags'
import LeavePolicyManager from '../components/LeavePolicyManager'
import ApprovalChainManager from '../components/ApprovalChainManager'
import { useApprovalProgress, WaitingLine } from '../components/ApprovalProgress'

import { tx, locale } from '../lib/i18n'
const TABS = [
  { key: 'overview', label: tx("Ringkasan"), icon: Users },
  { key: 'karyawan', label: tx("Karyawan"), icon: Users },
  { key: 'shift', label: 'Shift', icon: CalendarClock },
  { key: 'lokasi', label: tx("Lokasi"), icon: MapPin },
  { key: 'attendance', label: tx("Absensi"), icon: ClipboardList },
  { key: 'leave', label: tx("Cuti"), icon: CalendarDays },
  { key: 'approval', label: tx("Persetujuan"), icon: GitBranch },
  { key: 'overtime', label: tx("Lembur"), icon: AlarmClock },
  { key: 'reimbursement', label: tx("Reimburse"), icon: Receipt },
  { key: 'correction', label: tx("Koreksi Absen"), icon: ClipboardList },
  { key: 'payslip', label: tx("Slip Gaji"), icon: Wallet },
  { key: 'pengumuman', label: tx("Pengumuman"), icon: Bell },
  { key: 'kalender', label: tx("Kalender"), icon: CalendarDays },
]

export default function HRDashboard({ onBack, onToast }) {
  const [tab, setTab] = useState('overview')
  const [employees, setEmployees] = useState([])
  const isDesktop = useIsDesktop()

  async function loadEmployees() {
    const { data, error } = await supabase.rpc('get_hr_employees')
    if (error) { onToast(error.message); return }
    setEmployees(data || [])
  }
  useEffect(() => { loadEmployees() }, [])

  return (
    <div>
      {isDesktop ? (
        <h1 style={{ fontSize: 26, margin: '4px 0 4px' }}>{tx("HR Dashboard")}</h1>
      ) : (
        <div className="page-header">
          <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
          <h1>{tx("HR Dashboard")}</h1>
          <span style={{ width: 22 }} />
        </div>
      )}

      <div
        className="tabs"
        style={isDesktop
          ? { flexWrap: 'wrap', rowGap: 4, padding: '4px 0 14px', borderBottom: '1px solid var(--border)', marginBottom: 22 }
          : { overflowX: 'auto', whiteSpace: 'nowrap', flexWrap: 'nowrap' }}
      >
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div style={isDesktop ? { maxWidth: 1280 } : undefined}>
        {tab === 'overview' && <OverviewTab onToast={onToast} onGo={setTab} isDesktop={isDesktop} />}
        {tab === 'karyawan' && <KaryawanTab employees={employees} onReload={loadEmployees} onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'shift' && <ShiftTab employees={employees} onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'lokasi' && <LocationTab onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'attendance' && <AttendanceTab onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'leave' && <LeaveTab onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'approval' && <ApprovalChainManager employees={employees} onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'overtime' && <OvertimeTab onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'reimbursement' && <ReimbursementTab onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'correction' && <CorrectionTab onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'payslip' && <PayslipTab employees={employees} onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'pengumuman' && <AnnouncementTab onToast={onToast} isDesktop={isDesktop} />}
        {tab === 'kalender' && <CalendarEventsTab onToast={onToast} isDesktop={isDesktop} />}
      </div>
    </div>
  )
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })
}
function isoWeek(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}
function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
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

function ExportButton({ onClick, label = 'Export Excel', style }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--border)',
        borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
        boxShadow: 'var(--shadow-xs)', marginBottom: 14, ...style,
      }}
    >
      <FileDown size={15} /> {label}
    </button>
  )
}

function ImportButton({ onClick, label = 'Import Excel', style }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--border)',
        borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
        boxShadow: 'var(--shadow-xs)', marginBottom: 14, whiteSpace: 'nowrap', ...style,
      }}
    >
      <Upload size={15} /> {label}
    </button>
  )
}

// ---------------------------------------------------------------------
// Ringkasan — angka penting untuk HR
// ---------------------------------------------------------------------
function OverviewTab({ onToast, onGo, isDesktop }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    supabase.rpc('get_hr_overview').then(({ data, error }) => {
      if (error) { onToast(error.message); return }
      setStats(data)
    })
  }, [])

  if (!stats) return <div className="empty-state"><p>{tx("Memuat...")}</p></div>

  const cards = [
    { label: tx("Total Karyawan Aktif"), value: stats.total_employees, go: 'karyawan' },
    { label: tx("Hadir Hari Ini"), value: stats.present_today, go: 'attendance' },
    { label: tx("Cuti Menunggu"), value: stats.pending_leave, go: 'leave' },
    { label: tx("Lembur Menunggu"), value: stats.pending_overtime, go: 'overtime' },
    { label: tx("Reimburse Menunggu"), value: stats.pending_reimbursement, go: 'reimbursement' },
  ]

  if (isDesktop) {
    return (
      <div className="dsk-grid-cards" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {cards.map((c) => (
          <button key={c.label} className="dsk-card" onClick={() => onGo(c.go)}>
            <span style={{ fontSize: 30, fontWeight: 300, color: '#96101c' }}>{c.value}</span>
            <span className="lbl" style={{ fontWeight: 600, fontSize: 13, color: '#6b6560' }}>{c.label}</span>
          </button>
        ))}
      </div>
    )
  }

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
function KaryawanTab({ employees, onReload, onToast, isDesktop }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // null closed, {} new, {...} edit
  const [importOpen, setImportOpen] = useState(false)

  const filtered = employees.filter((e) =>
    e.full_name.toLowerCase().includes(query.toLowerCase()) || (e.employee_code || '').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="form-page">
      {isDesktop ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <div className="search-box" style={{ margin: 0, flex: 1 }}>
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx("Cari nama / kode karyawan...")}
              style={{ border: 'none', outline: 'none', background: 'none', flex: 1, fontSize: 14.5 }} />
          </div>
          <button className="primary-btn" style={{ width: 'auto', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px' }} onClick={() => setEditing({})}>
            <Plus size={18} />{' '}{tx("Tambah karyawan")}</button>
          <ImportButton onClick={() => setImportOpen(true)} style={{ marginBottom: 0, flexShrink: 0 }} />
          <ExportButton style={{ marginBottom: 0, flexShrink: 0 }} onClick={() => exportToExcel('data-karyawan.xlsx', 'Karyawan', filtered, [
            [tx("Kode Karyawan"), 'employee_code'], [tx("Nama"), 'full_name'], [tx("Jabatan"), 'position'], [tx("Departemen"), 'department'],
            [tx("Role"), 'role'], ['Status', (r) => r.employment_status || 'active'], ['No HP', 'phone'], ['Email', 'email'],
          ])} />
        </div>
      ) : (
        <>
          <div className="search-box" style={{ margin: '0 0 14px' }}>
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx("Cari nama / kode karyawan...")}
              style={{ border: 'none', outline: 'none', background: 'none', flex: 1, fontSize: 14.5 }} />
          </div>

          <button className="primary-btn" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setEditing({})}>
            <Plus size={18} />{' '}{tx("Tambah karyawan")}</button>

          <ImportButton onClick={() => setImportOpen(true)} style={{ marginRight: 8 }} />
          <ExportButton onClick={() => exportToExcel('data-karyawan.xlsx', 'Karyawan', filtered, [
            [tx("Kode Karyawan"), 'employee_code'], [tx("Nama"), 'full_name'], [tx("Jabatan"), 'position'], [tx("Departemen"), 'department'],
            [tx("Role"), 'role'], ['Status', (r) => r.employment_status || 'active'], ['No HP', 'phone'], ['Email', 'email'],
          ])} />
        </>
      )}

      {isDesktop ? (
        <div className="dsk-table-wrap" style={{ marginTop: 4 }}>
          <table className="dsk-table">
            <thead>
              <tr><th>{tx("Karyawan")}</th><th>{tx("Kode")}</th><th>{tx("Jabatan")}</th><th>{tx("Departemen")}</th><th>Shift</th><th>Status</th><th>{tx("Aksi")}</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="empty">{tx("Tidak ada karyawan yang cocok.")}</td></tr>
              ) : filtered.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>
                    {e.full_name}
                    {e.role !== 'employee' && <span style={{ fontSize: 10.5, background: '#FBE8D6', color: '#B4650C', padding: '2px 7px', borderRadius: 6, marginLeft: 8, fontWeight: 700 }}>{e.role?.toUpperCase()}</span>}
                  </td>
                  <td>{e.employee_code || '-'}</td>
                  <td>{e.position || '-'}</td>
                  <td>{e.department || '-'}</td>
                  <td>{e.default_shift_name ? `${e.default_shift_name} (${e.default_shift_start?.slice(0, 5)}-${e.default_shift_end?.slice(0, 5)})` : '-'}</td>
                  <td>{e.employment_status === 'inactive' ? <span style={{ color: '#C0392B' }}>{tx("Nonaktif")}</span> : <span style={{ color: '#1E8E5A' }}>{tx("Aktif")}</span>}</td>
                  <td><button className="btn" onClick={() => setEditing(e)}><Pencil size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{tx("Edit")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        filtered.map((e) => (
          <div key={e.id} className="list-item">
            <div className="info">
              <div className="name">{e.full_name} {e.role !== 'employee' && <span style={{ fontSize: 11, background: '#FBE8D6', color: '#B4650C', padding: '2px 7px', borderRadius: 6, marginLeft: 6 }}>{e.role?.toUpperCase()}</span>}</div>
              <div className="sub">
                {e.employee_code} · {e.position || '-'}{e.employment_status === 'inactive' ? tx(" · Nonaktif") : ''}
                {e.default_shift_name && ` · ${e.default_shift_name} (${e.default_shift_start?.slice(0, 5)}-${e.default_shift_end?.slice(0, 5)})`}
              </div>
            </div>
            <div className="actions">
              <button onClick={() => setEditing(e)}><Pencil size={17} /></button>
            </div>
          </div>
        ))
      )}

      {importOpen && (
        <EmployeeImportModal
          employees={employees}
          onClose={() => setImportOpen(false)}
          onDone={(msg) => { onReload(); onToast(msg) }}
        />
      )}

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
    default_shift_id: row.default_shift_id || '',
    default_days: row.default_work_days && row.default_work_days.length > 0 ? row.default_work_days.map(String) : ['0', '1', '2', '3', '4', '5', '6'],
  })
  const [shifts, setShifts] = useState([])
  const [departments, setDepartments] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.rpc('get_hr_shifts').then(({ data }) => setShifts(data || []))
    supabase.from('departments').select('id,name').order('name').then(({ data }) => setDepartments(data || []))
  }, [])

  const managerOptions = employees.filter((e) => e.id !== row.id)

  function toggleDay(d) {
    setForm((f) => ({ ...f, default_days: f.default_days.includes(d) ? f.default_days.filter((x) => x !== d) : [...f.default_days, d] }))
  }

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.full_name.trim() || (!row.id && !form.employee_code.trim())) { setError(tx("Nama dan kode karyawan wajib diisi")); return }
    setSaving(true)
    // samakan huruf dengan daftar resmi; departemen baru otomatis didaftarkan
    const typed = form.department.trim()
    let dept = departments.find((d) => d.name.toLowerCase() === typed.toLowerCase())
    if (typed && !dept) {
      const { data: created } = await supabase.from('departments').insert({ name: typed }).select('id,name').single()
      dept = created || null
    }
    form.department = dept ? dept.name : typed
    const daysParam = form.default_shift_id && form.default_days.length < 7 ? form.default_days.map(Number) : null
    let res
    if (row.id) {
      res = await supabase.rpc('update_employee_hr', {
        p_id: row.id, p_full_name: form.full_name, p_position: form.position || null, p_department: form.department || null,
        p_manager_id: form.manager_id || null, p_employment_status: form.employment_status,
        p_phone: form.phone || null, p_email: form.email || null, p_role: form.role,
        p_default_shift_id: form.default_shift_id || null, p_default_work_days: daysParam,
        p_clear_default_shift: !form.default_shift_id,
      })
    } else {
      res = await supabase.rpc('create_employee_hr', {
        p_employee_code: form.employee_code, p_full_name: form.full_name, p_position: form.position || null,
        p_department: form.department || null, p_manager_id: form.manager_id || null,
        p_phone: form.phone || null, p_email: form.email || null, p_role: form.role,
        p_default_shift_id: form.default_shift_id || null, p_default_work_days: daysParam,
      })
    }
    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    // samakan department_id (dipakai Struktur Organisasi) dengan departemen yang dipilih
    const empId = row.id || res.data?.id
    if (empId) await supabase.rpc('update_employee_department', { p_employee_id: empId, p_department_id: dept ? dept.id : null })
    onSaved(row.id ? tx("Data karyawan diperbarui") : tx("Karyawan ditambahkan"))
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.id ? tx("Edit Karyawan") : tx("Tambah Karyawan")}</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>{tx("Kode karyawan")}</label>
            <input value={form.employee_code} onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))} disabled={!!row.id} required={!row.id} />
            {!row.id && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{tx("Kode ini akan diminta ke karyawan saat mereka membuat akun login sendiri di halaman \"Buat Akun\" — pastikan unik dan sampaikan ke karyawan yang bersangkutan.")}</p>}
          </div>
          <div className="field"><label>{tx("Nama lengkap")}</label><input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
          <div className="field"><label>{tx("Jabatan")}</label><input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} /></div>
          <div className="field"><label>{tx("Departemen")}</label>
            <input list="dept-options" placeholder={tx("Pilih atau ketik departemen baru")} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
            <datalist id="dept-options">{departments.map((d) => <option key={d.id} value={d.name} />)}</datalist>
          </div>
          <div className="field">
            <label>{tx("Atasan langsung")}</label>
            <select value={form.manager_id} onChange={(e) => setForm((f) => ({ ...f, manager_id: e.target.value }))}>
              <option value="">{tx("- Tidak ada -")}</option>
              {managerOptions.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div className="field"><label>{tx("No. HP")}</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
          <div className="field"><label>Email</label><input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div className="field">
            <label>{tx("Role akses")}</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="employee">{tx("Employee")}</option>
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {row.id && (
            <div className="field">
              <label>Status</label>
              <select value={form.employment_status} onChange={(e) => setForm((f) => ({ ...f, employment_status: e.target.value }))}>
                <option value="active">{tx("Aktif")}</option>
                <option value="inactive">{tx("Nonaktif")}</option>
              </select>
            </div>
          )}

          <div className="field">
            <label>{tx("Shift default (berlaku terus-menerus)")}</label>
            <select value={form.default_shift_id} onChange={(e) => setForm((f) => ({ ...f, default_shift_id: e.target.value }))}>
              <option value="">{tx("- Tidak ada shift default -")}</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)})</option>)}
            </select>
          </div>
          {form.default_shift_id && (
            <div className="field">
              <label>{tx("Berlaku di hari")}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DOW_OPTIONS.map(([val, label]) => (
                  <button key={val} type="button" onClick={() => toggleDay(val)} style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer',
                    background: form.default_days.includes(val) ? 'var(--blue)' : '#fff', color: form.default_days.includes(val) ? '#fff' : 'var(--text)',
                  }}>{label}</button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{tx("Hari yang tidak dicentang otomatis jadi \"Libur\" tiap minggu. Ini cuma default — jadwal khusus per-tanggal (kalau ada) tetap yang menang.")}</p>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Simpan")}</button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Shift — kelola jenis shift, dan atur jadwal karyawan (satuan / massal)
// ---------------------------------------------------------------------
const DOW_OPTIONS = [
  ['1', tx("Sen")], ['2', tx("Sel")], ['3', tx("Rab")], ['4', tx("Kam")], ['5', tx("Jum")], ['6', tx("Sab")], ['0', tx("Min")],
]

function ShiftTab({ employees, onToast, isDesktop }) {
  const [sub, setSub] = useState('jadwal') // 'jadwal' | 'jenis'
  const [shifts, setShifts] = useState([])
  const [editingShift, setEditingShift] = useState(null)

  async function loadShifts() {
    const { data, error } = await supabase.rpc('get_hr_shifts')
    if (error) { onToast(error.message); return }
    setShifts(data || [])
  }
  useEffect(() => { loadShifts() }, [])

  return (
    <div className="form-page">
      <div className="tabs" style={{ padding: 0, marginBottom: 14 }}>
        <button className={sub === 'jadwal' ? 'active' : ''} onClick={() => setSub('jadwal')}>{tx("Jadwal Karyawan")}</button>
        <button className={sub === 'jenis' ? 'active' : ''} onClick={() => setSub('jenis')}>{tx("Jenis Shift")}</button>
      </div>

      {sub === 'jenis' && (
        <div>
          <button
            className={isDesktop ? 'dsk-outline-btn' : 'primary-btn'}
            style={isDesktop
              ? { marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }
              : { marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => setEditingShift({})}
          >
            <Plus size={isDesktop ? 15 : 18} /> {isDesktop ? tx("TAMBAH JENIS SHIFT") : tx("Tambah jenis shift")}
          </button>
          {shifts.length === 0 ? (
            <div className="empty-state"><p>{tx("Belum ada jenis shift. Tambah dulu, misalnya \"Office Staff 08:00 - 17:00\".")}</p></div>
          ) : isDesktop ? (
            <div className="dsk-table-wrap">
              <table className="dsk-table">
                <thead><tr><th>{tx("Nama shift")}</th><th>{tx("Jam")}</th><th>{tx("Aksi")}</th></tr></thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</td>
                      <td><button className="btn" onClick={() => setEditingShift(s)}><Pencil size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            shifts.map((s) => (
              <div key={s.id} className="list-item">
                <div className="info">
                  <div className="name">{s.name}</div>
                  <div className="sub">{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</div>
                </div>
                <div className="actions"><button onClick={() => setEditingShift(s)}><Pencil size={17} /></button></div>
              </div>
            ))
          )}
          {editingShift !== null && (
            <ShiftForm row={editingShift} onClose={() => setEditingShift(null)} onSaved={(msg) => { setEditingShift(null); loadShifts(); onToast(msg) }} />
          )}
        </div>
      )}

      {sub === 'jadwal' && <ScheduleManager employees={employees} shifts={shifts} onToast={onToast} isDesktop={isDesktop} />}
    </div>
  )
}

function ShiftForm({ row, onClose, onSaved }) {
  const [form, setForm] = useState({ name: row.name || '', start_time: row.start_time?.slice(0, 5) || '08:00', end_time: row.end_time?.slice(0, 5) || '17:00' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.name.trim()) { setError(tx("Nama shift wajib diisi")); return }
    setSaving(true)
    const { error } = await supabase.rpc('upsert_shift_hr', { p_id: row.id || null, p_name: form.name, p_start_time: form.start_time, p_end_time: form.end_time })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(row.id ? tx("Jenis shift diperbarui") : tx("Jenis shift ditambahkan"))
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.id ? tx("Edit Jenis Shift") : tx("Tambah Jenis Shift")}</h3></div>
        <form onSubmit={submit}>
          <div className="field"><label>{tx("Nama shift")}</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={tx("mis. Office Staff")} /></div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>{tx("Jam mulai")}</label><input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} /></div>
            <div className="field" style={{ flex: 1 }}><label>{tx("Jam selesai")}</label><input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} /></div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Simpan")}</button>
        </form>
      </div>
    </div>
  )
}

function LocationTab({ onToast, isDesktop }) {
  const [locations, setLocations] = useState(null)
  const [editing, setEditing] = useState(null)

  async function load() {
    const { data, error } = await supabase.rpc('get_attendance_locations')
    if (error) { onToast(error.message); return }
    setLocations(data || [])
  }
  useEffect(() => { load() }, [])

  async function remove(id) {
    if (!confirm(tx("Hapus lokasi ini? Karyawan tidak akan dibatasi radius lokasi ini lagi."))) return
    const { error } = await supabase.rpc('delete_location_hr', { p_id: id })
    if (error) { onToast(error.message); return }
    onToast(tx("Lokasi dihapus"))
    load()
  }

  return (
    <div className="form-page">
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, background: '#eef1fb', color: '#4356C4',
        borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14,
      }}>
        <MapPin size={16} style={{ flexShrink: 0, marginTop: 1 }} />{tx("Karyawan hanya bisa clock in/out dalam radius dari salah satu lokasi di bawah. Kalau belum ada lokasi ditambahkan, absen tidak dibatasi lokasi sama sekali.")}</div>

      <button
        className={isDesktop ? 'dsk-outline-btn' : 'primary-btn'}
        style={isDesktop
          ? { marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }
          : { marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={() => setEditing({})}
      >
        <Plus size={isDesktop ? 15 : 18} /> {isDesktop ? tx("TAMBAH LOKASI") : tx("Tambah lokasi")}
      </button>

      {locations === null ? (
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      ) : locations.length === 0 ? (
        <div className="empty-state"><p>{tx("Belum ada lokasi absen. Tambah dulu, misalnya \"Kantor Pusat\".")}</p></div>
      ) : isDesktop ? (
        <div className="dsk-table-wrap">
          <table className="dsk-table">
            <thead><tr><th>{tx("Nama lokasi")}</th><th>Radius</th><th>{tx("Koordinat")}</th><th>{tx("Aksi")}</th></tr></thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.name}</td>
                  <td>{l.radius_meters} m</td>
                  <td>{Number(l.lat).toFixed(5)}, {Number(l.lng).toFixed(5)}</td>
                  <td className="acts">
                    <button className="btn" onClick={() => setEditing(l)}><Pencil size={13} /></button>
                    <button className="btn muted" onClick={() => remove(l.id)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        locations.map((l) => (
          <div key={l.id} className="list-item">
            <div className="info">
              <div className="name">{l.name}</div>
              <div className="sub">Radius {l.radius_meters} m · {Number(l.lat).toFixed(5)}, {Number(l.lng).toFixed(5)}</div>
            </div>
            <div className="actions">
              <button onClick={() => setEditing(l)}><Pencil size={17} /></button>
              <button onClick={() => remove(l.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))
      )}

      {editing !== null && (
        <LocationForm row={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); load(); onToast(msg) }} />
      )}
    </div>
  )
}

function LocationForm({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: row.name || '', lat: row.lat ?? '', lng: row.lng ?? '', radius_meters: row.radius_meters ?? 100,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  function useMyLocation() {
    if (!navigator.geolocation) { setError(tx("Perangkat ini tidak mendukung deteksi lokasi")); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })); setLocating(false) },
      () => { setError(tx("Gagal mendapatkan lokasi. Izinkan akses lokasi di browser.")); setLocating(false) },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.name.trim()) { setError(tx("Nama lokasi wajib diisi")); return }
    if (form.lat === '' || form.lng === '') { setError(tx("Koordinat wajib diisi")); return }
    setSaving(true)
    const { error } = await supabase.rpc('upsert_location_hr', {
      p_id: row.id || null, p_name: form.name, p_lat: Number(form.lat), p_lng: Number(form.lng),
      p_radius_meters: Number(form.radius_meters) || 100,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(row.id ? tx("Lokasi diperbarui") : tx("Lokasi ditambahkan"))
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.id ? tx("Edit Lokasi") : tx("Tambah Lokasi")}</h3></div>
        <form onSubmit={submit}>
          <div className="field"><label>{tx("Nama lokasi")}</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={tx("mis. Kantor Pusat")} /></div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>Latitude</label><input type="number" step="any" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} placeholder="-6.200000" /></div>
            <div className="field" style={{ flex: 1 }}><label>Longitude</label><input type="number" step="any" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} placeholder="106.816666" /></div>
          </div>
          <button type="button" onClick={useMyLocation} disabled={locating} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 14,
            background: '#eef1fb', color: 'var(--blue)', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          }}>
            <Crosshair size={16} /> {locating ? tx("Mendeteksi lokasi...") : tx("Gunakan lokasi saya sekarang")}
          </button>
          <div className="field"><label>{tx("Radius (meter)")}</label><input type="number" min="10" value={form.radius_meters} onChange={(e) => setForm((f) => ({ ...f, radius_meters: e.target.value }))} /></div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Simpan")}</button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Pengumuman — HR/admin bikin, edit, hapus pengumuman untuk semua karyawan
// (tampil di Beranda). Membaca langsung dari tabel `announcements` (RLS-nya
// terbuka untuk dibaca semua orang); menulis lewat RPC upsert_announcement_hr
// / delete_announcement_hr yang dibatasi is_hr() di sisi database.
// ---------------------------------------------------------------------
function AnnouncementTab({ onToast, isDesktop }) {
  const [list, setList] = useState(null)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)

  async function load() {
    const { data, error } = await supabase.from('announcements').select('*').order('published_at', { ascending: false })
    if (error) { onToast(error.message); return }
    setList(data || [])
  }
  useEffect(() => { load() }, [])

  async function remove(id) {
    if (!confirm(tx("Hapus pengumuman ini?"))) return
    const { error } = await supabase.rpc('delete_announcement_hr', { p_id: id })
    if (error) { onToast(error.message); return }
    onToast(tx("Pengumuman dihapus"))
    setDetail((d) => (d?.id === id ? null : d))
    load()
  }

  function copyText(a) {
    navigator.clipboard.writeText(`${a.title}\n\n${a.body || ''}`.trim())
    onToast(tx("Pengumuman disalin"))
  }

  return (
    <div className="form-page">
      <button
        className={isDesktop ? 'dsk-outline-btn' : 'primary-btn'}
        style={isDesktop
          ? { marginBottom: 22, display: 'inline-flex', alignItems: 'center', gap: 8 }
          : { marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={() => setEditing({})}
      >
        <Plus size={isDesktop ? 15 : 18} /> {isDesktop ? tx("BUAT PENGUMUMAN") : tx("Buat pengumuman")}
      </button>

      {list === null ? (
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      ) : list.length === 0 ? (
        <div className="empty-state"><p>{tx("Belum ada pengumuman. Buat yang pertama untuk ditampilkan di Beranda semua karyawan.")}</p></div>
      ) : isDesktop ? (
        <div className="dsk-table-wrap">
          <table className="dsk-table">
            <thead><tr><th>{tx("Judul")}</th><th>{tx("Kategori")}</th><th>{tx("Tanggal")}</th><th>{tx("Penulis")}</th><th>{tx("Aksi")}</th></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(a)}>
                  <td style={{ fontWeight: 600 }}>{a.title}</td>
                  <td>
                    {a.category && (
                      <span style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#96101c', background: '#f4e8e9',
                        borderRadius: 20, padding: '2px 10px',
                      }}>
                        {tx(a.category)}
                      </span>
                    )}
                  </td>
                  <td>{fmtDate(a.published_at)}</td>
                  <td>{a.author || '-'}</td>
                  <td className="acts" onClick={(e) => e.stopPropagation()}>
                    <button className="btn muted" onClick={() => copyText(a)} title={tx("Salin")}><Copy size={13} /></button>
                    <button className="btn" onClick={() => setEditing(a)} title={tx("Edit")}><Pencil size={13} /></button>
                    <button className="btn muted" onClick={() => remove(a.id)} title={tx("Hapus")}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        list.map((a) => (
          <div key={a.id} className="list-item" style={{ alignItems: 'flex-start' }}>
            <div className="info">
              <div className="name">{a.title}</div>
              {a.category && (
                <span style={{
                  display: 'inline-block', fontSize: 10.5, fontWeight: 600, color: 'var(--blue)', background: '#eef2ff',
                  borderRadius: 20, padding: '1px 8px', marginTop: 4,
                }}>
                  {tx(a.category)}
                </span>
              )}
              {a.body && <div className="sub" style={{ marginTop: 3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{linkifyText(a.body.replace(/\n{3,}/g, '\n\n').trim())}</div>}
              <div className="sub" style={{ marginTop: 6, fontSize: 11.5 }}>
                {fmtDate(a.published_at)}{a.author ? ` · ${a.author}` : ''}
              </div>
              {a.attachment_url && (
                <a href={a.attachment_url} target="_blank" rel="noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 13, color: 'var(--blue)',
                }}>
                  <Paperclip size={13} /> {a.attachment_name || tx("Lihat lampiran")}
                </a>
              )}
            </div>
            <div className="actions">
              <button onClick={() => setEditing(a)}><Pencil size={17} /></button>
              <button onClick={() => remove(a.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))
      )}

      {detail && (
        <div className="modal-overlay dcuti-overlay" onClick={() => setDetail(null)}>
          <div className="dcuti-modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="dcuti-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <h2 style={{ margin: 0, flex: 1, borderBottom: 'none', paddingBottom: 0 }}>{detail.title}</h2>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => copyText(detail)} title={tx("Salin")} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}><Copy size={16} /></button>
                  <button onClick={() => { setEditing(detail); setDetail(null) }} title={tx("Edit")} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}><Pencil size={16} /></button>
                  <button onClick={() => remove(detail.id)} title={tx("Hapus")} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}><Trash2 size={16} /></button>
                </div>
              </div>
              {detail.category && (
                <span style={{
                  display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#96101c', background: '#f4e8e9',
                  borderRadius: 20, padding: '2px 10px', marginTop: 10,
                }}>
                  {tx(detail.category)}
                </span>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, paddingBottom: 18, borderBottom: '1px solid #ddd' }}>
                {fmtDate(detail.published_at)}{detail.author ? ` · ${detail.author}` : ''}
              </div>
              {detail.body && (
                <p style={{ fontSize: 14.5, marginTop: 18, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {linkifyText(String(detail.body).replace(/\n{3,}/g, '\n\n').trim())}
                </p>
              )}
              {detail.attachment_url && (
                <a href={detail.attachment_url} target="_blank" rel="noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 14, fontSize: 13, color: '#96101c',
                }}>
                  <Paperclip size={14} /> {detail.attachment_name || tx("Lihat lampiran")}
                </a>
              )}
            </div>
            <div className="dcuti-modal-foot"><button className="dcal-outline-btn" onClick={() => setDetail(null)}>{tx("TUTUP")}</button></div>
          </div>
        </div>
      )}

      {editing !== null && (
        <AnnouncementForm row={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); load(); onToast(msg) }} />
      )}
    </div>
  )
}

function AnnouncementForm({ row, onClose, onSaved }) {
  const [form, setForm] = useState({ title: row.title || '', body: row.body || '', category: row.category && row.category !== 'Uncategorized' ? row.category : '' })
  const [attachmentUrl, setAttachmentUrl] = useState(row.attachment_url || null)
  const [attachmentName, setAttachmentName] = useState(row.attachment_name || null)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.title.trim()) { setError(tx("Judul wajib diisi")); return }
    setSaving(true)

    let finalUrl = attachmentUrl
    let finalName = attachmentName
    if (file) {
      const path = `${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('announcement-attachments').upload(path, file)
      if (upErr) { setSaving(false); setError(tx("Gagal unggah lampiran: ") + upErr.message); return }
      const { data: pub } = supabase.storage.from('announcement-attachments').getPublicUrl(path)
      finalUrl = pub.publicUrl
      finalName = file.name
    }

    const { error } = await supabase.rpc('upsert_announcement_hr', {
      p_id: row.id || null, p_title: form.title, p_body: form.body || null,
      p_category: form.category.trim() || tx("Uncategorized"),
      p_attachment_url: finalUrl, p_attachment_name: finalName,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(row.id ? tx("Pengumuman diperbarui") : tx("Pengumuman diterbitkan"))
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.id ? tx("Edit Pengumuman") : tx("Buat Pengumuman")}</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>{tx("Judul")}</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={tx("mis. Libur Hari Raya")} />
          </div>
          <div className="field">
            <label>{tx("Isi (opsional)")}</label>
            <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder={tx("Detail pengumuman...")} />
          </div>
          <div className="field">
            <label>{tx("Kategori (opsional)")}</label>
            <input
              list="announcement-category-options"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder={tx("Uncategorized")}
            />
            <datalist id="announcement-category-options">
              <option value="Uncategorized" />
              <option value="Kajian Rutin" />
              <option value="Sports Day" />
              <option value="Libur" />
              <option value="Pengumuman Umum" />
              <option value="HR Update" />
            </datalist>
          </div>
          <div className="field">
            <label>{tx("Lampiran (opsional)")}</label>
            {attachmentUrl && !file ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                border: '1px solid var(--border)', borderRadius: 10, fontSize: 13.5,
              }}>
                <Paperclip size={15} color="var(--text-muted)" />
                <a href={attachmentUrl} target="_blank" rel="noreferrer" style={{ flex: 1, color: 'var(--blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {attachmentName || tx("Lampiran saat ini")}
                </a>
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            )}
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : row.id ? tx("Simpan") : tx("Terbitkan")}</button>
        </form>
      </div>
    </div>
  )
}

function ScheduleManager({ employees, shifts, onToast, isDesktop }) {
  const [start, setStart] = useState(todayStr())
  const [end, setEnd] = useState(() => { const d = new Date(todayStr()); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10) })
  const [rows, setRows] = useState(null)
  const [showBulk, setShowBulk] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  async function load() {
    const { data, error } = await supabase.rpc('get_hr_schedules', { p_start: start, p_end: end })
    if (error) { onToast(error.message); return }
    setRows(data)
  }
  useEffect(() => { load() }, [start, end])

  async function remove(id) {
    const { error } = await supabase.rpc('delete_schedule_hr', { p_id: id })
    if (error) { onToast(error.message); return }
    onToast(tx("Jadwal dihapus"))
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div className="field" style={{ flex: 1, margin: 0 }}><label>{tx("Dari")}</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field" style={{ flex: 1, margin: 0 }}><label>{tx("Sampai")}</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>

      <button
        className={isDesktop ? 'dsk-outline-btn' : 'primary-btn'}
        style={isDesktop
          ? { marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }
          : { marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={() => setShowBulk(true)}
      >
        <Plus size={isDesktop ? 15 : 18} /> {isDesktop ? tx("ATUR JADWAL (MASSAL)") : tx("Atur Jadwal (massal)")}
      </button>

      {rows === null ? (
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><p>{tx("Belum ada jadwal di rentang ini.")}</p></div>
      ) : isDesktop ? (
        <div className="dsk-table-wrap">
          <table className="dsk-table">
            <thead><tr><th>{tx("Karyawan")}</th><th>{tx("Tanggal")}</th><th>{tx("Jadwal")}</th><th>{tx("Aksi")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                  <td>{fmtDate(r.work_date)}</td>
                  <td>{r.is_day_off ? tx("Libur") : (r.shift_name ? `${r.shift_name} (${r.start_time?.slice(0, 5)}-${r.end_time?.slice(0, 5)})` : tx("Belum ada shift"))}</td>
                  <td className="acts">
                    <button className="btn" onClick={() => setEditingRow(r)}><Pencil size={13} /></button>
                    <button className="btn muted" onClick={() => remove(r.id)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="list-item">
            <div className="info">
              <div className="name">{r.full_name}</div>
              <div className="sub">
                {fmtDate(r.work_date)} · {r.is_day_off ? tx("Libur") : (r.shift_name ? `${r.shift_name} (${r.start_time?.slice(0, 5)}-${r.end_time?.slice(0, 5)})` : tx("Belum ada shift"))}
              </div>
            </div>
            <div className="actions">
              <button onClick={() => setEditingRow(r)}><Pencil size={17} /></button>
              <button onClick={() => remove(r.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))
      )}

      {showBulk && (
        <BulkScheduleForm employees={employees} shifts={shifts} onClose={() => setShowBulk(false)}
          onSaved={(msg) => { setShowBulk(false); load(); onToast(msg) }} />
      )}
      {editingRow && (
        <SingleScheduleForm row={editingRow} shifts={shifts} onClose={() => setEditingRow(null)}
          onSaved={(msg) => { setEditingRow(null); load(); onToast(msg) }} />
      )}
    </div>
  )
}

function SingleScheduleForm({ row, shifts, onClose, onSaved }) {
  const [shiftId, setShiftId] = useState(row.shift_id || '')
  const [isDayOff, setIsDayOff] = useState(row.is_day_off || false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.rpc('upsert_schedule_hr', {
      p_id: row.id, p_employee_id: row.employee_id, p_work_date: row.work_date,
      p_shift_id: isDayOff ? null : (shiftId || null), p_is_day_off: isDayOff,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved('Jadwal diperbarui')
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.full_name} · {fmtDate(row.work_date)}</h3></div>
        <form onSubmit={submit}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 14 }}>
            <input type="checkbox" checked={isDayOff} onChange={(e) => setIsDayOff(e.target.checked)} />{' '}{tx("Hari libur")}</label>
          {!isDayOff && (
            <div className="field">
              <label>{tx("Jenis shift")}</label>
              <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                <option value="">{tx("- Pilih shift -")}</option>
                {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)})</option>)}
              </select>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Simpan")}</button>
        </form>
      </div>
    </div>
  )
}

function BulkScheduleForm({ employees, shifts, onClose, onSaved }) {
  const [selectedIds, setSelectedIds] = useState([])
  const [start, setStart] = useState(todayStr())
  const [end, setEnd] = useState(todayStr())
  const [shiftId, setShiftId] = useState('')
  const [isDayOff, setIsDayOff] = useState(false)
  const [days, setDays] = useState(['1', '2', '3', '4', '5']) // default Senin-Jumat
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleEmp(id) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }
  function toggleDay(d) {
    setDays((ds) => ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d])
  }

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (selectedIds.length === 0) { setError(tx("Pilih minimal 1 karyawan")); return }
    if (!isDayOff && !shiftId) { setError(tx("Pilih jenis shift, atau centang Hari Libur")); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('bulk_assign_schedule_hr', {
      p_employee_ids: selectedIds, p_start_date: start, p_end_date: end,
      p_shift_id: isDayOff ? null : shiftId, p_is_day_off: isDayOff,
      p_days_of_week: days.length === 7 ? null : days.map(Number),
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(tx("{0} jadwal berhasil diatur", [data]))
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{tx("Atur Jadwal Massal")}</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>{tx("Karyawan (")}{selectedIds.length}{' '}{tx("dipilih)")}</label>
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
              {employees.map((e) => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 14 }}>
                  <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggleEmp(e.id)} />
                  {e.full_name} <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>({e.employee_code})</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>{tx("Dari tanggal")}</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>{tx("Sampai tanggal")}</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>

          <div className="field">
            <label>{tx("Hanya di hari (opsional, default semua)")}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DOW_OPTIONS.map(([val, label]) => (
                <button key={val} type="button" onClick={() => toggleDay(val)} style={{
                  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer',
                  background: days.includes(val) ? 'var(--blue)' : '#fff', color: days.includes(val) ? '#fff' : 'var(--text)',
                }}>{label}</button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: '4px 0 14px' }}>
            <input type="checkbox" checked={isDayOff} onChange={(e) => setIsDayOff(e.target.checked)} />{' '}{tx("Set sebagai Hari Libur (bukan shift kerja)")}</label>

          {!isDayOff && (
            <div className="field">
              <label>{tx("Jenis shift")}</label>
              <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                <option value="">{tx("- Pilih shift -")}</option>
                {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)})</option>)}
              </select>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Terapkan Jadwal")}</button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Absensi — semua karyawan, filter tanggal + cari nama
// ---------------------------------------------------------------------
function AttendanceTab({ onToast, isDesktop }) {
  const today = todayStr()
  const firstOfMonth = today.slice(0, 8) + '01'
  const [start, setStart] = useState(firstOfMonth)
  const [end, setEnd] = useState(today)
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState(null)

  async function load() {
    const { data, error } = await supabase.rpc('get_hr_attendance', { p_start: start, p_end: end })
    if (error) { onToast(error.message); return }
    setRows(data)
  }
  useEffect(() => { load() }, [start, end])

  const filtered = (rows || []).filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()))

  if (isDesktop) {
    return (
      <div>
        <div className="dsk-toolbar">
          <div className="dsk-filters">
            <label>{tx("Dari")}<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label>{tx("Sampai")}<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
            <label style={{ width: 240 }}>{tx("Cari nama")}<div className="dsk-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} /></div></label>
          </div>
          <ExportButton style={{ marginBottom: 0 }} onClick={() => exportToExcel(`absensi-${start}_${end}.xlsx`, 'Absensi', filtered, [
            [tx("Kode Karyawan"), 'employee_code'], [tx("Nama"), 'full_name'], [tx("Divisi"), (r) => r.department || '-'],
            [tx("Tanggal"), (r) => fmtDate(r.work_date)], ['Week', (r) => isoWeek(r.work_date)],
            [tx("Jam Masuk"), (r) => fmtTime(r.clock_in)], [tx("Jam Keluar"), (r) => fmtTime(r.clock_out)],
            ['Status', (r) => (r.status === 'late' ? tx("Telat") : tx("Tepat waktu"))],
          ])} />
        </div>
        <div className="dsk-table-wrap">
          <table className="dsk-table">
            <thead><tr><th>{tx("Karyawan")}</th><th>{tx("Tanggal")}</th><th>{tx("Clock in")}</th><th>{tx("Clock out")}</th><th>Status</th></tr></thead>
            <tbody>
              {rows === null ? <tr><td colSpan={5} className="empty">{tx("Memuat...")}</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={5} className="empty">{tx("Tidak ada data absensi pada rentang ini.")}</td></tr>
                : filtered.map((r) => (
                  <tr key={r.id} onClick={() => setDetailId(r.id)} style={{ cursor: 'pointer' }} title={tx("Klik untuk lihat detail")}>
                    <td style={{ fontWeight: 600 }}>{r.full_name}<FlagBadge flags={r.flags} /></td>
                    <td>{fmtDate(r.work_date)}</td>
                    <td>{fmtTime(r.clock_in)}</td>
                    <td>{fmtTime(r.clock_out)}</td>
                    <td>
                      <span style={{
                        fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                        background: r.status === 'late' ? '#FBE1DD' : '#E1F3EA',
                        color: r.status === 'late' ? '#C0392B' : '#1E8E5A',
                      }}>
                        {r.status === 'late' ? tx("Telat") : tx("Tepat waktu")}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {detailId && <HRAttendanceDetail attendanceId={detailId} onClose={() => setDetailId(null)} />}
      </div>
    )
  }

  return (
    <div className="form-page">
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div className="field" style={{ flex: 1, margin: 0 }}>
          <label>{tx("Dari")}</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, margin: 0 }}>
          <label>{tx("Sampai")}</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="search-box" style={{ margin: '0 0 14px' }}>
        <Search size={16} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx("Cari nama karyawan...")}
          style={{ border: 'none', outline: 'none', background: 'none', flex: 1, fontSize: 14.5 }} />
      </div>

      <ExportButton onClick={() => exportToExcel(`absensi-${start}_${end}.xlsx`, 'Absensi', filtered, [
        [tx("Kode Karyawan"), 'employee_code'], [tx("Nama"), 'full_name'], [tx("Divisi"), (r) => r.department || '-'],
        [tx("Tanggal"), (r) => fmtDate(r.work_date)], ['Week', (r) => isoWeek(r.work_date)],
        [tx("Jam Masuk"), (r) => fmtTime(r.clock_in)], [tx("Jam Keluar"), (r) => fmtTime(r.clock_out)],
        ['Status', (r) => (r.status === 'late' ? tx("Telat") : tx("Tepat waktu"))],
      ])} />

      {rows === null ? (
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>{tx("Tidak ada data absensi pada rentang ini.")}</p></div>
      ) : (
        filtered.map((r) => (
          <div key={r.id} className="list-item" onClick={() => setDetailId(r.id)} style={{ cursor: 'pointer' }}>
            <div className="info">
              <div className="name">{r.full_name}<FlagBadge flags={r.flags} /></div>
              <div className="sub">{fmtDate(r.work_date)}{' '}{tx("· masuk")}{' '}{fmtTime(r.clock_in)}{' '}{tx("· keluar")}{' '}{fmtTime(r.clock_out)}</div>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 8,
              background: r.status === 'late' ? '#FBE1DD' : '#E1F3EA',
              color: r.status === 'late' ? '#C0392B' : '#1E8E5A',
            }}>
              {r.status === 'late' ? tx("Telat") : tx("Tepat waktu")}
            </span>
          </div>
        ))
      )}
      {detailId && <HRAttendanceDetail attendanceId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Generic approval list (dipakai untuk Cuti, Lembur, Reimburse)
// ---------------------------------------------------------------------
function ApprovalTab({ onToast, rpcName, table, statusOptions, renderRow, exportColumns, exportFilename, isDesktop, desktopColumns }) {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState(null)
  const progress = useApprovalProgress(table, rows)

  async function load() {
    const { data, error } = await supabase.rpc(rpcName, { p_status: status || null })
    if (error) { onToast(error.message); return }
    setRows(data)
  }
  useEffect(() => { load() }, [status])

  async function decide(id, approve) {
    const { error } = await supabase.rpc('decide_request', { p_table: table, p_request_id: id, p_approve: approve })
    if (error) { onToast(error.message); return }
    onToast(approve ? tx("Disetujui") : tx("Ditolak"))
    load()
  }

  if (isDesktop) {
    return (
      <div>
        <div className="dsk-toolbar">
          <div className="tabs" style={{ padding: 0, border: 'none' }}>
            {statusOptions.map(([v, l]) => (
              <button key={v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
            ))}
          </div>
          {rows && rows.length > 0 && (
            <ExportButton style={{ marginBottom: 0 }} onClick={() => exportToExcel(`${exportFilename}-${status || 'semua'}.xlsx`, 'Data', rows, exportColumns)} />
          )}
        </div>
        <div className="dsk-table-wrap">
          <table className="dsk-table">
            <thead><tr><th>{tx("Karyawan")}</th>{desktopColumns.map(([label]) => <th key={label}>{label}</th>)}<th>{tx("Status / Aksi")}</th></tr></thead>
            <tbody>
              {rows === null ? <tr><td colSpan={desktopColumns.length + 2} className="empty">{tx("Memuat...")}</td></tr>
                : rows.length === 0 ? <tr><td colSpan={desktopColumns.length + 2} className="empty">{tx("Tidak ada pengajuan.")}</td></tr>
                : rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.full_name}<WaitingLine info={progress[r.id]} /></td>
                    {desktopColumns.map(([label, fn]) => <td key={label} className="wrap">{fn(r)}</td>)}
                    <td>
                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" style={{ borderColor: '#1E8E5A', color: '#1E8E5A' }} onClick={() => decide(r.id, true)}><Check size={13} /></button>
                          <button className="btn" style={{ borderColor: '#C0392B', color: '#C0392B' }} onClick={() => decide(r.id, false)}><X size={13} /></button>
                        </div>
                      ) : (
                        <span className={r.status === 'approved' ? 'status-approved' : 'status-rejected'}>
                          {r.status === 'approved' ? tx("Disetujui") : tx("Ditolak")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    )
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
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><p>{tx("Tidak ada pengajuan.")}</p></div>
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
                  {r.status === 'approved' ? tx("Disetujui") : tx("Ditolak")}
                </span>
              )}
            </div>
            <WaitingLine info={progress[r.id]} />
          </div>
        ))
      )}
    </div>
  )
}

const STATUS_OPTS = [['pending', tx("Menunggu")], ['approved', tx("Disetujui")], ['rejected', tx("Ditolak")], ['', tx("Semua")]]

function LeaveRequestsTab({ onToast, isDesktop }) {
  return (
    <ApprovalTab
      onToast={onToast} isDesktop={isDesktop} rpcName="get_hr_leave" table="leave_requests" statusOptions={STATUS_OPTS}
      exportFilename="cuti" exportColumns={[
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Jenis Cuti', 'leave_type_name'],
        ['Mulai', (r) => fmtDate(r.start_date)], ['Selesai', (r) => fmtDate(r.end_date)], ['Total Hari', 'total_days'],
        ['Alasan', 'reason'], ['Status', 'status'],
      ]}
      desktopColumns={[
        ['Jenis', (r) => tx(r.leave_type_name) || tx("Cuti")],
        ['Periode', (r) => tx("{0} - {1} ({2} hari)", [fmtDate(r.start_date), fmtDate(r.end_date), r.total_days])],
        ['Alasan', (r) => r.reason || '-'],
      ]}
      renderRow={(r) => (
        <div>
          <div className="date">{r.full_name}</div>
          <div className="desc">{tx(r.leave_type_name) || tx("Cuti")} · {fmtDate(r.start_date)} - {fmtDate(r.end_date)} ({r.total_days}{' '}{tx("hari)")}</div>
          {r.reason && <div className="desc">{r.reason}</div>}
        </div>
      )}
    />
  )
}

// Cuti = daftar pengajuan + pengaturan kuota (opsional) per jenis cuti
function LeaveTab({ onToast, isDesktop }) {
  const [sub, setSub] = useState('pengajuan') // 'pengajuan' | 'kuota'
  return (
    <div>
      <div className="tabs" style={{ padding: 0, marginBottom: 14 }}>
        <button className={sub === 'pengajuan' ? 'active' : ''} onClick={() => setSub('pengajuan')}>{tx("Pengajuan")}</button>
        <button className={sub === 'kuota' ? 'active' : ''} onClick={() => setSub('kuota')}>{tx("Kuota Cuti")}</button>
      </div>
      {sub === 'pengajuan'
        ? <LeaveRequestsTab onToast={onToast} isDesktop={isDesktop} />
        : <LeavePolicyManager onToast={onToast} isDesktop={isDesktop} />}
    </div>
  )
}

function OvertimeTab({ onToast, isDesktop }) {
  return (
    <ApprovalTab
      onToast={onToast} isDesktop={isDesktop} rpcName="get_hr_overtime" table="overtime_requests" statusOptions={STATUS_OPTS}
      exportFilename="lembur" exportColumns={[
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Tanggal', (r) => fmtDate(r.work_date)],
        ['Jam Mulai', (r) => r.start_time?.slice(0, 5)], ['Jam Selesai', (r) => r.end_time?.slice(0, 5)],
        ['Alasan', 'reason'], ['Status', 'status'],
      ]}
      desktopColumns={[
        ['Tanggal', (r) => fmtDate(r.work_date)],
        ['Jam', (r) => `${r.start_time?.slice(0, 5)} - ${r.end_time?.slice(0, 5)}`],
        ['Alasan', (r) => r.reason || '-'],
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

function ReimbursementTab({ onToast, isDesktop }) {
  return (
    <ApprovalTab
      onToast={onToast} isDesktop={isDesktop} rpcName="get_hr_reimbursement" table="reimbursement_requests" statusOptions={STATUS_OPTS}
      exportFilename="reimbursement" exportColumns={[
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Kategori', 'category_name'],
        ['Jumlah', 'amount'], ['Deskripsi', 'description'], ['Bulan', 'submitted_month'], ['Status', 'status'],
      ]}
      desktopColumns={[
        ['Kategori', (r) => tx(r.category_name) || tx("Reimburse")],
        ['Jumlah', (r) => rupiah(r.amount)],
        ['Deskripsi', (r) => r.description || '-'],
      ]}
      renderRow={(r) => (
        <div>
          <div className="date">{r.full_name}</div>
          <div className="desc">{tx(r.category_name) || tx("Reimburse")} · {rupiah(r.amount)}</div>
          {r.description && <div className="desc">{r.description}</div>}
        </div>
      )}
    />
  )
}

function CorrectionTab({ onToast, isDesktop }) {
  return (
    <ApprovalTab
      onToast={onToast} isDesktop={isDesktop} rpcName="get_hr_absence" table="absence_requests" statusOptions={STATUS_OPTS}
      exportFilename="koreksi-absensi" exportColumns={[
        ['Kode Karyawan', 'employee_code'], ['Nama', 'full_name'], ['Tanggal', (r) => fmtDate(r.work_date)],
        ['Jenis Masalah', 'issue_type'], ['Usulan Clock In', (r) => r.requested_clock_in?.slice(0, 5)],
        ['Usulan Clock Out', (r) => r.requested_clock_out?.slice(0, 5)], ['Alasan', 'reason'], ['Status', 'status'],
      ]}
      desktopColumns={[
        ['Tanggal', (r) => fmtDate(r.work_date)],
        ['Usulan jam', (r) => `${r.requested_clock_in?.slice(0, 5) || '-'} - ${r.requested_clock_out?.slice(0, 5) || '-'}`],
        ['Alasan', (r) => (
          <>
            {r.reason || '-'}
            {r.attachment_url && <><br /><a href={r.attachment_url} target="_blank" rel="noreferrer" style={{ color: '#96101c' }}>{tx("Lihat lampiran")}</a></>}
          </>
        )],
      ]}
      renderRow={(r) => (
        <div>
          <div className="date">{r.full_name}</div>
          <div className="desc">
            {fmtDate(r.work_date)}{' '}{tx("· usul")}{' '}{r.requested_clock_in?.slice(0, 5) || '-'} - {r.requested_clock_out?.slice(0, 5) || '-'}
          </div>
          {r.reason && <div className="desc">{r.reason}</div>}
          {r.attachment_url && <a href={r.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--blue)' }}>{tx("Lihat lampiran")}</a>}
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
  const base = { 'Periode (YYYY-MM)': todayStr().slice(0, 7), 'PTKP': 'TK/0', 'Badan Usaha': 'CV Napocut', 'Gaji Pokok': 5000000 }
  PENDAPATAN_FIELDS.forEach(([label]) => { base[label] = 0 })
  POTONGAN_FIELDS.forEach(([label]) => { base[label] = 0 })
  const rows = employees.slice(0, 5).map((e) => ({
    'Kode Karyawan': e.employee_code, 'Nama (referensi saja)': e.full_name, ...base, 'Catatan': '',
  }))
  if (rows.length === 0) rows.push(Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c, ''])))

  const wsData = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_COLUMNS })
  const wsRef = XLSX.utils.aoa_to_sheet([
    ['Kode Karyawan', tx("Nama")],
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

function PayslipTab({ employees, onToast, isDesktop }) {
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
    onToast(tx("Slip gaji dihapus"))
    load()
  }

  async function resend(row) {
    const { error } = await supabase.rpc('notify_payslip', { p_employee_id: row.employee_id, p_period: row.period })
    if (error) { onToast(error.message); return }
    onToast(tx("Notifikasi dikirim ke {0}", [row.full_name]))
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
        onToast(tx("Tidak ada baris valid di file ini (cek kolom Kode Karyawan & Periode)"))
        setImporting(false)
        return
      }
      const { data, error } = await supabase.rpc('bulk_upsert_payslips', { p_rows: parsed })
      if (error) { onToast(error.message); setImporting(false); return }
      setImportResult(data)
      onToast(tx("{0} slip gaji berhasil diimpor{1}", [data.ok.length, data.failed.length ? tx(", {0} gagal", [data.failed.length]) : '']))
      load()
    } catch (err) {
      onToast(tx("Gagal membaca file: ") + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="form-page">
      <div style={{ background: '#eef1fb', color: '#4356C4', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{tx("Download template Excel, isi rincian gaji & tunjangan per karyawan, lalu unggah lagi di sini untuk input massal. Setiap kali slip gaji disimpan/diimpor, karyawan otomatis dapat notifikasi di app (ikon 🔔 untuk kirim ulang).")}</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10, ...(isDesktop ? { maxWidth: 480 } : {}) }}>
        <button className="primary-btn" style={{ flex: 1, background: '#eee', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => downloadTemplate(employees)}>
          <Download size={17} />{' '}{tx("Template Excel")}</button>
        <label className="primary-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
          <Upload size={17} /> {importing ? tx("Mengimpor...") : tx("Unggah Excel")}
          <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
        </label>
      </div>

      {importResult?.failed?.length > 0 && (
        <div style={{ background: '#FBE1DD', color: '#C0392B', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{tx("Gagal:")}{' '}{importResult.failed.map((f) => `${f.employee_code} (${f.error})`).join(', ')}
        </div>
      )}

      <div className={isDesktop ? 'dsk-toolbar' : undefined} style={isDesktop ? { marginTop: 6 } : undefined}>
        <button
          className={isDesktop ? 'dsk-outline-btn' : 'primary-btn'}
          style={isDesktop
            ? { display: 'inline-flex', alignItems: 'center', gap: 8 }
            : { marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setEditing({})}
        >
          <Plus size={isDesktop ? 15 : 18} /> {isDesktop ? tx("INPUT MANUAL") : tx("Input manual")}
        </button>
        {rows && rows.length > 0 && (
          <ExportButton style={isDesktop ? { marginBottom: 0 } : undefined} onClick={() => exportToExcel('data-slip-gaji.xlsx', 'Slip Gaji', rows, [
            [tx("Kode Karyawan"), 'employee_code'], [tx("Nama"), 'full_name'], [tx("Jabatan"), 'position'], [tx("Departemen"), 'department'],
            [tx("Periode"), (r) => new Date(r.period).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })],
            [tx("Gaji Pokok"), 'basic_salary'], [tx("Total Tunjangan"), 'allowances'], [tx("Total Potongan"), 'deductions'],
            ['Take Home Pay', 'net_salary'], ['PTKP', 'ptkp_status'], [tx("Badan Usaha"), 'business_entity'], [tx("Catatan"), 'notes'],
          ])} />
        )}
      </div>

      {rows === null ? (
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><p>{tx("Belum ada slip gaji yang diinput.")}</p></div>
      ) : isDesktop ? (
        <div className="dsk-table-wrap">
          <table className="dsk-table">
            <thead><tr><th>{tx("Karyawan")}</th><th>{tx("Periode")}</th><th>Take home pay</th><th>{tx("Aksi")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                  <td>{new Date(r.period).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</td>
                  <td>{rupiah(r.net_salary)}</td>
                  <td className="acts">
                    <button className="btn" onClick={() => resend(r)} title={tx("Kirim ulang notifikasi")}><Bell size={13} /></button>
                    <button className="btn" onClick={() => setEditing(r)}><Pencil size={13} /></button>
                    <button className="btn muted" onClick={() => remove(r.id)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="list-item">
            <div className="info">
              <div className="name">{r.full_name}</div>
              <div className="sub">{new Date(r.period).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })} · {rupiah(r.net_salary)}</div>
            </div>
            <div className="actions">
              <button onClick={() => resend(r)} title={tx("Kirim ulang notifikasi")}><Bell size={17} /></button>
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
          onSaved={() => { setEditing(null); load(); onToast(tx("Slip gaji disimpan")) }}
        />
      )}
    </div>
  )
}

function PayslipForm({ row, employees, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee_id: row.employee_id || '', period: row.period ? row.period.slice(0, 7) : todayStr().slice(0, 7),
    basic_salary: row.basic_salary || '', allowances: row.allowances || '', deductions: row.deductions || '', notes: row.notes || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!row.id && !form.employee_id) { setError(tx("Pilih karyawan terlebih dahulu")); return }
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
        <div className="sheet-title-row"><h3>{row.id ? tx("Edit Slip Gaji") : tx("Input Slip Gaji")}</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>{tx("Karyawan")}</label>
            <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} disabled={!!row.id}>
              <option value="">{tx("- Pilih karyawan -")}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
            </select>
          </div>
          <div className="field"><label>{tx("Periode (bulan)")}</label><input type="month" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} /></div>
          <div className="field"><label>{tx("Gaji pokok")}</label><input type="number" value={form.basic_salary} onChange={(e) => setForm((f) => ({ ...f, basic_salary: e.target.value }))} /></div>
          <div className="field"><label>{tx("Tunjangan (total)")}</label><input type="number" value={form.allowances} onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))} /></div>
          <div className="field"><label>{tx("Potongan (total)")}</label><input type="number" value={form.deductions} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} /></div>
          <div className="field"><label>{tx("Catatan")}</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          {error && <p className="error-text">{error}</p>}
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{tx("Untuk rincian tunjangan/potongan per item, gunakan import Excel.")}</p>
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Simpan")}</button>
        </form>
      </div>
    </div>
  )
}
