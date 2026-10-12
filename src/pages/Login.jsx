import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { tx, getLang, setLang } from '../lib/i18n'
import logo from '../assets/napocut-cover.png'
import './Login.css'

// Teks baru yang belum ada di kamus i18n: L(indonesia, inggris).
// Teks lama tetap memakai tx() supaya terjemahannya konsisten dengan seluruh aplikasi.
const L = (id, en) => (getLang() === 'en' ? en : id)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ---------- Ikon (inline SVG, tanpa dependensi) ---------- */
const svg = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
}
const IconMail = () => (
  <svg {...svg}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7.5 8 5.5 8-5.5" /></svg>
)
const IconLock = () => (
  <svg {...svg}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
)
const IconBadge = () => (
  <svg {...svg}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M6.2 16.2c.5-1.5 1.5-2.2 2.8-2.2s2.3.7 2.8 2.2M14.5 10h3.5M14.5 13.5H18" /></svg>
)
const IconEye = () => (
  <svg {...svg}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
)
const IconEyeOff = () => (
  <svg {...svg}><path d="M9.9 5.7A10.6 10.6 0 0 1 12 5.5C18.4 5.5 22 12 22 12a17 17 0 0 1-3.2 3.9M6.1 7.3A16.7 16.7 0 0 0 2 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m3 3 18 18" /></svg>
)

