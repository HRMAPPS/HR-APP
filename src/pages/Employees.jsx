import { useEffect, useState } from 'react'
import { ArrowLeft, Search, Phone, Mail, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useIsDesktop } from '../lib/useIsDesktop'

function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function waLink(phone) {
  if (!phone) return null
  let digits = phone.replace(/[^0-9]/g, '')
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  return `https://wa.me/${digits}`
}

export default function Employees({ viewer }) {
  const [query, setQuery] = useState('')
  const [list, setList] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const isDesktop = useIsDesktop()

  const isHr = viewer?.role === 'hr' || viewer?.role === 'admin'

  useEffect(() => {
    let active = true
    setLoading(true)
    const t = setTimeout(async () => {
      let q = supabase
        .from('employees')
        .select('id, full_name, position, phone, email, employee_code, department, avatar_url', { count: 'exact' })
        .order('full_name')
        .limit(50)
      if (query.trim()) q = q.ilike('full_name', `%${query.trim()}%`)
      const { data, count, error } = await q
      if (active && !error) { setList(data || []); setCount(count || 0) }
      if (active) setLoading(false)
    }, 250)
    return () => { active = false; clearTimeout(t) }
  }, [query])

  if (selected) {
    return <EmployeeDetail emp={selected} isHr={isHr} onBack={() => setSelected(null)} />
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
        {!loading && list.length > 0 && (isDesktop ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, padding: '4px 16px 16px' }}>
            {list.map((emp) => (
              <div key={emp.id} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
                <button onClick={() => setSelected(emp)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, marginBottom: 12 }}>
                  <div className="avatar" style={{ width: 44, height: 44 }}>{initials(emp.full_name)}</div>
                  <div className="info">
                    <div className="name">{emp.full_name}</div>
                    <div className="sub">{emp.position || '-'}</div>
                  </div>
                </button>
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {isHr && (
                    <a href={emp.phone ? `tel:${emp.phone}` : undefined} title="Telepon" style={{
                      flex: 1, display: 'flex', justifyContent: 'center', padding: 7, borderRadius: 8, background: '#f7f4f0',
                      color: 'var(--blue)', opacity: emp.phone ? 1 : 0.35, pointerEvents: emp.phone ? 'auto' : 'none',
                    }}><Phone size={16} /></a>
                  )}
                  <a href={emp.email ? `mailto:${emp.email}` : undefined} title="Email" style={{
                    flex: 1, display: 'flex', justifyContent: 'center', padding: 7, borderRadius: 8, background: '#f7f4f0',
                    color: 'var(--blue)', opacity: emp.email ? 1 : 0.35, pointerEvents: emp.email ? 'auto' : 'none',
                  }}><Mail size={16} /></a>
                  {isHr && (
                    <a href={emp.phone ? waLink(emp.phone) : undefined} target="_blank" rel="noreferrer" title="WhatsApp" style={{
                      flex: 1, display: 'flex', justifyContent: 'center', padding: 7, borderRadius: 8, background: '#f7f4f0',
                      color: 'var(--blue)', opacity: emp.phone ? 1 : 0.35, pointerEvents: emp.phone ? 'auto' : 'none',
                    }}><MessageCircle size={16} /></a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          list.map((emp) => (
            <div key={emp.id} className="list-item">
              <button onClick={() => setSelected(emp)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                <div className="avatar">{initials(emp.full_name)}</div>
                <div className="info">
                  <div className="name">{emp.full_name}</div>
                  <div className="sub">{emp.position || '-'}</div>
                </div>
              </button>
              <div className="actions">
                {isHr && (
                  <a href={emp.phone ? `tel:${emp.phone}` : undefined} title="Telepon"
                    style={{ opacity: emp.phone ? 1 : 0.35, pointerEvents: emp.phone ? 'auto' : 'none' }}>
                    <Phone size={18} />
                  </a>
                )}
                <a href={emp.email ? `mailto:${emp.email}` : undefined} title="Email"
                  style={{ opacity: emp.email ? 1 : 0.35, pointerEvents: emp.email ? 'auto' : 'none' }}>
                  <Mail size={18} />
                </a>
                {isHr && (
                  <a href={emp.phone ? waLink(emp.phone) : undefined} target="_blank" rel="noreferrer" title="WhatsApp"
                    style={{ opacity: emp.phone ? 1 : 0.35, pointerEvents: emp.phone ? 'auto' : 'none' }}>
                    <MessageCircle size={18} />
                  </a>
                )}
              </div>
            </div>
          ))
        ))}
      </div>
    </div>
  )
}

function EmployeeDetail({ emp, isHr, onBack }) {
  const rows = [
    ['Email', emp.email || '-'],
    ['ID Karyawan', emp.employee_code || '-'],
    ['Posisi pekerjaan', emp.position || '-'],
    ['Nama Organisasi', emp.department || '-'],
  ]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={22} /></button>
      </div>
      <div style={{ textAlign: 'center', padding: '8px 20px 20px' }}>
        <div className="avatar" style={{ width: 76, height: 76, fontSize: 24, margin: '0 auto 14px' }}>{initials(emp.full_name)}</div>
        <div style={{ fontSize: 19, fontWeight: 700 }}>{emp.full_name}</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{emp.position || '-'}</div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
          {isHr && (
            <a href={emp.phone ? `tel:${emp.phone}` : undefined} title="Telepon" style={{
              width: 48, height: 48, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)', color: 'var(--blue)', opacity: emp.phone ? 1 : 0.35, pointerEvents: emp.phone ? 'auto' : 'none',
            }}>
              <Phone size={20} />
            </a>
          )}
          <a href={emp.email ? `mailto:${emp.email}` : undefined} title="Email" style={{
            width: 48, height: 48, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)', color: 'var(--blue)', opacity: emp.email ? 1 : 0.35, pointerEvents: emp.email ? 'auto' : 'none',
          }}>
            <Mail size={20} />
          </a>
          {isHr && (
            <a href={emp.phone ? waLink(emp.phone) : undefined} target="_blank" rel="noreferrer" title="WhatsApp" style={{
              width: 48, height: 48, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)', color: 'var(--blue)', opacity: emp.phone ? 1 : 0.35, pointerEvents: emp.phone ? 'auto' : 'none',
            }}>
              <MessageCircle size={20} />
            </a>
          )}
        </div>
      </div>

      <div className="menu-block" style={{ margin: '0 16px 20px' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 15 }}>{value}</div>
          </div>
        ))}
      </div>

      {!isHr && (
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', padding: '0 30px 20px' }}>
          Telepon &amp; WhatsApp hanya bisa diakses oleh HR.
        </p>
      )}
    </div>
  )
}
