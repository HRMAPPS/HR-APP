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

const MENU = [
  { group: 'Umum', items: [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'job', label: 'Pekerjaan', icon: Briefcase },
    { key: 'emergency', label: 'Kontak darurat', icon: PhoneCall },
    { key: 'family', label: 'Keluarga', icon: Users },
    { key: 'education', label: 'Pendidikan & pengalaman', icon: GraduationCap },
    { key: 'additional', label: 'Info tambahan', icon: Info },
  ] },
  { group: 'Dokumen & keuangan', items: [
    { key: 'payroll', label: 'Payroll', icon: Wallet },
    { key: 'files', label: 'File saya', icon: Paperclip },
    { key: 'warnings', label: 'Peringatan', icon: AlertTriangle },
  ] },
]
const ALL = MENU.flatMap((g) => g.items)

const SUBTITLE = {
  personal: 'Identitas, kontak, dan alamat Anda.',
  job: 'Dikelola oleh HR. Ajukan lewat "Perubahan Data" bila ada yang perlu diperbarui.',
  emergency: 'Orang yang dihubungi bila terjadi keadaan darurat.',
  family: 'Anggota keluarga yang tercatat.',
  education: 'Riwayat pendidikan dan pengalaman kerja.',
  additional: 'Informasi pendukung lainnya.',
  payroll: 'Rekening, NPWP, dan BPJS.',
  files: 'Dokumen pribadi yang Anda unggah.',
  warnings: 'Catatan peringatan dari perusahaan.',
}

const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : null)
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
      <dd className={value ? '' : 'empty'}>{value || 'Belum diisi'}</dd>
    </div>
  )
}

function PersonalView({ e, onEdit }) {
  const age = ageOf(e.birth_date)
  return (
    <>
      <div className="dpx-sec">
        <div className="dpx-sec-h">
          <h3>Data pribadi</h3>
          <button className="dpx-edit" onClick={onEdit}><Pencil size={14} /> Ubah</button>
        </div>
        <dl className="dpx-grid">
          <Field label="Nama lengkap" value={e.full_name} />
          <Field label="No. HP" value={e.phone} />
          <Field label="Email kantor" value={e.email} />
          <Field label="Email pribadi" value={e.personal_email} />
          <Field label="Tempat lahir" value={e.birth_place} />
          <Field label="Tanggal lahir" value={e.birth_date ? `${fmtDate(e.birth_date)}${age != null ? ` · ${age} tahun` : ''}` : null} />
          <Field label="Jenis kelamin" value={e.gender} />
          <Field label="Status pernikahan" value={e.marital_status} />
          <Field label="Golongan darah" value={e.blood_type} />
          <Field label="Agama" value={e.religion} />
        </dl>
      </div>
      <div className="dpx-sec">
        <div className="dpx-sec-h"><h3>Identitas & alamat</h3></div>
        <dl className="dpx-grid">
          <Field label="NIK (KTP)" value={e.nik} />
          <Field label="Alamat KTP" value={e.ktp_address} wide />
          <Field label="Alamat domisili" value={e.domicile_address} wide />
        </dl>
      </div>
    </>
  )
}

function JobView({ e }) {
  return (
    <div className="dpx-sec">
      <dl className="dpx-grid">
        <Field label="Kode karyawan" value={e.employee_code} />
        <Field label="Jabatan" value={e.position} />
        <Field label="Departemen" value={e.department} />
        <Field label="Status karyawan" value={e.employment_status === 'inactive' ? 'Tidak aktif' : 'Aktif'} />
        <Field label="Tanggal bergabung" value={fmtDate(e.join_date)} />
        <Field label="Lokasi kerja" value={e.work_location} />
        <Field label="Tipe kontrak" value={e.contract_type} />
        <Field label="Atasan langsung" value={e.manager_name} />
      </dl>
    </div>
  )
}

export default function DesktopProfile({ employee, onSignOut, onToast, onAvatarChanged }) {
  const profile = useProfileDetail()
  const [section, setSection] = useState('personal')
  const [editing, setEditing] = useState(false)

  if (profile.loading && !profile.data) return <div className="empty-state"><p>Memuat...</p></div>
  if (!profile.data) return <div className="empty-state"><p>Data profil tidak bisa dimuat.</p></div>

  const e = profile.data.employee
  const active = ALL.find((m) => m.key === section)
  const go = (k) => { setSection(k); setEditing(false) }
  const facts = [
    [Hash, 'Kode', e.employee_code],
    [Building2, 'Departemen', e.department],
    [MapPin, 'Lokasi', e.work_location],
    [CalendarDays, 'Bergabung', fmtDate(e.join_date)],
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
              {e.position || 'Karyawan'}
              <span className={`dpx-badge${e.employment_status === 'inactive' ? ' off' : ''}`}>
                {e.employment_status === 'inactive' ? 'Tidak aktif' : 'Karyawan aktif'}
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
        <nav className="dpx-nav" aria-label="Profil">
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
          <button className="dpx-out" onClick={onSignOut}><LogOut size={17} /> Keluar</button>
        </nav>

        <main className="dpx-body">
          <header className="dpx-body-h">
            <div>
              <h2>{active?.label}</h2>
              <p>{SUBTITLE[section]}</p>
            </div>
            {section === 'personal' && editing && (
              <button className="dpx-edit" onClick={() => setEditing(false)}>Batal</button>
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
