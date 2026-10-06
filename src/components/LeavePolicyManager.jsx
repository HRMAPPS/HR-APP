import { useEffect, useState } from 'react'
import { Pencil, Info } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { tx } from '../lib/i18n'

// Pengaturan kuota cuti (khusus HR). Kuota bersifat OPSIONAL per jenis cuti dan mati secara default.
// Penegakannya ada di database (submit_leave_request); halaman ini hanya mengatur lewat RPC set_leave_policy.
const days = (n) => tx("{0} hari", [Number(n)])

function Pill({ on }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap',
      background: on ? '#dcfce7' : '#e5e7eb', color: on ? '#166534' : '#374151',
    }}>{on ? tx("Diterapkan") : tx("Tidak diterapkan")}</span>
  )
}

export default function LeavePolicyManager({ onToast, isDesktop }) {
  const [types, setTypes] = useState(null)
  const [editing, setEditing] = useState(null)

  async function load() {
    const { data, error } = await supabase.from('leave_types').select('id, name, default_days, enforce_quota').order('name')
    if (error) { onToast(error.message); return }
    setTypes(data || [])
  }
  useEffect(() => { load() }, [])

  return (
    <div className="form-page">
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, background: '#eef1fb', color: '#4356C4',
        borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14,
      }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{tx("Secara default kuota cuti tidak diterapkan. Jika diaktifkan untuk satu jenis cuti, karyawan tidak bisa mengajukan melebihi kuota per tahun kalender (terpakai + menunggu persetujuan + pengajuan baru). Hanya berlaku untuk pengajuan baru; pengajuan yang sudah ada tidak berubah.")}</span>
      </div>

      {types === null ? (
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      ) : types.length === 0 ? (
        <div className="empty-state"><p>{tx("Belum ada jenis cuti.")}</p></div>
      ) : isDesktop ? (
        <div className="dsk-table-wrap">
          <table className="dsk-table">
            <thead><tr><th>{tx("Jenis cuti")}</th><th>{tx("Kuota per tahun")}</th><th>Status</th><th>{tx("Aksi")}</th></tr></thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{tx(t.name)}</td>
                  <td>{t.enforce_quota ? days(t.default_days) : <span style={{ color: 'var(--text-muted)' }}>{tx("Tanpa batas")}</span>}</td>
                  <td><Pill on={t.enforce_quota} /></td>
                  <td><button className="btn" onClick={() => setEditing(t)} aria-label={tx("Atur kuota")}><Pencil size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        types.map((t) => (
          <div key={t.id} className="list-item">
            <div className="info">
              <div className="name">{tx(t.name)}</div>
              <div className="sub">{t.enforce_quota ? tx("Kuota {0} per tahun", [days(t.default_days)]) : tx("Tanpa batas")}</div>
            </div>
            <div className="actions" style={{ alignItems: 'center', gap: 10 }}>
              <Pill on={t.enforce_quota} />
              <button onClick={() => setEditing(t)} aria-label={tx("Atur kuota")}><Pencil size={17} /></button>
            </div>
          </div>
        ))
      )}

      {editing && (
        <QuotaForm row={editing} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); load(); onToast(msg) }} />
      )}
    </div>
  )
}

function QuotaForm({ row, onClose, onSaved }) {
  const [enforce, setEnforce] = useState(!!row.enforce_quota)
  const [quota, setQuota] = useState(row.default_days ?? 0)
  const [impact, setImpact] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const q = Number(quota)
  const valid = quota !== '' && Number.isFinite(q) && q >= 0 && q <= 365

  // Tampilkan dampaknya SEBELUM kuota dinyalakan: berapa karyawan yang tahun ini sudah melewati/tepat di kuota.
  useEffect(() => {
    if (!enforce || !valid) { setImpact(null); return }
    let alive = true
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('get_leave_quota_impact', { p_leave_type_id: row.id, p_days: q })
      if (alive) setImpact(data || null)
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [enforce, quota, row.id])

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (enforce && !valid) { setError(tx("Kuota harus berupa angka 0 sampai 365 hari")); return }
    setSaving(true)
    const { error: err } = await supabase.rpc('set_leave_policy', {
      p_leave_type_id: row.id, p_enforce: enforce, p_days: valid ? q : null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(enforce ? tx("Kuota cuti diterapkan") : tx("Kuota cuti dinonaktifkan"))
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{tx("Kuota")} · {tx(row.name)}</h3></div>
        <form onSubmit={submit}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600, margin: '4px 0 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={enforce} onChange={(e) => setEnforce(e.target.checked)} style={{ width: 18, height: 18 }} />
            {tx("Terapkan kuota untuk jenis cuti ini")}
          </label>

          <div className="field" style={{ opacity: enforce ? 1 : 0.55 }}>
            <label>{tx("Kuota (hari per tahun)")}</label>
            <input type="number" min="0" max="365" step="0.5" value={quota} disabled={!enforce}
              onChange={(e) => setQuota(e.target.value)} />
          </div>

          {enforce && valid && q === 0 && (
            <p style={{ fontSize: 13, color: '#8a5a0b', margin: '0 0 10px' }}>{tx("Kuota 0 berarti semua pengajuan baru untuk jenis cuti ini akan ditolak.")}</p>
          )}
          {enforce && impact && (impact.employees_over > 0 || impact.employees_at_limit > 0) && (
            <div style={{ background: '#FBEEDD', color: '#8a5a0b', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '0 0 12px' }}>
              {impact.employees_over > 0 && <div>{tx("{0} karyawan pada {1} sudah memakai/mengajukan lebih dari {2} hari. Pengajuan mereka yang ada tidak berubah, tetapi mereka tidak bisa mengajukan lagi.", [impact.employees_over, impact.year, q])}</div>}
              {impact.employees_at_limit > 0 && <div>{tx("{0} karyawan pada {1} tepat berada di batas {2} hari.", [impact.employees_at_limit, impact.year, q])}</div>}
            </div>
          )}
          {enforce && impact && impact.employees_over === 0 && impact.employees_at_limit === 0 && (
            <p style={{ fontSize: 13, color: '#166534', margin: '0 0 12px' }}>{tx("Tidak ada karyawan yang terdampak pada {0}.", [impact.year])}</p>
          )}

          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Simpan")}</button>
        </form>
      </div>
    </div>
  )
}
