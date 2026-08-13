import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Shown when a user is authenticated (has a Supabase Auth session) but
// their account isn't linked to any `employees` row yet — e.g. they
// confirmed their email after signup, so linking couldn't happen inline
// during Login's signup flow (which needs an active session).
export default function LinkAccount({ onLinked, onSignOut }) {
  const [employeeCode, setEmployeeCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!employeeCode.trim()) { setError('Kode karyawan wajib diisi'); return }
    setLoading(true)
    const { error } = await supabase.rpc('link_my_employee_account', { p_employee_code: employeeCode.trim() })
    setLoading(false)
    if (error) { setError(error.message); return }
    onLinked()
  }

  return (
    <div className="login-page">
      <h1>Hubungkan Akun</h1>
      <p>Akun Anda sudah aktif, tapi belum terhubung ke data karyawan. Masukkan <strong>kode karyawan</strong> yang diberikan HR untuk melanjutkan.</p>
      <form onSubmit={submit}>
        <div className="field">
          <label>Kode karyawan</label>
          <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)}
            placeholder="mis. NP01 (dari HR)" required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>
          {loading ? 'Menghubungkan...' : 'Hubungkan Akun'}
        </button>
      </form>
      <button type="button" onClick={onSignOut}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13.5, marginTop: 16, cursor: 'pointer' }}>
        Keluar
      </button>
    </div>
  )
}
