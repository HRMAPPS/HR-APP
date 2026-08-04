import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const FIELDS = [
  { value: 'phone', label: 'Nomor telepon' },
  { value: 'email', label: 'Email' },
  { value: 'full_name', label: 'Nama lengkap' },
]

export default function DataChangeForm({ employee, onBack, onToast }) {
  const [field, setField] = useState(FIELDS[0].value)
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!newValue.trim()) { setError('Isi nilai baru'); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_data_change_request', {
      p_field_name: field, p_old_value: employee?.[field] || null, p_new_value: newValue, p_reason: reason,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast('Pengajuan perubahan data terkirim')
    onBack()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Ajukan Perubahan Data</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>Data yang diubah</label>
          <select value={field} onChange={(e) => setField(e.target.value)}>
            {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Data saat ini</label>
          <input value={employee?.[field] || '-'} disabled />
        </div>
        <div className="field">
          <label>Data baru</label>
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Masukkan data baru" />
        </div>
        <div className="field">
          <label>Alasan</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tambahkan alasan..." />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>{loading ? 'Mengirim...' : 'Kirim pengajuan'}</button>
      </form>
    </div>
  )
}
