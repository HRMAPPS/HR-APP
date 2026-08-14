import { useEffect, useState } from 'react'
import { ChevronRight, User, Bell, CalendarDays, AlarmClock, Receipt, MapPin, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { ApprovalCategoryPage } from './ApprovalCenter'

const FOLDERS = [
  { key: 'notifikasi', label: 'Notifikasi', icon: Bell },
  { key: 'leave_requests', label: 'Cuti', icon: CalendarDays },
  { key: 'overtime_requests', label: 'Lembur', icon: AlarmClock },
  { key: 'reimbursement_requests', label: 'Reimbursement', icon: Receipt },
  { key: 'absence_requests', label: 'Presensi', icon: MapPin },
  { key: 'shift_change_requests', label: 'Perubahan Shift', icon: RefreshCw },
]

const APPROVAL_TABLES = FOLDERS.filter((f) => f.key !== 'notifikasi').map((f) => f.key)

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function NotificationList({ items, loading, onOpen }) {
  if (loading) return <div className="empty-state"><p>Memuat...</p></div>
  if (items.length === 0) return <div className="empty-state"><h3>Belum ada notifikasi</h3><p>Notifikasi Anda akan tampil di sini.</p></div>
  return (
    <div>
      {items.map((n) => (
        <button key={n.id} onClick={() => onOpen(n)} className="approval-card" style={{ width: 'calc(100% - 32px)', textAlign: 'left', cursor: 'pointer' }}>
          <div className="top-row">
            {n.actor_name
              ? <div className="approval-avatar-fallback" style={{ background: 'var(--blue)', color: '#fff' }}>{initials(n.actor_name)}</div>
              : <div className="approval-avatar-fallback"><User size={20} /></div>}
            <div className="body">
              <div className="name" style={{ fontWeight: n.is_read ? 500 : 700 }}>{n.title}</div>
              {n.body && <div className="desc">{n.body}</div>}
              <div className="desc" style={{ color: '#b0a99f', marginTop: 4 }}>
                {new Date(n.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <ChevronRight size={18} color="#ccc" style={{ flexShrink: 0, marginTop: 8 }} />
          </div>
        </button>
      ))}
    </div>
  )
}

// Desktop Inbox: folder sidebar on the left (Notifikasi + each approval
// category), full content pane on the right. Content reuses
// ApprovalCategoryPage as-is for categories, so list/detail/timeline/
// approve-reject behavior stays identical to what mobile already has —
// only the surrounding layout differs.
export default function DesktopInbox({ employee, onToast, onRead }) {
  const [folder, setFolder] = useState('notifikasi')
  const [openId, setOpenId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadNotifications() {
    setLoading(true)
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { loadNotifications() }, [employee?.id])

  async function openNotification(n) {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      loadNotifications()
      onRead?.()
    }
    if (n.related_table && APPROVAL_TABLES.includes(n.related_table) && n.related_id) {
      setFolder(n.related_table)
      setOpenId(n.related_id)
    }
  }

  function selectFolder(key) {
    setFolder(key)
    setOpenId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '20px 20px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--red)' }}>Message</h1>
      </div>

      <div style={{ display: 'flex', minHeight: 520, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', margin: '0 20px 20px' }}>
        <nav style={{ width: 200, flexShrink: 0, background: '#f6f3ef', padding: '18px 0' }}>
          {FOLDERS.map((f) => (
            <button key={f.key} onClick={() => selectFolder(f.key)} style={{
              display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              padding: '11px 20px', fontSize: 13, letterSpacing: '.02em', fontWeight: folder === f.key ? 700 : 500,
              background: folder === f.key ? '#fff' : 'transparent', color: folder === f.key ? 'var(--text)' : 'var(--text-muted)',
            }}>
              {f.label.toUpperCase()}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, background: '#fff', minWidth: 0 }}>
          {folder === 'notifikasi' ? (
            <NotificationList items={items} loading={loading} onOpen={openNotification} />
          ) : (
            <ApprovalCategoryPage categoryKey={folder} initialId={openId} onBack={() => selectFolder('notifikasi')} onToast={onToast} />
          )}
        </div>
      </div>
    </div>
  )
}
