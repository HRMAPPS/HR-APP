import { useEffect, useMemo, useState } from 'react'
import { Info, Search, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { tx } from '../lib/i18n'

// Tab HR "Persetujuan": ringkasan aturan berjenjang, saklar override HR, cakupan, dan pratinjau rantai per karyawan.
// Aturan sendiri disimpan di tabel approval_rules (diubah lewat SQL); halaman ini hanya membaca/mengatur override.
const RULES = [
  [1, [2, 3]], [2, [3]], [3, [4, 5]], [4, [5]], [5, [5]],
]

const box = (bg, fg) => ({ display: 'flex', alignItems: 'flex-start', gap: 8, background: bg, color: fg, borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 })

export default function ApprovalChainManager({ employees = [], onToast, isDesktop }) {
  const [override, setOverride] = useState(null)
  const [coverage, setCoverage] = useState(null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null)
  const [chain, setChain] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.rpc('get_approval_settings').then(({ data, error }) => { if (!error && data) setOverride(!!data.hr_override) })
    supabase.rpc('get_approval_coverage').then(({ data, error }) => { if (!error && data) setCoverage(data) })
  }, [])

  async function toggleOverride(next) {
    setSaving(true)
    const { error } = await supabase.rpc('set_approval_hr_override', { p_enabled: next })
    setSaving(false)
    if (error) { onToast(error.message); return }
    setOverride(next)
    onToast(next ? tx("Override HR diaktifkan") : tx("Override HR dinonaktifkan"))
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return employees.filter((e) => (e.full_name || '').toLowerCase().includes(q) || (e.employee_code || '').toLowerCase().includes(q)).slice(0, 8)
  }, [query, employees])

  async function pick(e) {
    setPicked(e); setQuery(''); setChain(null)
    const { data, error } = await supabase.rpc('preview_approval_chain', { p_employee_id: e.id })
    if (error) { onToast(error.message); return }
    setChain(data || [])
  }

  return (
    <div className="form-page">
      <div style={box('#eef1fb', '#4356C4')}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <b>{tx("Persetujuan berjenjang berdasarkan golongan")}</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {RULES.map(([g, steps]) => (
              <li key={g}>{tx("Golongan {0} → {1}", [g, steps.map((s) => tx("Gol. {0}", [s])).join(' → ')])}</li>
            ))}
          </ul>
          <div style={{ marginTop: 6 }}>{tx("Rantai ditelusuri ke atas lewat atasan. Tingkat yang tidak ada di rantai dilewati; bila tidak ada yang cocok dipakai atasan terdekat yang golongannya lebih tinggi, atau HR bila tidak ada atasan. Tahap berikutnya baru aktif setelah tahap sebelumnya menyetujui.")}</div>
        </div>
      </div>

      {coverage && (
        <div style={box(coverage.first_no_account > 0 ? '#FBEEDD' : '#dcfce7', coverage.first_no_account > 0 ? '#8a5a0b' : '#166534')}>
          {coverage.first_no_account > 0 && <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
          <div>
            {tx("Dari {0} karyawan aktif, {1} memiliki approver tahap pertama yang sudah punya akun login, {2} yang belum, dan {3} langsung ke HR.",
              [coverage.employees, coverage.first_with_account, coverage.first_no_account, coverage.first_hr])}
            {' '}{tx("Atasan dengan akun: {0} dari {1}.", [coverage.approvers_with_account, coverage.approvers_total])}
            {coverage.first_no_account > 0 && <div style={{ marginTop: 4 }}>{tx("Untuk approver yang belum punya akun, HR diberi tahu dan dapat menyetujui lewat override.")}</div>}
          </div>
        </div>
      )}

      <div className="section" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14.5, fontWeight: 600 }}>
          <input type="checkbox" checked={!!override} disabled={override === null || saving} onChange={(e) => toggleOverride(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
          <span>
            {tx("HR dapat meng-override persetujuan")}
            <div style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {tx("Jika aktif, HR dapat menyetujui/menolak pada tahap mana pun dan menyelesaikan sisa tahap sekaligus (tercatat sebagai tindakan HR). Jika dimatikan, hanya approver yang ditunjuk yang dapat memutuskan.")}
            </div>
          </span>
        </label>
        {override === false && coverage && coverage.first_no_account > 0 && (
          <div style={{ ...box('#FBE1DD', '#991b1b'), marginTop: 10, marginBottom: 0 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{tx("Peringatan: {0} karyawan memiliki approver yang belum punya akun login. Pengajuan mereka tidak akan bisa diproses selama override dimatikan.", [coverage.first_no_account])}</span>
          </div>
        )}
      </div>

      <div className="section">
        <b style={{ fontSize: 14.5 }}>{tx("Pratinjau rantai persetujuan")}</b>
        <div style={{ position: 'relative', margin: '10px 0' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx("Cari nama atau kode karyawan...")}
            style={{ width: '100%', padding: '9px 10px 9px 30px', borderRadius: 10, border: '1px solid var(--border)', boxSizing: 'border-box' }} />
          {matches.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: 40, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-sm)' }}>
              {matches.map((e) => (
                <button key={e.id} onClick={() => pick(e)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 0, background: 'none', cursor: 'pointer' }}>
                  {e.full_name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{e.employee_code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {picked && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{picked.full_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12.5 }}>{picked.employee_code}{picked.grade ? ` · ${tx("Gol. {0}", [picked.grade])}` : ''}</span></div>
            {chain === null ? <p style={{ color: 'var(--text-muted)' }}>{tx("Memuat...")}</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table className={isDesktop ? 'dsk-table' : undefined} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th>{tx("Tahap")}</th><th>{tx("Approver")}</th><th>{tx("Golongan")}</th><th>{tx("Jabatan")}</th><th>{tx("Akun login")}</th></tr></thead>
                  <tbody>
                    {chain.map((s) => (
                      <tr key={s.step_no} style={{ borderTop: '1px solid var(--border)' }}>
                        <td>{s.step_no}</td>
                        <td style={{ fontWeight: 600 }}>{s.approver_name}</td>
                        <td>{s.approver_grade ?? '-'}</td>
                        <td>{s.approver_position || '-'}</td>
                        <td>{s.approver_code ? (s.has_account ? <span style={{ color: '#166534' }}>{tx("Ada")}</span> : <span style={{ color: '#92400e' }}>{tx("Belum")}</span>) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
