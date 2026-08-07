import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, Filter, ScrollText } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'

export default function Absensi({ onBack, startNew, onToast }) {
  const [tab, setTab] = useState('riwayat')
  const [showForm, setShowForm] = useState(!!startNew)
  const [attendance, setAttendance] = useState([])
  const [absenceReqs, setAbsenceReqs] = useState([])
  const [shiftReqs, setShiftReqs] = useState([])
  const [loading, setLoading] = useState(true)

  const monthStart = useMemo(() => todayStr().slice(0, 8) + '01', [])

  const [shiftEndByDate, setShiftEndByDate] = useState({})

  async function load() {
    setLoading(true)
    const [{ data: att }, { data: absR }, { data: shR }, { data: sched }] = await Promise.all([
      supabase.from('attendance').select('*').gte('work_date', monthStart).order('work_date', { ascending: false }),
      supabase.from('absence_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('shift_change_requests')
        .select('id, work_date, reason, status, to_is_day_off, from_shift:from_shift_id(name,start_time,end_time), to_shift:to_shift_id(name,start_time,end_time)')
        .order('created_at', { ascending: false }),
      supabase.from('shift_schedules')
        .select('work_date, shifts(end_time)')
        .gte('work_date', monthStart),
    ])
    setAttendance(att || [])
    setAbsenceReqs(absR || [])
    setShiftReqs(shR || [])
    setShiftEndByDate(Object.fromEntries((sched || []).map((s) => [s.work_date, s.shifts?.end_time])))
    setLoading(false)
  }

  function isEarlyClockOut(a) {
    const endTime = shiftEndByDate[a.work_date]
    if (!a.clock_out || !endTime) return false
    const outHHMM = new Date(a.clock_out).toTimeString().slice(0, 5)
    return outHHMM < endTime.slice(0, 5)
  }

  useEffect(() => { load() }, [])

  if (showForm) {
    return <AbsensiForm onDone={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} onToast={onToast} />
  }

  const late = attendance.filter((a) => a.status === 'late').length
  const noOut = attendance.filter((a) => a.clock_in && !a.clock_out).length
  const noIn = attendance.filter((a) => !a.clock_in && a.clock_out).length
  const absent = attendance.filter((a) => !a.clock_in && !a.clock_out).length
  const early = attendance.filter(isEarlyClockOut).length

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
          <div className="stats-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 8px' }}>
            <div className="stat"><div className="num">{absent}</div><div className="lbl">Absent</div></div>
            <div className="stat"><div className="num">{late}</div><div className="lbl">Late clock in</div></div>
            <div className="stat"><div className="num">{early}</div><div className="lbl">Early clock out</div></div>
            <div className="stat"><div className="num">{noIn}</div><div className="lbl">No clock in</div></div>
            <div className="stat"><div className="num">{noOut}</div><div className="lbl">No clock out</div></div>
          </div>
          {loading ? <p style={{ padding: 16, color: '#a39c94' }}>Memuat...</p> : attendance.map((a) => (
            <div key={a.id} className="attendance-row">
              <div className={`date ${!a.clock_in ? 'libur' : ''}`}>
                <b>{new Date(a.work_date).getDate()} {new Date(a.work_date).toLocaleDateString('id-ID', { month: 'short' })}</b>
                <span>{a.clock_in ? 'Jam kerja' : 'Libur'}</span>
              </div>
              <div className="time">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
              <div className="time">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
            </div>
          ))}
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
