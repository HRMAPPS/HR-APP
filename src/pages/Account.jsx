import { useState } from 'react'
import { ChevronRight, User, Briefcase, Flag, Users, GraduationCap, Wallet, Info, Folder, AlertTriangle, Lock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const INFO_ROWS = [
  { label: 'Info personal', icon: User, section: 'personal' },
  { label: 'Info pekerjaan', icon: Briefcase, section: 'job' },
  { label: 'Info kontak darurat', icon: Flag, section: 'emergency' },
  { label: 'Info keluarga', icon: Users, section: 'family' },
  { label: 'Pendidikan dan Pengalaman', icon: GraduationCap, section: 'education' },
  { label: 'Info payroll', icon: Wallet, section: 'payroll' },
  { label: 'Info tambahan', icon: Info, section: 'additional' },
  { label: 'File saya', icon: Folder, section: null },
  { label: 'Peringatan', icon: AlertTriangle, section: null },
]

export default function Account({ employee, onSignOut, onToast, onNavigate }) {
  const [showPwd, setShowPwd] = useState(false)

  function initials(name) {
    return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  }

  return (
    <div>
      <div className="account-header">
        <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials(employee?.full_name)}</div>
        <div>
          <div className="name">{employee?.full_name}</div>
          <div className="role">{employee?.position}</div>
        </div>
      </div>

      <div className="menu-block">
        <h4>Info saya</h4>
        {INFO_ROWS.map((r) => {
          const Icon = r.icon
          return (
            <button key={r.label} className="menu-row" onClick={() => r.section ? onNavigate(`profile-${r.section}`) : onToast(`${r.label} segera hadir`)}>
              <Icon size={19} /> {r.label} <ChevronRight size={18} className="chev" />
            </button>
          )
        })}
      </div>

      <div className="menu-block">
        <h4>Pengaturan</h4>
        <button className="menu-row" onClick={() => setShowPwd(true)}>
          <Lock size={19} /> Ubah kata sandi <ChevronRight size={18} className="chev" />
        </button>
        <button className="menu-row" style={{ color: '#b23b3b' }} onClick={onSignOut}>
          Keluar
        </button>
      </div>

      {showPwd && <ChangePasswordSheet onClose={() => setShowPwd(false)} onToast={onToast} />}
    </div>
  )
}

function ChangePasswordSheet({ onClose, onToast }) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (pwd.length < 6) { setError('Kata sandi minimal 6 karakter'); return }
    if (pwd !== confirm) { setError('Konfirmasi kata sandi tidak sama'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast('Kata sandi berhasil diubah')
    onClose()
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>Kata sandi</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Kata sandi baru</label>
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Masukkan kata sandi baru" />
          </div>
          <div className="field">
            <label>Konfirmasi kata sandi</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi kata sandi baru" />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={loading}>{loading ? 'Menyimpan...' : 'Kirim'}</button>
        </form>
      </div>
    </div>
  )
}
