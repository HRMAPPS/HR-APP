import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'
import { useProfileDetail } from '../lib/useProfileDetail'

const SECTION_TITLES = {
  personal: 'Info Personal',
  job: 'Info Pekerjaan',
  emergency: 'Info Kontak Darurat',
  family: 'Info Keluarga',
  education: 'Pendidikan dan Pengalaman',
  payroll: 'Info Payroll',
  additional: 'Info Tambahan',
}

export default function ProfileDetail({ section, onBack, onToast }) {
  const profile = useProfileDetail()

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>{SECTION_TITLES[section] || 'Info saya'}</h1>
        <span style={{ width: 22 }} />
      </div>

      {profile.loading || !profile.data ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : (
        <div className="form-page">
          {section === 'personal' && <PersonalForm profile={profile} onToast={onToast} />}
          {section === 'job' && <JobView employee={profile.data.employee} />}
          {section === 'emergency' && <EmergencyForm profile={profile} onToast={onToast} />}
          {section === 'family' && <FamilyList profile={profile} onToast={onToast} />}
          {section === 'education' && <EducationList profile={profile} onToast={onToast} />}
          {section === 'payroll' && <PayrollForm profile={profile} onToast={onToast} />}
          {section === 'additional' && <AdditionalForm profile={profile} onToast={onToast} />}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Info personal
// ---------------------------------------------------------------------
function PersonalForm({ profile, onToast }) {
  const e = profile.data.employee
  const [form, setForm] = useState({
    nik: e.nik || '', birth_place: e.birth_place || '', birth_date: e.birth_date || '',
    gender: e.gender || '', blood_type: e.blood_type || '', marital_status: e.marital_status || '',
    religion: e.religion || '', ktp_address: e.ktp_address || '', domicile_address: e.domicile_address || '',
    personal_email: e.personal_email || '', phone: e.phone || '',
  })
  const [error, setError] = useState('')

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    const r = await profile.updatePersonal({
      p_nik: form.nik || null, p_birth_place: form.birth_place || null, p_birth_date: form.birth_date || null,
      p_gender: form.gender || null, p_blood_type: form.blood_type || null, p_marital_status: form.marital_status || null,
      p_religion: form.religion || null, p_ktp_address: form.ktp_address || null, p_domicile_address: form.domicile_address || null,
      p_personal_email: form.personal_email || null, p_phone: form.phone || null,
    })
    if (!r.ok) { setError(r.message); return }
    onToast('Info personal disimpan')
  }

  return (
    <form onSubmit={submit}>
      <div className="field"><label>NIK (KTP)</label><input value={form.nik} onChange={(ev) => set('nik', ev.target.value)} /></div>
      <div className="field"><label>Tempat lahir</label><input value={form.birth_place} onChange={(ev) => set('birth_place', ev.target.value)} /></div>
      <div className="field"><label>Tanggal lahir</label><input type="date" value={form.birth_date || ''} onChange={(ev) => set('birth_date', ev.target.value)} /></div>
      <div className="field">
        <label>Jenis kelamin</label>
        <select value={form.gender} onChange={(ev) => set('gender', ev.target.value)}>
          <option value="">- Pilih -</option>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>
      </div>
      <div className="field"><label>Golongan darah</label><input value={form.blood_type} onChange={(ev) => set('blood_type', ev.target.value)} /></div>
      <div className="field">
        <label>Status pernikahan</label>
        <select value={form.marital_status} onChange={(ev) => set('marital_status', ev.target.value)}>
          <option value="">- Pilih -</option>
          <option value="Belum menikah">Belum menikah</option>
          <option value="Menikah">Menikah</option>
          <option value="Cerai">Cerai</option>
        </select>
      </div>
      <div className="field"><label>Agama</label><input value={form.religion} onChange={(ev) => set('religion', ev.target.value)} /></div>
      <div className="field"><label>Alamat KTP</label><textarea value={form.ktp_address} onChange={(ev) => set('ktp_address', ev.target.value)} /></div>
      <div className="field"><label>Alamat domisili</label><textarea value={form.domicile_address} onChange={(ev) => set('domicile_address', ev.target.value)} /></div>
      <div className="field"><label>No. HP</label><input value={form.phone} onChange={(ev) => set('phone', ev.target.value)} /></div>
      <div className="field"><label>Email pribadi</label><input value={form.personal_email} onChange={(ev) => set('personal_email', ev.target.value)} /></div>
      {error && <p className="error-text">{error}</p>}
      <button className="primary-btn" disabled={profile.saving}>{profile.saving ? 'Menyimpan...' : 'Simpan'}</button>
    </form>
  )
}

// ---------------------------------------------------------------------
// Info pekerjaan — read only, diatur oleh HR
// ---------------------------------------------------------------------
function JobView({ employee: e }) {
  const rows = [
    ['Kode karyawan', e.employee_code],
    ['Jabatan', e.position],
    ['Departemen', e.department],
    ['Status karyawan', e.employment_status],
    ['Tanggal bergabung', e.join_date],
    ['Lokasi kerja', e.work_location],
    ['Tipe kontrak', e.contract_type],
    ['Atasan langsung', e.manager_name],
  ]
  return (
    <div>
      <div style={{ background: '#eef1fb', color: '#4356C4', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
        Data pekerjaan dikelola oleh HR. Ajukan lewat "Perubahan Data" jika ada yang perlu diperbarui.
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="field">
          <label>{label}</label>
          <input value={value || '-'} disabled />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Info kontak darurat
// ---------------------------------------------------------------------
function EmergencyForm({ profile, onToast }) {
  const e = profile.data.employee
  const [form, setForm] = useState({
    name: e.emergency_contact_name || '', relation: e.emergency_contact_relation || '', phone: e.emergency_contact_phone || '',
  })
  const [error, setError] = useState('')

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    const r = await profile.updateEmergency({ p_name: form.name || null, p_relation: form.relation || null, p_phone: form.phone || null })
    if (!r.ok) { setError(r.message); return }
    onToast('Kontak darurat disimpan')
  }

  return (
    <form onSubmit={submit}>
      <div className="field"><label>Nama</label><input value={form.name} onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))} /></div>
      <div className="field"><label>Hubungan</label><input value={form.relation} onChange={(ev) => setForm((f) => ({ ...f, relation: ev.target.value }))} placeholder="mis. Suami, Orang tua" /></div>
      <div className="field"><label>No. HP</label><input value={form.phone} onChange={(ev) => setForm((f) => ({ ...f, phone: ev.target.value }))} /></div>
      {error && <p className="error-text">{error}</p>}
      <button className="primary-btn" disabled={profile.saving}>{profile.saving ? 'Menyimpan...' : 'Simpan'}</button>
    </form>
  )
}

// ---------------------------------------------------------------------
// Info keluarga — daftar bisa tambah/edit/hapus
// ---------------------------------------------------------------------
function FamilyList({ profile, onToast }) {
  const [editing, setEditing] = useState(null) // null = list, {} = new, {...row} = edit

  if (editing !== null) {
    return (
      <FamilyForm
        row={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); onToast('Data keluarga disimpan') }}
        profile={profile}
      />
    )
  }

  return (
    <div>
      {profile.data.family.length === 0 ? (
        <div className="empty-state"><p>Belum ada data keluarga.</p></div>
      ) : (
        profile.data.family.map((f) => (
          <div key={f.id} className="list-item">
            <div className="info">
              <div className="name">{f.full_name}</div>
              <div className="sub">{f.relationship || '-'}{f.occupation ? ` · ${f.occupation}` : ''}</div>
            </div>
            <div className="actions">
              <button onClick={() => setEditing(f)}><Pencil size={17} /></button>
              <button onClick={async () => { await profile.deleteFamily(f.id); onToast('Data keluarga dihapus') }}><Trash2 size={17} /></button>
            </div>
          </div>
        ))
      )}
      <button className="primary-btn" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setEditing({})}>
        <Plus size={18} /> Tambah anggota keluarga
      </button>
    </div>
  )
}

