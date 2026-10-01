import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { toDateStr } from '../lib/dateUtils'

import { tx } from '../lib/i18n'
// Panel kanan Beranda desktop (gaya Talenta): "Sakit Used", "Unpaid Leave Used"
// dan "Who's Off". Data dari RPC get_leave_summary & get_whos_off
// (lihat supabase/migrations/20260930_home_leave_summary_whos_off.sql).

const cardStyle = { background: '#fff', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }
const linkBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: 'var(--blue)', fontSize: 13.5, textAlign: 'left',
}

function formatDays(n) {
  const v = Number(n) || 0
  return `${v} ${v > 1 ? tx("Days") : tx("Day")}`
}

function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function StatBlock({ label, value, actionLabel, onAction }) {
  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 4px' }}>{value}</div>
      <button onClick={onAction} style={linkBtn}>{actionLabel} →</button>
    </div>
  )
}

export default function HomeLeavePanel({ onNavigate }) {
  const [summary, setSummary] = useState(null)
  const [offDay, setOffDay] = useState('today') // 'today' | 'tomorrow'
  const [offList, setOffList] = useState([])
  const [offLoading, setOffLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_leave_summary')
      .then(({ data }) => setSummary(data || { sakit_used: 0, unpaid_used: 0 }))
  }, [])

  const targetDate = offDay === 'today'
    ? new Date()
    : new Date(Date.now() + 24 * 60 * 60 * 1000)
  const targetStr = toDateStr(targetDate)

  useEffect(() => {
    let cancelled = false
    setOffLoading(true)
    supabase.rpc('get_whos_off', { p_date: targetStr })
      .then(({ data }) => {
        if (cancelled) return
        setOffList(data || [])
        setOffLoading(false)
      })
    return () => { cancelled = true }
  }, [targetStr])

  const dateHeading = targetDate
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .replace(',', '')
    .toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <StatBlock
            label={tx("Sakit Used")}
            value={summary ? formatDays(summary.sakit_used) : '…'}
            actionLabel={tx("Request sakit")}
            onAction={() => onNavigate('cuti-new')}
          />
          <StatBlock
            label={tx("Unpaid Leave Used")}
            value={summary ? formatDays(summary.unpaid_used) : '…'}
            actionLabel={tx("Request unpaid leave")}
            onAction={() => onNavigate('cuti-new')}
          />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 14 }}>
          <button onClick={() => onNavigate('cuti')} style={linkBtn}>{tx("View all")}</button>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{tx("Who's Off")}</div>
          <select
            value={offDay}
            onChange={(e) => setOffDay(e.target.value)}
            style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}
          >
            <option value="today">{tx("Today")}</option>
            <option value="tomorrow">{tx("Tomorrow")}</option>
          </select>
        </div>

        <div style={{ background: '#f4f1ee', padding: '7px 20px', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
          {dateHeading}
        </div>

        <div style={{ padding: '6px 20px 12px', maxHeight: 280, overflowY: 'auto' }}>
          {offLoading ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0' }}>{tx("Memuat…")}</p>
          ) : offList.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0' }}>{tx("Tidak ada yang cuti.")}</p>
          ) : offList.map((p) => (
            <div key={p.employee_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
              {p.avatar_url
                ? <img src={p.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : (
                  <div className="avatar" style={{ width: 40, height: 40, fontSize: 13, flexShrink: 0 }}>
                    {initials(p.full_name) || <User size={16} />}
                  </div>
                )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.leave_type || tx("Cuti")}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
