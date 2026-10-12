import { useEffect, useId, useState } from 'react'
import {
  Check, Clock, MapPin, Copy, Paperclip, ChevronRight, ChevronDown, ArrowRight, Plus,
  LayoutGrid, User, ClipboardList, Building2, Coffee, LogIn, LogOut, CalendarDays,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { HOME_QUICK_APPS, REQUEST_TYPES } from '../lib/menuConfig'
import { useAttendance } from '../lib/useAttendance'
import { useIsDesktop } from '../lib/useIsDesktop'
import CameraCapture from '../components/CameraCapture'
import { jakartaHour, toDateStr } from '../lib/dateUtils'
import { linkifyText } from '../lib/linkify'
import { tx, locale, getLang } from '../lib/i18n'
import logo from '../assets/napocut-cover.png'
import './Home.css'

// Teks baru yang belum ada di kamus i18n: L(indonesia, inggris).
// Teks lama tetap memakai tx() supaya terjemahannya konsisten dengan seluruh aplikasi.
const L = (id, en) => (getLang() === 'en' ? en : id)

/* ------------------------------------------------------------------ waktu */
const pad = (n) => String(n).padStart(2, '0')

// Menit sejak 00:00 untuk sebuah Date, selalu dalam zona waktu Jakarta.
function jktMin(d) {
  const [h, m] = d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).split(':').map(Number)
  return h * 60 + m
}
function parseHM(s) {
  const [h, m] = String(s || '0:0').split(':').map(Number)
  return h * 60 + (m || 0)
}
function hm(min) {
  const m = ((min % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}
function dur(min) {
  const v = Math.max(0, Math.round(min))
  const h = Math.floor(v / 60)
  const m = v % 60
  if (getLang() === 'en') return h > 0 ? `${h}h ${m}m` : `${m}m`
  return h > 0 ? `${h}j ${m}m` : `${m}m`
}

// Jam sekarang (menit), diperbarui tiap 30 detik agar cincin & timeline ikut bergerak.
function useNowMin() {
  const [n, setN] = useState(() => jktMin(new Date()))
  useEffect(() => {
    const t = setInterval(() => setN(jktMin(new Date())), 30000)
    return () => clearInterval(t)
  }, [])
  return n
}

// Model shift hari ini: progres 0..1, fase, dan sisa menit. Mendukung shift lewat tengah malam.
function shiftModel(shift, nowMin) {
  if (!shift || shift.is_day_off || !shift.start_time || !shift.end_time) return null
  const start = parseHM(shift.start_time)
  let end = parseHM(shift.end_time)
  let now = nowMin
  if (end <= start) {
    end += 1440
    if (now < start) now += 1440
  }
  const progress = Math.min(1, Math.max(0, (now - start) / (end - start)))
  const phase = now < start ? 'before' : now >= end ? 'after' : 'during'
  const left = phase === 'during' ? end - now : phase === 'before' ? start - now : 0
  return { start, end, now, progress, phase, left, overnight: end > 1440 }
}

function buildTimeline(model, shift, att, nowMin) {
  const norm = (t) => (model?.overnight && t < model.start ? t + 1440 : t)
  const items = []
  if (att?.clock_in) {
    const t = jktMin(new Date(att.clock_in))
    items.push({
      key: 'in', t: norm(t), time: hm(t), dot: 'check', label: L('Clock in', 'Clock in'),
      sub: model && t <= model.start % 1440 ? L('Sebelum shift dimulai', 'Before shift start') : L('Setelah shift dimulai', 'After shift start'),
    })
  }
  if (model) {
    items.push({
      key: 'start', t: model.start, time: hm(model.start), dot: model.now >= model.start ? 'clock' : 'next',
      label: L('Shift dimulai', 'Shift starts'), sub: shift?.shift_name || '',
    })
  }
  const nowSub = !model ? '' : model.phase === 'during' ? L('Shift berjalan', 'Shift in progress')
    : model.phase === 'before' ? L('Shift belum dimulai', 'Shift not started') : L('Shift sudah selesai', 'Shift finished')
  items.push({ key: 'now', t: norm(nowMin), time: hm(nowMin), dot: 'now', label: L('Sekarang', 'Now'), sub: nowSub })
  if (att?.clock_out) {
    const t = jktMin(new Date(att.clock_out))
    items.push({ key: 'out', t: norm(t), time: hm(t), dot: 'check', label: L('Clock out', 'Clock out'), sub: '' })
  }
  if (model) {
    items.push({
      key: 'end', t: model.end, time: hm(model.end), dot: model.phase === 'after' ? 'clock' : 'next',
      label: L('Shift selesai', 'Shift ends'),
      sub: att?.clock_in && !att?.clock_out ? L('Jangan lupa clock out', 'Remember to clock out') : '',
    })
  }
  return items.sort((a, b) => a.t - b.t)
}

/* ------------------------------------------------------------- pengumuman */
const FIELD_KEY = { tanggal: 'date', date: 'date', waktu: 'time', time: 'time', lokasi: 'place', location: 'place' }
const FIELD_RE = /^[^\p{L}\p{N}]*(tanggal|waktu|lokasi|date|time|location)\s*:\s*(.+?)\s*$/iu
const MAPS_RE = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com)\S*/i

// Mengambil baris "Tanggal / Waktu / Lokasi" dari isi pengumuman (teks bebas) supaya bisa
// ditampilkan rapi sebagai chip. Jika tidak ada, isi tampil apa adanya.
function parseAnnouncement(body) {
  const fields = {}
  const rest = []
  for (const line of String(body || '').replace(/\r/g, '').split('\n')) {
    const m = line.match(FIELD_RE)
    if (m) {
      const k = FIELD_KEY[m[1].toLowerCase()]
      if (k && !fields[k]) { fields[k] = m[2]; continue }
    }
    rest.push(line)
  }
  const joined = rest.join('\n')
  const maps = (joined.match(MAPS_RE) || [])[0] || null
  const lines = maps
    ? rest.filter((l) => !(l.includes(maps) && l.replace(maps, '').replace(/[^\p{L}\p{N}]/gu, '') === ''))
    : rest
  return { fields, maps, text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() }
}

function fmtDate(iso, opts) {
  return new Date(iso).toLocaleDateString(locale(), { timeZone: 'Asia/Jakarta', ...opts })
}

/* ------------------------------------------------------------ komponen kecil */
const PALETTE = ['#B64639', '#4F7C81', '#2D3A66', '#7E5A76', '#7D8A62', '#B8621D']
function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}
function Avatar({ url, name, size = 40, index = 0 }) {
  const st = { width: size, height: size, fontSize: Math.round(size * 0.3) }
  if (url) return <img className="hd-av" src={url} alt="" style={st} />
  return <span className="hd-av" style={{ ...st, background: PALETTE[index % PALETTE.length] }}>{initials(name) || <User size={size * 0.45} />}</span>
}

