import { useEffect, useMemo, useState } from 'react'
import * as sbModule from '../lib/supabaseClient'
import { parseEmployeeWorkbook, toPayload } from '../lib/parseEmployeeWorkbook'

// Mendukung `export const supabase` maupun `export default`
const supabase = sbModule.supabase || sbModule.default

const CHUNK = 40
const MAX_FILES = 200
const MAX_BYTES = 2 * 1024 * 1024 // template terisi hanya puluhan KB; batas ini mencegah file raksasa/berbahaya

const normText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

// Tandai file yang merujuk karyawan yang sama dalam satu unggahan (yang terakhir diproses menimpa yang sebelumnya)
function markDuplicates(list) {
  const groups = new Map()
  list.forEach((it, idx) => {
    if (it.empty) return
    const e = it.employee || {}
    const key = normText(e.employee_code) ? 'k:' + normText(e.employee_code)
      : normText(e.email) ? 'e:' + normText(e.email) : 'n:' + normText(e.full_name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(idx)
  })
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue
    for (const i of idxs) {
      const others = idxs.filter((j) => j !== i).map((j) => list[j].source)
      list[i].issues = [...(list[i].issues || []),
        `Duplikat dalam unggahan: karyawan yang sama juga ada di ${others.slice(0, 2).join(', ')}${others.length > 2 ? ` (+${others.length - 2})` : ''}. File yang diproses paling akhir menimpa yang sebelumnya.`]
    }
  }
}

const STATUS = {
  update: { label: 'Update', bg: '#dcfce7', fg: '#166534' },
  create: { label: 'Karyawan baru', bg: '#dbeafe', fg: '#1e40af' },
  not_found: { label: 'Tidak ditemukan', bg: '#fef3c7', fg: '#92400e' },
  ambiguous: { label: 'Ganda', bg: '#fef3c7', fg: '#92400e' },
  error: { label: 'Error', bg: '#fee2e2', fg: '#991b1b' },
  skipped: { label: 'Dilewati', bg: '#e5e7eb', fg: '#374151' },
}
const MATCH = { kode: 'Kode karyawan', email: 'Email kantor', nama: 'Nama' }

