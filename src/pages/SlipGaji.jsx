import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function periodLabel(period) {
  return new Date(period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export default function SlipGaji({ onBack }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_payslips')
      if (!error) setItems(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Slip Gaji</h1>
        <span style={{ width: 22 }} />
      </div>

      {loading ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : items.length === 0 ? (
        <div className="empty-state"><p>Belum ada slip gaji.</p></div>
      ) : (
        <div style={{ padding: '4px 16px' }}>
          {items.map((p) => {
            const open = openId === p.id
            return (
              <div key={p.id} style={{
                border: '1px solid var(--border)', borderRadius: 14, marginBottom: 12, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setOpenId(open ? null : p.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                    background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: '#DCEEF0', color: '#2C8C9C',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Wallet size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, textTransform: 'capitalize' }}>{periodLabel(p.period)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Gaji bersih: {rupiah(p.net_salary)}</div>
                  </div>
                  {open ? <ChevronUp size={18} color="#ccc" /> : <ChevronDown size={18} color="#ccc" />}
                </button>

                {open && (
                  <div style={{ padding: '2px 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <Row label="Gaji pokok" value={rupiah(p.basic_salary)} />
                    <Row label="Tunjangan" value={rupiah(p.allowances)} />
                    <Row label="Potongan" value={`- ${rupiah(p.deductions)}`} />
                    <Row label="Gaji bersih" value={rupiah(p.net_salary)} bold />
                    {p.notes && (
                      <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{p.notes}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '8px 0',
      borderTop: '1px solid var(--border)', fontSize: bold ? 14.5 : 13.5,
      fontWeight: bold ? 700 : 400,
    }}>
      <span style={{ color: bold ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
