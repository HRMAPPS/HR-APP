import { useEffect, useState } from 'react'
import { Search, Phone, Mail, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function Employees() {
  const [query, setQuery] = useState('')
  const [list, setList] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    const t = setTimeout(async () => {
      let q = supabase
        .from('employees')
        .select('id, full_name, position, phone, email', { count: 'exact' })
        .order('full_name')
        .limit(50)
      if (query.trim()) q = q.ilike('full_name', `%${query.trim()}%`)
      const { data, count, error } = await q
      if (active && !error) { setList(data || []); setCount(count || 0) }
      if (active) setLoading(false)
    }, 250)
    return () => { active = false; clearTimeout(t) }
  }, [query])

  function initials(name) {
    return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  }

  return (
    <div>
      <div className="topbar" style={{ paddingBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>
          Employees <span style={{ color: '#a39c94', fontWeight: 500 }}>{count}</span>
        </div>
      </div>

      <div className="search-box">
        <Search size={18} />
        <input placeholder="Cari Karyawan" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div>
        {loading && <div className="empty-state"><p>Memuat...</p></div>}
        {!loading && list.length === 0 && (
          <div className="empty-state">
            <h3>Tidak ada karyawan</h3>
            <p>Coba kata kunci pencarian lain.</p>
          </div>
        )}
        {list.map((emp) => (
          <div key={emp.id} className="list-item">
            <div className="avatar">{initials(emp.full_name)}</div>
            <div className="info">
              <div className="name">{emp.full_name}</div>
              <div className="sub">{emp.position || '-'}</div>
            </div>
            <div className="actions">
              <button title="Telepon" disabled={!emp.phone}><Phone size={18} /></button>
              <button title="Email" disabled={!emp.email}><Mail size={18} /></button>
              <button title="WhatsApp" disabled={!emp.phone}><MessageCircle size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
