import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './AttendanceLog.css'

import { tx } from '../lib/i18n'
const TZ = 'Asia/Jakarta'
const MONTHS = ['Jan','Feb','Mar','Apr',tx("May"),'Jun','Jul',tx("Aug"),'Sep',tx("Oct"),'Nov',tx("Dec")]
const iso = (d) => d.toISOString().slice(0, 10)
const utc = (y, m, d) => new Date(Date.UTC(y, m, d))
const mins = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m }
const hhmm = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : null

// Period runs from the 25th of the previous month to the 24th of the chosen month.
function periodOf(ym) {
  const [y, m] = ym.split('-').map(Number)
  return { start: utc(y, m - 2, 25), end: utc(y, m - 1, 24) }
}

function buildRows({ start, end }, att, sched, shifts, holidays, emp, today) {
  const rows = []
  for (let d = new Date(start); d <= end; d = utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)) {
    const key = iso(d)
    const dow = d.getUTCDay() || 7 // 1=Mon ... 7=Sun
    const hol = holidays.find((h) => h.start_date <= key && h.end_date >= key)
    const s = sched[key]
    const a = att[key]
    let shift = null
    let off = false
    if (s) { off = s.is_day_off; shift = s.shift_id ? shifts[s.shift_id] : null }
    else if (emp?.default_shift_id && (emp.default_work_days || []).includes(dow)) shift = shifts[emp.default_shift_id]
    else off = true

    const r = {
      key, date: d, hol, shift, kind: 'work', clockIn: hhmm(a?.clock_in), clockOut: hhmm(a?.clock_out),
      flags: [], worked: null,
    }
    if (hol) r.kind = 'holiday'
    else if (off || !shift) r.kind = 'off'
    if (r.kind === 'work') {
      const startM = mins(shift.start_time.slice(0, 5))
      const endM = mins(shift.end_time.slice(0, 5))
      if (key > today) r.kind = 'upcoming'
      else if (!a || (!a.clock_in && !a.clock_out)) { if (key < today) r.kind = 'absent'; else r.kind = 'upcoming' }
      else {
        if (!r.clockIn) r.flags.push('noin')
        else if (mins(r.clockIn) > startM) r.flags.push('late')
        if (!r.clockOut && key < today) r.flags.push('noout')
        else if (r.clockOut && mins(r.clockOut) < endM) r.flags.push('early')
        if (r.clockIn && r.clockOut) {
          const w = mins(r.clockOut) - mins(r.clockIn)
          r.worked = `${Math.floor(w / 60)}h ${String(w % 60).padStart(2, '0')}m`
        }
      }
    }
    rows.push(r)
  }
  return rows
}

const LABEL = { holiday: tx("Holiday"), off: tx("Day off"), absent: tx("Absent"), upcoming: 'Upcoming' }
const FLAG = { late: tx("Late clock in"), early: tx("Early clock out"), noin: tx("No clock in"), noout: tx("No clock out") }