function FamilyForm({ row, onCancel, onSaved, profile }) {
  const [form, setForm] = useState({
    full_name: row.full_name || '', relationship: row.relationship || '', birth_date: row.birth_date || '', occupation: row.occupation || '',
  })
  const [error, setError] = useState('')

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.full_name.trim()) { setError('Nama wajib diisi'); return }
    const r = await profile.upsertFamily({
      p_id: row.id || null, p_full_name: form.full_name, p_relationship: form.relationship || null,
      p_birth_date: form.birth_date || null, p_occupation: form.occupation || null,
    })
    if (!r.ok) { setError(r.message); return }
    onSaved()
  }

  return (
    <form onSubmit={submit}>
      <div className="field"><label>Nama</label><input value={form.full_name} onChange={(ev) => setForm((f) => ({ ...f, full_name: ev.target.value }))} /></div>
      <div className="field"><label>Hubungan</label><input value={form.relationship} onChange={(ev) => setForm((f) => ({ ...f, relationship: ev.target.value }))} placeholder="mis. Anak, Istri, Ayah" /></div>
      <div className="field"><label>Tanggal lahir</label><input type="date" value={form.birth_date || ''} onChange={(ev) => setForm((f) => ({ ...f, birth_date: ev.target.value }))} /></div>
      <div className="field"><label>Pekerjaan</label><input value={form.occupation} onChange={(ev) => setForm((f) => ({ ...f, occupation: ev.target.value }))} /></div>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="primary-btn" style={{ background: '#eee', color: '#333' }} onClick={onCancel}>Batal</button>
        <button className="primary-btn" disabled={profile.saving}>{profile.saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Pendidikan dan pengalaman — daftar bisa tambah/edit/hapus
// ---------------------------------------------------------------------
function EducationList({ profile, onToast }) {
  const [editing, setEditing] = useState(null)

  if (editing !== null) {
    return (
      <EducationForm
        row={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); onToast('Data disimpan') }}
        profile={profile}
      />
    )
  }

  const education = profile.data.education.filter((e) => e.kind === 'education')
  const experience = profile.data.education.filter((e) => e.kind === 'experience')

  return (
    <div>
      <strong style={{ fontSize: 15 }}>Pendidikan</strong>
      {education.length === 0 ? (
        <div className="empty-state" style={{ padding: '14px 0' }}><p>Belum ada data pendidikan.</p></div>
      ) : education.map((r) => <EduRow key={r.id} r={r} profile={profile} onEdit={() => setEditing(r)} onToast={onToast} />)}

      <strong style={{ fontSize: 15, display: 'block', marginTop: 20 }}>Pengalaman kerja</strong>
      {experience.length === 0 ? (
        <div className="empty-state" style={{ padding: '14px 0' }}><p>Belum ada data pengalaman kerja.</p></div>
      ) : experience.map((r) => <EduRow key={r.id} r={r} profile={profile} onEdit={() => setEditing(r)} onToast={onToast} />)}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="primary-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setEditing({ kind: 'education' })}>
          <Plus size={18} /> Pendidikan
        </button>
        <button className="primary-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setEditing({ kind: 'experience' })}>
          <Plus size={18} /> Pengalaman
        </button>
      </div>
    </div>
  )
}

