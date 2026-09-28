import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, X, Search,
  Building2, Clock, CalendarDays, Gift, User, MapPin,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import { useBackHandler } from '../lib/backStack'

const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Urutan sama dengan tampilan: Aktivitas, Cuti, Hari libur, Ulang tahun.
const KINDS = [
  { key: 'activity', label: 'Aktivitas', icon: Building2, color: '#4356C4' },
  { key: 'leave', label: 'Cuti', icon: Clock, color: '#E08A1E' },
  { key: 'holiday', label: 'Hari libur', icon: CalendarDays, color: '#C0392B' },
  { key: 'birthday', label: 'Ulang tahun', icon: Gift, color: '#D6479B' },
]
const KIND_BY_KEY = Object.fromEntries(KINDS.map((k) => [k.key, k]))
const PREVIEW_LIMIT = 5

const pad = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

// "2026-09-24" -> "24 Sep 2026" (diparse manual supaya tidak kena geseran zona waktu)
function fmtDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`
}
const fmtTime = (t) => (t ? t.slice(0, 5) : '')

function subtitleOf(ev) {
  if (ev.kind === 'activity') {
    const time = ev.start_time ? `${fmtTime(ev.start_time)}${ev.end_time ? ' - ' + fmtTime(ev.end_time) : ''}` : ''
    return [time, ev.location].filter(Boolean).join(' · ') || 'Sepanjang hari'
  }
  if (ev.kind === 'leave') return ev.subtitle
  if (ev.kind === 'holiday') return 'Hari libur nasional'
  return ''
}

export default function CalendarPage({ onBack, onToast }) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayStr().split('-').map(Number)
    return { y, m: m - 1 }
  })
  const [selected, setSelected] = useState(todayStr())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [openKind, setOpenKind] = useState(null)      // kategori yang sedang dibuka (pratinjau di bawah kalender)
  const [sheet, setSheet] = useState(null)             // { tab } -> daftar acara sebulan
  const [detail, setDetail] = useState(null)           // satu acara

  const today = todayStr()

  useEffect(() => {
    let cancelled = false
    const start = ymd(cursor.y, cursor.m, 1)
    const end = ymd(cursor.y, cursor.m, new Date(cursor.y, cursor.m + 1, 0).getDate())
    setLoading(true)
    supabase.rpc('get_calendar_events', { p_start: start, p_end: end }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) { onToast?.('Gagal memuat kalender: ' + error.message); setEvents([]); return }
      setEvents(data || [])
    })
    return () => { cancelled = true }
  }, [cursor])

  // Index: tanggal -> acara, supaya klik tanggal langsung tampil tanpa query ulang.
  const byDate = useMemo(() => {
    const map = new Map()
    for (const ev of events) {
      if (!map.has(ev.event_date)) map.set(ev.event_date, [])
      map.get(ev.event_date).push(ev)
    }
    return map
  }, [events])

  const dayEvents = byDate.get(selected) || []
  const dayByKind = (k) => dayEvents.filter((e) => e.kind === k)

  function changeMonth(delta) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    const next = { y: d.getFullYear(), m: d.getMonth() }
    setCursor(next)
    // pilih hari ini kalau bulannya sama, kalau tidak tanggal 1
    const [ty, tm] = today.split('-').map(Number)
    setSelected(ty === next.y && tm - 1 === next.m ? today : ymd(next.y, next.m, 1))
  }
  function goToday() {
    const [y, m] = today.split('-').map(Number)
    setCursor({ y, m: m - 1 })
    setSelected(today)
  }

  useBackHandler(() => setDetail(null), !!detail)
  useBackHandler(() => setSheet(null), !!sheet)

  const firstDow = new Date(cursor.y, cursor.m, 1).getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="topbar">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Bulan sebelumnya"><ChevronLeft size={20} /></button>
          <div style={{ fontWeight: 700, fontSize: 18, minWidth: 116, textAlign: 'center' }}>
            {MONTHS_SHORT[cursor.m]} {cursor.y}
          </div>
          <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="Bulan berikutnya"><ChevronRight size={20} /></button>
        </div>
        <button className="icon-btn" style={{ color: '#4356C4', fontWeight: 600, fontSize: 13 }} onClick={goToday}>
          Hari ini
        </button>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateStr = ymd(cursor.y, cursor.m, d)
          const evs = byDate.get(dateStr) || []
          const kinds = KINDS.filter((k) => evs.some((e) => e.kind === k.key))
          const cls = [
            'cal-cell',
            dateStr === selected ? 'selected' : '',
            dateStr === today ? 'is-today' : '',
            evs.some((e) => e.kind === 'holiday') ? 'holiday' : '',
          ].join(' ')
          return (
            <button key={i} className={cls} onClick={() => setSelected(dateStr)} aria-label={fmtDate(dateStr)}>
              {d}
              {kinds.length > 0 && (
                <span className="dots">{kinds.map((k) => <i key={k.key} style={{ background: k.color }} />)}</span>
              )}
            </button>
          )
        })}
      </div>

      <button className="cal-month-link" onClick={() => setSheet({ tab: 'activity' })}>
        Lihat acara di bulan ini <ChevronRight size={18} />
      </button>

      <div className="cal-day-panel">
        <h3 className="cal-day-title">{selected === today ? 'Hari ini' : fmtDate(selected)}</h3>
        {KINDS.map((k) => {
          const items = dayByKind(k.key)
          const isOpen = openKind === k.key && items.length > 0
          return (
            <div key={k.key}>
              <button
                className="cal-kind-row"
                onClick={() => {
                  // ada isi -> buka pratinjau di bawah; kosong -> langsung ke daftar sebulan
                  if (items.length > 0) setOpenKind(isOpen ? null : k.key)
                  else setSheet({ tab: k.key })
                }}
              >
                <span>{k.label} ({loading ? '…' : items.length})</span>
                {isOpen ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
              </button>
              {isOpen && (
                <div className="cal-preview">
                  {items.slice(0, PREVIEW_LIMIT).map((ev) => (
                    <EventRow key={ev.kind + ev.ref_id + ev.event_date} ev={ev} onClick={() => setDetail(ev)} />
                  ))}
                  <button className="cal-see-all" onClick={() => setSheet({ tab: k.key })}>Lihat semua</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {sheet && (
        <MonthSheet
          cursor={cursor}
          events={events}
          selected={selected}
          initialTab={sheet.tab}
          onMonth={changeMonth}
          onClose={() => setSheet(null)}
          onPick={setDetail}
        />
      )}
      {detail && <DetailSheet ev={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function Avatar({ ev, size = 44 }) {
  const meta = KIND_BY_KEY[ev.kind]
  if (ev.kind === 'leave' || ev.kind === 'birthday') {
    return (
      <div className="avatar" style={{ width: size, height: size }}>
        {ev.avatar_url ? <img src={ev.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={size * 0.5} />}
      </div>
    )
  }
  const Icon = meta.icon
  return (
    <div className="avatar" style={{ width: size, height: size, borderRadius: 12, background: meta.color + '1f', color: meta.color }}>
      <Icon size={size * 0.5} />
    </div>
  )
}

function EventRow({ ev, onClick }) {
  const sub = subtitleOf(ev)
  return (
    <button className="cal-event-row" onClick={onClick}>
      <Avatar ev={ev} />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div className="t">{ev.title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      <ChevronRight size={20} color="#6b7280" />
    </button>
  )
}

// Daftar acara sebulan penuh, per kategori (tab), dikelompokkan per tanggal + pencarian.
function MonthSheet({ cursor, events, selected, initialTab, onMonth, onClose, onPick }) {
  const [tab, setTab] = useState(initialTab)
  const [query, setQuery] = useState('')
  const selectedRef = useRef(null)

  const counts = useMemo(() => {
    const c = {}
    for (const k of KINDS) c[k.key] = events.filter((e) => e.kind === k.key).length
    return c
  }, [events])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const map = new Map()
    for (const ev of events) {
      if (ev.kind !== tab) continue
      if (q && !`${ev.title} ${ev.subtitle || ''} ${ev.location || ''}`.toLowerCase().includes(q)) continue
      if (!map.has(ev.event_date)) map.set(ev.event_date, [])
      map.get(ev.event_date).push(ev)
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
  }, [events, tab, query])

  // Buka langsung di grup tanggal yang dipilih (atau tanggal terdekat setelahnya).
  const anchorDate = (groups.find(([d]) => d >= selected) || [])[0]
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'start' }) }, [tab, anchorDate])

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet cal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row" style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button className="icon-btn" onClick={() => onMonth(-1)} aria-label="Bulan sebelumnya"><ChevronLeft size={20} /></button>
            <h3 style={{ minWidth: 118, textAlign: 'center' }}>{MONTHS_SHORT[cursor.m]} {cursor.y}</h3>
            <button className="icon-btn" onClick={() => onMonth(1)} aria-label="Bulan berikutnya"><ChevronRight size={20} /></button>
          </div>
          <button className="sheet-close" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="cal-tabs">
          {KINDS.map((k) => {
            const Icon = k.icon
            return (
              <button key={k.key} className={tab === k.key ? 'active' : ''} onClick={() => setTab(k.key)}>
                <Icon size={22} />
                <span>{k.label} ({counts[k.key]})</span>
              </button>
            )
          })}
        </div>

        <div className="cal-search">
          <Search size={20} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'activity' || tab === 'holiday' ? 'Cari acara' : 'Cari nama karyawan'}
          />
        </div>

        <div className="cal-sheet-body">
          {groups.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={72} color="#5b9bf0" />
              <h3>Tidak ada acara</h3>
              <p>Acara pada tanggal yang dipilih akan terlihat di sini.</p>
            </div>
          ) : groups.map(([date, list]) => (
            <div key={date} ref={date === anchorDate ? selectedRef : null}>
              <div className={`cal-group-head ${date === selected ? 'sel' : ''}`}>{fmtDate(date)}</div>
              {list.map((ev) => (
                <EventRow key={ev.kind + ev.ref_id + ev.event_date} ev={ev} onClick={() => onPick(ev)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DetailSheet({ ev, onClose }) {
  const meta = KIND_BY_KEY[ev.kind]
  const sub = subtitleOf(ev)
  return (
    <div className="sheet-overlay" style={{ zIndex: 45 }} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row">
          <h3>{meta.label}</h3>
          <button className="sheet-close" onClick={onClose}><X size={22} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <Avatar ev={ev} size={52} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{ev.title}</div>
            {sub && <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>{sub}</div>}
          </div>
        </div>
        <div className="cal-detail-line"><CalendarDays size={17} /> {fmtDate(ev.event_date)}</div>
        {ev.start_time && (
          <div className="cal-detail-line"><Clock size={17} /> {fmtTime(ev.start_time)}{ev.end_time ? ` - ${fmtTime(ev.end_time)}` : ''}</div>
        )}
        {ev.location && <div className="cal-detail-line"><MapPin size={17} /> {ev.location}</div>}
        {ev.description && <p style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ev.description}</p>}
      </div>
    </div>
  )
}