const s = {
  page: { maxWidth: 1000, margin: '0 auto', padding: 16, fontFamily: 'inherit', color: '#111827' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 },
  h1: { fontSize: 20, fontWeight: 700, margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#6b7280', margin: 0 },
  btn: { background: '#c0392b', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: '#fff', color: '#c0392b', border: '1px solid #c0392b', borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
  btnOff: { opacity: 0.5, cursor: 'not-allowed' },
  th: { textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '8px 10px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  td: { fontSize: 13, padding: '8px 10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
}

function Badge({ status }) {
  const st = STATUS[status] || STATUS.error
  return (
    <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {st.label}
    </span>
  )
}

export default function ImportEmployees({ onBack }) {
  const [allowed, setAllowed] = useState(null) // null = sedang cek
  const [items, setItems] = useState([]) // hasil baca file
  const [rows, setRows] = useState([]) // hasil cek / import per file
  const [phase, setPhase] = useState('pick') // pick | previewed | done
  const [createMissing, setCreateMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [partial, setPartial] = useState('') // pesan galat bila pengiriman terhenti di tengah jalan

  useEffect(() => {
    let alive = true
    supabase.rpc('is_hr').then(({ data, error: err }) => {
      if (alive) setAllowed(!err && data === true)
    })
    return () => { alive = false }
  }, [])

  const sendable = useMemo(() => items.filter((i) => !i.empty), [items])

  async function onPickFiles(e) {
    setError('')
    setPartial('')
    setRows([])
    setPhase('pick')
    let files = Array.from(e.target.files || [])
    const parsed = []
    if (files.length > MAX_FILES) {
      setError(`Maksimal ${MAX_FILES} file per unggahan. ${files.length - MAX_FILES} file terakhir tidak dibaca; unggah sisanya pada gelombang berikutnya.`)
      files = files.slice(0, MAX_FILES)
    }
    const reject = (f, why) => parsed.push({ source: f.name, employee: {}, family: [], education: [], issues: [why], empty: true })
    for (const f of files) {
      if (!/\.xlsx$/i.test(f.name)) { reject(f, 'Bukan file .xlsx'); continue }
      if (f.size > MAX_BYTES) { reject(f, `Ukuran file melebihi ${MAX_BYTES / 1024 / 1024} MB`); continue }
      try {
        const buf = await f.arrayBuffer()
        parsed.push(parseEmployeeWorkbook(buf, f.name))
      } catch (err) {
        reject(f, 'Gagal membaca file')
      }
    }
    markDuplicates(parsed)
    setItems(parsed)
    e.target.value = ''
  }

  // Kirim ke Supabase per potongan agar aman untuk banyak file
  async function run(dryRun) {
    const payload = sendable.map(toPayload)
    const out = []
    let failure = ''
    for (let off = 0; off < payload.length; off += CHUNK) {
      const chunk = payload.slice(off, off + CHUNK)
      try {
        const { data, error: err } = await supabase.rpc('bulk_import_employee_data', {
          p_rows: chunk,
          p_dry_run: dryRun,
          p_create_missing: createMissing,
        })
        if (err) throw err
        for (const r of data.results) out.push({ ...r, _src: sendable[off + r.row - 1] })
      } catch (err) {
        // Potongan sebelumnya sudah tersimpan: jangan buang hasilnya. Tandai sisanya "tidak terkirim".
        failure = err.message || 'Koneksi terputus'
        for (let i = off; i < payload.length; i++) {
          out.push({ status: 'error', source: sendable[i].source, full_name: sendable[i].employee?.full_name || '',
            error: 'Tidak terkirim: ' + failure, warnings: [], _src: sendable[i] })
        }
        break
      }
    }
    // tambahkan file yang dilewati di sisi klien
    const skipped = items.filter((i) => i.empty).map((i) => ({
      status: 'skipped', source: i.source, full_name: '', error: i.issues.join('; '), warnings: [], _src: i,
    }))
    return { rows: [...out, ...skipped], failure }
  }

  async function onPreview() {
    setBusy(true); setError(''); setPartial('')
    try {
      const { rows: r, failure } = await run(true)
      setRows(r)
      setPhase('previewed')
      if (failure) {
        setPartial(failure)
        setError(`Pengecekan terhenti: ${failure}. Beberapa file belum dicek (ditandai "Tidak terkirim"). Coba "Cek dulu" lagi sebelum import.`)
      }
    } catch (err) {
      setError(err.message || 'Gagal melakukan pengecekan')
    } finally { setBusy(false) }
  }

  async function onImport() {
    const okCount = rows.filter((r) => r.status === 'update' || r.status === 'create').length
    if (!window.confirm(`Import data ${okCount} karyawan sekarang? Kolom yang terisi akan menimpa data lama.`)) return
    setBusy(true); setError('')
    try {
      const { rows: r, failure } = await run(false)
      setRows(r)
      setPhase('done')
      if (failure) {
        const saved = r.filter((x) => x.status === 'update' || x.status === 'create').length
        const notSent = r.filter((x) => String(x.error || '').startsWith('Tidak terkirim')).length
        setError(`Import terhenti di tengah jalan (${failure}). ${saved} karyawan sudah tersimpan, ${notSent} belum terkirim` +
          ` (potongan yang sedang dikirim saat terputus mungkin sudah tersimpan). Aman diulang: pilih file yang sama, klik "Cek dulu", lalu "Import sekarang" — data yang sama hanya ditimpa dengan nilai yang sama.`)
      }
    } catch (err) {
      setError(err.message || 'Gagal import')
    } finally { setBusy(false) }
  }

  const okCount = rows.filter((r) => r.status === 'update' || r.status === 'create').length
  const failCount = rows.length - okCount

  if (allowed === null) return <div style={s.page}>Memeriksa akses…</div>
  if (!allowed) return <div style={s.page}>{onBack && <button onClick={onBack} style={{ background: 'none', border: 0, color: '#c0392b', fontWeight: 600, cursor: 'pointer', padding: '0 0 10px' }}>← Kembali</button>}<div style={s.card}>Halaman ini khusus HR.</div></div>

  return (
    <div style={s.page}>
      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 0, color: '#c0392b', fontWeight: 600, cursor: 'pointer', padding: '0 0 10px' }}>
          ← Kembali
        </button>
      )}
      <div style={s.card}>
        <h1 style={s.h1}>Import Data Karyawan</h1>
        <p style={s.sub}>
          Karyawan mengisi template Excel, lalu HR mengunggah semua file di sini. Sistem mencocokkan karyawan lewat
          Kode karyawan → Email kantor → Nama, lalu mengisi data personal, kontak darurat, bank/pajak/BPJS, keluarga,
          serta pendidikan &amp; pengalaman.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <a href="/Template_Data_Karyawan.xlsx" download style={s.btnGhost}>Unduh template</a>
          <label style={{ ...s.btn, display: 'inline-block' }}>
            Pilih file terisi (boleh banyak)
            <input type="file" accept=".xlsx" multiple onChange={onPickFiles} style={{ display: 'none' }} />
          </label>
        </div>
        <ul style={{ fontSize: 12, color: '#6b7280', margin: '12px 0 0', paddingLeft: 18 }}>
          <li>Hanya kolom yang terisi yang menimpa data lama; kolom kosong tidak menghapus apa pun.</li>
          <li>Jabatan, departemen, golongan, atasan, dan role tidak diubah oleh import ini.</li>
          <li>Jika sheet Keluarga / Pendidikan terisi, daftar lama karyawan itu diganti dengan isi file.</li>
          <li>Maksimal 200 file per unggahan, format .xlsx, ukuran maksimal 2 MB per file.</li>
        </ul>
      </div>

      {items.length > 0 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <b>{items.length} file dipilih</b>
              <span style={{ color: '#6b7280', fontSize: 13 }}> · {sendable.length} siap dicek</span>
            </div>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={createMissing} onChange={(e) => { setCreateMissing(e.target.checked); setPhase('pick'); setRows([]); setPartial('') }} />
              Buat karyawan baru jika tidak ditemukan
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              style={{ ...s.btnGhost, ...(busy || sendable.length === 0 ? s.btnOff : {}) }}
              disabled={busy || sendable.length === 0}
              onClick={onPreview}
            >
              {busy && phase === 'pick' ? 'Mengecek…' : '1. Cek dulu (tidak mengubah data)'}
            </button>
            <button
              style={{ ...s.btn, ...(busy || phase !== 'previewed' || okCount === 0 || !!partial ? s.btnOff : {}) }}
              disabled={busy || phase !== 'previewed' || okCount === 0 || !!partial}
              onClick={onImport}
            >
              {busy && phase === 'previewed' ? 'Mengimpor…' : '2. Import sekarang'}
            </button>
          </div>
          {error && <p style={{ color: '#991b1b', fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>
      )}

      {phase !== 'pick' && rows.length > 0 && (
        <div style={s.card}>
          <div style={{ marginBottom: 10 }}>
            {phase === 'done' ? (
              <b style={{ color: '#166534' }}>Selesai: {okCount} karyawan berhasil diimpor{failCount ? `, ${failCount} gagal/dilewati` : ''}.</b>
            ) : (
              <b>Hasil pengecekan: {okCount} siap diimpor{failCount ? `, ${failCount} perlu dicek` : ''}.</b>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={s.th}>File</th>
                  <th style={s.th}>Karyawan</th>
                  <th style={s.th}>Dicocokkan via</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Kolom</th>
                  <th style={s.th}>Keluarga</th>
                  <th style={s.th}>Riwayat</th>
                  <th style={s.th}>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const notes = [...(r.warnings || []), ...(r._src?.issues || []), r.error].filter(Boolean)
                  return (
                    <tr key={i}>
                      <td style={s.td}>{r.source}</td>
                      <td style={s.td}>
                        {r.full_name || '-'}
                        {r.employee_code ? <div style={{ color: '#6b7280', fontSize: 12 }}>{r.employee_code}</div> : null}
                      </td>
                      <td style={s.td}>{MATCH[r.match_by] || '-'}</td>
                      <td style={s.td}><Badge status={r.status} /></td>
                      <td style={s.td}>{r.filled ?? '-'}</td>
                      <td style={s.td}>{r.family ?? '-'}</td>
                      <td style={s.td}>{r.education ?? '-'}</td>
                      <td style={{ ...s.td, color: r.error ? '#991b1b' : '#92400e' }}>{notes.join(' · ') || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
