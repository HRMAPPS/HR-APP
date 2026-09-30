// Import karyawan massal dari Excel (template: public/template-import-karyawan.xlsx)
import { supabase } from './supabaseClient'

export const TEMPLATE_URL = `${import.meta.env.BASE_URL}template-import-karyawan.xlsx`

const DAY_MAP = { min: 0, sen: 1, sel: 2, rab: 3, kam: 4, jum: 5, sab: 6 }
const ROLES = ['employee', 'hr', 'admin']

// Header di template -> key internal (tanpa tanda * dan huruf besar/kecil diabaikan)
const HEADER_MAP = {
  'kode karyawan': 'code', 'nama lengkap': 'name', 'jabatan': 'position', 'departemen': 'department',
  'kode atasan': 'manager_code', 'no. hp': 'phone', 'no hp': 'phone', 'email': 'email',
  'role akses': 'role', 'shift default': 'shift', 'hari kerja': 'days', 'tanggal bergabung': 'join_date',
}

function norm(h) { return String(h || '').replace(/\*/g, '').trim().toLowerCase() }
function str(v) { return v == null ? '' : String(v).trim() }

function toIsoDate(v) {
  if (v == null || v === '') return { value: null }
  if (v instanceof Date && !isNaN(v)) {
    // +12 jam supaya aman dari pergeseran zona waktu SheetJS
    const d = new Date(v.getTime() + 12 * 3600 * 1000)
    return { value: d.toISOString().slice(0, 10) }
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return { value: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/) // DD/MM/YYYY
  if (m) return { value: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  return { error: `Tanggal "${s}" tidak valid (pakai YYYY-MM-DD)` }
}

export async function readEmployeeFile(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'karyawan') || wb.SheetNames[0]
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: true })
  return raw.map((r, i) => {
    const o = { _row: i + 2 } // baris di Excel (header = baris 1)
    Object.entries(r).forEach(([k, v]) => { const key = HEADER_MAP[norm(k)]; if (key) o[key] = v })
    return o
  })
}

// Validasi + susun rencana impor. existingEmployees: hasil get_hr_employees, shifts: hasil get_hr_shifts
export function buildPlan(rows, existingEmployees, shifts, departments = []) {
  const deptByLower = new Map(departments.map((d) => [d.name.toLowerCase(), d.name]))
  const existingByCode = new Map(existingEmployees.filter((e) => e.employee_code).map((e) => [e.employee_code.toLowerCase(), e]))
  const shiftByName = new Map(shifts.map((s) => [s.name.toLowerCase(), s]))
  const seen = new Set()

  const items = rows
    // lewati baris kosong & baris contoh dari template
    .filter((r) => str(r.code) || str(r.name))
    .filter((r) => !(str(r.code) === 'EMP-0200' && str(r.name) === 'Contoh Nama Karyawan'))
    .map((r) => {
      const it = {
        row: r._row, code: str(r.code), name: str(r.name), position: str(r.position) || null,
        department: (deptByLower.get(str(r.department).toLowerCase()) || str(r.department)) || null, manager_code: str(r.manager_code),
        phone: str(r.phone) || null, email: str(r.email) || null,
        role: str(r.role).toLowerCase() || 'employee', shiftName: str(r.shift), shift_id: null,
        work_days: null, join_date: null, status: 'ok', message: '',
      }
      const fail = (msg) => { if (it.status === 'ok') { it.status = 'error'; it.message = msg } }

      if (!it.code) fail('Kode Karyawan kosong')
      if (!it.name) fail('Nama Lengkap kosong')
      if (it.code) {
        const key = it.code.toLowerCase()
        if (existingByCode.has(key)) { it.status = 'skip'; it.message = 'Kode sudah ada di sistem (dilewati)' }
        else if (seen.has(key)) fail('Kode dobel di file ini')
        seen.add(key)
      }
      if (!ROLES.includes(it.role)) fail(`Role "${it.role}" tidak valid (employee/hr/admin)`)

      if (it.shiftName) {
        const s = shiftByName.get(it.shiftName.toLowerCase())
        if (!s) fail(`Shift "${it.shiftName}" tidak ditemukan`)
        else it.shift_id = s.id
      }
      const daysRaw = str(r.days)
      if (daysRaw) {
        const parts = daysRaw.split(/[,;\s]+/).filter(Boolean).map((d) => d.toLowerCase().slice(0, 3))
        const bad = parts.find((d) => !(d in DAY_MAP))
        if (bad) fail(`Hari "${bad}" tidak valid (Sen,Sel,Rab,Kam,Jum,Sab,Min)`)
        else if (parts.length < 7) it.work_days = [...new Set(parts.map((d) => DAY_MAP[d]))]
      }
      const jd = toIsoDate(r.join_date)
      if (jd.error) fail(jd.error); else it.join_date = jd.value
      return it
    })

  // Cek kode atasan: harus ada di sistem atau di baris lain yang akan dibuat
  const willExist = new Set(items.filter((i) => i.status === 'ok').map((i) => i.code.toLowerCase()))
  items.forEach((it) => {
    if (it.status !== 'ok' || !it.manager_code) return
    const k = it.manager_code.toLowerCase()
    if (!existingByCode.has(k) && !willExist.has(k)) { it.status = 'error'; it.message = `Kode Atasan "${it.manager_code}" tidak ditemukan` }
  })
  return items
}

