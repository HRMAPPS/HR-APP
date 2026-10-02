import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { flagLabel, flagLevel, reviewFlags } from '../lib/attendanceFlags'
import { tx, locale } from '../lib/i18n'

// Lencana kecil di daftar absensi HR: jumlah tanda yang perlu ditinjau.
export function FlagBadge({ flags }) {
  const n = reviewFlags(flags).length
  if (!n) return null
  const high = (flags || []).some((f) => flagLevel(f) === 'high')
  return (
    <span title={tx("Ada tanda risiko absensi, klik untuk detail")} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 8, fontSize: 11.5, fontWeight: 700,
      padding: '2px 7px', borderRadius: 8, background: high ? '#FBE1DD' : '#FBEEDD', color: high ? '#C0392B' : '#8a5a0b',
    }}>
      <ShieldAlert size={12} />{n}
    </span>
  )
}

const shortUa = (ua) => {
  if (!ua) return '-'
  const m = ua.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return [os, m ? m[0].split('/')[0] : ''].filter(Boolean).join(' · ') || ua.slice(0, 40)
}

// Panel keamanan di detail absensi HR: tanda risiko, jejak perangkat/IP, dan reset wajah.
export default function SecurityPanel({ detail }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const events = detail?.security_events || []
  const flags = [...new Set(events.flatMap((e) => e.flags || []))]
  const review = reviewFlags(flags)

  async function resetFace() {
    if (!window.confirm(tx("Reset data wajah {0}? Karyawan harus mendaftarkan wajah lagi sebelum bisa absen.", [detail.full_name]))) return
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('hr_reset_face', { p_employee_id: detail.employee_id })
    setBusy(false)
    setMsg(error ? error.message : tx("Data wajah direset. Karyawan perlu mendaftarkan wajah kembali."))
  }

  return (
    <div style={{ margin: '4px 0 14px' }}>
      {flags.length > 0 && (
        <div style={{ background: review.length ? '#FBEEDD' : '#eef1fb', color: review.length ? '#8a5a0b' : '#4356C4', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
          <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldAlert size={15} />{review.length ? tx("Perlu ditinjau") : tx("Catatan keamanan")}</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {flags.map((f) => <li key={f}>{flagLabel(f)}</li>)}
          </ul>
        </div>
      )}
      {events.length > 0 && (
        <details style={{ marginTop: 8, fontSize: 12.5 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>{tx("Jejak perangkat dan jaringan")}</summary>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th>{tx("Jenis")}</th><th>{tx("Waktu")}</th><th>{tx("Perangkat")}</th><th>IP</th><th>{tx("Akurasi")}</th><th>{tx("Jarak wajah")}</th>
              </tr></thead>
              <tbody>{events.map((e, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td>{e.kind === 'in' ? 'In' : 'Out'}</td>
                  <td>{new Date(e.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</td>
                  <td title={e.user_agent}>{shortUa(e.user_agent)}</td>
                  <td>{e.ip || '-'}</td>
                  <td>{e.accuracy != null ? `${Math.round(e.accuracy)} m` : '-'}</td>
                  <td>{e.face_distance != null ? Number(e.face_distance).toFixed(2) : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      )}
      {detail?.employee_id && (
        <div style={{ marginTop: 8 }}>
          <button onClick={resetFace} disabled={busy}
            style={{ background: 'none', border: 0, padding: 0, color: '#C0392B', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {tx("Reset data wajah karyawan")}
          </button>
          {msg && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--text-muted)' }}>{msg}</div>}
        </div>
      )}
    </div>
  )
}
