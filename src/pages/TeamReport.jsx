import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Clock, MapPin, Minus, Plus, User, X } from 'lucide-react'
import { useIsDesktop } from '../lib/useIsDesktop'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import { useBackHandler } from '../lib/backStack'
import TeamStatsCarousel, { StatsHelpSheet } from '../components/TeamStatsCarousel'
import TeamMemberAttendance from './TeamMemberAttendance'
import './TeamReportMobile.css'

import { tx, locale } from '../lib/i18n'
function pad2(n) { return String(n).padStart(2, '0') }

function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function fmtTime(iso) {
  if (!iso) return null
  // HH:mm (titik dua) dalam WIB, tidak bergantung zona waktu perangkat
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
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
  const [openId, setOpenId] = useState(null)       // anggota yang sedang diperluas (satu per waktu)
  const [memberView, setMemberView] = useState(null) // {id, name} -> kehadiran bulanan
  const [help, setHelp] = useState(false)
  useBackHandler(() => setMemberView(null), !!memberView && !isDesktop)

  useEffect(() => { load(); setOpenId(null) }, [date, employee?.id])

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
      const noClockIn = !!a && !a.clock_in && !!a.clock_out
      const earlyOut = !invalid && !!a?.clock_out && !!shift?.end_time &&
        new Date(a.clock_out).toTimeString().slice(0, 5) < shift.end_time.slice(0, 5)
      const onTime = !!a?.clock_in && !late && !invalid
      const absent = isPastOrToday && !dayOff && !onLeave && !a?.clock_in && !a?.clock_out
      return { emp: t, shift, att: a, onLeave, dayOff, late, invalid, noClockOut, noClockIn, earlyOut, onTime, absent }
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
    noClockIn: rows.filter((r) => r.noClockIn).length,
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

  if (memberView) {
    return <TeamMemberAttendance empId={memberView.id} name={memberView.name} onBack={() => setMemberView(null)} />
  }

  const longDate = new Date(date + 'T00:00:00').toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')

  return (
    <div className="tr-page">
      <header className="tr-head">
        <button type="button" className="tr-back" onClick={onBack} aria-label={tx("Kembali")}><ArrowLeft size={26} /></button>
        <label className="tr-title">
          <span className="tr-title-main">{longDate}<ChevronDown size={22} /></span>
          <input type="date" value={date} max={todayStr()} aria-label={tx("Pilih tanggal")}
            onChange={(e) => { if (e.target.value) setDate(e.target.value) }} />
        </label>
        <span className="tr-head-sp" />
      </header>

      <TeamStatsCarousel
        onHelp={() => setHelp(true)}
        hadir={[[tx("Tepat waktu"), stats.onTime], [tx("Terlambat masuk"), stats.late], [tx("Pulang lebih awal"), stats.earlyOut],
          [tx("Tidak clock in"), stats.noClockIn], [tx("Tidak clock out"), stats.noClockOut], [tx("Tidak valid"), stats.invalid]]}
        absent={[[tx("Absen"), stats.absent], [tx("Cuti"), stats.cuti]]}
      />

      <section className="tr-list">
        {loading && <div className="tr-empty">{tx("Memuat...")}</div>}
        {!loading && rows.length === 0 && (
          <div className="tr-empty">
            <User size={36} color="#ccc" />
            <h3>{tx("Belum ada anggota tim")}</h3>
            <p>{tx("Karyawan yang atasannya Anda akan muncul di sini.")}</p>
          </div>
        )}
        {!loading && rows.map((r) => {
          const a = r.att
          const open = openId === r.emp.id
          const hasAtt = !!(a?.clock_in || a?.clock_out)
          const events = []
          if (a?.clock_in) events.push({ k: 'in', time: fmtTime(a.clock_in), label: 'Clock in' })
          if (a?.clock_out) events.push({ k: 'out', time: fmtTime(a.clock_out), label: 'Clock out' })
          const shiftLabel = !r.shift ? null
            : r.shift.is_day_off ? tx("Hari libur")
            : `${r.shift.name} (${r.shift.start_time?.slice(0, 5)} - ${r.shift.end_time?.slice(0, 5)})`
          return (
            <div key={r.emp.id} className="tr-item">
              <button type="button" className="tr-item-head" aria-expanded={open} onClick={() => setOpenId(open ? null : r.emp.id)}>
                <TeamAvatar url={r.emp.avatar_url} name={r.emp.full_name} size={44} />
                <div className="tr-info">
                  <div className="tr-name">{r.emp.full_name}</div>
                  <div className="tr-sub">{r.emp.employee_code || '-'}{r.emp.department ? ` | ${r.emp.department}` : ''}</div>
                  {hasAtt ? (
                    <div className="tr-times">
                      <span className={'tr-t g' + (r.late ? ' late' : '')}><Clock size={20} />{fmtTime(a.clock_in) || '-'}</span>
                      <span className="tr-t b"><Clock size={20} />{fmtTime(a.clock_out) || '-'}</span>
                    </div>
                  ) : <div className="tr-sub">{tx("Belum ada presensi")}</div>}
                </div>
                <span className="tr-toggle">{open ? <Minus size={24} /> : <Plus size={24} />}</span>
              </button>
              {open && (
                <div className="tr-body">
                  {shiftLabel && <div className="tr-shift">{shiftLabel}</div>}
                  {events.map((ev) => (
                    <button key={ev.k} type="button" className="tr-ev" onClick={() => setDetail(r)}>
                      <MapPin size={26} /><span className="t">{ev.time}</span><span className="l">{ev.label}</span><ChevronRight size={24} />
                    </button>
                  ))}
                  <button type="button" className="tr-link" onClick={() => setMemberView({ id: r.emp.id, name: r.emp.full_name })}>
                    {tx("Lihat semua data kehadiran")}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {help && <StatsHelpSheet onClose={() => setHelp(false)} />}

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
                <span style={{ color: 'var(--text-muted)' }}>{tx("Clock In")}</span>
                <b>{fmtTime(detail.att?.clock_in) || '-'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{tx("Clock Out")}</span>
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
