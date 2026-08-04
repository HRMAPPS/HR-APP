import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('Email atau kata sandi salah.')
  }

  return (
    <div className="login-page">
      <h1>Masuk</h1>
      <p>Masuk untuk melihat jadwal, absensi, dan pengajuan Anda.</p>
      <form onSubmit={handleLogin}>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@perusahaan.com" required />
        </div>
        <div className="field">
          <label>Kata sandi</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan kata sandi" required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
