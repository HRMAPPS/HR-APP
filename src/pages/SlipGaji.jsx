import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/useAuth'

function rupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID')
}

const COMPONENT_LABELS = {
  tunjangan_makan: 'Tunjangan Makan',
  tunjangan_transport: 'Tunjangan Transport',
  tunjangan_jabatan: 'Tunjangan Jabatan',
  bonus: 'Bonus',
  potongan_bpjs: 'Potongan BPJS',
  potongan_pph21: 'Potongan PPh21',
  potongan_lain: 'Potongan Lain',
}

export default function SlipGaji({ onBack }) {
  const { employee } = useAuth()
  const [payslips, setPayslips] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!employee?.id) return
    supabase.from('payslips').select('*').eq('employee_id', employee.id).order('period', { ascending: false })
      .then(({ data }) => setPayslips(data || []))
  }, [employee?.id])

  if (selected) {
    const comp = selected.components || {}
    const hasComponents = Object.keys(comp).length > 0
    return (
      <div>
        <div className="page-header">
          <button className="back-btn" onClick={() => setSelected(null)}><ArrowLeft size={22} /></button>
          <h1>Detail Slip Gaji</h1>
          <span style={{ width: 22 }} />
        </div>
        <div className="form-page">
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {new Date(selected.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{rupiah(selected.net_salary)}</div>
          </div>
          <div className="list-item"><div className="info"><div className="name">Gaji pokok</div></div><strong>{rupiah(selected.basic_salary)}</strong></div>

          {hasComponents ? (
            <>
              {['tunjangan_makan', 'tunjangan_transport', 'tunjangan_jabatan', 'bonus'].filter((k) => comp[k]).map((k) => (
                <div key={k} className="list-item"><div className="info"><div className="name">{COMPONENT_LABELS[k]}</div></div><strong>{rupiah(comp[k])}</strong></div>
              ))}
              {['potongan_bpjs', 'potongan_pph21', 'potongan_lain'].filter((k) => comp[k]).map((k) => (
                <div key={k} className="list-item"><div className="info"><div className="name">{COMPONENT_LABELS[k]}</div></div><strong style={{ color: '#C0392B' }}>-{rupiah(comp[k])}</strong></div>
              ))}
            </>
          ) : (
            <>
              <div className="list-item"><div className="info"><div className="name">Tunjangan</div></div><strong>{rupiah(selected.allowances)}</strong></div>
              <div className="list-item"><div className="info"><div className="name">Potongan</div></div><strong style={{ color: '#C0392B' }}>-{rupiah(selected.deductions)}</strong></div>
            </>
          )}

          {selected.notes && <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 14 }}>{selected.notes}</p>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Slip Gaji</h1>
        <span style={{ width: 22 }} />
      </div>
      {payslips === null ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : payslips.length === 0 ? (
        <div className="empty-state"><p>Belum ada slip gaji.</p></div>
      ) : (
        payslips.map((p) => (
          <button key={p.id} className="list-item" style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => setSelected(p)}>
            <span className="ic" style={{ background: '#DCEEF0', color: '#2C8C9C', width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} />
            </span>
            <div className="info">
              <div className="name">{new Date(p.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</div>
              <div className="sub">{rupiah(p.net_salary)}</div>
            </div>
            <ChevronRight size={18} color="#ccc" />
          </button>
        ))
      )}
    </div>
  )
}
