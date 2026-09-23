import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, User, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'

function pad2(n) { return String(n).padStart(2, '0') }

function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function fmtTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function TeamAvatar({ url, name, size = 42 }) {
  if (url) {
    return <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#eee' }} />
  }
  return <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}>{initials(name)}</div>
}

// Manager-facing attendance report for direct reports (employees.manager_id
// = the logged-in employee), for a single selected day. Mirrors "Laporan
// tim saya" in the reference app: a swipeable stats strip up top, then a
// list of each report's clock in/out for that day.
export default function TeamReport({ employee, onBack }) {
  const [date, setDate] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statsPage, setStatsPage] = useState(0)
  const [detail, setDetail] = useState(null)

  useEffect(() => { load() }, [date, employee?.id])

  async function load() {
    if (!employee?.id) return
    setLoading(true)
    const { data: team } = await supabase
      .from('employees')
      .select('id, full_name, employee_code, position, department, avatar_url, default_work_days, default_shift:default_shift_id(name,start_time,end_time)')
      .eq('manager_id', employee.id)
      .order('full_name')

    const list = team || []
    const ids = list.map((t) => t.id)
    if (ids.length === 0) { setRows([]); setLoading(false); return }

    const [{ data: att }, { data: sched }, { data: leaves }] = await Promise.all([
      supabase.from('attendance').select('*').in('employee_id', ids).eq('work_date', date),
      supabase.from('shift_schedules').select('employee_id, is_day_off, shifts(name,start_time,end_time)').in('employee_id', ids).eq('work_date', date),
      supabase.from('leave_requests').select('employee_id').in('employee_id', ids).eq('status', 'approved').lte('start_date', date).gte('end_date', date),
    ])
    const attByEmp = Object.fromEntries((att || []).map((a) => [a.employee_id, a]))
    const schedByEmp = Object.fromEntries((sched || []).map((s) => [s.employee_id, s]))
    const leaveSet = new Set((leaves || []).map((l) => l.employee_id))
    const dow = new Date(date + 'T00:00:00').getDay()
    const isPastOrToday = date <= todayStr()

    const merged = list.map((t) => {
      const explicit = schedByEmp[t.id]
      const shift = explicit
        ? { name: explicit.shifts?.name, start_time: explicit.shifts?.start_time, end_time: explicit.shifts?.end_time, is_day_off: explicit.is_day_off }
        : t.default_shift
          ? { name: t.default_shift.name, start_time: t.default_shift.start_time, end_time: t.default_shift.end_time, is_day_off: t.default_work_days ? !t.default_work_days.includes(dow) : false }
          : null
      const a = attByEmp[t.id] || null
      const onLeave = leaveSet.has(t.id)
      const dayOff = !!shift?.is_day_off
      const late = a?.status === 'late'
      const invalid = !!a?.clock_in && !!a?.clock_out && new Date(a.clock_out) <= new Date(a.clock_in)
      const noClockOut = !!a?.clock_in && !a?.clock_out
      const earlyOut = !invalid && !!a?.clock_out && !!shift?.end_time &&
        new Date(a.clock_out).toTimeString().slice(0, 5) < shift.end_time.slice(0, 5)
      const onTime = !!a?.clock_in && !late && !invalid
      const absent = isPastOrToday && !dayOff && !onLeave && !a?.clock_in && !a?.clock_out
      return { emp: t, shift, att: a, onLeave, dayOff, late, invalid, noClockOut, earlyOut, onTime, absent }
    })
    setRows(merged)
    setLoading(false)
  }

  const stats = useMemo(() => ({
    onTime: rows.filter((r) => r.onTime).length,
    late: rows.filter((r) => r.late).length,
    earlyOut: rows.filter((r) => r.earlyOut).length,
    clockedIn: rows.filter((r) => r.att?.clock_in).length,
    noClockOut: rows.filter((r) => r.noClockOut).length,
    invalid: rows.filter((r) => r.invalid).length,
    absent: rows.filter((r) => r.absent).length,
    cuti: rows.filter((r) => r.onLeave).length,
  }), [rows])

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
  const isToday = date >= todayStr()

  function onStatsScroll(e) {
    const w = e.currentTarget.clientWidth
    if (w) setStatsPage(Math.round(e.currentTarget.scrollLeft / w))
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setDate((d) => addDays(d, -1))}><ChevronLeft size={18} /></button>
          <h1 style={{ flex: 'none', fontSize: 16.5 }}>{dateLabel}</h1>
          <button className="icon-btn" style={{ color: '#fff', opacity: isToday ? 0.4 : 1, pointerEvents: isToday ? 'none' : 'auto' }}
            onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
        <span style={{ width: 22 }} />
      </div>

      <div
        style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', display: 'flex', WebkitOverflowScrolling: 'touch' }}
        onScroll={onStatsScroll}
      >
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start' }}>
          <div className="stats-strip">
            <div className="stat"><div className="num">{stats.onTime}</div><div className="lbl">Tepat waktu</div></div>
            <div className="stat"><div className="num">{stats.late}</div><div className="lbl">Terlambat masuk</div></div>
            <div className="stat"><div className="num">{stats.earlyOut}</div><div className="lbl">Pulang lebih awal</div></div>
          </div>
        </div>
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', display: 'flex', gap: 10 }}>
          <div className="stats-strip" style={{ flex: 1, margin: '14px 0 0 16px' }}>
            <div className="stat"><div className="num">{stats.clockedIn}</div><div className="lbl">Sudah clock in</div></div>
            <div className="stat"><div className="num">{stats.noClockOut}</div><div className="lbl">Tidak clock out</div></div>
            <div className="stat"><div className="num">{stats.invalid}</div><div className="lbl">Tidak valid</div></div>
          </div>
          <div className="stats-strip" style={{ flex: 'none', width: 140, margin: '14px 16px 0 0', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ fontWeight: 700, fontSize: 12.5 }}>Tidak hadir</div>
            <div style={{ display: 'flex', gap: 14, width: '100%' }}>
              <div className="stat"><div className="num">{stats.absent}</div><div className="lbl">Absen</div></div>
              <div className="stat"><div className="num">{stats.cuti}</div><div className="lbl">Cuti</div></div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '8px 0 2px' }}>
        {[0, 1].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: statsPage === i ? 'var(--blue)' : '#e2ddd6' }} />
        ))}
      </div>

      <div style={{ padding: '4px 0 24px' }}>
        {loading && <div className="empty-state"><p>Memuat...</p></div>}
        {!loading && rows.length === 0 && (
          <div className="empty-state">
            <User size={36} color="#ccc" />
            <h3>Belum ada anggota tim</h3>
            <p>Karyawan yang atasannya Anda akan muncul di sini.</p>
          </div>
        )}
        {!loading && rows.map((r) => (
          <div key={r.emp.id} className="list-item" onClick={() => setDetail(r)} style={{ cursor: 'pointer' }}>
            <TeamAvatar url={r.emp.avatar_url} name={r.emp.full_name} />
            <div className="info">
              <div className="name">{r.emp.full_name}</div>
              <div className="sub">{r.emp.employee_code || '-'}{r.emp.department ? ` | ${r.emp.department}` : ''}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ color: r.att?.clock_in ? '#1e8e5a' : '#bbb' }}>{fmtTime(r.att?.clock_in) || '-'}</span>
              <span style={{ color: r.att?.clock_out ? 'var(--blue)' : '#bbb' }}>{fmtTime(r.att?.clock_out) || '-'}</span>
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <div className="sheet-overlay" onClick={() => setDetail(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title-row">
              <h3>{detail.emp.full_name}</h3>
              <button className="sheet-close" onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 14 }}>
              {detail.emp.position || '-'}{detail.emp.department ? ` · ${detail.emp.department}` : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5, marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Shift</span>
                <b>{detail.shift ? (detail.shift.is_day_off ? 'Libur' : `${detail.shift.name} (${detail.shift.start_time?.slice(0, 5)}-${detail.shift.end_time?.slice(0, 5)})`) : '-'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Clock in</span>
                <b>{fmtTime(detail.att?.clock_in) || '-'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Clock out</span>
                <b>{fmtTime(detail.att?.clock_out) || '-'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <b>
                  {detail.onLeave ? 'Cuti' : detail.dayOff ? 'Hari libur' : detail.absent ? 'Tidak hadir'
                    : detail.invalid ? 'Tidak valid' : detail.late ? 'Terlambat masuk'
                    : detail.noClockOut ? 'Belum clock out' : detail.earlyOut ? 'Pulang lebih awal'
                    : detail.onTime ? 'Tepat waktu' : '-'}
                </b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
