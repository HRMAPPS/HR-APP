import { useState } from 'react'
import { LogOut, Pencil, Briefcase, User, PhoneCall, Users, GraduationCap, Wallet, Info, Paperclip, AlertTriangle, MapPin, Hash, Building2, CalendarDays } from 'lucide-react'
import { useProfileDetail } from '../lib/useProfileDetail'
import AvatarUploader from '../components/AvatarUploader'
import {
  PersonalForm, EmergencyForm, FamilyList, EducationList,
  PayrollForm, AdditionalForm, FilesList, WarningsList,
} from './ProfileDetail'
import coverLogo from '../assets/napocut-cover.png'
import './DesktopProfile.css'

import { tx, locale } from '../lib/i18n'
const MENU = [
  { group: 'Umum', items: [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'job', label: tx("Pekerjaan"), icon: Briefcase },
    { key: 'emergency', label: tx("Kontak darurat"), icon: PhoneCall },
    { key: 'family', label: tx("Keluarga"), icon: Users },
    { key: 'education', label: tx("Pendidikan & pengalaman"), icon: GraduationCap },
    { key: 'additional', label: tx("Info tambahan"), icon: Info },
  ] },
  { group: 'Dokumen & keuangan', items: [
    { key: 'payroll', label: 'Payroll', icon: Wallet },
    { key: 'files', label: tx("File saya"), icon: Paperclip },
    { key: 'warnings', label: tx("Peringatan"), icon: AlertTriangle },
  ] },
]
const ALL = MENU.flatMap((g) => g.items)

const SUBTITLE = {
  personal: tx("Identitas, kontak, dan alamat Anda."),
  job: tx("Dikelola oleh HR. Ajukan lewat \"Perubahan Data\" bila ada yang perlu diperbarui."),
  emergency: tx("Orang yang dihubungi bila terjadi keadaan darurat."),
  family: tx("Anggota keluarga yang tercatat."),
  education: tx("Riwayat pendidikan dan pengalaman kerja."),
  additional: tx("Informasi pendukung lainnya."),
  payroll: tx("Rekening, NPWP, dan BPJS."),
  files: tx("Dokumen pribadi yang Anda unggah."),
  warnings: tx("Catatan peringatan dari perusahaan."),
}

const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : null)
const ageOf = (d) => {
  if (!d) return null
  const b = new Date(d + 'T00:00:00'), n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}

function Field({ label, value, wide }) {
  return (
    <div className={`dpx-f${wide ? ' wide' : ''}`}>
      <dt>{label}</dt>
      <dd className={value ? '' : 'empty'}>{value || tx("Belum diisi")}</dd>
    </div>
  )
}

function PersonalView({ e, onEdit }) {
  const age = ageOf(e.birth_date)
  return (
    <>
      <div className="dpx-sec">
        <div className="dpx-sec-h">
          <h3>{tx("Data pribadi")}</h3>
          <button className="dpx-edit" onClick={onEdit}><Pencil size={14} />{' '}{tx("Ubah")}</button>
        </div>
        <dl className="dpx-grid">
          <Field label={tx("Nama lengkap")} value={e.full_name} />
          <Field label={tx("No. HP")} value={e.phone} />
          <Field label={tx("Email kantor")} value={e.email} />
          <Field label={tx("Email pribadi")} value={e.personal_email} />
          <Field label={tx("Tempat lahir")} value={e.birth_place} />
          <Field label={tx("Tanggal lahir")} value={e.birth_date ? `${fmtDate(e.birth_date)}${age != null ? tx("· {0} tahun", [age]) : ''}` : null} />
          <Field label={tx("Jenis kelamin")} value={e.gender} />
          <Field label={tx("Status pernikahan")} value={e.marital_status} />
          <Field label={tx("Golongan darah")} value={e.blood_type} />
          <Field label={tx("Agama")} value={e.religion} />
        </dl>
      </div>
      <div className="dpx-sec">
        <div className="dpx-sec-h"><h3>{tx("Identitas & alamat")}</h3></div>
        <dl className="dpx-grid">
          <Field label={tx("NIK (KTP)")} value={e.nik} />
          <Field label={tx("Alamat KTP")} value={e.ktp_address} wide />
          <Field label={tx("Alamat domisili")} value={e.domicile_address} wide />
        </dl>
      </div>
    </>
  )
}

