import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, ScrollText, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import AttendanceDetail from '../components/AttendanceDetail'

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function pad2(n) { return String(n).padStart(2, '0') }

export default function Absensi({ employee, onBack, startNew, onToast }) {
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

  const todayParts = todayStr().split('-').map(Number)
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

  useEffect(() => { load() }, [monthStart, monthEnd, employee?.id])

  if (eventDetail) {
    return <AttendanceDetail type={eventDetail.type} attendance={eventDetail.attendance} shift={eventDetail.shift} onBack={() => setEventDetail(null)} />
  }

  if (showForm) {
    return <AbsensiForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  const today = todayStr()
  const pastWorkDays = attendance.filter((a) => a.work_date <= today && !shiftByDate[a.work_date]?.is_day_off)
  const late = pastWorkDays.filter((a) => a.status === 'late').length
  const noOut = pastWorkDays.filter((a) => a.clock_in && !a.clock_out).length
  const noIn = pastWorkDays.filter((a) => !a.clock_in && a.clock_out).length
  const absent = pastWorkDays.filter((a) => !a.clock_in && !a.clock_out).length
  const early = pastWorkDays.filter(isEarlyClockOut).length

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
            <div className="stat"><div className="num">{absent}</div><div className="lbl">Absent</div></div>
            <div className="stat"><div className="num">{late}</div><div className="lbl">Late clock in</div></div>
            <div className="stat"><div className="num">{early}</div><div className="lbl">Early clock out</div></div>
            <div className="stat"><div className="num">{noIn}</div><div className="lbl">No clock in</div></div>
            <div className="stat"><div className="num">{noOut}</div><div className="lbl">No clock out</div></div>
          </div>

          {loading ? <p style={{ padding: 16, color: '#a39c94' }}>Memuat...</p> : attendance.length === 0 ? (
            <div className="empty-state"><h3>Tidak ada data</h3><p>Belum ada catatan absensi di bulan ini.</p></div>
          ) : attendance.map((a) => {
            const isDayOff = !!shiftByDate[a.work_date]?.is_day_off
            return (
              <button key={a.id} className="attendance-row" style={{ width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => setDayDetail(a)}>
                <div className={`date ${isDayOff ? 'libur' : ''}`}>
                  <b>{new Date(a.work_date).getDate()} {new Date(a.work_date).toLocaleDateString('id-ID', { month: 'short' })}</b>
                  <span>{isDayOff ? 'Libur' : 'Jam kerja'}</span>
                </div>
                <div className="time">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                <div className="time">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                <ChevronRight size={18} className="chev" />
              </button>
            )
          })}
        </>
      )}

      {tab === 'absensi' && (
        <>
          {loading ? <p style={{ padding: 16, color: '#a39c94' }}>Memuat...</p> :
          absenceReqs.length === 0 ? (
            <div className="empty-state">
              <ScrollText size={40} color="#c8c1b9" />
              <h3>Belum ada pengajuan</h3>
              <p>Pengajuan absensi Anda akan tampil di sini.</p>
            </div>
          ) : absenceReqs.map((r) => (
            <div key={r.id} className="shift-hist-row">
              <div className="top">
                <div className="date">{r.work_date}</div>
                <span className={`status-${r.status}`}>{statusLabel(r.status)}</span>
              </div>
              <div className="desc">{r.reason}</div>
            </div>
          ))}
          <button className="fab-bottom-btn" onClick={() => setShowForm(true)}>Ajukan absensi</button>
        </>
      )}

      {tab === 'shift' && (
        <>
          {loading ? <p style={{ padding: 16, color: '#a39c94' }}>Memuat...</p> :
          shiftReqs.length === 0 ? (
            <div className="empty-state"><h3>Belum ada pengajuan</h3><p>Pengajuan ubah shift Anda akan tampil di sini.</p></div>
          ) : shiftReqs.map((r) => (
            <div key={r.id} className="shift-hist-row">
              <div className="top">
                <div className="date">{r.work_date}</div>
                <span className={`status-${r.status}`}>{statusLabel(r.status)}</span>
              </div>
              <div className="desc">
                {r.from_shift?.name || '-'} ({r.from_shift?.start_time?.slice(0,5)} - {r.from_shift?.end_time?.slice(0,5)}) menjadi{' '}
                {r.to_is_day_off ? 'Off (00:00 - 00:00)' : `${r.to_shift?.name} (${r.to_shift?.start_time?.slice(0,5)} - ${r.to_shift?.end_time?.slice(0,5)})`}
              </div>
            </div>
          ))}
        </>
      )}

      {showMonthPicker && (
        <MonthPickerSheet
          year={monthYear} monthIndex={monthIndex}
          onClose={() => setShowMonthPicker(false)}
          onApply={(y, m) => { setMonthYear(y); setMonthIndex(m); setShowMonthPicker(false) }}
        />
      )}

      {dayDetail && (
        <DayDetailSheet
          attendance={dayDetail}
          shift={shiftByDate[dayDetail.work_date]}
          onClose={() => setDayDetail(null)}
          onOpenEvent={(type) => { setEventDetail({ type, attendance: dayDetail, shift: shiftByDate[dayDetail.work_date] }); setDayDetail(null) }}
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

function DayDetailSheet({ attendance, shift, onClose, onOpenEvent }) {
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
