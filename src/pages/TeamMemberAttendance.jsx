import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import { tx, locale } from '../lib/i18n'
import Sheet from '../components/Sheet'
import TeamStatsCarousel, { StatsHelpSheet } from '../components/TeamStatsCarousel'
import { periodOf, buildRows } from './AttendanceLog'
import './TeamReportMobile.css'

const pad2 = (n) => String(n).padStart(2, '0')
const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m }
const isoUtc = (d) => d.toISOString().slice(0, 10) // d selalu Date UTC dari periodOf
const monthShort = (d) => d.toLocaleDateString(locale(), { month: 'short', timeZone: 'UTC' }).replace('.', '')
const fmtDay = (d) => `${pad2(d.getUTCDate())} ${monthShort(d)}`
const isInvalid = (r) => !!(r.clockIn && r.clockOut && toMin(r.clockOut) <= toMin(r.clockIn))

// Periode aktif: tanggal 25 bulan lalu s/d 24 bulan terpilih. Mulai tgl 25, periode berikutnya jadi default.
function defaultYm() {
  const [y, m, d] = todayStr().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + (d >= 25 ? 1 : 0), 1))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`
}

function statusOf(r) {
  if (r.kind === 'leave') return tx('Cuti')
  if (r.kind === 'holiday') return r.hol?.title || tx('Hari libur')
  if (r.kind === 'off') return tx('Hari libur')
  if (r.kind === 'absent') return tx('Tidak hadir')
  if (r.kind === 'upcoming') return '-'
  if (isInvalid(r)) return tx('Tidak valid')
  if (r.flags.includes('noin')) return tx('Tidak clock in')
  if (r.flags.includes('late')) return tx('Terlambat masuk')
  if (r.flags.includes('noout')) return tx('Belum clock out')
  if (r.flags.includes('early')) return tx('Pulang lebih awal')
  return tx('Tepat waktu')
}

// Kehadiran bulanan satu anggota tim (dibuka dari "Lihat semua data kehadiran").
export default function TeamMemberAttendance({ empId, name, onBack }) {
  const [ym, setYm] = useState(defaultYm)
  const [state, setState] = useState({ loading: true, error: null, rows: [] })
  const [sel, setSel] = useState(null)
  const [help, setHelp] = useState(false)
  const period = useMemo(() => periodOf(ym), [ym])

  const months = useMemo(() => {
    const [y, m] = defaultYm().split('-').map(Number)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 - i, 1))
      return { v: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`, t: `${monthShort(d)} ${d.getUTCFullYear()}` }
    })
  }, [])
  const curMonth = months.find((o) => o.v === ym)?.t || ym

  useEffect(() => {
    let alive = true
    ;(async () => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const from = isoUtc(period.start), to = isoUtc(period.end)
        const [emp, att, sch, shf, cal, lv] = await Promise.all([
          supabase.from('employees').select('id, full_name, position, default_shift_id, default_work_days').eq('id', empId).single(),
          supabase.from('attendance').select('work_date, clock_in, clock_out').eq('employee_id', empId).gte('work_date', from).lte('work_date', to),
          supabase.from('shift_schedules').select('work_date, shift_id, is_day_off').eq('employee_id', empId).gte('work_date', from).lte('work_date', to),
          supabase.from('shifts').select('id, name, start_time, end_time'),
          supabase.from('calendar_events').select('title, start_date, end_date').eq('kind', 'holiday').lte('start_date', to).gte('end_date', from),
          supabase.from('leave_requests').select('start_date, end_date').eq('employee_id', empId).eq('status', 'approved').lte('start_date', to).gte('end_date', from),
        ])
        const err = emp.error || att.error || sch.error || shf.error || cal.error || lv.error
        if (err) throw err
        const by = (res, k) => Object.fromEntries((res.data || []).map((x) => [x[k], x]))
        const leaves = lv.data || []
        const onLeave = (key) => leaves.some((l) => l.start_date <= key && l.end_date >= key)
        const rows = buildRows(period, by(att, 'work_date'), by(sch, 'work_date'), by(shf, 'id'), cal.data || [], emp.data, todayStr())
          // hari kerja tanpa presensi tetapi ada cuti disetujui dihitung Cuti, bukan Absen
          .map((r) => ((r.kind === 'absent' || r.kind === 'upcoming') && onLeave(r.key) ? { ...r, kind: 'leave' } : r))
        if (alive) setState({ loading: false, error: null, rows })
      } catch (e) {
        if (alive) setState({ loading: false, error: e.message || tx('Gagal memuat data'), rows: [] })
      }
    })()
    return () => { alive = false }
  }, [empId, period])

  const { rows, loading, error } = state
  const worked = rows.filter((r) => r.kind === 'work')
  const stats = {
    onTime: worked.filter((r) => !r.flags.includes('late') && !r.flags.includes('noin') && !isInvalid(r)).length,
    late: worked.filter((r) => r.flags.includes('late')).length,
    early: worked.filter((r) => r.flags.includes('early') && !isInvalid(r)).length,
    noIn: worked.filter((r) => r.flags.includes('noin')).length,
    noOut: worked.filter((r) => r.flags.includes('noout')).length,
    invalid: worked.filter(isInvalid).length,
    absent: rows.filter((r) => r.kind === 'absent').length,
    cuti: rows.filter((r) => r.kind === 'leave').length,
  }

  return (
    <div className="tr-page">
      <header className="tr-head">
        <button type="button" className="tr-back" onClick={onBack} aria-label={tx('Kembali')}><ArrowLeft size={26} /></button>
        <label className="tr-title">
          <span className="tr-title-main">{curMonth}<ChevronDown size={22} /></span>
          <small>{name}</small>
          <select value={ym} onChange={(e) => setYm(e.target.value)} aria-label={tx('Pilih bulan')}>
            {months.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </label>
        <span className="tr-head-sp" />
      </header>

      <TeamStatsCarousel
        onHelp={() => setHelp(true)}
        hadir={[[tx('Tepat waktu'), stats.onTime], [tx('Terlambat masuk'), stats.late], [tx('Pulang lebih awal'), stats.early],
          [tx('Tidak clock in'), stats.noIn], [tx('Tidak clock out'), stats.noOut], [tx('Tidak valid'), stats.invalid]]}
        absent={[[tx('Absen'), stats.absent], [tx('Cuti'), stats.cuti]]}
      />

      <section className="tr-list">
        {loading && <div className="tr-empty">{tx('Memuat...')}</div>}
        {error && <div className="tr-empty" style={{ color: '#c0392b' }}>{error}</div>}
        {!loading && !error && rows.map((r) => {
          const red = r.kind === 'off' || r.kind === 'holiday'
          const sub = r.kind === 'holiday' ? (r.hol?.title || tx('Hari libur'))
            : r.kind === 'off' ? tx('Hari libur')
            : r.kind === 'leave' ? tx('Cuti')
            : r.kind === 'absent' ? tx('Tidak hadir')
            : (r.shift?.name || '')
          return (
            <button key={r.key} type="button" className="tr-day" onClick={() => setSel(r)}>
              <div>
                <div className={'tr-date' + (red ? ' red' : '')}>{fmtDay(r.date)}</div>
                <div className={'tr-loc' + (red || r.kind === 'absent' ? ' red' : '')}>{sub}</div>
              </div>
              <span className={'tr-dt' + (r.flags.includes('late') ? ' late' : '')}>{r.clockIn || '-'}</span>
              <span className="tr-dt">{r.clockOut || '-'}</span>
              <ChevronRight size={24} />
            </button>
          )
        })}
      </section>

      {help && <StatsHelpSheet onClose={() => setHelp(false)} />}
      {sel && (
        <Sheet title={fmtDay(sel.date) + ' ' + sel.date.getUTCFullYear()} onClose={() => setSel(null)}>
          <div style={{ paddingBottom: 6 }}>
            <div className="tr-kv"><span>Shift</span><b>{sel.shift && sel.kind !== 'off' && sel.kind !== 'holiday' ? `${sel.shift.name} (${sel.shift.start_time.slice(0, 5)} - ${sel.shift.end_time.slice(0, 5)})` : '-'}</b></div>
            <div className="tr-kv"><span>Clock in</span><b>{sel.clockIn || '-'}</b></div>
            <div className="tr-kv"><span>Clock out</span><b>{sel.clockOut || '-'}</b></div>
            <div className="tr-kv"><span>{tx('Durasi kerja')}</span><b>{sel.worked || '-'}</b></div>
            <div className="tr-kv"><span>Status</span><b>{statusOf(sel)}</b></div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
