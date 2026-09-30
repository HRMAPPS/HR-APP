import { useEffect } from 'react'
import { ArrowLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import './RequestDesktop.css'

export const STATUS_LABEL = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function fmtDate(s) {
  if (!s) return '-'
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return `${d} ${MON[m - 1]} ${y}`
}
export const fmtStamp = (ts) => (ts ? fmtDate(new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })) : '-')
export const fmtDateTime = (ts) => (ts ? new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }) : '-')
export const weekday = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long' }) }
export const overtimeMinutes = (s, e) => {
  const t = (x) => { const [h, m] = x.slice(0, 5).split(':'); return +h * 60 + +m }
  const d = t(e) - t(s)
  return d > 0 ? d : d + 1440
}
export const fmtDur = (m) => `${Math.floor(m / 60)} j ${String(m % 60).padStart(2, '0')} m`

export function StatusPill({ status }) {
  return <span className={`rq-pill ${status}`}>{STATUS_LABEL[status] || status}</span>
}

// ---------- Form page: form card on the left, summary + recent on the right ----------
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

// ---------- List page: KPI cards, filter bar, table, detail drawer ----------
export function SelectFilter({ label, value, onChange, options }) {
  return (
    <label className="rq-sel"><span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  )
}

export function SearchFilter({ value, onChange, placeholder }) {
  return (
    <label className="rq-sel rq-search"><span>Cari</span>
      <div><Search size={15} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div>
    </label>
  )
}

export function RequestListPage({ title, subtitle, actionLabel, onAction, kpis, filters, columns, loading, rows, total, empty, renderRow, drawer }) {
  return (
    <div className="rq">
      <header className="rq-head">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="primary-btn rq-cta" onClick={onAction}><Plus size={17} /> {actionLabel}</button>
      </header>

      <section className="rq-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="rq-card rq-kpi">
            <span>{k.label}</span>
            <b className={k.tone || ''}>{k.value}</b>
            {k.hint && <small>{k.hint}</small>}
          </div>
        ))}
      </section>

      <section className="rq-card rq-bar">{filters}</section>

      <section className="rq-card rq-tablecard">
        <div className="rq-scroll">
          <table className="rq-t">
            <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}<th /></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={columns.length + 1} className="rq-empty">Memuat...</td></tr>}
              {!loading && !rows.length && <tr><td colSpan={columns.length + 1} className="rq-empty">{empty}</td></tr>}
              {!loading && rows.map(renderRow)}
            </tbody>
          </table>
        </div>
        <div className="rq-foot">Menampilkan <b>{rows.length}</b> dari <b>{total}</b> pengajuan</div>
      </section>
      {drawer}
    </div>
  )
}

export const RowChevron = () => <td className="rq-chev"><ChevronRight size={17} /></td>

export function DetailDrawer({ title, status, items, reason, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="rq-ovl" onClick={onClose}>
      <aside className="rq-drawer" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <div><small>{title}</small><StatusPill status={status} /></div>
          <button onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </header>
        <dl>
          {items.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v || '-'}</dd></div>)}
        </dl>
        <div className="rq-reason"><dt>Alasan</dt><p>{reason || 'Tidak ada alasan yang dituliskan.'}</p></div>
        <footer><button className="rq-ghost" onClick={onClose}>Tutup</button></footer>
      </aside>
    </div>
  )
}
