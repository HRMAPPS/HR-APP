import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, ChevronDown, Clock, Filter, ScrollText, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import AttendanceDetail from '../components/AttendanceDetail'

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function pad2(n) { return String(n).padStart(2, '0') }

export default function Absensi({ employee, onBack, startNew, onToast, onNavigate }) {
  const [tab, setTab] = useState('riwayat')
  const [showForm, setShowForm] = useState(!!startNew)
  const [attendance, setAttendance] = useState([])
  const [absenceReqs, setAbsenceReqs] = useState([])
  const [shiftReqs, setShiftReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [shiftByDate, setShiftByDate] = useState({})
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [dayDetail, setDayDetail] = useState(null)   // attendance row shown in the bottom sheet
  const [eventDetail, setEventDetail] = useState(null) // { type: 'in'|'out', attendance, shift } -> full detail page
  const [correctionTarget, setCorrectionTarget] = useState(null) // { attendance, shift, issue } -> koreksi presensi
  const [issueList, setIssueList] = useState(null) // { key, label, rows, issue } -> daftar tanggal per kategori

  const todayParts = todayStr().split('-').map(Number)
  const [absFilterMonth, setAbsFilterMonth] = useState({ y: todayParts[0], m: todayParts[1] - 1 })
  const [absStatusFilter, setAbsStatusFilter] = useState('')
  const [showAbsMonthPicker, setShowAbsMonthPicker] = useState(false)
  const [showAbsStatusSheet, setShowAbsStatusSheet] = useState(false)

  const [shiftFilterMonth, setShiftFilterMonth] = useState({ y: todayParts[0], m: todayParts[1] - 1 })
  const [shiftStatusFilter, setShiftStatusFilter] = useState('')
  const [showShiftMonthPicker, setShowShiftMonthPicker] = useState(false)
  const [showShiftStatusSheet, setShowShiftStatusSheet] = useState(false)

  const [monthYear, setMonthYear] = useState(todayParts[0])
  const [monthIndex, setMonthIndex] = useState(todayParts[1] - 1) // 0-based

  // Periode payroll: tanggal 25 bulan sebelumnya s.d. tanggal 24 di bulan
  // yang dipilih (sama dengan cutoff yang dipakai di Slip Gaji).
  const monthStart = useMemo(() => {
    const d = new Date(monthYear, monthIndex - 1, 25)
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  }, [monthYear, monthIndex])
  const monthEnd = useMemo(() => `${monthYear}-${pad2(monthIndex + 1)}-24`, [monthYear, monthIndex])

  async function load() {
    if (!employee?.id) return
    setLoading(true)
    const [{ data: att }, { data: absR }, { data: shR }, { data: sched }, { data: empDefault }] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', employee.id).gte('work_date', monthStart).lte('work_date', monthEnd).order('work_date', { ascending: false }),
      supabase.from('absence_requests').select('*').eq('employee_id', employee.id).order('created_at', { ascending: false }),
      supabase.from('shift_change_requests')
        .select('id, work_date, reason, status, to_is_day_off, from_shift:from_shift_id(name,start_time,end_time), to_shift:to_shift_id(name,start_time,end_time)')
        .eq('employee_id', employee.id).order('created_at', { ascending: false }),
      supabase.from('shift_schedules')
        .select('work_date, is_day_off, shifts(name, start_time, end_time)')
        .eq('employee_id', employee.id).gte('work_date', monthStart).lte('work_date', monthEnd),
      supabase.from('employees')
        .select('default_work_days, default_shift:default_shift_id(name, start_time, end_time)')
        .eq('id', employee.id).maybeSingle(),
    ])
    setAbsenceReqs(absR || [])
    setShiftReqs(shR || [])
    const explicitMap = Object.fromEntries((sched || []).map((s) => [
      s.work_date, { work_date: s.work_date, is_day_off: s.is_day_off, shift_name: s.shifts?.name, start_time: s.shifts?.start_time, end_time: s.shifts?.end_time },
    ]))
    const defaultShift = empDefault?.default_shift
    const defaultDays = empDefault?.default_work_days // null = setiap hari

    // Untuk setiap tanggal di periode: jadwal khusus (shift_schedules) kalau
    // ada selalu menang; kalau tidak ada, fallback ke shift default
    // karyawan (kalau HR sudah set satu).
    const shiftMap = {}
    let d0 = new Date(monthStart + 'T00:00:00')
    const endD0 = new Date(monthEnd + 'T00:00:00')
    while (d0 <= endD0) {
      const dateStr = `${d0.getFullYear()}-${pad2(d0.getMonth() + 1)}-${pad2(d0.getDate())}`
      if (explicitMap[dateStr]) {
        shiftMap[dateStr] = explicitMap[dateStr]
      } else if (defaultShift) {
        const dow = d0.getDay()
        const isDayOff = defaultDays ? !defaultDays.includes(dow) : false
        shiftMap[dateStr] = { work_date: dateStr, is_day_off: isDayOff, shift_name: defaultShift.name, start_time: defaultShift.start_time, end_time: defaultShift.end_time }
      }
      d0.setDate(d0.getDate() + 1)
    }
    setShiftByDate(shiftMap)

    // Bangun daftar untuk SETIAP tanggal di periode (bukan cuma yang sudah
    // ada baris absensinya) supaya jadwal ke depan & hari libur ikut
    // tampil, mengikuti shift yang sudah diatur HR (atau shift default).
    const attByDate = Object.fromEntries((att || []).map((a) => [a.work_date, a]))
    const merged = []
    let d = new Date(monthStart + 'T00:00:00')
    const endD = new Date(monthEnd + 'T00:00:00')
    while (d <= endD) {
      const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      const existing = attByDate[dateStr]
      merged.push(existing || { id: `virtual-${dateStr}`, employee_id: employee.id, work_date: dateStr, clock_in: null, clock_out: null, status: null, _virtual: true })
      d.setDate(d.getDate() + 1)
    }
    merged.sort((a, b) => (a.work_date > b.work_date ? 1 : -1))
    setAttendance(merged)
    setLoading(false)
  }

  function isEarlyClockOut(a) {
    const shift = shiftByDate[a.work_date]
    if (!a.clock_out || !shift?.end_time) return false
    const outHHMM = new Date(a.clock_out).toTimeString().slice(0, 5)
    return outHHMM < shift.end_time.slice(0, 5)
  }

  // Menentukan apakah sebuah hari punya "masalah" yang bisa diajukan koreksi
  // (telat, pulang cepat, lupa clock in/out, atau absen sama sekali).
  // Hanya berlaku untuk hari kerja yang sudah lewat, bukan hari libur/depan.
  function dayIssue(a) {
    const shift = shiftByDate[a.work_date]
    if (a.work_date > todayStr() || shift?.is_day_off) return null
    if (!a.clock_in && !a.clock_out) return { type: 'absent', label: 'Tidak Hadir' }
    if (a.clock_in && !a.clock_out) return { type: 'no_out', label: 'Belum Clock Out' }
    if (!a.clock_in && a.clock_out) return { type: 'no_in', label: 'Belum Clock In' }
    if (a.status === 'late') return { type: 'late_in', label: 'Telat Clock In' }
    if (isEarlyClockOut(a)) return { type: 'early_out', label: 'Early Clock Out' }
    return null
  }

  useEffect(() => { load() }, [monthStart, monthEnd, employee?.id])

  if (eventDetail) {
    return <AttendanceDetail type={eventDetail.type} attendance={eventDetail.attendance} shift={eventDetail.shift} onBack={() => setEventDetail(null)} />
  }

  if (correctionTarget) {
    return (
      <CorrectionRequestForm
        {...correctionTarget}
        onCancel={() => setCorrectionTarget(null)}
        onDone={() => { setCorrectionTarget(null); setDayDetail(null); load(); onToast('Pengajuan presensi terkirim') }}
        onToast={onToast}
      />
    )
  }

  if (showForm) {
    return <AbsensiForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  const today = todayStr()
  const pastWorkDays = attendance.filter((a) => a.work_date <= today && !shiftByDate[a.work_date]?.is_day_off)
  const lateRows = pastWorkDays.filter((a) => a.status === 'late')
  const noOutRows = pastWorkDays.filter((a) => a.clock_in && !a.clock_out)
  const noInRows = pastWorkDays.filter((a) => !a.clock_in && a.clock_out)
  const absentRows = pastWorkDays.filter((a) => !a.clock_in && !a.clock_out)
  const earlyRows = pastWorkDays.filter(isEarlyClockOut)

  const STAT_CARDS = [
    { key: 'absent', label: 'Absent', rows: absentRows, issue: { type: 'absent', label: 'Tidak Hadir' } },
    { key: 'late', label: 'Late clock in', rows: lateRows, issue: { type: 'late_in', label: 'Telat Clock In' } },
    { key: 'early', label: 'Early clock out', rows: earlyRows, issue: { type: 'early_out', label: 'Early Clock Out' } },
    { key: 'noIn', label: 'No clock in', rows: noInRows, issue: { type: 'no_in', label: 'Belum Clock In' } },
    { key: 'noOut', label: 'No clock out', rows: noOutRows, issue: { type: 'no_out', label: 'Belum Clock Out' } },
  ]

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Daftar Absensi</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="tabs on-red" style={{ background: 'var(--red)', margin: 0, padding: '0 16px 10px' }}>
        <button className={tab === 'riwayat' ? 'active' : ''} onClick={() => setTab('riwayat')}>Riwayat</button>
        <button className={tab === 'absensi' ? 'active' : ''} onClick={() => setTab('absensi')}>Absensi</button>
        <button className={tab === 'shift' ? 'active' : ''} onClick={() => setTab('shift')}>Shift</button>
      </div>

      {tab === 'riwayat' && (
        <>
          <div style={{ padding: '14px 16px 0' }}>
            <button onClick={() => setShowMonthPicker(true)} className="date-select" style={{ width: '100%', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16} /> {MONTHS_ID[monthIndex]} {monthYear}</span>
              <ChevronRight size={16} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 2px 0' }}>
              Periode {new Date(monthStart).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(monthEnd).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>

          <div className="stats-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 8px' }}>
            {STAT_CARDS.map((c) => (
              <button key={c.key} className="stat" style={{ background: 'none', border: 'none', cursor: c.rows.length ? 'pointer' : 'default' }}
                onClick={() => c.rows.length && setIssueList(c)}>
                <div className="num">{c.rows.length}</div>
                <div className="lbl">{c.label}</div>
              </button>
            ))}
          </div>

          {loading ? <p style={{ padding: 16, color: '#a39c94' }}>Memuat...</p> : attendance.length === 0 ? (
            <div className="empty-state"><h3>Tidak ada data</h3><p>Belum ada catatan absensi di bulan ini.</p></div>
          ) : attendance.map((a) => {
            const isDayOff = !!shiftByDate[a.work_date]?.is_day_off
            const issue = dayIssue(a)
            return (
              <button key={a.id} className="attendance-row" style={{ width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => setDayDetail(a)}>
                <div className={`date ${isDayOff ? 'libur' : ''}`}>
                  <b>{new Date(a.work_date).getDate()} {new Date(a.work_date).toLocaleDateString('id-ID', { month: 'short' })}</b>
                  <span style={issue ? { color: '#C0392B', fontWeight: 600 } : undefined}>{isDayOff ? 'Libur' : (issue ? issue.label : 'Jam kerja')}</span>
                </div>
                <div className="time">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                <div className="time">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                <ChevronRight size={18} className="chev" />
              </button>
            )
          })}
        </>
      )}

      {tab === 'absensi' && (() => {
        const filteredAbs = absenceReqs.filter((r) => {
          const d = new Date(r.work_date)
          const monthMatch = d.getFullYear() === absFilterMonth.y && d.getMonth() === absFilterMonth.m
          const statusMatch = !absStatusFilter || r.status === absStatusFilter
          return monthMatch && statusMatch
        })
        return (
          <>
            <FilterBar
              label={`${MONTHS_ID[absFilterMonth.m]} ${absFilterMonth.y} - ${MONTHS_ID[absFilterMonth.m]} ${absFilterMonth.y}`}
              onLabelClick={() => setShowAbsMonthPicker(true)}
              onFilterClick={() => setShowAbsStatusSheet(true)}
              filterActive={!!absStatusFilter}
            />
            {loading ? <p style={{ padding: 16, color: '#a39c94' }}>Memuat...</p> :
            filteredAbs.length === 0 ? (
              <div className="empty-state">
                <ScrollText size={40} color="#c8c1b9" />
                <h3>Belum ada pengajuan</h3>
                <p>Pengajuan absensi Anda akan tampil di sini.</p>
              </div>
            ) : filteredAbs.map((r) => (
              <div key={r.id} className="shift-hist-row">
                <div className="top">
                  <div className="date">{new Date(r.work_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <span className={`status-${r.status}`}>{statusLabel(r.status)}</span>
                </div>
                {(r.requested_clock_in || r.requested_clock_out) && (
                  <div className="desc">Usulan: {r.requested_clock_in?.slice(0, 5) || '-'} - {r.requested_clock_out?.slice(0, 5) || '-'}</div>
                )}
                {r.reason && <div className="desc">{r.reason}</div>}
              </div>
            ))}
            <button className="fab-bottom-btn" onClick={() => setShowForm(true)}>Ajukan absensi</button>

            {showAbsMonthPicker && (
              <MonthPickerSheet year={absFilterMonth.y} monthIndex={absFilterMonth.m}
                onClose={() => setShowAbsMonthPicker(false)}
                onApply={(y, m) => { setAbsFilterMonth({ y, m }); setShowAbsMonthPicker(false) }} />
            )}
            {showAbsStatusSheet && (
              <StatusFilterSheet current={absStatusFilter} onClose={() => setShowAbsStatusSheet(false)}
                onApply={(v) => { setAbsStatusFilter(v); setShowAbsStatusSheet(false) }} />
            )}
          </>
        )
      })()}

      {tab === 'shift' && (() => {
        const filteredShift = shiftReqs.filter((r) => {
          const d = new Date(r.work_date)
          const monthMatch = d.getFullYear() === shiftFilterMonth.y && d.getMonth() === shiftFilterMonth.m
          const statusMatch = !shiftStatusFilter || r.status === shiftStatusFilter
          return monthMatch && statusMatch
        })
        return (
          <>
            <FilterBar
              label={`${MONTHS_ID[shiftFilterMonth.m]} ${shiftFilterMonth.y} - ${MONTHS_ID[shiftFilterMonth.m]} ${shiftFilterMonth.y}`}
              onLabelClick={() => setShowShiftMonthPicker(true)}
              onFilterClick={() => setShowShiftStatusSheet(true)}
              filterActive={!!shiftStatusFilter}
            />
            {loading ? <p style={{ padding: 16, color: '#a39c94' }}>Memuat...</p> :
            filteredShift.length === 0 ? (
              <div className="empty-state"><h3>Belum ada pengajuan</h3><p>Pengajuan ubah shift Anda akan tampil di sini.</p></div>
            ) : filteredShift.map((r) => (
              <div key={r.id} className="shift-hist-row">
                <div className="top">
                  <div className="date">{new Date(r.work_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <span className={`status-${r.status}`}>{statusLabel(r.status)}</span>
                </div>
                <div className="desc">
                  {r.from_shift?.name || '-'} ({r.from_shift?.start_time?.slice(0,5)} - {r.from_shift?.end_time?.slice(0,5)}) menjadi{' '}
                  {r.to_is_day_off ? 'Off (00:00 - 00:00)' : `${r.to_shift?.name} (${r.to_shift?.start_time?.slice(0,5)} - ${r.to_shift?.end_time?.slice(0,5)})`}
                </div>
              </div>
            ))}
            <button className="fab-bottom-btn" onClick={() => onNavigate?.('shift-new')}>Ajukan ubah shift</button>

            {showShiftMonthPicker && (
              <MonthPickerSheet year={shiftFilterMonth.y} monthIndex={shiftFilterMonth.m}
                onClose={() => setShowShiftMonthPicker(false)}
                onApply={(y, m) => { setShiftFilterMonth({ y, m }); setShowShiftMonthPicker(false) }} />
            )}
            {showShiftStatusSheet && (
              <StatusFilterSheet current={shiftStatusFilter} onClose={() => setShowShiftStatusSheet(false)}
                onApply={(v) => { setShiftStatusFilter(v); setShowShiftStatusSheet(false) }} />
            )}
          </>
        )
      })()}

      {showMonthPicker && (
        <MonthPickerSheet
          year={monthYear} monthIndex={monthIndex}
          onClose={() => setShowMonthPicker(false)}
          onApply={(y, m) => { setMonthYear(y); setMonthIndex(m); setShowMonthPicker(false) }}
        />
      )}

      {issueList && (
        <IssueListSheet
          issueList={issueList}
          onClose={() => setIssueList(null)}
          onPick={(row) => { setCorrectionTarget({ attendance: row, shift: shiftByDate[row.work_date], issue: issueList.issue }); setIssueList(null) }}
        />
      )}

      {dayDetail && (
        <DayDetailSheet
          attendance={dayDetail}
          shift={shiftByDate[dayDetail.work_date]}
          issue={dayIssue(dayDetail)}
          onClose={() => setDayDetail(null)}
          onOpenEvent={(type) => { setEventDetail({ type, attendance: dayDetail, shift: shiftByDate[dayDetail.work_date] }); setDayDetail(null) }}
          onAjukan={(issue) => setCorrectionTarget({ attendance: dayDetail, shift: shiftByDate[dayDetail.work_date], issue })}
        />
      )}
    </div>
  )
}

function MonthPickerSheet({ year, monthIndex, onClose, onApply }) {
  const [y, setY] = useState(year)
  const [m, setM] = useState(monthIndex)

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{MONTHS_FULL[m]} {y}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 18 }}>
          <button onClick={() => setY((v) => v - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronLeft size={20} /></button>
          <span style={{ fontSize: 16 }}>{y}</span>
          <button onClick={() => setY((v) => v + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronRight size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {MONTHS_ID.map((label, i) => (
            <button key={label} onClick={() => setM(i)} style={{
              padding: '12px 0', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 15,
              background: m === i ? 'var(--blue-dark)' : 'none', color: m === i ? '#fff' : 'var(--text)',
              fontWeight: m === i ? 700 : 400,
            }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => onApply(y, m)} style={{
          width: '100%', border: 'none', borderTop: '1px solid var(--border)', background: 'none', padding: '14px 0',
          color: 'var(--blue-dark)', fontWeight: 700, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer',
        }}>
          LIHAT HASIL
        </button>
      </div>
    </div>
  )
}

function FilterBar({ label, onLabelClick, onFilterClick, filterActive }) {
  return (
    <div className="filter-row">
      <button onClick={onLabelClick} className="date-select" style={{ cursor: 'pointer' }}>
        <Calendar size={16} /> <span style={{ flex: 1 }}>{label}</span>
        <ChevronDown size={16} />
      </button>
      <button onClick={onFilterClick} className="filter-btn" style={{ cursor: 'pointer', position: 'relative' }}>
        <Filter size={17} color={filterActive ? 'var(--blue)' : undefined} />
        {filterActive && <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)' }} />}
      </button>
    </div>
  )
}

const STATUS_FILTER_OPTIONS = [
  ['', 'Semua'], ['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak'], ['cancelled', 'Dibatalkan'],
]

function StatusFilterSheet({ current, onClose, onApply }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3 style={{ fontSize: 17 }}>Filter Status</h3></div>
        {STATUS_FILTER_OPTIONS.map(([val, label]) => (
          <button key={val} onClick={() => onApply(val)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 4px',
            background: 'none', border: 'none', borderBottom: '1px solid #f1ece6', cursor: 'pointer', textAlign: 'left', fontSize: 15,
            color: current === val ? 'var(--blue)' : 'var(--text)', fontWeight: current === val ? 700 : 400,
          }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function IssueListSheet({ issueList, onClose, onPick }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row">
          <h3 style={{ fontSize: 17 }}>{issueList.label}</h3>
          <button className="sheet-close" onClick={onClose}><X size={20} /></button>
        </div>
        {issueList.rows.map((row) => (
          <button key={row.id} onClick={() => onPick(row)} style={{
            width: '100%', display: 'flex', alignItems: 'center', padding: '13px 4px', background: 'none', border: 'none',
            borderBottom: '1px solid #f1ece6', cursor: 'pointer', textAlign: 'left', fontSize: 15,
          }}>
            <span style={{ flex: 1 }}>{new Date(row.work_date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <ChevronRight size={18} color="#bbb" />
          </button>
        ))}
      </div>
    </div>
  )
}

function DayDetailSheet({ attendance, shift, issue, onClose, onOpenEvent, onAjukan }) {
  const dateLabel = new Date(attendance.work_date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row">
          <h3 style={{ fontSize: 17 }}>{dateLabel}</h3>
          <button className="sheet-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          {shift ? `${shift.shift_name} (${shift.start_time?.slice(0, 5)}-${shift.end_time?.slice(0, 5)})` : 'Belum ada jadwal'}
        </div>

        {issue && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: '#FBE1DD', borderRadius: 12,
            padding: '12px 14px', marginBottom: 14,
          }}>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: '#C0392B' }}>{issue.label}</span>
            <button onClick={() => onAjukan(issue)} style={{
              background: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700,
              fontSize: 13.5, color: 'var(--text)', cursor: 'pointer', boxShadow: 'var(--shadow-xs)',
            }}>
              Ajukan
            </button>
          </div>
        )}

        <div style={{ background: '#f7f4f0', borderRadius: 14, overflow: 'hidden' }}>
          <button onClick={() => attendance.clock_in && onOpenEvent('in')} disabled={!attendance.clock_in} style={{
            width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none',
            borderBottom: '1px solid #eee', cursor: attendance.clock_in ? 'pointer' : 'default', opacity: attendance.clock_in ? 1 : 0.5,
          }}>
            <strong style={{ fontSize: 15, width: 60 }}>{fmtTime(attendance.clock_in) || '-'}</strong>
            <span style={{ flex: 1, textAlign: 'left', fontSize: 14.5 }}>Clock in</span>
            {attendance.clock_in && <ChevronRight size={18} color="#bbb" />}
          </button>
          <button onClick={() => attendance.clock_out && onOpenEvent('out')} disabled={!attendance.clock_out} style={{
            width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none',
            cursor: attendance.clock_out ? 'pointer' : 'default', opacity: attendance.clock_out ? 1 : 0.5,
          }}>
            <strong style={{ fontSize: 15, width: 60 }}>{fmtTime(attendance.clock_out) || '-'}</strong>
            <span style={{ flex: 1, textAlign: 'left', fontSize: 14.5 }}>Clock out</span>
            {attendance.clock_out && <ChevronRight size={18} color="#bbb" />}
          </button>
        </div>
      </div>
    </div>
  )
}

function statusLabel(s) {
  return { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' }[s] || s
}

function CorrectionRequestForm({ attendance, shift, issue, onCancel, onDone, onToast }) {
  const [wantIn, setWantIn] = useState(issue?.type === 'no_in' || issue?.type === 'late_in' || issue?.type === 'absent')
  const [wantOut, setWantOut] = useState(issue?.type === 'no_out' || issue?.type === 'early_out' || issue?.type === 'absent')
  const [clockIn, setClockIn] = useState(attendance.clock_in ? new Date(attendance.clock_in).toTimeString().slice(0, 5) : '')
  const [clockOut, setClockOut] = useState(attendance.clock_out ? new Date(attendance.clock_out).toTimeString().slice(0, 5) : '')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const dateLabel = new Date(attendance.work_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const actualLabel = `${attendance.clock_in ? new Date(attendance.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} - ${attendance.clock_out ? new Date(attendance.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}`

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (wantIn && !clockIn) { setError('Isi jam clock in yang diusulkan'); return }
    if (wantOut && !clockOut) { setError('Isi jam clock out yang diusulkan'); return }
    if (!wantIn && !wantOut) { setError('Centang minimal Clock in atau Clock out'); return }
    setLoading(true)

    let attachmentUrl = null
    if (file) {
      const path = `${attendance.employee_id}/${attendance.work_date}-${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('attendance-photos').upload(path, file)
      if (upErr) { setLoading(false); setError('Gagal unggah lampiran: ' + upErr.message); return }
      const { data: pub } = supabase.storage.from('attendance-photos').getPublicUrl(path)
      attachmentUrl = pub.publicUrl
    }

    const { error: rpcErr } = await supabase.rpc('submit_absence_request', {
      p_work_date: attendance.work_date, p_reason: reason || null, p_attachment_url: attachmentUrl,
      p_requested_clock_in: wantIn ? clockIn : null, p_requested_clock_out: wantOut ? clockOut : null,
      p_issue_type: issue?.type || null,
    })
    setLoading(false)
    if (rpcErr) { setError(rpcErr.message); return }
    onDone()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>Pengajuan presensi</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>Tanggal pengajuan</label>
          <div style={{ position: 'relative' }}>
            <input value={dateLabel} disabled style={{ paddingRight: 40 }} />
            <Calendar size={18} color="#8a847c" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>
        <div className="field">
          <label>Shift</label>
          <div style={{ position: 'relative' }}>
            <input value={shift ? `${shift.shift_name} (${shift.start_time?.slice(0, 5)}-${shift.end_time?.slice(0, 5)})` : '-'} disabled style={{ paddingRight: 40, background: '#f7f4f0' }} />
            <ChevronDown size={18} color="#8a847c" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>Clock in-out saat ini: {actualLabel}</p>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
          <input type="checkbox" checked={wantIn} onChange={(e) => setWantIn(e.target.checked)} /> Clock in
        </label>
        <div className="field">
          <div style={{ position: 'relative' }}>
            <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} disabled={!wantIn} placeholder="Clock in" style={{ paddingRight: 40 }} />
            <Clock size={18} color="#8a847c" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
          <input type="checkbox" checked={wantOut} onChange={(e) => setWantOut(e.target.checked)} /> Clock out
        </label>
        <div className="field">
          <div style={{ position: 'relative' }}>
            <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} disabled={!wantOut} placeholder="Clock out" style={{ paddingRight: 40 }} />
            <Clock size={18} color="#8a847c" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>

        <div className="field">
          <label>Alasan ({reason.length}/200)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder="Jelaskan alasan pengajuan..." />
        </div>

        <div className="field">
          <label>Lampiran (opsional)</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading} style={{ marginBottom: 10 }}>{loading ? 'Mengirim...' : 'Kirim'}</button>
        <button type="button" className="primary-btn" style={{ background: '#eee', color: '#333' }} onClick={onCancel}>Batal</button>
      </form>
    </div>
  )
}

function AbsensiForm({ onDone, onCancel, onToast }) {
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!date) { setError('Pilih tanggal'); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_absence_request', {
      p_work_date: date, p_reason: reason, p_attachment_url: null,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast('Pengajuan absensi terkirim')
    onDone()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>Ajukan Absensi</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>Tanggal</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Alasan</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tambahkan alasan..." />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>{loading ? 'Mengirim...' : 'Kirim pengajuan'}</button>
      </form>
    </div>
  )
}