// Jalankan impor. Baris dibuat berurutan supaya atasan (di file yang sama) lebih dulu terbuat.
export async function runImport(items, existingEmployees, onProgress, existingDepartments = []) {
  const idByCode = new Map(existingEmployees.filter((e) => e.employee_code).map((e) => [e.employee_code.toLowerCase(), e.id]))
  let pending = items.filter((i) => i.status === 'ok')
  // peta nama departemen -> id; departemen baru dari file didaftarkan dulu
  const deptId = new Map((existingDepartments || []).map((d) => [d.name.toLowerCase(), d.id]))
  const fresh = [...new Set(pending.map((i) => i.department).filter((n) => n && !deptId.has(n.toLowerCase())))]
  if (fresh.length) {
    const { data: created } = await supabase.from('departments').insert(fresh.map((name) => ({ name }))).select('id,name')
    ;(created || []).forEach((d) => deptId.set(d.name.toLowerCase(), d.id))
  }
  const ok = [], failed = []
  let total = pending.length, done = 0

  while (pending.length) {
    const ready = pending.filter((i) => !i.manager_code || idByCode.has(i.manager_code.toLowerCase()))
    if (ready.length === 0) { // sisa = atasan saling merujuk (siklus)
      pending.forEach((i) => failed.push({ row: i.row, code: i.code, error: 'Rantai atasan tidak bisa diselesaikan (siklus)' }))
      break
    }
    for (const it of ready) {
      const { data, error } = await supabase.rpc('create_employee_hr', {
        p_employee_code: it.code, p_full_name: it.name, p_position: it.position, p_department: it.department,
        p_manager_id: it.manager_code ? idByCode.get(it.manager_code.toLowerCase()) : null,
        p_phone: it.phone, p_email: it.email, p_role: it.role,
        p_default_shift_id: it.shift_id, p_default_work_days: it.shift_id ? it.work_days : null,
        ...(it.join_date ? { p_join_date: it.join_date } : {}),
      })
      done++
      if (error) failed.push({ row: it.row, code: it.code, error: error.message })
      else {
        ok.push(it.code)
        if (data?.id) {
          idByCode.set(it.code.toLowerCase(), data.id)
          const did = it.department && deptId.get(it.department.toLowerCase())
          if (did) await supabase.rpc('update_employee_department', { p_employee_id: data.id, p_department_id: did })
        }
      }
      onProgress?.(done, total)
    }
    pending = pending.filter((i) => !ready.includes(i))
  }
  return { ok, failed }
}
