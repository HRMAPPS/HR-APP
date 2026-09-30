import { ArrowLeft } from 'lucide-react'
import './RequestDesktop.css'

export const STATUS_LABEL = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function fmtDate(s) {
  if (!s) return '-'
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return `${d} ${MON[m - 1]} ${y}`
}

export function StatusPill({ status }) {
  return <span className={`rq-pill ${status}`}>{STATUS_LABEL[status] || status}</span>
}

// Two-column page: form card on the left, summary + recent requests on the right.
export function RequestShell({ title, subtitle, onBack, form, aside }) {
  return (
    <div className="rq">
      <header className="rq-top">
        <button className="rq-back" onClick={onBack} aria-label="Kembali"><ArrowLeft size={20} /></button>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="rq-layout">
        <section className="rq-card rq-form">{form}</section>
        <aside className="rq-aside">{aside}</aside>
      </div>
    </div>
  )
}

export function StatTiles({ tiles }) {
  return (
    <div className="rq-card rq-tiles">
      {tiles.map(([label, value, tone]) => (
        <div key={label} className={`rq-tile ${tone || ''}`}><b>{value}</b><span>{label}</span></div>
      ))}
    </div>
  )
}

export function RecentList({ title, rows, empty, render }) {
  return (
    <div className="rq-card rq-recent">
      <h3>{title}</h3>
      {rows === null ? <p className="rq-dim">Memuat...</p>
        : rows.length === 0 ? <p className="rq-dim">{empty}</p>
        : <ul>{rows.map((r) => <li key={r.id}>{render(r)}</li>)}</ul>}
    </div>
  )
}
