import { useEffect, useState } from 'react'
import { ChevronRight, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const TABLE_LABELS = {
  leave_requests: 'Pengajuan Cuti',
  overtime_requests: 'Pengajuan Lembur',
  reimbursement_requests: 'Pengajuan Reimbursement',
  shift_change_requests: 'Pengajuan Ubah Shift',
  absence_requests: 'Pengajuan Absensi',
}

const SELECTS = {
  leave_requests: 'id, created_at, reason, status, start_date, end_date, total_days, employee_id, leave_types(name)',
  overtime_requests: 'id, created_at, reason, status, work_date, start_time, end_time, employee_id',
  reimbursement_requests: 'id, created_at, reason:description, status, amount, employee_id, reimbursement_categories(name)',
  shift_change_requests: 'id, created_at, reason, status, work_date, to_is_day_off, employee_id, to_shift:to_shift_id(name)',
  absence_requests: 'id, created_at, reason, status, work_date, employee_id',
}

function detailLine(p) {
  switch (p.table) {
    case 'leave_requests':
      return `${p.leave_types?.name || 'Cuti'} · ${p.start_date} – ${p.end_date} (${p.total_days} hari)`
    case 'overtime_requests':
      return `${p.work_date} · ${p.start_time?.slice(0, 5)} – ${p.end_time?.slice(0, 5)}`
    case 'reimbursement_requests':
      return `${p.reimbursement_categories?.name || 'Reimbursement'} · Rp ${Number(p.amount).toLocaleString('id-ID')}`
    case 'shift_change_requests':
      return `${p.work_date} · menjadi ${p.to_is_day_off ? 'Off' : (p.to_shift?.name || '-')}`
    case 'absence_requests':
      return `${p.work_date}`
    default:
      return ''
  }
}

export default function Inbox({ employee, onToast }) {
  const [tab, setTab] = useState('notifikasi')
  const [items, setItems] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    const { data: notif } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(notif || [])

    if (employee?.id) {
      const tables = Object.keys(TABLE_LABELS)
      const results = await Promise.all(
        tables.map((t) =>
          supabase.from(t).select(SELECTS[t]).eq('approver_id', employee.id).eq('status', 'pending')
            .order('created_at', { ascending: false })
            .then(({ data, error }) => error ? [] : (data || []).map((d) => ({ ...d, table: t })))
        )
      )
      const flat = results.flat()
      const employeeIds = [...new Set(flat.map((p) => p.employee_id))]
      let namesById = {}
      if (employeeIds.length) {
        const { data: emps } = await supabase.from('employees').select('id, full_name').in('id', employeeIds)
        namesById = Object.fromEntries((emps || []).map((e) => [e.id, e.full_name]))
      }
      setPending(flat.map((p) => ({ ...p, requester_name: namesById[p.employee_id] || 'Karyawan' })))
    } else {
      setPending([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [employee?.id])

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    load()
  }

  async function decide(p, approve) {
    setBusyId(p.table + p.id)
    const { error } = await supabase.rpc('decide_request', {
      p_table: p.table, p_request_id: p.id, p_approve: approve,
    })
    setBusyId(null)
    if (error) { onToast?.(error.message); return }
    onToast?.(approve ? 'Pengajuan disetujui' : 'Pengajuan ditolak')
    setPending((prev) => prev.filter((x) => !(x.table === p.table && x.id === p.id)))
  }

  return (
    <div>
      <div className="topbar"><div style={{ fontSize: 24, fontWeight: 700 }}>Inbox</div></div>

      <div className="tabs">
        <button className={tab === 'notifikasi' ? 'active' : ''} onClick={() => setTab('notifikasi')}>Notifikasi</button>
        <button className={tab === 'approval' ? 'active' : ''} onClick={() => setTab('approval')}>
          Butuh persetujuan{pending.length > 0 ? ` (${pending.length})` : ''}
        </button>
      </div>

      {loading && <div className="empty-state"><p>Memuat...</p></div>}

      {!loading && tab === 'notifikasi' && (
        items.length === 0 ? (
          <div className="empty-state"><h3>Belum ada notifikasi</h3><p>Notifikasi Anda akan tampil di sini.</p></div>
        ) : items.map((n) => (
          <button key={n.id} className="list-item" style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => !n.is_read && markRead(n.id)}>
            <div className="avatar" />
            <div className="info">
              <div className="name" style={{ fontWeight: n.is_read ? 500 : 700 }}>{n.title}</div>
              <div className="sub">{n.body}</div>
            </div>
            <ChevronRight size={18} color="#ccc" />
          </button>
        ))
      )}

      {!loading && tab === 'approval' && (
        pending.length === 0 ? (
          <div className="empty-state"><h3>Tidak ada yang perlu disetujui</h3><p>Pengajuan yang menunggu persetujuan Anda akan tampil di sini.</p></div>
        ) : pending.map((p) => {
          const key = p.table + p.id
          return (
            <div key={key} className="shift-hist-row">
              <div className="top">
                <div>
                  <div className="date">{p.requester_name}</div>
                  <div className="desc" style={{ margin: '2px 0 4px' }}>{TABLE_LABELS[p.table]}</div>
                </div>
              </div>
              <div className="desc">{detailLine(p)}</div>
              {p.reason && <div className="desc" style={{ fontStyle: 'italic' }}>"{p.reason}"</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  onClick={() => decide(p, true)}
                  disabled={busyId === key}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#1E8E5A', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}
                >
                  <Check size={16} /> Setuju
                </button>
                <button
                  onClick={() => decide(p, false)}
                  disabled={busyId === key}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #C0392B', background: '#fff', color: '#C0392B', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}
                >
                  <X size={16} /> Tolak
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