function JobView({ e }) {
  return (
    <div className="dpx-sec">
      <dl className="dpx-grid">
        <Field label={tx("Kode karyawan")} value={e.employee_code} />
        <Field label={tx("Jabatan")} value={e.position} />
        <Field label={tx("Departemen")} value={e.department} />
        <Field label={tx("Status karyawan")} value={e.employment_status === 'inactive' ? tx("Tidak aktif") : tx("Aktif")} />
        <Field label={tx("Tanggal bergabung")} value={fmtDate(e.join_date)} />
        <Field label={tx("Lokasi kerja")} value={e.work_location} />
        <Field label={tx("Tipe kontrak")} value={e.contract_type} />
        <Field label={tx("Atasan langsung")} value={e.manager_name} />
      </dl>
    </div>
  )
}

export default function DesktopProfile({ employee, onSignOut, onToast, onAvatarChanged }) {
  const profile = useProfileDetail()
  const [section, setSection] = useState('personal')
  const [editing, setEditing] = useState(false)

  if (profile.loading && !profile.data) return <div className="empty-state"><p>{tx("Memuat...")}</p></div>
  if (!profile.data) return <div className="empty-state"><p>{tx("Data profil tidak bisa dimuat.")}</p></div>

  const e = profile.data.employee
  const active = ALL.find((m) => m.key === section)
  const go = (k) => { setSection(k); setEditing(false) }
  const facts = [
    [Hash, tx("Kode"), e.employee_code],
    [Building2, tx("Departemen"), e.department],
    [MapPin, tx("Lokasi"), e.work_location],
    [CalendarDays, tx("Bergabung"), fmtDate(e.join_date)],
  ]

  return (
    <div className="dpx">
      <section className="dpx-hero">
        <div className="dpx-cover" style={{ backgroundImage: `url(${coverLogo})` }} />
        <div className="dpx-hero-in">
          <div className="dpx-avatar">
            <AvatarUploader
              name={e.full_name} url={e.avatar_url} size={104} fontSize={30} onToast={onToast}
              onChanged={async () => { await profile.reload(); await onAvatarChanged?.() }}
            />
          </div>
          <div className="dpx-id">
            <h1>{e.full_name}</h1>
            <div className="dpx-role">
              {e.position || tx("Karyawan")}
              <span className={`dpx-badge${e.employment_status === 'inactive' ? ' off' : ''}`}>
                {e.employment_status === 'inactive' ? tx("Tidak aktif") : tx("Karyawan aktif")}
              </span>
            </div>
          </div>
          <dl className="dpx-facts">
            {facts.map(([Icon, l, v]) => (
              <div key={l}><Icon size={15} /><span><dt>{l}</dt><dd>{v || '–'}</dd></span></div>
            ))}
          </dl>
        </div>
      </section>

      <div className="dpx-layout">
        <nav className="dpx-nav" aria-label={tx("Profil")}>
          {MENU.map((g) => (
            <div key={g.group}>
              <div className="dpx-nav-g">{g.group}</div>
              {g.items.map(({ key, label, icon: Icon }) => (
                <button key={key} aria-current={section === key ? 'page' : undefined} onClick={() => go(key)}>
                  <Icon size={17} /> {label}
                </button>
              ))}
            </div>
          ))}
          <button className="dpx-out" onClick={onSignOut}><LogOut size={17} />{' '}{tx("Keluar")}</button>
        </nav>

        <main className="dpx-body">
          <header className="dpx-body-h">
            <div>
              <h2>{active?.label}</h2>
              <p>{SUBTITLE[section]}</p>
            </div>
            {section === 'personal' && editing && (
              <button className="dpx-edit" onClick={() => setEditing(false)}>{tx("Batal")}</button>
            )}
          </header>

          {section === 'personal' && (editing
            ? <div className="dpx-form"><PersonalForm profile={profile} onToast={(m) => { onToast(m); setEditing(false) }} /></div>
            : <PersonalView e={e} onEdit={() => setEditing(true)} />)}
          {section === 'job' && <JobView e={e} />}
          {section === 'emergency' && <div className="dpx-form"><EmergencyForm profile={profile} onToast={onToast} /></div>}
          {section === 'family' && <FamilyList profile={profile} onToast={onToast} />}
          {section === 'education' && <EducationList profile={profile} onToast={onToast} />}
          {section === 'payroll' && <div className="dpx-form"><PayrollForm profile={profile} onToast={onToast} /></div>}
          {section === 'additional' && <div className="dpx-form"><AdditionalForm profile={profile} onToast={onToast} /></div>}
          {section === 'files' && <FilesList employeeId={e.id} onToast={onToast} />}
          {section === 'warnings' && <WarningsList employeeId={e.id} />}
        </main>
      </div>
    </div>
  )
}
