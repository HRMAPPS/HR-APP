import { useState } from 'react'
import { ChevronRight, User, Briefcase, Flag, Users, GraduationCap, Wallet, Info, Folder, AlertTriangle, Lock, ScanFace } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import AvatarUploader from '../components/AvatarUploader'

import { tx } from '../lib/i18n'
import LanguageSwitch from '../components/LanguageSwitch'
const INFO_ROWS = [
  { label: tx("Info personal"), icon: User, section: 'personal' },
  { label: tx("Info pekerjaan"), icon: Briefcase, section: 'job' },
  { label: tx("Info kontak darurat"), icon: Flag, section: 'emergency' },
  { label: tx("Info keluarga"), icon: Users, section: 'family' },
  { label: tx("Pendidikan dan Pengalaman"), icon: GraduationCap, section: 'education' },
  { label: tx("Info payroll"), icon: Wallet, section: 'payroll' },
  { label: tx("Info tambahan"), icon: Info, section: 'additional' },
  { label: tx("File saya"), icon: Folder, section: 'files' },
  { label: tx("Peringatan"), icon: AlertTriangle, section: 'warnings' },
]

export default function Account({ employee, onSignOut, onToast, onNavigate, onAvatarChanged }) {
  const [showPwd, setShowPwd] = useState(false)

  function initials(name) {
    return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  }

  return (
    <div>
      <div className="account-header">
        <AvatarUploader
          name={employee?.full_name}
          url={employee?.avatar_url}
          size={56}
          fontSize={18}
          onToast={onToast}
          onChanged={() => onAvatarChanged?.()}
        />
        <div>
          <div className="name">{employee?.full_name}</div>
          <div className="role">{employee?.position}</div>
        </div>
      </div>

      <div className="menu-block">
        <h4>{tx("Info saya")}</h4>
        {INFO_ROWS.map((r) => {
          const Icon = r.icon
          return (
            <button key={r.label} className="menu-row" onClick={() => r.section ? onNavigate(`profile-${r.section}`) : onToast(tx("{0} segera hadir", [r.label]))}>
              <Icon size={19} /> {r.label} <ChevronRight size={18} className="chev" />
            </button>
          )
        })}
      </div>

      <div className="menu-block">
        <h4>{tx("Pengaturan")}</h4>
        <button className="menu-row" onClick={() => onNavigate('face-enrollment')}>
          <ScanFace size={19} />{' '}{tx("Daftarkan Wajah")}{' '}<ChevronRight size={18} className="chev" />
        </button>
        <button className="menu-row" onClick={() => setShowPwd(true)}>
          <Lock size={19} />{' '}{tx("Ubah kata sandi")}{' '}<ChevronRight size={18} className="chev" />
        </button>
        <div className="menu-row" style={{ cursor: 'default' }}>
          <span style={{ flex: 1 }}>{tx("Bahasa")}</span>
          <LanguageSwitch />
        </div>
        <button className="menu-row" style={{ color: '#b23b3b' }} onClick={onSignOut}>{tx("Keluar")}</button>
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
    if (pwd.length < 6) { setError(tx("Kata sandi minimal 6 karakter")); return }
    if (pwd !== confirm) { setError(tx("Konfirmasi kata sandi tidak sama")); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setLoading(false)
    if (error) { setError(error.message); return }
    onToast(tx("Kata sandi berhasil diubah"))
    onClose()
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{tx("Kata sandi")}</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>{tx("Kata sandi baru")}</label>
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={tx("Masukkan kata sandi baru")} />
          </div>
          <div className="field">
            <label>{tx("Konfirmasi kata sandi")}</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={tx("Ulangi kata sandi baru")} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={loading}>{loading ? tx("Menyimpan...") : tx("Kirim")}</button>
        </form>
      </div>
    </div>
  )
}
