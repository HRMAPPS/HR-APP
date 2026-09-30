import { useState } from 'react'
import { ArrowLeft, Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import './AttendanceLogDesktop.css'

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const hhmm = (ts) => (ts ? new Date(ts).toTimeString().slice(0, 5) : null)

// Header + tab switcher used on desktop for all three tabs of Daftar Absensi.
export function DesktopAbsensiHeader({ tab, onTab, onBack }) {
  const tabs = [['riwayat', 'Riwayat'], ['absensi', 'Pengajuan absensi'], ['shift', 'Pengajuan shift']]
  return (
    <div className="adx-top">
      <button className="adx-back" onClick={onBack} aria-label="Kembali"><ArrowLeft size={20} /></button>
      <h1>Daftar Absensi</h1>
      <div className="adx-tabs" role="tablist">
        {tabs.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => onTab(k)}>{t}</button>
        ))}
      </div>
    </div>
  )
}

export default function AttendanceLogDesktop({
  employee, loading, attendance, shiftByDate, today, dayIssue,
  monthLabel, periodLabel, onOpenMonth, statCards, onOpenIssue, onOpenDay,
}) {
  const [filter, setFilter] = useState('all')

  const rows = attendance.map((a) => {
    const [y, m, d] = a.work_date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    const shift = shiftByDate[a.work_date]
    const off = !!shift?.is_day_off
    const future = a.work_date > today
    const issue = dayIssue(a)
    let dur = null
    if (a.clock_in && a.clock_out) {
      const mm = Math.round((new Date(a.clock_out) - new Date(a.clock_in)) / 60000)
      if (mm > 0) dur = `${Math.floor(mm / 60)}j ${String(mm % 60).padStart(2, '0')}m`
    }
    let kind = 'none', label = '–'
    if (off) { kind = 'off'; label = 'Libur' }
    else if (future) { if (shift) { kind = 'plan'; label = 'Terjadwal' } }
    else if (issue) { kind = ['late_in', 'early_out'].includes(issue.type) ? 'warn' : 'bad'; label = issue.label }
    else if (a.clock_in && a.clock_out) { kind = 'ok'; label = 'Tepat waktu' }
    return { a, shift, off, future, issue, dur, kind, label, day: d, mon: m - 1, dow, inT: hhmm(a.clock_in), outT: hhmm(a.clock_out) }
  })

  const past = rows.filter((r) => !r.off && !r.future)
  const onTime = past.filter((r) => r.kind === 'ok').length
  const pct = past.length ? Math.round((onTime / past.length) * 100) : 0
  const offCount = rows.filter((r) => r.off).length
  const tone = { absent: 'r', late: 'w', early: 'w', noIn: 'r', noOut: 'r' }

  const visible = rows.filter((r) =>
    filter === 'all' ? true
    : filter === 'work' ? !r.off
    : filter === 'issue' ? r.kind === 'warn' || r.kind === 'bad'
    : r.off)

  return (
    <div className="adx">
      <div className="adx-bar">
        <div>
          <div className="adx-name">{employee?.full_name}{employee?.position ? ` · ${employee.position}` : ''}</div>
          <div className="adx-dim">Periode {periodLabel}</div>
        </div>
        <button className="adx-month" onClick={onOpenMonth}>
          <Calendar size={16} /> {monthLabel} <ChevronDown size={16} />
        </button>
      </div>

      <section className="adx-hero">
        <div className="adx-card adx-score">
          <div className="adx-ring">
            <svg width="120" height="120" viewBox="0 0 132 132" aria-hidden="true">
              <circle cx="66" cy="66" r="56" fill="none" stroke="var(--adx-off-soft)" strokeWidth="14" />
              <circle cx="66" cy="66" r="56" fill="none" stroke="var(--adx-ok)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray="352" strokeDashoffset={352 - (352 * pct) / 100} />
            </svg>
            <b>{pct}%</b>
          </div>
          <div>
            <h2>{onTime} dari {past.length} hari kerja tepat waktu</h2>
            <p>Klik kartu angka di kanan untuk melihat tanggalnya dan mengajukan koreksi presensi.</p>
          </div>
        </div>
        <div className="adx-card adx-stats">
          <div className="adx-stat g"><b>{onTime}</b><span>Tepat waktu</span></div>
          {statCards.map((c) => (
            <button key={c.key} className={`adx-stat ${c.rows.length ? tone[c.key] : ''}`} disabled={!c.rows.length}
              onClick={() => onOpenIssue(c)}>
              <b>{c.rows.length}</b><span>{c.label}</span>
            </button>
          ))}
          <div className="adx-stat"><b>{offCount}</b><span>Libur</span></div>
        </div>
      </section>

      <section className="adx-card adx-strip-card">
        <div className="adx-strip">
          {rows.map((r) => (
            <div key={r.a.work_date} className="adx-day" title={`${r.day} ${MON[r.mon]} · ${r.label}`}>
              <div className={`adx-bar-i ${r.kind}`} />
              <span>{r.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="adx-card adx-table">
        <div className="adx-filters" role="group" aria-label="Filter">
          {[['all', 'Semua hari'], ['work', 'Hari kerja'], ['issue', 'Perlu perhatian'], ['off', 'Libur']].map(([k, t]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}</button>
          ))}
        </div>
        <div className="adx-scroll">
          <table>
            <thead>
              <tr><th>Tanggal</th><th>Shift</th><th>Jadwal</th><th>Clock in</th><th>Clock out</th><th>Durasi</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="8" className="adx-empty">Memuat...</td></tr>}
              {!loading && !visible.length && <tr><td colSpan="8" className="adx-empty">Tidak ada data untuk filter ini.</td></tr>}
              {!loading && visible.map((r) => (
                <tr key={r.a.work_date} tabIndex={0} onClick={() => onOpenDay(r.a)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpenDay(r.a) }}>
                  <td>
                    <div className="adx-date">
                      <div className={`adx-dn${r.dow === 0 || r.dow === 6 || r.off ? ' we' : ''}`}><b>{r.day}</b><small>{MON[r.mon]}</small></div>
                      <b>{DAYS[r.dow]}</b>
                    </div>
                  </td>
                  <td>{r.off ? <span className="adx-dim">Libur</span> : r.shift ? <b>{r.shift.shift_name}</b> : <span className="adx-dim">–</span>}</td>
                  <td className="adx-t adx-dim">{r.shift && !r.off ? `${r.shift.start_time?.slice(0, 5)} – ${r.shift.end_time?.slice(0, 5)}` : '–'}</td>
                  <td className={`adx-t${r.issue?.type === 'late_in' ? ' late' : ''}`}>{r.inT || '–'}</td>
                  <td className={`adx-t${r.issue?.type === 'early_out' ? ' late' : ''}`}>{r.outT || '–'}</td>
                  <td className="adx-t">{r.dur || '–'}</td>
                  <td><span className={`adx-pill ${r.kind}`}>{r.label}</span></td>
                  <td className="adx-chev"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