export default function AttendanceLog() {
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [state, setState] = useState({ loading: true, error: null, emp: null, rows: [] })
  const [filter, setFilter] = useState('all')
  const period = useMemo(() => periodOf(ym), [ym])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const { data: u } = await supabase.auth.getUser()
        const { data: emp, error: e1 } = await supabase
          .from('employees')
          .select('id, full_name, position, default_shift_id, default_work_days')
          .eq('auth_user_id', u.user.id)
          .single()
        if (e1) throw e1
        const from = iso(period.start), to = iso(period.end)
        const [att, sch, shf, cal] = await Promise.all([
          supabase.from('attendance').select('work_date, clock_in, clock_out').eq('employee_id', emp.id).gte('work_date', from).lte('work_date', to),
          supabase.from('shift_schedules').select('work_date, shift_id, is_day_off').eq('employee_id', emp.id).gte('work_date', from).lte('work_date', to),
          supabase.from('shifts').select('id, name, start_time, end_time'),
          supabase.from('calendar_events').select('title, start_date, end_date').eq('kind', 'holiday').lte('start_date', to).gte('end_date', from),
        ])
        const err = att.error || sch.error || shf.error || cal.error
        if (err) throw err
        const by = (list, k) => Object.fromEntries((list.data || []).map((x) => [x[k], x]))
        const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
        const rows = buildRows(period, by(att, 'work_date'), by(sch, 'work_date'), by(shf, 'id'), cal.data || [], emp, today)
        if (alive) setState({ loading: false, error: null, emp, rows })
      } catch (e) {
        if (alive) setState({ loading: false, error: e.message || tx("Failed to load attendance"), emp: null, rows: [] })
      }
    })()
    return () => { alive = false }
  }, [period])

  const { rows, emp, loading, error } = state
  const count = (f) => rows.filter(f).length
  const stats = {
    onTime: count((r) => r.kind === 'work' && !r.flags.includes('late') && !r.flags.includes('noin')),
    late: count((r) => r.flags.includes('late')),
    early: count((r) => r.flags.includes('early')),
    noOut: count((r) => r.flags.includes('noout')),
    noIn: count((r) => r.flags.includes('noin')),
    absent: count((r) => r.kind === 'absent'),
    off: count((r) => r.kind === 'off'),
  }
  const worked = count((r) => r.kind === 'work' || r.kind === 'absent')
  const pct = worked ? Math.round((stats.onTime / worked) * 100) : 0
  const visible = rows.filter((r) =>
    filter === 'all' ? true
    : filter === 'work' ? r.kind === 'work'
    : filter === 'late' ? r.flags.includes('late')
    : filter === 'issues' ? r.kind === 'absent' || r.flags.length > 0
    : r.kind === 'off' || r.kind === 'holiday')

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, t: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
  })
  const fmt = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`

  return (
    <div className="attlog">
      <div className="al-wrap">
        <header className="al-head">
          <div>
            <h1>{tx("My attendance log")}</h1>
            <div className="al-sub">{emp ? `${emp.full_name}${emp.position ? ' · ' + emp.position : ''}` : ' '}</div>
          </div>
          <label className="al-period">
            <select value={ym} onChange={(e) => setYm(e.target.value)} aria-label={tx("Period")}>
              {months.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
            </select>
            <span className="al-dim">{fmt(period.start)} – {fmt(period.end)}</span>
          </label>
        </header>

        {error && <div className="al-card al-error">{error}</div>}

        <section className="al-hero">
          <div className="al-card al-score">
            <div className="al-ring">
              <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
                <circle cx="66" cy="66" r="56" fill="none" stroke="var(--off-soft)" strokeWidth="14" />
                <circle cx="66" cy="66" r="56" fill="none" stroke="var(--ok)" strokeWidth="14" strokeLinecap="round"
                  strokeDasharray="352" strokeDashoffset={352 - (352 * pct) / 100} />
              </svg>
              <b>{pct}%</b>
            </div>
            <div>
              <h2>{stats.onTime}{' '}{tx("of")}{' '}{worked}{' '}{tx("workdays on time")}</h2>
              <p>{stats.late}{' '}{tx("late clock-ins,")}{' '}{stats.noIn}{' '}{tx("missing clock-in and")}{' '}{stats.absent}{' '}{tx("absences this period.")}</p>
            </div>
          </div>
          <div className="al-card al-stats">
            {[[tx("On time"), stats.onTime, 'g'], [tx("Late clock in"), stats.late, 'w'], [tx("Early clock out"), stats.early, ''], [tx("No clock out"), stats.noOut, ''],
              [tx("No clock in"), stats.noIn, 'r'], [tx("Absent"), stats.absent, 'r'], [tx("Day off"), stats.off, ''], [tx("Time off"), 0, '']].map(([l, v, c]) => (
              <div key={l} className={'al-stat ' + c}><b>{v}</b><span>{l}</span></div>
            ))}
          </div>
        </section>

        <section className="al-card al-table">
          <div className="al-filters" role="group" aria-label="Filter">
            {[['all', tx("All days")], ['work', tx("Workdays")], ['late', tx("Late")], ['issues', tx("Needs attention")], ['off', tx("Off & holidays")]].map(([k, t]) => (
              <button key={k} type="button" className="al-chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}</button>
            ))}
          </div>
          <div className="al-scroll">
            <table>
              <thead><tr><th>{tx("Date")}</th><th>Shift</th><th>{tx("Schedule")}</th><th>Clock in</th><th>Clock out</th><th>{tx("Worked")}</th><th>Status</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan="7" className="al-empty">{tx("Loading attendance…")}</td></tr>}
                {!loading && !visible.length && <tr><td colSpan="7" className="al-empty">{tx("No days match this filter.")}</td></tr>}
                {!loading && visible.map((r) => {
                  const dow = r.date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
                  const weekend = dow === 'Sat' || dow === 'Sun' || r.kind === 'holiday'
                  const work = r.kind === 'work'
                  return (
                    <tr key={r.key}>
                      <td>
                        <div className="al-date">
                          <div className={'al-dn' + (weekend ? ' we' : '')}><b>{r.date.getUTCDate()}</b><small>{MONTHS[r.date.getUTCMonth()]}</small></div>
                          <div><b>{dow}</b><div className="al-dim">{r.key}</div></div>
                        </div>
                      </td>
                      <td>
                        {r.kind === 'holiday' ? <span className="al-hol">{r.hol.title}</span>
                          : r.kind === 'off' ? <span className="al-dim">{tx("Libur")}</span>
                          : <b>{r.shift?.name}</b>}
                      </td>
                      <td className="al-t al-dim">{r.shift && r.kind !== 'off' && r.kind !== 'holiday' ? `${r.shift.start_time.slice(0, 5)} – ${r.shift.end_time.slice(0, 5)}` : '–'}</td>
                      <td className={'al-t' + (r.flags.includes('late') ? ' late' : work && r.clockIn ? ' ok' : ' al-dim')}>{r.clockIn || '–'}</td>
                      <td className={'al-t' + (r.clockOut ? '' : ' al-dim')}>{r.clockOut || '–'}</td>
                      <td className="al-t">{r.worked || '–'}</td>
                      <td>
                        {work && !r.flags.length && <span className="al-pill ok">{tx("On time")}</span>}
                        {work && r.flags.map((f) => <span key={f} className={'al-pill ' + (f === 'late' || f === 'early' ? 'late' : 'hol')}>{FLAG[f]}</span>)}
                        {!work && <span className={'al-pill ' + (r.kind === 'absent' ? 'hol' : r.kind === 'holiday' ? 'hol' : 'off')}>{LABEL[r.kind]}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
