import { useEffect, useState } from 'react'
import {
  ChevronRight, ArrowLeft, Search, Check, X, Receipt, CalendarDays, MapPin,
  AlarmClock, RefreshCw, UserCircle, FileText, Target, ListChecks, CheckSquare, UserPlus, FolderInput,
  ClipboardCheck, Filter,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import Avatar from '../components/Avatar'

import { tx, locale } from '../lib/i18n'
const CATEGORIES = [
  { key: 'reimbursement_requests', label: tx("Reimbursement"), icon: Receipt },
  { key: 'leave_requests', label: tx("Cuti"), icon: CalendarDays },
  { key: 'absence_requests', label: tx("Presensi"), icon: MapPin },
  { key: 'overtime_requests', label: tx("Lembur"), icon: AlarmClock },
  { key: 'shift_change_requests', label: tx("Perubahan shift"), icon: RefreshCw },
  { key: 'data_change_requests', label: tx("Perubahan data"), icon: UserCircle },
  { key: 'formulir', label: tx("Formulir"), icon: FileText, noBacking: true },
  { key: 'goal', label: tx("Goal"), icon: Target, noBacking: true },
  { key: 'timesheet', label: 'Timesheet', icon: ListChecks, noBacking: true },
  { key: 'task', label: tx("Task"), icon: CheckSquare, noBacking: true },
  { key: 'penambahan_karyawan', label: tx("Penambahan karyawan"), icon: UserPlus, noBacking: true },
  { key: 'pemindahan_karyawan', label: tx("Pemindahan karyawan"), icon: FolderInput, noBacking: true },
]

const CAT_ICON_BG = '#EAF1FB'
const CAT_ICON_FG = '#3B6ECF'

export default function ApprovalCenter({ onToast, onCountsChange, onOpenCategory }) {
  const [counts, setCounts] = useState({})

  async function loadCounts() {
    const { data, error } = await supabase.rpc('get_approval_counts')
    if (!error) {
      setCounts(data || {})
      onCountsChange?.(Object.values(data || {}).reduce((a, b) => a + b, 0))
    }
  }
  useEffect(() => { loadCounts() }, [])

  return (
    <div>
      {CATEGORIES.map((c) => {
        const Icon = c.icon
        const count = counts[c.key]
        return (
          <button key={c.key} className="menu-row" style={{ borderTop: '1px solid var(--border)' }}
            onClick={() => c.noBacking ? onToast?.(tx("{0} segera hadir", [c.label])) : onOpenCategory(c.key)}>
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

// Halaman penuh (lewat App-level routing, bukan nested di tab Inbox) supaya
// header "Inbox" dan bottom nav ikut hilang saat masuk ke satu kategori.
export function ApprovalCategoryPage({ categoryKey, initialId, onBack, onToast }) {
  const [view, setView] = useState(initialId ? { screen: 'detail', id: initialId } : { screen: 'list' })
  const category = CATEGORIES.find((c) => c.key === categoryKey)

  if (!category) {
    // Guards against a malformed/unknown deep link instead of crashing
    // on category.label below.
    return (
      <div>
        <div className="page-header"><button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button><h1>{tx("Tidak ditemukan")}</h1><span style={{ width: 22 }} /></div>
        <div className="empty-state"><p>{tx("Kategori pengajuan tidak dikenali.")}</p></div>
      </div>
    )
  }

  if (view.screen === 'detail') {
    return (
      <ApprovalDetail
        table={categoryKey} id={view.id}
        onBack={() => (initialId ? onBack() : setView({ screen: 'list' }))}
        onToast={onToast}
        onDecided={() => {}}
      />
    )
  }

  return (
    <ApprovalList
      category={category}
      onBack={onBack}
      onOpen={(id) => setView({ screen: 'detail', id })}
      onToast={onToast}
    />
  )
}

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function ApprovalList({ category, onBack, onOpen, onToast }) {
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')

  async function load() {
    const { data, error } = await supabase.rpc('get_my_approvals', { p_status: null })
    if (error) { onToast?.(error.message); return }
    setRows((data || []).filter((r) => r.category === category.key))
  }
  useEffect(() => { load() }, [])

  const filtered = (rows || []).filter((r) => r.requester_name?.toLowerCase().includes(query.toLowerCase()))

  // Kelompokkan per tanggal pengajuan (created_at), seperti referensi.
  const groups = []
  for (const r of filtered) {
    const dayKey = new Date(r.created_at).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })
    let g = groups.find((g) => g.dayKey === dayKey)
    if (!g) { g = { dayKey, items: [] }; groups.push(g) }
    g.items.push(r)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
        <button className="icon-btn" onClick={onBack} style={{ padding: 4 }}><ArrowLeft size={22} /></button>
        <h1 style={{ flex: 1, fontSize: 20, fontWeight: 700, margin: 0 }}>{category.label}</h1>
        <button className="icon-btn" style={{ padding: 4 }}><ClipboardCheck size={21} color="#5b554f" /></button>
        <button className="icon-btn" style={{ padding: 4 }}><Filter size={20} color="#5b554f" /></button>
      </div>

      <div className="search-box">
        <Search size={18} />
        <input placeholder={tx("Cari...")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {rows === null ? (
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><h3>{tx("Tidak ada pengajuan")}</h3><p>{tx("Pengajuan yang perlu Anda tinjau akan tampil di sini.")}</p></div>
      ) : (
        groups.map((g) => (
          <div key={g.dayKey}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '14px 16px 6px' }}>{g.dayKey}</div>
            {g.items.map((r) => (
              <button key={r.id} onClick={() => onOpen(r.id)} style={{
                width: '100%', display: 'block', textAlign: 'left', cursor: 'pointer', background: '#fff', border: 'none',
                borderRadius: 14, margin: '0 16px 10px', padding: 14, boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Avatar url={r.requester_avatar} name={r.requester_name} size={36} fontSize={12} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{r.requester_name}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 2 }}>{titleFor(category.key, r)}</div>
                    <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', fontSize: 13.5, color: 'var(--text-muted)' }}>
                      {bulletsFor(category.key, r).map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                    <div style={{ marginTop: 8 }}><StatusPill status={r.status} waitingFor={r.status === 'pending' && r.can_act === false ? r.waiting_for : null} /></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

function titleFor(category, r) {
  const d = r.details || {}
  switch (category) {
    case 'leave_requests': return tx("Pengajuan cuti untuk {0}", [d.type_name || tx("Cuti")])
    case 'overtime_requests': return tx("Pengajuan lembur untuk {0}", [fmtDay(d.work_date)])
    case 'reimbursement_requests': return tx("Pengajuan reimbursement untuk {0}", [tx(d.category_name) || tx("Reimbursement")])
    case 'shift_change_requests': return tx("Pengajuan ubah shift untuk {0}", [fmtDay(d.work_date)])
    case 'absence_requests': return tx("Pengajuan presensi untuk {0}", [fmtDay(d.work_date)])
    case 'data_change_requests': return tx("Pengajuan perubahan {0}", [fieldLabel(d.field_name)])
    default: return ''
  }
}

function bulletsFor(category, r) {
  const d = r.details || {}
  const lines = []
  switch (category) {
    case 'leave_requests':
      lines.push(d.start_date === d.end_date
        ? tx("{0} ({1} hari)", [fmtDay(d.start_date), d.total_days])
        : tx("{0} - {1} ({2} hari)", [fmtDay(d.start_date), fmtDay(d.end_date), d.total_days]))
      break
    case 'overtime_requests':
      lines.push(`Jam: ${d.start_time?.slice(0, 5)} - ${d.end_time?.slice(0, 5)}`)
      break
    case 'reimbursement_requests':
      lines.push(tx("Jumlah: Rp {0}", [Number(d.amount || 0).toLocaleString('id-ID')]))
      break
    case 'shift_change_requests':
      lines.push(tx("{0} menjadi {1}", [d.from_shift_name || '-', d.to_is_day_off ? 'Off' : (d.to_shift_name || '-')]))
      break
    case 'absence_requests':
      if (d.requested_clock_in || d.requested_clock_out) {
        lines.push(tx("Usulan: {0} - {1}", [d.requested_clock_in?.slice(0, 5) || '-', d.requested_clock_out?.slice(0, 5) || '-']))
      }
      break
    case 'data_change_requests':
      lines.push(d.field_name === 'bank_account'
        ? tx("{0} menjadi {1}", [bankText(d.old_value), bankText(d.new_value)])
        : tx("{0} menjadi {1}", [d.old_value || '-', d.new_value || '-']))
      break
  }
  if (r.reason) lines.push(tx("Alasan: {0}", [r.reason]))
  return lines
}

const FIELD_LABELS = {
  phone: () => tx("Nomor telepon"),
  email: () => 'Email',
  full_name: () => tx("Nama lengkap"),
  bank_account: () => tx("Rekening bank"),
}
function fieldLabel(f) { return (FIELD_LABELS[f] || (() => f || '-'))() }

// Rekening bank disimpan sebagai JSON {bank_name, bank_account_number, bank_account_holder}
function parseBank(v) {
  try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && typeof o === 'object' ? o : null } catch { return null }
}
function bankText(v) {
  const b = parseBank(v)
  if (!b || (!b.bank_name && !b.bank_account_number)) return '-'
  return `${b.bank_name || '-'} ${b.bank_account_number || '-'} (${b.bank_account_holder || '-'})`
}

function fmtDay(d) {
  return d ? new Date(d).toLocaleDateString(locale(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

function StatusPill({ status, waitingFor }) {
  if (waitingFor) {
    return (
      <span style={{ background: '#eef1fb', color: '#4356C4', fontSize: 11.5, fontWeight: 700, borderRadius: 8, padding: '4px 9px', whiteSpace: 'nowrap' }}>
        {tx("Menunggu {0}", [waitingFor])}
      </span>
    )
  }
  const map = {
    pending: { label: tx("Menunggu persetujuan"), bg: '#FBEEDD', fg: '#B4650C' },
    approved: { label: tx("Disetujui"), bg: '#DCF3E6', fg: '#1E8E5A' },
    rejected: { label: tx("Ditolak"), bg: '#FBE1DD', fg: '#C0392B' },
    cancelled: { label: tx("Dibatalkan"), bg: '#eee', fg: '#888' },
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
    onToast?.(approve ? tx("Pengajuan disetujui") : tx("Pengajuan ditolak"))
    onDecided?.()
    load()
  }

  if (!detail) {
    return (
      <div>
        <div className="page-header"><button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button><h1>Detail</h1><span style={{ width: 22 }} /></div>
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      </div>
    )
  }

  const r = detail.row
  const cat = CATEGORIES.find((c) => c.key === table)
  const submittedAt = new Date(r.created_at).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' pukul ' + new Date(r.created_at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>{cat?.label}</h1>
        <span style={{ width: 22 }} />
      </div>

      <div style={{ padding: '18px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar url={detail.requester_avatar} name={detail.requester_name} size={46} fontSize={15} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.requester_name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{submittedAt}</div>
        </div>
      </div>
      <div style={{ padding: '0 16px 14px' }}><StatusPill status={r.status} waitingFor={r.status === 'pending' && detail.can_act === false ? stepWho(firstPendingStep(detail)) : null} /></div>

      <div className="section" style={{ margin: '0 16px' }}>
        <FieldRows table={table} row={r} />

        {r.reason && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{tx("Alasan")}</div>
            <div style={{ fontSize: 15, marginTop: 2 }}>{r.reason}</div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>{tx("Status pengajuan")}</div>
          <Timeline row={r} detail={detail} />
        </div>
      </div>

      {r.status === 'pending' && detail.can_act !== false && (
        <div style={{ display: 'flex', gap: 10, padding: 16 }}>
          <button onClick={() => decide(false)} disabled={busy} style={{
            flex: 1, padding: 13, borderRadius: 12, border: '1px solid #C0392B', background: '#fff', color: '#C0392B',
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
          }}>
            <X size={17} />{' '}{tx("Tolak")}</button>
          <button onClick={() => decide(true)} disabled={busy} style={{
            flex: 1, padding: 13, borderRadius: 12, border: 'none', background: '#1E8E5A', color: '#fff',
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
          }}>
            <Check size={17} />{' '}{tx("Setuju")}</button>
        </div>
      )}
    </div>
  )
}

function FieldRows({ table, row }) {
  const rows = []
  if (table === 'leave_requests') {
    rows.push([tx("Tanggal"), tx("{0} - {1} ({2} hari)", [fmt(row.start_date), fmt(row.end_date), row.total_days])])
  } else if (table === 'overtime_requests') {
    rows.push([tx("Tanggal"), fmt(row.work_date)])
    rows.push([tx("Jam"), `${row.start_time?.slice(0, 5)} - ${row.end_time?.slice(0, 5)}`])
  } else if (table === 'reimbursement_requests') {
    rows.push([tx("Jumlah"), 'Rp ' + Number(row.amount).toLocaleString('id-ID')])
    if (row.description) rows.push([tx("Deskripsi"), row.description])
  } else if (table === 'shift_change_requests') {
    rows.push([tx("Tanggal"), fmt(row.work_date)])
    rows.push([tx("Menjadi"), row.to_is_day_off ? 'Off' : tx("Shift baru")])
  } else if (table === 'absence_requests') {
    rows.push([tx("Tanggal"), fmt(row.work_date)])
    if (row.requested_clock_in || row.requested_clock_out) {
      rows.push([tx("Usulan jam"), `${row.requested_clock_in?.slice(0, 5) || '-'} - ${row.requested_clock_out?.slice(0, 5) || '-'}`])
    }
  } else if (table === 'data_change_requests') {
    rows.push([tx("Data yang diubah"), fieldLabel(row.field_name)])
    if (row.field_name === 'bank_account') {
      const o = parseBank(row.old_value) || {}
      const n = parseBank(row.new_value) || {}
      rows.push([tx("Data saat ini"), bankText(o)])
      rows.push([tx("Nama bank"), n.bank_name || '-'])
      rows.push([tx("Nomor rekening"), n.bank_account_number || '-'])
      rows.push([tx("Atas nama"), n.bank_account_holder || '-'])
    } else {
      rows.push([tx("Data saat ini"), row.old_value || '-'])
      rows.push([tx("Data baru"), row.new_value || '-'])
    }
  }
  return (
    <>
      {table === 'data_change_requests' && row.field_name === 'bank_account' && row.status === 'pending' && (
        <div style={{ background: '#FBEEDD', color: '#8a5a0b', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
          {tx("Verifikasi rekening langsung dengan karyawan sebelum menyetujui.")}
        </div>
      )}
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
  return d ? new Date(d).toLocaleDateString(locale(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

const firstPendingStep = (detail) => (detail.steps || []).find((s) => s.status === 'pending')
const stepWho = (s) => (!s ? null : s.hr_fallback ? 'HR' : s.approver_name)

function Timeline({ row, detail }) {
  const items = [
    { label: tx("Diajukan oleh {0}", [detail.requester_name]), time: row.created_at, color: '#4356C4', done: true },
  ]
  const steps = detail.steps || []
  if (steps.length) {
    // rantai persetujuan berjenjang: satu butir per tahap (tahap yang dilewati tidak ditampilkan)
    let seenPending = false
    for (const s of steps) {
      const who = stepWho(s)
      const gol = s.approver_grade ? ` (${tx("Gol. {0}", [s.approver_grade])})` : ''
      if (s.status === 'approved') {
        const by = s.decided_by_name || who
        items.push({
          label: tx("Disetujui oleh {0}", [by]), time: s.decided_at, color: '#1E8E5A', done: true,
          sub: s.acted_as_hr && by !== who ? tx("menggantikan {0}", [who + gol]) : (s.approver_grade ? tx("Gol. {0}", [s.approver_grade]) : ''),
        })
      } else if (s.status === 'rejected') {
        const by = s.decided_by_name || who
        items.push({
          label: tx("Ditolak oleh {0}", [by]), time: s.decided_at, color: '#C0392B', done: true,
          sub: s.acted_as_hr && by !== who ? tx("menggantikan {0}", [who + gol]) : '',
        })
      } else if (s.status === 'pending') {
        items.push(seenPending
          ? { label: tx("Berikutnya: {0}", [who + gol]), time: null, color: '#cfc7bd', pending: true }
          : { label: tx("Menunggu persetujuan {0}", [who + gol]), time: null, color: '#c58a12', pending: true })
        seenPending = true
      }
    }
  } else if (row.status === 'pending') {
    items.push({ label: tx("Menunggu persetujuan dari {0}", [row.field_name ? 'HR' : (detail.manager_name || 'HR')]), time: null, color: '#c58a12', pending: true })
  } else if (row.status === 'approved') {
    items.push({ label: tx("Disetujui oleh {0}", [detail.approver_name || 'HR']), time: row.decided_at, color: '#1E8E5A', done: true })
  } else if (row.status === 'rejected') {
    items.push({ label: tx("Ditolak oleh {0}", [detail.approver_name || 'HR']), time: row.decided_at, color: '#C0392B', done: true })
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
            {it.sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{it.sub}</div>}
            {it.time && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(it.time).toLocaleDateString(locale(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(it.time).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
