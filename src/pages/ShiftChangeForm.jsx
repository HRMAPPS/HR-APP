import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function ShiftChangeForm({ onBack, onToast }) {
  const [shifts, setShifts] = useState([])
  const [date, setDate] = useState('')
  const [toShiftId, setToShiftId] = useState('')
  const [isDayOff, setIsDayOff] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('shifts').select('*').then(({ data }) => {
      setShifts(data || [])
      if (data?.[0]) setToShiftId(data[0].id)
    })
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!date) { setError('Pilih tanggal'); return }
    setLoading(true)
    const { error } = await supabase.rpc('submit_shift_change_request', {
      p_work_date: date, p_to_shift_id: isDayOff ? null : toShiftId, p_to_is_day_off: isDayOff, p_reason: reason,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast('Pengajuan ubah shift terkirim')
    onBack()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Ajukan Ubah Shift</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>Tanggal</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" checked={isDayOff} onChange={(e) => setIsDayOff(e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />
            Jadikan hari libur (Off)
          </label>
        </div>
        {!isDayOff && (
          <div className="field">
            <label>Shift baru</label>
            <select value={toShiftId} onChange={(e) => setToShiftId(e.target.value)}>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time?.slice(0,5)}-{s.end_time?.slice(0,5)})</option>)}
            </select>
          </div>
        )}
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
