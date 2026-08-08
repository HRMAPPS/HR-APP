import { useEffect, useState } from 'react'
import { ChevronRight, User } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import ApprovalCenter from '../components/ApprovalCenter'

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function Inbox({ employee, onToast }) {
  const [tab, setTab] = useState('notifikasi')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [approvalCount, setApprovalCount] = useState(0)

  async function load() {
    setLoading(true)
    const { data: notif } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(notif || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [employee?.id])

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    load()
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
            onClick={() => !n.is_read && markRead(n.id)}>
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
        <ApprovalCenter employee={employee} onToast={onToast} onCountsChange={setApprovalCount} />
      )}
    </div>
  )
}
