import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, User, X } from 'lucide-react'
import { useIsDesktop } from '../lib/useIsDesktop'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'

import { tx, locale } from '../lib/i18n'
function pad2(n) { return String(n).padStart(2, '0') }

function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function fmtTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
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
  const isDesktop = useIsDesktop()
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

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString(locale(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
  const isToday = date >= todayStr()

  function onStatsScroll(e) {
    const w = e.currentTarget.clientWidth
    if (w) setStatsPage(Math.round(e.currentTarget.scrollLeft / w))
  }

  if (isDesktop) {
    return (
      <div className="dsk-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <h1 className="dsk-title">{tx("Laporan Tim Saya")}</h1>
            <p className="dsk-sub" style={{ marginBottom: 0 }}>{dateLabel}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="icon-btn" onClick={() => setDate((d) => addDays(d, -1))}><ChevronLeft size={20} /></button>
            <button className="icon-btn" style={{ opacity: isToday ? 0.35 : 1, pointerEvents: isToday ? 'none' : 'auto' }}
              onClick={() => setDate((d) => addDays(d, 1))}><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="dsk-stats" style={{ marginTop: 26 }}>
          <div><b>{stats.onTime}</b><span>{tx("tepat waktu")}</span></div>
          <div><b>{stats.late}</b><span>{tx("terlambat masuk")}</span></div>
          <div><b>{stats.earlyOut}</b><span>{tx("pulang lebih awal")}</span></div>
          <div><b>{stats.clockedIn}</b><span>{tx("sudah clock in")}</span></div>
          <div><b>{stats.noClockOut}</b><span>{tx("tidak clock out")}</span></div>
          <div><b>{stats.invalid}</b><span>{tx("tidak valid")}</span></div>
          <div><b>{stats.absent}</b><span>{tx("tidak hadir")}</span></div>
          <div><b>{stats.cuti}</b><span>{tx("cuti")}</span></div>
        </div>

        <div className="dsk-table-wrap">
          <table className="dsk-table">
            <thead><tr><th>{tx("Karyawan")}</th><th>{tx("Departemen")}</th><th>Shift</th><th>Clock in</th><th>Clock out</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="empty">{tx("Memuat...")}</td></tr>
                : rows.length === 0 ? <tr><td colSpan={6} className="empty">{tx("Karyawan yang atasannya Anda akan muncul di sini.")}</td></tr>
                : rows.map((r) => (
                  <tr key={r.emp.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(r)}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <TeamAvatar url={r.emp.avatar_url} name={r.emp.full_name} size={30} />
                      {r.emp.full_name}
                    </td>
                    <td>{r.emp.department || '-'}</td>
                    <td>{r.shift ? (r.shift.is_day_off ? tx("Libur") : `${r.shift.name || ''} ${r.shift.start_time?.slice(0, 5) || ''}-${r.shift.end_time?.slice(0, 5) || ''}`) : '-'}</td>
                    <td style={{ color: r.att?.clock_in ? '#1e8e5a' : '#bbb', fontWeight: 600 }}>{fmtTime(r.att?.clock_in) || '-'}</td>
                    <td style={{ color: r.att?.clock_out ? '#3B6ECF' : '#bbb', fontWeight: 600 }}>{fmtTime(r.att?.clock_out) || '-'}</td>
                    <td>
                      {r.onLeave ? tx("Cuti") : r.dayOff ? tx("Hari libur") : r.absent ? tx("Tidak hadir")
                        : r.invalid ? tx("Tidak valid") : r.late ? tx("Terlambat masuk")
                        : r.noClockOut ? tx("Belum clock out") : r.earlyOut ? tx("Pulang lebih awal")
                        : r.onTime ? tx("Tepat waktu") : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {detail && <TeamReportDetailModal detail={detail} onClose={() => setDetail(null)} />}
      </div>
    )
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
            <div className="stat"><div className="num">{stats.onTime}</div><div className="lbl">{tx("Tepat waktu")}</div></div>
            <div className="stat"><div className="num">{stats.late}</div><div className="lbl">{tx("Terlambat masuk")}</div></div>
            <div className="stat"><div className="num">{stats.earlyOut}</div><div className="lbl">{tx("Pulang lebih awal")}</div></div>
          </div>
        </div>
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', display: 'flex', gap: 10 }}>
          <div className="stats-strip" style={{ flex: 1, margin: '14px 0 0 16px' }}>
            <div className="stat"><div className="num">{stats.clockedIn}</div><div className="lbl">{tx("Sudah clock in")}</div></div>
            <div className="stat"><div className="num">{stats.noClockOut}</div><div className="lbl">{tx("Tidak clock out")}</div></div>
            <div className="stat"><div className="num">{stats.invalid}</div><div className="lbl">{tx("Tidak valid")}</div></div>
          </div>
          <div className="stats-strip" style={{ flex: 'none', width: 140, margin: '14px 16px 0 0', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ fontWeight: 700, fontSize: 12.5 }}>{tx("Tidak hadir")}</div>
            <div style={{ display: 'flex', gap: 14, width: '100%' }}>
              <div className="stat"><div className="num">{stats.absent}</div><div className="lbl">{tx("Absen")}</div></div>
              <div className="stat"><div className="num">{stats.cuti}</div><div className="lbl">{tx("Cuti")}</div></div>
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
        {loading && <div className="empty-state"><p>{tx("Memuat...")}</p></div>}
        {!loading && rows.length === 0 && (
          <div className="empty-state">
            <User size={36} color="#ccc" />
            <h3>{tx("Belum ada anggota tim")}</h3>
            <p>{tx("Karyawan yang atasannya Anda akan muncul di sini.")}</p>
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

      {detail && !isDesktop && (
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
                <b>{detail.shift ? (detail.shift.is_day_off ? tx("Libur") : `${detail.shift.name} (${detail.shift.start_time?.slice(0, 5)}-${detail.shift.end_time?.slice(0, 5)})`) : '-'}</b>
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
                  {detail.onLeave ? tx("Cuti") : detail.dayOff ? tx("Hari libur") : detail.absent ? tx("Tidak hadir")
                    : detail.invalid ? tx("Tidak valid") : detail.late ? tx("Terlambat masuk")
                    : detail.noClockOut ? tx("Belum clock out") : detail.earlyOut ? tx("Pulang lebih awal")
                    : detail.onTime ? tx("Tepat waktu") : '-'}
                </b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function TeamReportDetailModal({ detail, onClose }) {
  const line = (label, value) => <div className="dl"><span>{label}</span><div>{value}</div></div>
  return (
    <div className="modal-overlay dcuti-overlay" onClick={onClose}>
      <div className="dcuti-modal narrow" onClick={(e) => e.stopPropagation()}>
        <div className="dcuti-modal-body">
          <h2>{detail.emp.full_name}</h2>
          <div className="dcuti-detail">
            {line('Jabatan', detail.emp.position || '-')}
            {line('Departemen', detail.emp.department || '-')}
            {line('Shift', detail.shift ? (detail.shift.is_day_off ? tx("Libur") : `${detail.shift.name} (${detail.shift.start_time?.slice(0, 5)}-${detail.shift.end_time?.slice(0, 5)})`) : '-')}
            {line('Clock in', fmtTime(detail.att?.clock_in) || '-')}
            {line('Clock out', fmtTime(detail.att?.clock_out) || '-')}
            {line('Status', detail.onLeave ? tx("Cuti") : detail.dayOff ? tx("Hari libur") : detail.absent ? tx("Tidak hadir")
              : detail.invalid ? tx("Tidak valid") : detail.late ? tx("Terlambat masuk")
              : detail.noClockOut ? tx("Belum clock out") : detail.earlyOut ? tx("Pulang lebih awal")
              : detail.onTime ? tx("Tepat waktu") : '-')}
          </div>
        </div>
        <div className="dcuti-modal-foot"><button className="dcal-outline-btn" onClick={onClose}>{tx("TUTUP")}</button></div>
      </div>
    </div>
  )
}
