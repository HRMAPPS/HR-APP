import { useEffect, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { TEMPLATE_URL, readEmployeeFile, buildPlan, runImport } from '../lib/employeeImport'

import { tx } from '../lib/i18n'
const STATUS_STYLE = {
  ok: { label: tx("Siap"), bg: '#E1F3EA', color: '#1E8E5A' },
  skip: { label: tx("Dilewati"), bg: '#FFF3D6', color: '#B4650C' },
  error: { label: 'Error', bg: '#FBE1DD', color: '#C0392B' },
}

export default function EmployeeImportModal({ employees, onClose, onDone }) {
  const [shifts, setShifts] = useState([])
  const [departments, setDepartments] = useState([])
  const [items, setItems] = useState(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('get_hr_shifts').then(({ data }) => setShifts(data || []))
    supabase.from('departments').select('id,name').then(({ data }) => setDepartments(data || []))
  }, [])

  async function onFile(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setError(''); setResult(null); setItems(null); setFileName(file.name)
    try {
      const rows = await readEmployeeFile(file)
      const plan = buildPlan(rows, employees, shifts, departments)
      if (plan.length === 0) { setError(tx("Tidak ada baris data di file ini. Pastikan data diisi mulai baris 3 di sheet \"Karyawan\".")); return }
      setItems(plan)
    } catch (err) {
      setError(tx("Gagal membaca file: ") + err.message)
    }
  }

  const okCount = items?.filter((i) => i.status === 'ok').length || 0

  async function doImport() {
    setBusy(true); setError('')
    const res = await runImport(items, employees, (d, t) => setProgress(`${d}/${t}`), departments)
    setBusy(false); setProgress(null)
    setResult(res)
    if (res.ok.length) onDone?.(tx("{0} karyawan berhasil diimpor{1}", [res.ok.length, res.failed.length ? tx(", {0} gagal", [res.failed.length]) : '']), res.failed.length === 0)
  }

  return (
    <div className="sheet-overlay" onClick={busy ? undefined : onClose}>
      <div className="sheet" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{tx("Import Karyawan dari Excel")}</h3></div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>{tx("Unduh template, isi data karyawan (mulai baris 3), lalu unggah kembali. Kode yang sudah ada di sistem akan dilewati.")}</p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <a className="primary-btn" href={TEMPLATE_URL} download="template-import-karyawan.xlsx"
            style={{ flex: 1, background: '#eee', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
            <Download size={17} />{' '}{tx("Unduh Template")}</a>
          <label className="primary-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
            <Upload size={17} />{' '}{tx("Pilih File Excel")}<input type="file" accept=".xlsx,.xls" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        {items && !result && (
          <>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <b>{fileName}</b> — {okCount}{' '}{tx("siap diimpor,")}{' '}{items.filter((i) => i.status === 'skip').length}{' '}{tx("dilewati,")}{' '}{items.filter((i) => i.status === 'error').length}{' '}{tx("error")}</div>
            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table className="dsk-table" style={{ fontSize: 13 }}>
                <thead><tr><th>{tx("Baris")}</th><th>{tx("Kode")}</th><th>{tx("Nama")}</th><th>{tx("Role")}</th><th>Status</th></tr></thead>
                <tbody>
                  {items.map((it) => {
                    const st = STATUS_STYLE[it.status]
                    return (
                      <tr key={it.row}>
                        <td>{it.row}</td><td>{it.code || '-'}</td><td>{it.name || '-'}</td><td>{it.role}</td>
                        <td>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: st.bg, color: st.color }}>{st.label}</span>
                          {it.message && <div style={{ fontSize: 12, color: st.color, marginTop: 3 }}>{it.message}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button className="primary-btn" style={{ marginTop: 14 }} disabled={busy || okCount === 0} onClick={doImport}>
              {busy ? tx("Mengimpor... {0}", [progress || '']) : tx("Impor {0} karyawan", [okCount])}
            </button>
          </>
        )}

        {result && (
          <div style={{ marginTop: 6 }}>
            <div style={{ background: '#E1F3EA', color: '#1E8E5A', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, marginBottom: 10 }}>
              {result.ok.length}{' '}{tx("karyawan berhasil ditambahkan.")}</div>
            {result.failed.length > 0 && (
              <div style={{ background: '#FBE1DD', color: '#C0392B', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 10 }}>{tx("Gagal:")}{' '}{result.failed.map((f) => tx("baris {0} {1} ({2})", [f.row, f.code, f.error])).join('; ')}
              </div>
            )}
            <button className="primary-btn" onClick={onClose}>{tx("Selesai")}</button>
          </div>
        )}
      </div>
    </div>
  )
}