function EduRow({ r, profile, onEdit, onToast }) {
  return (
    <div className="list-item">
      <div className="info">
        <div className="name">{r.institution}</div>
        <div className="sub">{r.title || '-'} {r.start_year ? `· ${r.start_year}${r.end_year ? '-' + r.end_year : ''}` : ''}</div>
      </div>
      <div className="actions">
        <button onClick={onEdit}><Pencil size={17} /></button>
        <button onClick={async () => { await profile.deleteEducation(r.id); onToast('Data dihapus') }}><Trash2 size={17} /></button>
      </div>
    </div>
  )
}

function EducationForm({ row, onCancel, onSaved, profile }) {
  const isExperience = row.kind === 'experience'
  const [form, setForm] = useState({
    institution: row.institution || '', title: row.title || '',
    start_year: row.start_year || '', end_year: row.end_year || '', description: row.description || '',
  })
  const [error, setError] = useState('')

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.institution.trim()) { setError(isExperience ? 'Nama perusahaan wajib diisi' : 'Nama institusi wajib diisi'); return }
    const r = await profile.upsertEducation({
      p_id: row.id || null, p_kind: row.kind || 'education', p_institution: form.institution,
      p_title: form.title || null, p_start_year: form.start_year ? Number(form.start_year) : null,
      p_end_year: form.end_year ? Number(form.end_year) : null, p_description: form.description || null,
    })
    if (!r.ok) { setError(r.message); return }
    onSaved()
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>{isExperience ? 'Nama perusahaan' : 'Nama sekolah/kampus'}</label>
        <input value={form.institution} onChange={(ev) => setForm((f) => ({ ...f, institution: ev.target.value }))} />
      </div>
      <div className="field">
        <label>{isExperience ? 'Jabatan' : 'Jenjang & jurusan'}</label>
        <input value={form.title} onChange={(ev) => setForm((f) => ({ ...f, title: ev.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>Tahun mulai</label><input value={form.start_year} onChange={(ev) => setForm((f) => ({ ...f, start_year: ev.target.value }))} /></div>
        <div className="field" style={{ flex: 1 }}><label>Tahun selesai</label><input value={form.end_year} onChange={(ev) => setForm((f) => ({ ...f, end_year: ev.target.value }))} /></div>
      </div>
      <div className="field"><label>Keterangan</label><textarea value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))} /></div>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="primary-btn" style={{ background: '#eee', color: '#333' }} onClick={onCancel}>Batal</button>
        <button className="primary-btn" disabled={profile.saving}>{profile.saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Info payroll
// ---------------------------------------------------------------------
function PayrollForm({ profile, onToast }) {
  const e = profile.data.employee
  const [form, setForm] = useState({
    bank_name: e.bank_name || '', bank_account_number: e.bank_account_number || '', bank_account_holder: e.bank_account_holder || '',
    npwp: e.npwp || '', bpjs_kesehatan: e.bpjs_kesehatan || '', bpjs_ketenagakerjaan: e.bpjs_ketenagakerjaan || '',
  })
  const [error, setError] = useState('')

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    const r = await profile.updatePayroll({
      p_bank_name: form.bank_name || null, p_bank_account_number: form.bank_account_number || null,
      p_bank_account_holder: form.bank_account_holder || null, p_npwp: form.npwp || null,
      p_bpjs_kesehatan: form.bpjs_kesehatan || null, p_bpjs_ketenagakerjaan: form.bpjs_ketenagakerjaan || null,
    })
    if (!r.ok) { setError(r.message); return }
    onToast('Info payroll disimpan')
  }

  return (
    <form onSubmit={submit}>
      <div className="field"><label>Nama bank</label><input value={form.bank_name} onChange={(ev) => setForm((f) => ({ ...f, bank_name: ev.target.value }))} /></div>
      <div className="field"><label>Nomor rekening</label><input value={form.bank_account_number} onChange={(ev) => setForm((f) => ({ ...f, bank_account_number: ev.target.value }))} /></div>
      <div className="field"><label>Atas nama</label><input value={form.bank_account_holder} onChange={(ev) => setForm((f) => ({ ...f, bank_account_holder: ev.target.value }))} /></div>
      <div className="field"><label>NPWP</label><input value={form.npwp} onChange={(ev) => setForm((f) => ({ ...f, npwp: ev.target.value }))} /></div>
      <div className="field"><label>No. BPJS Kesehatan</label><input value={form.bpjs_kesehatan} onChange={(ev) => setForm((f) => ({ ...f, bpjs_kesehatan: ev.target.value }))} /></div>
      <div className="field"><label>No. BPJS Ketenagakerjaan</label><input value={form.bpjs_ketenagakerjaan} onChange={(ev) => setForm((f) => ({ ...f, bpjs_ketenagakerjaan: ev.target.value }))} /></div>
      {error && <p className="error-text">{error}</p>}
      <button className="primary-btn" disabled={profile.saving}>{profile.saving ? 'Menyimpan...' : 'Simpan'}</button>
    </form>
  )
}

// ---------------------------------------------------------------------
// Info tambahan
// ---------------------------------------------------------------------
function AdditionalForm({ profile, onToast }) {
  const [notes, setNotes] = useState(profile.data.employee.additional_notes || '')
  const [error, setError] = useState('')

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    const r = await profile.updateAdditional({ p_notes: notes || null })
    if (!r.ok) { setError(r.message); return }
    onToast('Info tambahan disimpan')
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Catatan tambahan</label>
        <textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="Tulis info tambahan di sini..." style={{ minHeight: 160 }} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="primary-btn" disabled={profile.saving}>{profile.saving ? 'Menyimpan...' : 'Simpan'}</button>
    </form>
  )
}
