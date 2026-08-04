import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export default function CalendarPage({ onBack }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [markedDays, setMarkedDays] = useState(new Set())
  const [selected, setSelected] = useState(new Date())

  useEffect(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10)
    supabase.from('leave_requests').select('start_date,end_date').gte('start_date', start).lte('end_date', end)
      .then(({ data }) => {
        const set = new Set()
        for (const r of data || []) {
          let d = new Date(r.start_date)
          const e = new Date(r.end_date)
          while (d <= e) { set.add(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
        }
        setMarkedDays(set)
      })
  }, [cursor])

  const year = cursor.getFullYear(), month = cursor.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = new Date().toISOString().slice(0, 10)

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="topbar">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <div style={{ fontWeight: 700, fontSize: 18 }}>
          {cursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </div>
        <button className="icon-btn" style={{ color: '#4356C4', fontWeight: 600, fontSize: 13 }}
          onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelected(new Date()) }}>
          Hari ini
        </button>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          return (
            <div key={i} className={`cal-cell ${isToday ? 'today' : ''}`} onClick={() => setSelected(new Date(dateStr))}>
              {d}
              {markedDays.has(dateStr) && !isToday && <span className="dot" />}
            </div>
          )
        })}
      </div>

      <div className="section" style={{ marginTop: 18 }}>
        <h4 style={{ margin: '0 0 10px' }}>Hari ini</h4>
        {['Aktivitas', 'Cuti', 'Hari libur', 'Ulang tahun'].map((label) => (
          <div key={label} className="menu-row" style={{ padding: '12px 2px' }}>
            {label} <span style={{ marginLeft: 'auto', color: '#a39c94' }}>
              ({label === 'Cuti' ? markedDays.size : 0})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
