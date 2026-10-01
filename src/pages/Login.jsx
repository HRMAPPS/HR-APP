import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

import { tx } from '../lib/i18n'
import LanguageSwitch from '../components/LanguageSwitch'
export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(tx("Email atau kata sandi salah."))
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    if (!employeeCode.trim()) { setError(tx("Kode karyawan wajib diisi. Minta kode ini ke HR.")); return }
    if (password.length < 8) { setError(tx("Kata sandi minimal 8 karakter")); return }
    if (password !== confirm) { setError(tx("Konfirmasi kata sandi tidak sama")); return }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    if (data.session) {
      // Signed in immediately — link to the HR-created employee record
      // right away so the app has a usable profile on first load.
      const { error: linkError } = await supabase.rpc('link_my_employee_account', { p_employee_code: employeeCode.trim() })
      setLoading(false)
      if (linkError) {
        setError(tx("Akun berhasil dibuat, tapi gagal menghubungkan ke data karyawan: {0}. Anda tetap bisa login nanti dan mencoba menghubungkan lagi.", [linkError.message]))
        return
      }
      // App re-renders automatically via the auth state change + linked employee.
    } else {
      // Email confirmation is required — there's no session yet, so linking
      // (which needs auth.uid()) has to happen after they confirm & log in.
      setLoading(false)
      setInfo(tx("Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk di sini — Anda akan diminta memasukkan kode karyawan untuk menghubungkan akun."))
      setMode('login')
    }
  }

  return (
    <div className="login-page">
      <LanguageSwitch style={{ position: 'absolute', top: 14, right: 14 }} />
      {mode === 'login' ? (
        <>
          <h1>{tx("Masuk")}</h1>
          <p>{tx("Masuk untuk melihat jadwal, absensi, dan pengajuan Anda.")}</p>
          {info && <p style={{ background: '#eef1fb', color: '#4356C4', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{info}</p>}
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={tx("nama@perusahaan.com")} required />
            </div>
            <div className="field">
              <label>{tx("Kata sandi")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={tx("Masukkan kata sandi")} required />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="primary-btn" disabled={loading}>
              {loading ? tx("Memproses...") : tx("Masuk")}
            </button>
          </form>
          <button type="button" onClick={() => { setMode('signup'); setError(''); setInfo('') }}
            style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13.5, fontWeight: 600, marginTop: 16, cursor: 'pointer' }}>{tx("Belum punya akun? Buat akun")}</button>
        </>
      ) : (
        <>
          <h1>{tx("Buat Akun")}</h1>
          <p>{tx("Sudah terdaftar sebagai karyawan? Minta")}{' '}<strong>{tx("kode karyawan")}</strong>{' '}{tx("ke HR, lalu buat akun login di sini.")}</p>
          <form onSubmit={handleSignup}>
            <div className="field">
              <label>{tx("Kode karyawan")}</label>
              <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder={tx("mis. NP01 (dari HR)")} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={tx("nama@perusahaan.com")} required />
            </div>
            <div className="field">
              <label>{tx("Kata sandi")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={tx("Minimal 8 karakter")} required />
            </div>
            <div className="field">
              <label>{tx("Konfirmasi kata sandi")}</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder={tx("Ulangi kata sandi")} required />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="primary-btn" disabled={loading}>
              {loading ? tx("Memproses...") : tx("Buat Akun")}
            </button>
          </form>
          <button type="button" onClick={() => { setMode('login'); setError(''); setInfo('') }}
            style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13.5, fontWeight: 600, marginTop: 16, cursor: 'pointer' }}>{tx("Sudah punya akun? Masuk")}</button>
        </>
      )}
    </div>
  )
}
