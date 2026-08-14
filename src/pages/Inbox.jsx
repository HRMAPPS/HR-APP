import { useEffect, useState } from 'react'
import { ChevronRight, User } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import ApprovalCenter from '../components/ApprovalCenter'
import DesktopInbox from '../components/DesktopInbox'
import { useIsDesktop } from '../lib/useIsDesktop'

const APPROVAL_TABLES = ['leave_requests', 'overtime_requests', 'reimbursement_requests', 'shift_change_requests', 'absence_requests']

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function Inbox({ employee, onToast, onNavigate, onRead }) {
  const isDesktop = useIsDesktop()
  const [tab, setTab] = useState('notifikasi')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [approvalCount, setApprovalCount] = useState(0)

  async function load() {
    setLoading(true)
    const [{ data: notif }, { data: counts }] = await Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.rpc('get_approval_counts'),
    ])
    setItems(notif || [])
    // Fetched here (not just inside ApprovalCenter) so the "(1)" tab label
    // is correct immediately on open, not only after switching tabs.
    setApprovalCount(Object.values(counts || {}).reduce((a, b) => a + b, 0))
    setLoading(false)
  }

  useEffect(() => { load() }, [employee?.id])

  if (isDesktop) {
    return <DesktopInbox employee={employee} onToast={onToast} onRead={onRead} />
  }

  async function openNotification(n) {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      load()
      onRead?.()
    }
    // Only "needs approval" notifications (has related_table/related_id
    // pointing at a request) have somewhere to navigate to — "Slip Gaji
    // Tersedia" etc. are informational only and stay put.
    if (n.related_table && APPROVAL_TABLES.includes(n.related_table) && n.related_id) {
      onNavigate?.(`approval:${n.related_table}:${n.related_id}`)
    }
  }

  return (
    <div>
      <div className="topbar"><div style={{ fontSize: 24, fontWeight: 700 }}>Inbox</div></div>

      <div className="tabs">
        <button className={tab === 'notifikasi' ? 'active' : ''} onClick={() => setTab('notifikasi')}>Notifikasi</button>
        <button className={tab === 'approval' ? 'active' : ''} onClick={() => setTab('approval')}>
          Butuh persetujuan{approvalCount > 0 ? ` (${approvalCount})` : ''}
        </button>
      </div>

      {tab === 'notifikasi' && (
        loading ? <div className="empty-state"><p>Memuat...</p></div> :
        items.length === 0 ? (
          <div className="empty-state"><h3>Belum ada notifikasi</h3><p>Notifikasi Anda akan tampil di sini.</p></div>
        ) : items.map((n) => (
          <button key={n.id} className="list-item" style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => openNotification(n)}>
            <div className="avatar" style={{ color: '#9a938c' }}>
              {n.actor_name ? initials(n.actor_name) : <User size={18} />}
            </div>
            <div className="info">
              <div className="name" style={{ fontWeight: n.is_read ? 500 : 700 }}>{n.title}</div>
              {n.body && <div className="sub">{n.body}</div>}
              <div className="sub" style={{ color: '#b0a99f', marginTop: 1 }}>
                {new Date(n.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <ChevronRight size={18} color="#ccc" />
          </button>
        ))
      )}

      {tab === 'approval' && (
        <ApprovalCenter onToast={onToast} onCountsChange={setApprovalCount} onOpenCategory={(key) => onNavigate?.(`approval:${key}`)} />
      )}
    </div>
  )
}