/* ---------- Komponen kecil (di luar Login agar input tidak kehilangan fokus) ---------- */
function LangPill() {
  const cur = getLang()
  return (
    <div className="lg-lang" role="group" aria-label="Bahasa / Language">
      {[['id', 'ID', 'Bahasa Indonesia'], ['en', 'EN', 'English']].map(([k, label, title]) => (
        <button key={k} type="button" title={title} aria-pressed={cur === k}
          onClick={() => { if (cur !== k) setLang(k) }}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Field({ id, label, icon, type = 'text', value, onChange, placeholder, autoComplete, inputMode, invalid }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="lg-field">
      <label htmlFor={id}>{label}</label>
      <div className={'lg-control' + (invalid ? ' is-invalid' : '')}>
        <span className="lg-ico">{icon}</span>
        <input
          id={id} name={id} value={value} onChange={onChange}
          type={isPassword && show ? 'text' : type}
          placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-invalid={invalid || undefined}
        />
        {isPassword && (
          <button type="button" className="lg-eye" aria-pressed={show}
            aria-label={show ? L('Sembunyikan kata sandi', 'Hide password') : L('Tampilkan kata sandi', 'Show password')}
            onClick={() => setShow((s) => !s)}>
            {show ? <IconEyeOff /> : <IconEye />}
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- Halaman ---------- */
export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [bad, setBad] = useState('') // field yang ditandai merah
  const [loading, setLoading] = useState(false)

  const touch = (setter) => (e) => { setter(e.target.value); if (bad) setBad(''); if (error) setError('') }
  const isBad = (...keys) => keys.includes(bad) || bad === 'both'

  function switchMode(next) {
    setMode(next); setError(''); setInfo(''); setBad('')
    setPassword(''); setConfirm('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setInfo('')
    const mail = email.trim()
    if (!EMAIL_RE.test(mail)) {
      setBad('email'); setError(L('Masukkan alamat email yang valid.', 'Enter a valid email address.')); return
    }
    if (!password) {
      setBad('password'); setError(L('Kata sandi wajib diisi.', 'Password is required.')); return
    }
    setBad(''); setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password })
      if (err) {
        const m = (err.message || '').toLowerCase()
        if (m.includes('not confirmed')) {
          setError(L('Email Anda belum diverifikasi. Periksa kotak masuk Anda.', 'Your email is not verified yet. Check your inbox.'))
        } else if (m.includes('invalid')) {
          setBad('both'); setError(tx('Email atau kata sandi salah.'))
        } else {
          setError(L('Terjadi kesalahan. Silakan coba lagi.', 'Something went wrong. Please try again.'))
        }
      }
      // Jika sukses, App otomatis berpindah lewat perubahan status auth.
    } catch {
      setError(L('Tidak dapat terhubung. Periksa koneksi internet Anda.', "Can't connect. Check your internet connection."))
    }
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    if (!employeeCode.trim()) { setBad('code'); setError(tx("Kode karyawan wajib diisi. Minta kode ini ke HR.")); return }
    if (!EMAIL_RE.test(email.trim())) { setBad('email'); setError(L('Masukkan alamat email yang valid.', 'Enter a valid email address.')); return }
    if (password.length < 8) { setBad('password'); setError(tx("Kata sandi minimal 8 karakter")); return }
    if (password !== confirm) { setBad('confirm'); setError(tx("Konfirmasi kata sandi tidak sama")); return }

    setBad(''); setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password })
    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    if (data.session) {
      // Langsung masuk — hubungkan ke data karyawan buatan HR supaya profil siap dipakai.
      const { error: linkError } = await supabase.rpc('link_my_employee_account', { p_employee_code: employeeCode.trim() })
      setLoading(false)
      if (linkError) {
        setError(tx("Akun berhasil dibuat, tapi gagal menghubungkan ke data karyawan: {0}. Anda tetap bisa login nanti dan mencoba menghubungkan lagi.", [linkError.message]))
        return
      }
      // App merender ulang otomatis lewat perubahan status auth + karyawan terhubung.
    } else {
      // Perlu konfirmasi email — belum ada sesi, jadi penghubungan (butuh auth.uid()) dilakukan setelah login.
      setLoading(false)
      setInfo(tx("Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk di sini — Anda akan diminta memasukkan kode karyawan untuk menghubungkan akun."))
      setMode('login'); setPassword(''); setConfirm('')
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="lg-page">
      <LangPill />

      <main className="lg-grid">
        {/* Kiri: brand */}
        <section className="lg-brand">
          <img className="lg-logo" src={logo} alt="Napocut" draggable="false" />
          <h2 className="lg-tagline">
            {L('Jadwal, absensi, dan pengajuan Anda dalam satu tempat.', 'Your schedule, attendance, and requests in one place.')}
          </h2>
          <div className="lg-bars" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <span key={i} className="lg-bar" />)}
          </div>
        </section>

        {/* Kanan: kartu form */}
        <section className="lg-formcol">
          <div className="lg-card">
            {isLogin ? (
              <>
                <h1>{tx("Masuk")}</h1>
                <p className="lg-lead">{tx("Masuk untuk melihat jadwal, absensi, dan pengajuan Anda.")}</p>
                {info && <p className="lg-info" role="status">{info}</p>}

                <form key="login" onSubmit={handleLogin} noValidate>
                  <Field id="email" label="Email" icon={<IconMail />} type="email" inputMode="email"
                    autoComplete="username" value={email} onChange={touch(setEmail)}
                    placeholder={tx("nama@perusahaan.com")} invalid={isBad('email')} />
                  <Field id="password" label={tx("Kata sandi")} icon={<IconLock />} type="password"
                    autoComplete="current-password" value={password} onChange={touch(setPassword)}
                    placeholder={tx("Masukkan kata sandi")} invalid={isBad('password')} />

                  {error && <div className="lg-error" role="alert">{error}</div>}

                  <button className="lg-submit" disabled={loading}>
                    {loading && <span className="lg-spin" aria-hidden="true" />}
                    {loading ? tx("Memproses...") : tx("Masuk")}
                  </button>
                </form>

                <p className="lg-switch">
                  {L('Belum punya akun?', "Don't have an account?")}{' '}
                  <button type="button" className="lg-link" onClick={() => switchMode('signup')}>
                    {L('Buat akun', 'Create account')}
                  </button>
                </p>
              </>
            ) : (
              <>
                <h1>{tx("Buat Akun")}</h1>
                <p className="lg-lead">
                  {tx("Sudah terdaftar sebagai karyawan? Minta")}{' '}<strong>{tx("kode karyawan")}</strong>{' '}{tx("ke HR, lalu buat akun login di sini.")}
                </p>

                <form key="signup" onSubmit={handleSignup} noValidate>
                  <Field id="employee-code" label={tx("Kode karyawan")} icon={<IconBadge />}
                    autoComplete="off" value={employeeCode} onChange={touch(setEmployeeCode)}
                    placeholder={tx("mis. NP01 (dari HR)")} invalid={isBad('code')} />
                  <Field id="email" label="Email" icon={<IconMail />} type="email" inputMode="email"
                    autoComplete="username" value={email} onChange={touch(setEmail)}
                    placeholder={tx("nama@perusahaan.com")} invalid={isBad('email')} />
                  <Field id="new-password" label={tx("Kata sandi")} icon={<IconLock />} type="password"
                    autoComplete="new-password" value={password} onChange={touch(setPassword)}
                    placeholder={tx("Minimal 8 karakter")} invalid={isBad('password')} />
                  <Field id="confirm-password" label={tx("Konfirmasi kata sandi")} icon={<IconLock />} type="password"
                    autoComplete="new-password" value={confirm} onChange={touch(setConfirm)}
                    placeholder={tx("Ulangi kata sandi")} invalid={isBad('confirm')} />

                  {error && <div className="lg-error" role="alert">{error}</div>}

                  <button className="lg-submit" disabled={loading}>
                    {loading && <span className="lg-spin" aria-hidden="true" />}
                    {loading ? tx("Memproses...") : tx("Buat Akun")}
                  </button>
                </form>

                <p className="lg-switch">
                  {L('Sudah punya akun?', 'Already have an account?')}{' '}
                  <button type="button" className="lg-link" onClick={() => switchMode('login')}>
                    {tx("Masuk")}
                  </button>
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
