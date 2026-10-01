// Membaca file template "Template_Data_Karyawan.xlsx" yang sudah diisi karyawan.
// Hasilnya siap dikirim ke fungsi Supabase bulk_import_employee_data.
import * as XLSXNS from 'xlsx'
const XLSX = XLSXNS.default || XLSXNS

const EMPLOYEE_KEYS = [
  'employee_code', 'full_name', 'email', 'phone', 'personal_email', 'birth_place', 'birth_date',
  'gender', 'marital_status', 'blood_type', 'religion', 'nik', 'ktp_address', 'domicile_address',
  'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone',
  'bank_name', 'bank_account_holder', 'bank_account_number', 'npwp', 'bpjs_kesehatan',
  'bpjs_ketenagakerjaan', 'join_date', 'contract_type', 'work_location', 'additional_notes',
]
const DATE_KEYS = ['birth_date', 'join_date']

const pad = (n) => String(n).padStart(2, '0')

// Excel menyimpan tanggal sebagai angka (serial). Diubah ke 'YYYY-MM-DD' tanpa efek zona waktu.
export function toISODate(v) {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d || !d.y) return String(v)
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`
  }
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/) // dd/mm/yyyy
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) // yyyy-mm-dd
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return s // biarkan, nanti server menolak dengan pesan "format tanggal tidak valid"
}

function toText(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  return String(v).trim()
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

function findSheet(wb, startsWith) {
  const name = wb.SheetNames.find((n) => norm(n).startsWith(startsWith))
  return name ? wb.Sheets[name] : null
}

function rowsOf(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
}

// Tabel (Keluarga / Pendidikan): baris kunci tersembunyi berisi nama field.
function readTable(sheet, anchorKey, dateKeys = []) {
  const rows = rowsOf(sheet)
  const keyRowIdx = rows.findIndex((r) => r.some((c) => String(c).trim() === anchorKey))
  if (keyRowIdx < 0) return { items: [], missing: true }
  const keyRow = rows[keyRowIdx]
  const cols = []
  keyRow.forEach((c, i) => { if (String(c).trim()) cols.push([i, String(c).trim()]) })
  const items = []
  for (let r = keyRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    const first = String(row[0] ?? '').trim().toLowerCase()
    if (first === 'no.' || first === 'no' || first === 'contoh') continue
    const item = {}
    let any = false
    for (const [i, key] of cols) {
      const val = dateKeys.includes(key) ? toISODate(row[i]) : toText(row[i])
      item[key] = val
      if (val !== '') any = true
    }
    if (any) items.push(item)
  }
  return { items, missing: false }
}

/**
 * @param {ArrayBuffer} buffer isi file xlsx
 * @param {string} fileName nama file (untuk ditampilkan di laporan)
 * @returns {{source:string, employee:object, family:object[], education:object[], issues:string[], empty:boolean}}
 */
export function parseEmployeeWorkbook(buffer, fileName) {
  const issues = []
  const result = { source: fileName, employee: {}, family: [], education: [], issues, empty: false }

  let wb
  try {
    wb = XLSX.read(buffer, { type: 'array' })
  } catch (e) {
    issues.push('File tidak bisa dibaca. Pastikan formatnya .xlsx')
    result.empty = true
    return result
  }

  const main = findSheet(wb, 'datakaryawan')
  if (!main) {
    issues.push("Sheet 'Data Karyawan' tidak ditemukan. Gunakan template resmi.")
    result.empty = true
    return result
  }

  // Sheet utama: kolom A = kunci field (tersembunyi), kolom C = isian karyawan
  const rows = rowsOf(main)
  let foundKeys = 0
  for (const row of rows) {
    const key = String(row[0] ?? '').trim()
    if (!key || !EMPLOYEE_KEYS.includes(key)) continue
    foundKeys++
    result.employee[key] = DATE_KEYS.includes(key) ? toISODate(row[2]) : toText(row[2])
  }
  if (foundKeys === 0) issues.push('Struktur sheet tidak dikenali. Gunakan template resmi.')

  const famSheet = findSheet(wb, 'keluarga')
  if (famSheet) result.family = readTable(famSheet, 'relationship', ['birth_date']).items
  const eduSheet = findSheet(wb, 'pendidikan')
  if (eduSheet) result.education = readTable(eduSheet, 'institution').items

  const e = result.employee
  const hasIdentity = e.employee_code || e.email || e.full_name
  const filledCount = Object.entries(e).filter(([k, v]) => !['employee_code', 'full_name', 'email'].includes(k) && v !== '').length
  if (!hasIdentity) {
    issues.push('Nama lengkap / Email kantor belum diisi')
    result.empty = true
  } else if (filledCount === 0 && result.family.length === 0 && result.education.length === 0) {
    issues.push('Tidak ada data yang diisi selain identitas')
  }
  return result
}

// Bentuk yang dikirim ke RPC (tanpa field internal)
export function toPayload(parsed) {
  return { source: parsed.source, employee: parsed.employee, family: parsed.family, education: parsed.education }
}
