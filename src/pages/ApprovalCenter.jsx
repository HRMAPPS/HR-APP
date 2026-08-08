import { useEffect, useState } from 'react'
import {
  ChevronRight, ArrowLeft, Search, Check, X, Receipt, CalendarDays, MapPin,
  AlarmClock, RefreshCw, UserCircle, FileText, Target, ListChecks, CheckSquare, UserPlus, FolderInput,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const CATEGORIES = [
  { key: 'reimbursement_requests', label: 'Reimbursement', icon: Receipt },
  { key: 'leave_requests', label: 'Cuti', icon: CalendarDays },
  { key: 'absence_requests', label: 'Presensi', icon: MapPin },
  { key: 'overtime_requests', label: 'Lembur', icon: AlarmClock },
  { key: 'shift_change_requests', label: 'Perubahan shift', icon: RefreshCw },
  { key: 'data_change_requests', label: 'Perubahan data', icon: UserCircle, noBacking: true },
  { key: 'formulir', label: 'Formulir', icon: FileText, noBacking: true },
  { key: 'goal', label: 'Goal', icon: Target, noBacking: true },
  { key: 'timesheet', label: 'Timesheet', icon: ListChecks, noBacking: true },
  { key: 'task', label: 'Task', icon: CheckSquare, noBacking: true },
  { key: 'penambahan_karyawan', label: 'Penambahan karyawan', icon: UserPlus, noBacking: true },
  { key: 'pemindahan_karyawan', label: 'Pemindahan karyawan', icon: FolderInput, noBacking: true },
]

const CAT_ICON_BG = '#EAF1FB'
const CAT_ICON_FG = '#3B6ECF'

export default function ApprovalCenter({ employee, onToast, onCountsChange }) {
  const [view, setView] = useState({ screen: 'categories' })
  const [counts, setCounts] = useState({})

  async function loadCounts() {
    const { data, error } = await supabase.rpc('get_approval_counts')
    if (!error) {
      setCounts(data || {})
      onCountsChange?.(Object.values(data || {}).reduce((a, b) => a + b, 0))
    }
  }
  useEffect(() => { loadCounts() }, [])

  if (view.screen === 'detail') {
    return (
      <ApprovalDetail
        table={view.table} id={view.id}
        onBack={() => setView({ screen: 'list', table: view.table })}
        onToast={onToast}
        onDecided={() => { loadCounts() }}
      />
    )
  }

  if (view.screen === 'list') {
    const cat = CATEGORIES.find((c) => c.key === view.table)
    return (
      <ApprovalList
        category={cat}
        onBack={() => setView({ screen: 'categories' })}
        onOpen={(id) => setView({ screen: 'detail', table: view.table, id })}
        onToast={onToast}
      />
    )
  }

  return (
    <div>
      {CATEGORIES.map((c) => {
        const Icon = c.icon
        const count = counts[c.key]
        return (
          <button key={c.key} className="menu-row" style={{ borderTop: '1px solid var(--border)' }}
            onClick={() => c.noBacking ? onToast?.(`${c.label} segera hadir`) : setView({ screen: 'list', table: c.key })}>
            <span style={{
              width: 34, height: 34, borderRadius: 9, background: CAT_ICON_BG, color: CAT_ICON_FG,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={17} />
            </span>
            {c.label}
            {count > 0 && (
              <span style={{ marginLeft: 8, background: '#C0392B', color: '#fff', fontSize: 11.5, fontWeight: 700, borderRadius: 10, padding: '1px 7px' }}>
                {count}
              </span>
            )}
            <ChevronRight size={18} className="chev" />
          </button>
        )
      })}
    </div>
  )
}

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function ApprovalList({ category, onBack, onOpen, onToast }) {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')

  async function load() {
    const { data, error } = await supabase.rpc('get_my_approvals', { p_status: status || null })
    if (error) { onToast?.(error.message); return }
    setRows((data || []).filter((r) => r.category === category.key))
  }
  useEffect(() => { load() }, [status])

  const filtered = (rows || []).filter((r) => r.requester_name?.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>{category.label}</h1>
        <span style={{ width: 22 }} />
      </div>

      <div className="search-box">
        <Search size={18} />
        <input placeholder="Cari..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="tabs" style={{ paddingTop: 0 }}>
        {[['pending', 'Pengajuan'], ['', 'Semua']].map(([v, l]) => (
          <button key={v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>

      {rows === null ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><h3>Tidak ada pengajuan</h3><p>Pengajuan yang perlu Anda tinjau akan tampil di sini.</p></div>
      ) : (
        filtered.map((r) => (
          <button key={r.id} className="list-item" style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onOpen(r.id)}>
            <div className="avatar">{initials(r.requester_name)}</div>
            <div className="info">
              <div className="name">{r.requester_name}</div>
              <div className="sub">{category.label} untuk {r.summary}</div>
              {r.reason && <div className="sub" style={{ fontStyle: 'italic' }}>Alasan: {r.reason}</div>}
            </div>
            <StatusPill status={r.status} />
          </button>
        ))
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    pending: { label: 'Menunggu persetujuan', bg: '#FBEEDD', fg: '#B4650C' },
    approved: { label: 'Disetujui', bg: '#DCF3E6', fg: '#1E8E5A' },
    rejected: { label: 'Ditolak', bg: '#FBE1DD', fg: '#C0392B' },
    cancelled: { label: 'Dibatalkan', bg: '#eee', fg: '#888' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 11.5, fontWeight: 700, borderRadius: 8, padding: '4px 9px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function ApprovalDetail({ table, id, onBack, onToast, onDecided }) {
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.rpc('get_request_detail', { p_table: table, p_id: id })
    if (error) { onToast?.(error.message); return }
    setDetail(data)
  }
  useEffect(() => { load() }, [table, id])

  async function decide(approve) {
    setBusy(true)
    const { error } = await supabase.rpc('decide_request', { p_table: table, p_request_id: id, p_approve: approve })
    setBusy(false)
    if (error) { onToast?.(error.message); return }
    onToast?.(approve ? 'Pengajuan disetujui' : 'Pengajuan ditolak')
    onDecided?.()
    load()
  }

  if (!detail) {
    return (
      <div>
        <div className="page-header"><button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button><h1>Detail</h1><span style={{ width: 22 }} /></div>
        <div className="empty-state"><p>Memuat...</p></div>
      </div>
    )
  }

  const r = detail.row
  const cat = CATEGORIES.find((c) => c.key === table)
  const submittedAt = new Date(r.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' pukul ' + new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>{cat?.label}</h1>
        <span style={{ width: 22 }} />
      </div>

      <div style={{ padding: '18px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="avatar" style={{ width: 46, height: 46, fontSize: 15 }}>{initials(detail.requester_name)}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.requester_name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{submittedAt}</div>
        </div>
      </div>
      <div style={{ padding: '0 16px 14px' }}><StatusPill status={r.status} /></div>

      <div className="section" style={{ margin: '0 16px' }}>
        <FieldRows table={table} row={r} />

        {r.reason && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Alasan</div>
            <div style={{ fontSize: 15, marginTop: 2 }}>{r.reason}</div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>Status pengajuan</div>
          <Timeline row={r} detail={detail} />
        </div>
      </div>

      {r.status === 'pending' && (
        <div style={{ display: 'flex', gap: 10, padding: 16 }}>
          <button onClick={() => decide(false)} disabled={busy} style={{
            flex: 1, padding: 13, borderRadius: 12, border: '1px solid #C0392B', background: '#fff', color: '#C0392B',
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
          }}>
            <X size={17} /> Tolak
          </button>
          <button onClick={() => decide(true)} disabled={busy} style={{
            flex: 1, padding: 13, borderRadius: 12, border: 'none', background: '#1E8E5A', color: '#fff',
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
          }}>
            <Check size={17} /> Setuju
          </button>
        </div>
      )}
    </div>
  )
}

function FieldRows({ table, row }) {
  const rows = []
  if (table === 'leave_requests') {
    rows.push(['Tanggal', `${fmt(row.start_date)} - ${fmt(row.end_date)} (${row.total_days} hari)`])
  } else if (table === 'overtime_requests') {
    rows.push(['Tanggal', fmt(row.work_date)])
    rows.push(['Jam', `${row.start_time?.slice(0, 5)} - ${row.end_time?.slice(0, 5)}`])
  } else if (table === 'reimbursement_requests') {
    rows.push(['Jumlah', 'Rp ' + Number(row.amount).toLocaleString('id-ID')])
    if (row.description) rows.push(['Deskripsi', row.description])
  } else if (table === 'shift_change_requests') {
    rows.push(['Tanggal', fmt(row.work_date)])
    rows.push(['Menjadi', row.to_is_day_off ? 'Off' : 'Shift baru'])
  } else if (table === 'absence_requests') {
    rows.push(['Tanggal', fmt(row.work_date)])
    if (row.requested_clock_in || row.requested_clock_out) {
      rows.push(['Usulan jam', `${row.requested_clock_in?.slice(0, 5) || '-'} - ${row.requested_clock_out?.slice(0, 5) || '-'}`])
    }
  }
  return (
    <>
      {rows.map(([label, value]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{value}</div>
        </div>
      ))}
    </>
  )
}

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

function Timeline({ row, detail }) {
  const items = [
    { label: `Diajukan oleh ${detail.requester_name}`, time: row.created_at, color: '#4356C4', done: true },
  ]
  if (row.status === 'pending') {
    items.push({ label: `Menunggu persetujuan dari ${detail.manager_name || 'HR'}`, time: null, color: '#c58a12', pending: true })
  } else if (row.status === 'approved') {
    items.push({ label: `Disetujui oleh ${detail.approver_name || 'HR'}`, time: row.decided_at, color: '#1E8E5A', done: true })
  } else if (row.status === 'rejected') {
    items.push({ label: `Ditolak oleh ${detail.approver_name || 'HR'}`, time: row.decided_at, color: '#C0392B', done: true })
  }

  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: it.color, marginTop: 4 }} />
            {i < items.length - 1 && <span style={{ width: 2, flex: 1, background: '#e5e0da', minHeight: 20 }} />}
          </div>
          <div style={{ paddingBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: it.pending ? 400 : 600 }}>{it.label}</div>
            {it.time && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(it.time).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(it.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