function TeamStack({ team, size = 40 }) {
  const shown = team.slice(0, 4)
  const extra = team.length - shown.length
  return (
    <div className="hd-stack">
      {shown.map((t, i) => <Avatar key={t.id} url={t.avatar_url} name={t.full_name} size={size} index={i} />)}
      {extra > 0 && <span className="hd-av hd-av-more" style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}>+{extra}</span>}
    </div>
  )
}

function Ring({ size, stroke, progress, large, children }) {
  const gid = 'hdg' + useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.round(progress * 100)
  return (
    <div className={'hd-ring' + (large ? ' is-lg' : '')} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={L(`Progres shift ${pct} persen`, `Shift progress ${pct} percent`)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7E9BF0" />
            <stop offset="1" stopColor="#3541A6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0E8DC" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${c * progress} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <div className="hd-ring-in">{children}</div>
    </div>
  )
}

function ShiftCard({ compact, loaded, shift, att, model, busy, setCameraMode }) {
  const noShift = loaded && !model
  const clockedIn = !!att?.clock_in
  const clockedOut = !!att?.clock_out
  const canIn = !busy && !clockedIn
  const canOut = !busy && clockedIn && !clockedOut
  const primary = clockedIn ? 'out' : 'in'
  const ciText = clockedIn ? hm(jktMin(new Date(att.clock_in))) : '––:––'
  const coText = clockedOut ? hm(jktMin(new Date(att.clock_out))) : '––:––'

  const ringLabel = !model ? '' : model.phase === 'before' ? L('MULAI DALAM', 'STARTS IN')
    : model.phase === 'during' ? L('SISA WAKTU', 'TIME LEFT') : L('SHIFT', 'SHIFT')
  const ringValue = !model ? '…' : model.phase === 'after' ? L('Selesai', 'Done') : dur(model.left)

  if (noShift) {
    return (
      <section className={'hd-card hd-shift hd-dayoff' + (compact ? ' is-compact' : '')} aria-label={L('Shift hari ini', "Today's shift")}>
        <span className="hd-dayoff-ic"><Coffee size={compact ? 24 : 30} /></span>
        <div>
          <div className="hd-dayoff-t">{tx("Tidak ada shift hari ini")}</div>
          <div className="hd-dayoff-s">{tx("Selamat menikmati hari libur!")}</div>
        </div>
      </section>
    )
  }

  const status = clockedIn ? (
    <span className="hd-status"><i aria-hidden="true" />{L('Sudah clock in', 'Clocked in')}{compact ? ` ${ciText}` : ''}</span>
  ) : (
    <span className="hd-status is-idle"><i aria-hidden="true" />{L('Belum clock in', 'Not clocked in')}</span>
  )

  const btn = (kind) => {
    const isIn = kind === 'in'
    const can = isIn ? canIn : canOut
    const Icon = isIn ? LogIn : LogOut
    const cls = kind === primary ? 'hd-btn hd-btn-primary' : 'hd-btn hd-btn-ghost'
    return (
      <button key={kind} type="button" className={cls} disabled={!can} onClick={() => setCameraMode(kind)}>
        <Icon size={18} />{isIn ? tx("Clock In") : tx("Clock Out")}
      </button>
    )
  }
  const buttons = primary === 'in' ? [btn('in'), btn('out')] : [btn('out'), btn('in')]

  return (
    <section className={'hd-card hd-shift' + (compact ? ' is-compact' : '')} aria-label={L('Shift hari ini', "Today's shift")}>
      {compact ? (
        <div className="hd-shift-row">
          <Ring size={136} stroke={11} progress={model?.progress || 0}>
            <span className="hd-ring-k">{model?.phase === 'before' ? L('MULAI', 'STARTS') : L('SISA', 'LEFT')}</span>
            <span className="hd-ring-v">{ringValue}</span>
          </Ring>
          <div className="hd-shift-info">
            <span className="hd-pill">{L('Shift hari ini', "Today's shift")}</span>
            <div className="hd-shift-name">{shift?.shift_name || '…'}</div>
            <div className="hd-shift-hours">{model ? `${hm(model.start)} – ${hm(model.end)}` : ''}</div>
            {status}
          </div>
        </div>
      ) : (
        <>
          <div className="hd-shift-top">
            <span className="hd-pill">{L('Shift hari ini', "Today's shift")}</span>
            {status}
          </div>
          <Ring size={260} stroke={16} progress={model?.progress || 0} large>
            <span className="hd-ring-k">{ringLabel}</span>
            <span className="hd-ring-v">{ringValue}</span>
            <span className="hd-ring-n">{shift?.shift_name || ''}</span>
            <span className="hd-ring-h">{model ? `${hm(model.start)} – ${hm(model.end)}` : ''}</span>
          </Ring>
          <div className="hd-times">
            <div className="hd-time-box"><span>Clock in</span><strong>{ciText}</strong></div>
            <div className={'hd-time-box' + (clockedOut ? '' : ' is-empty')}><span>Clock out</span><strong>{coText}</strong></div>
          </div>
        </>
      )}
      <div className="hd-actions">{buttons}</div>
    </section>
  )
}

function Timeline({ items }) {
  return (
    <ol className="hd-tl">
      {items.map((it) => (
        <li key={it.key} className={'hd-tl-item is-' + it.dot}>
          <span className="hd-tl-time">{it.time}</span>
          <span className="hd-tl-dot" aria-hidden="true">
            {it.dot === 'check' && <Check size={14} strokeWidth={3} />}
            {it.dot === 'clock' && <Clock size={14} strokeWidth={2.4} />}
            {it.dot === 'now' && <i />}
          </span>
          <div className="hd-tl-body">
            <div className="hd-tl-t">{it.label}</div>
            {it.sub && <div className="hd-tl-s">{it.sub}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Stepper({ items }) {
  return (
    <section className="hd-card hd-stepcard" aria-label={L('Agenda hari ini', "Today's agenda")}>
      <ol className="hd-step" style={{ '--n': items.length }}>
        {items.map((it) => (
          <li key={it.key} className={'hd-step-item is-' + it.dot}>
            <span className="hd-tl-dot" aria-hidden="true">
              {it.dot === 'check' && <Check size={13} strokeWidth={3} />}
              {it.dot === 'clock' && <Clock size={13} strokeWidth={2.4} />}
              {it.dot === 'now' && <i />}
            </span>
            <span className="hd-step-time">{it.time}</span>
            <span className="hd-step-label">{it.label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function WhosOff() {
  const [day, setDay] = useState('today')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const target = day === 'today' ? new Date() : new Date(Date.now() + 24 * 60 * 60 * 1000)
  const targetStr = toDateStr(target)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase.rpc('get_whos_off', { p_date: targetStr }).then(({ data }) => {
      if (cancelled) return
      setList(data || [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [targetStr])

  return (
    <div className="hd-off">
      <div className="hd-off-head">
        <h3>{tx("Who's Off")}</h3>
        <div className="hd-seg" role="group" aria-label={L('Pilih hari', 'Choose day')}>
          <button type="button" aria-pressed={day === 'today'} onClick={() => setDay('today')}>{tx("Today")}</button>
          <button type="button" aria-pressed={day === 'tomorrow'} onClick={() => setDay('tomorrow')}>{tx("Tomorrow")}</button>
        </div>
      </div>
      {loading ? (
        <p className="hd-muted">{tx("Memuat…")}</p>
      ) : list.length === 0 ? (
        <p className="hd-muted">{tx("Tidak ada yang cuti.")}</p>
      ) : (
        <div className="hd-off-list">
          {list.map((p, i) => (
            <div key={p.employee_id} className="hd-off-item">
              <Avatar url={p.avatar_url} name={p.full_name} size={34} index={i} />
              <div>
                <div className="hd-off-n">{p.full_name}</div>
                <div className="hd-off-s">{p.leave_type || tx("Cuti")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LeaveCard({ summary, onNavigate }) {
  const unit = (n) => (getLang() === 'en' ? (Number(n) === 1 ? 'day' : 'days') : 'hari')
  const sakit = summary ? Number(summary.sakit_used) || 0 : null
  const unpaid = summary ? Number(summary.unpaid_used) || 0 : null
  return (
    <section className="hd-card hd-leave">
      <div className="hd-row-between">
        <h2>{L('Cuti saya', 'My leave')}</h2>
        <button type="button" className="hd-link-light" onClick={() => onNavigate('cuti')}>{tx("View all")}</button>
      </div>
      <div className="hd-leave-grid">
        <div>
          <div className="hd-leave-n">{sakit ?? '…'}</div>
          <div className="hd-leave-l">{L('Hari sakit terpakai', 'Sick days used')}{sakit != null && <small> · {unit(sakit)}</small>}</div>
        </div>
        <div>
          <div className="hd-leave-n">{unpaid ?? '…'}</div>
          <div className="hd-leave-l">{L('Hari cuti tanpa gaji', 'Unpaid days used')}{unpaid != null && <small> · {unit(unpaid)}</small>}</div>
        </div>
      </div>
      <div className="hd-leave-btns">
        <button type="button" onClick={() => onNavigate('cuti-new')}>{L('Ajukan sakit', 'Request sick leave')}</button>
        <button type="button" className="is-solid" onClick={() => onNavigate('cuti-new')}>{L('Ajukan cuti', 'Request leave')}</button>
      </div>
    </section>
  )
}

function Announcement({ a, onToast, onNavigate }) {
  const [open, setOpen] = useState(false)
  const { fields, maps, text } = parseAnnouncement(a.body)
  const chips = [
    ['date', CalendarDays, L('Tanggal', 'Date')],
    ['time', Clock, L('Waktu', 'Time')],
    ['place', MapPin, L('Lokasi', 'Location')],
  ].filter(([k]) => fields[k])
  const long = text.length > 280 || text.split('\n').length > 6

  return (
    <article className="hd-ann">
      <h3 className="hd-ann-t">{a.title}</h3>
      {text && (
        <p className={'hd-ann-body' + (open ? '' : ' is-clamped')}>{linkifyText(text)}</p>
      )}
      {long && (
        <button type="button" className="hd-link" onClick={() => setOpen((o) => !o)}>
          {open ? L('Ringkas', 'Show less') : L('Selengkapnya', 'Read more')}
        </button>
      )}
      {chips.length > 0 && (
        <div className="hd-ann-chips">
          {chips.map(([k, Icon, label]) => (
            <div key={k} className={'hd-ann-chip is-' + k}>
              <span className="ic"><Icon size={18} /></span>
              <div><small>{label}</small><strong>{fields[k]}</strong></div>
              {k === 'place' && maps && <a href={maps} target="_blank" rel="noreferrer">Maps →</a>}
            </div>
          ))}
        </div>
      )}
      {a.attachment_url && (
        <a className="hd-ann-att" href={a.attachment_url} target="_blank" rel="noreferrer" download>
          <Paperclip size={14} /> {a.attachment_name || tx("Lampiran")}
        </a>
      )}
      <div className="hd-ann-foot">
        <Avatar url={a.author_avatar_url} name={a.author || 'napocut'} size={36} index={2} />
        <div className="hd-ann-by">
          <strong>{a.author || 'napocut'}</strong>
          <span>{fmtDate(a.published_at, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
        <button type="button" className="hd-btn-sm" onClick={() => {
          navigator.clipboard?.writeText(`${a.title}\n\n${a.body || ''}`.trim())
          onToast(tx("Pengumuman disalin"))
        }} title={tx("Salin pengumuman")}>
          <Copy size={15} /> {L('Salin', 'Copy')}
        </button>
        <button type="button" className="hd-btn-sm" onClick={() => onNavigate(`announcement:${a.id}`)}>
          {L('Buka', 'Open')} <ArrowRight size={15} />
        </button>
      </div>
    </article>
  )
}

function MoreAnnouncements({ items, onNavigate }) {
  return (
    <div className="hd-ann-more">
      {items.map((a) => (
        <button key={a.id} type="button" className="hd-ann-row" onClick={() => onNavigate(`announcement:${a.id}`)}>
          <span className="hd-ann-row-t">
            <strong>{a.title}</strong>
            <small>{a.author || 'napocut'}</small>
          </span>
          <span className="hd-ann-row-d">{fmtDate(a.published_at, { day: '2-digit', month: 'short' })}</span>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ halaman */
export default function Home({ employee, onNavigate, onOpenAllApps }) {
  const { data, busy, cameraMode, setCameraMode, handleCapture } = useAttendance(employee)
  const isDesktop = useIsDesktop()
  const nowMin = useNowMin()
  const [toast, setToast] = useState('')
  const [announcements, setAnnouncements] = useState([])
  const [showAll, setShowAll] = useState(false)
  const [team, setTeam] = useState([])
  const [summary, setSummary] = useState(null)
  const [reqOpen, setReqOpen] = useState(false)

  useEffect(() => {
    supabase.from('announcements').select('*').order('published_at', { ascending: false }).limit(5)
      .then(({ data }) => setAnnouncements(data || []))
  }, [])

  useEffect(() => {
    if (!employee?.id) return
    supabase.from('employees').select('id, full_name, avatar_url').eq('manager_id', employee.id).order('full_name')
      .then(({ data }) => setTeam(data || []))
  }, [employee?.id])

  useEffect(() => {
    if (!isDesktop) return
    supabase.rpc('get_leave_summary').then(({ data }) => setSummary(data || { sakit_used: 0, unpaid_used: 0 }))
  }, [isDesktop])

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const loaded = data !== null
  const shift = data?.shift
  const att = data?.attendance_today
  const model = shiftModel(shift, nowMin)
  const timeline = buildTimeline(model, shift, att, nowMin)

  const hour = jakartaHour()
  const greeting = hour < 11 ? tx("Good morning") : hour < 15 ? tx("Good afternoon") : hour < 19 ? tx("Good evening") : tx("Good night")
  const firstName = employee?.full_name?.split(' ')[0] || ''
  const dateLong = new Date().toLocaleDateString(locale(), {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const featured = announcements[0]
  const others = announcements.slice(1)

  function openApp(app) {
    if (app.page === '__ALL_APPS__') onOpenAllApps()
    else if (app.page) onNavigate(app.page)
    else flash(tx("{0} segera hadir", [app.label]))
  }

  const overlays = (
    <>
      {cameraMode && (
        <CameraCapture
          mode={cameraMode}
          employee={employee}
          shift={shift}
          onCapture={(blob, notes, faceDescriptor) => handleCapture(blob, (r) => flash(r.message), notes, faceDescriptor)}
          onClose={() => setCameraMode(null)}
        />
      )}
      {busy && !cameraMode && <div className="toast">{tx("Memproses absensi...")}</div>}
      {toast && <div className="toast">{toast}</div>}
    </>
  )

  const appChips = (
    <nav className="hd-chips" aria-label={L('Aplikasi', 'Apps')}>
      {HOME_QUICK_APPS.map((app) => {
        const Icon = app.icon
        const isAll = app.page === '__ALL_APPS__'
        return (
          <button key={app.key} type="button" className={'hd-chip' + (isAll ? ' is-dark' : '')} onClick={() => openApp(app)}>
            <span className="ic" style={isAll ? undefined : { background: app.bg, color: app.fg }}><Icon size={18} /></span>
            {app.label}
          </button>
        )
      })}
    </nav>
  )

  /* ------------------------------------------------------------- desktop */
  if (isDesktop) {
    return (
      <div className="hd hd-d">
        <div className="hd-greet">
          <div>
            <p className="hd-date">{dateLong}</p>
            <h1>{greeting}, {firstName}!</h1>
          </div>
          <div className="hd-cmd-wrap">
            <button type="button" className="hd-cmd" aria-haspopup="menu" aria-expanded={reqOpen} onClick={() => setReqOpen((o) => !o)}>
              <Plus size={18} />
              <span className="hd-cmd-t">{L('Buat pengajuan…', 'Make a request…')}</span>
              <span className="hd-cmd-go"><ChevronDown size={15} />{L('Ajukan', 'Request')}</span>
            </button>
            {reqOpen && (
              <>
                <div className="hd-scrim" onClick={() => setReqOpen(false)} />
                <div className="hd-pop" role="menu">
                  {REQUEST_TYPES.map((r) => {
                    const Icon = r.icon
                    return (
                      <button key={r.key} type="button" role="menuitem" onClick={() => { setReqOpen(false); onNavigate(r.page) }}>
                        <span className="ic"><Icon size={17} /></span>{r.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="hd-hero">
          <ShiftCard loaded={loaded} shift={shift} att={att} model={model} busy={busy} setCameraMode={setCameraMode} />

          <section className="hd-card hd-agenda" aria-label={L('Agenda hari ini', "Today's agenda")}>
            <div className="hd-row-between">
              <h2>{L('Hari ini', 'Today')}</h2>
              <span className="hd-muted-s">{new Date().toLocaleDateString(locale(), { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            <Timeline items={timeline} />
            <WhosOff />
          </section>

          <div className="hd-side">
            <LeaveCard summary={summary} onNavigate={onNavigate} />
            {team.length > 0 && (
              <section className="hd-card hd-team">
                <h2>{tx("Laporan tim saya")}</h2>
                <div className="hd-team-row">
                  <TeamStack team={team} />
                  <button type="button" className="hd-link" onClick={() => onNavigate('team-report')}>{tx("Lihat aktivitas")} →</button>
                </div>
              </section>
            )}
          </div>
        </div>

        {appChips}

        <div className="hd-lower">
          <section className="hd-card hd-annwrap">
            <div className="hd-annhead">
              <div className="hd-annhead-l">
                <h2>{tx("Announcement")}</h2>
                {featured?.category && <span className="hd-tag">{tx(featured.category)}</span>}
              </div>
              {others.length > 0 && (
                <button type="button" className="hd-link" onClick={() => setShowAll((s) => !s)}>{tx("Lihat semua")}</button>
              )}
            </div>
            {!featured ? (
              <p className="hd-muted hd-pad">{tx("Belum ada pengumuman.")}</p>
            ) : (
              <Announcement a={featured} onToast={flash} onNavigate={onNavigate} />
            )}
            {others.length > 0 && (
              <>
                <button type="button" className="hd-more" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
                  {showAll ? L('Sembunyikan', 'Hide') : L(`Lihat ${others.length} pengumuman lainnya`, `See ${others.length} more announcements`)}
                  <ChevronDown size={16} className={showAll ? 'is-flip' : ''} />
                </button>
                {showAll && <MoreAnnouncements items={others} onNavigate={onNavigate} />}
              </>
            )}
          </section>

          <section className="hd-card hd-quick">
            <h2>{tx("Quick Links")}</h2>
            {[
              [User, tx("Employee profile"), 'account'],
              [ClipboardList, tx("My Attendance Logs"), 'absensi'],
              [Building2, tx("Struktur Organisasi"), 'org-chart'],
            ].map(([Icon, label, target]) => (
              <button key={label} type="button" className="hd-quick-row" onClick={() => onNavigate(target)}>
                <span className="ic"><Icon size={18} /></span>
                <span className="t">{label}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </section>
        </div>

        {overlays}
      </div>
    )
  }

  /* -------------------------------------------------------------- mobile */
  return (
    <div className="hd hd-m">
      <header className="hd-m-head">
        <img className="hd-m-logo" src={logo} alt="Napocut" draggable="false" />
        <span className="grow" />
        <button type="button" className="hd-m-ib" aria-label={tx("Semua Aplikasi")} onClick={onOpenAllApps}><LayoutGrid size={19} /></button>
        <button type="button" className="hd-m-av" aria-label={tx("Akun")} onClick={() => onNavigate('account')}>
          {employee?.avatar_url ? <img src={employee.avatar_url} alt="" /> : initials(employee?.full_name)}
        </button>
      </header>

      <div className="hd-m-greet">
        <p className="hd-date">{dateLong}</p>
        <h1>{greeting}, {firstName}!</h1>
      </div>

      <ShiftCard compact loaded={loaded} shift={shift} att={att} model={model} busy={busy} setCameraMode={setCameraMode} />
      {timeline.length > 1 && <Stepper items={timeline} />}

      {appChips}

      {team.length > 0 && (
        <button type="button" className="hd-card hd-m-team" onClick={() => onNavigate('team-report')}>
          <TeamStack team={team} size={36} />
          <span className="t"><strong>{tx("Laporan tim saya")}</strong><small>{tx("Lihat aktivitas")}</small></span>
          <ChevronRight size={18} />
        </button>
      )}

      {announcements.length > 0 && (
        <>
          <div className="hd-row-between hd-m-sec">
            <h2>{tx("Pengumuman")}</h2>
            {others.length > 0 && (
              <button type="button" className="hd-link" onClick={() => setShowAll((s) => !s)}>{showAll ? L('Sembunyikan', 'Hide') : tx("Lihat semua")}</button>
            )}
          </div>
          <button type="button" className="hd-card hd-m-ann" onClick={() => onNavigate(`announcement:${featured.id}`)}>
            <span className="band">
              {featured.category ? <span className="hd-tag">{tx(featured.category)}</span> : <span />}
              <small>{fmtDate(featured.published_at, { day: '2-digit', month: 'short', year: 'numeric' })}</small>
            </span>
            <span className="body">
              <strong>{featured.title}</strong>
              <small>{featured.author || 'napocut'}</small>
            </span>
          </button>
          {showAll && <MoreAnnouncements items={others} onNavigate={onNavigate} />}
        </>
      )}

      {overlays}
    </div>
  )
}
