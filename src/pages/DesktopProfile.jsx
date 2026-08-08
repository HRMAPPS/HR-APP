import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useProfileDetail } from '../lib/useProfileDetail'
import {
  PersonalForm, JobView, EmergencyForm, FamilyList, EducationList,
  PayrollForm, AdditionalForm, FilesList, WarningsList,
} from './ProfileDetail'

const MENU = [
  { key: 'personal', label: 'Personal' },
  { key: 'job', label: 'Employment' },
  { key: 'emergency', label: 'Emergency contact' },
  { key: 'family', label: 'Family' },
  { key: 'education', label: 'Education & experience' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'additional', label: 'Additional info' },
  { key: 'files', label: 'Files' },
  { key: 'warnings', label: 'Peringatan' },
]

function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function DesktopProfile({ employee, onSignOut, onToast }) {
  const profile = useProfileDetail()
  const [section, setSection] = useState('personal')

  if (profile.loading || !profile.data) {
    return <div className="empty-state"><p>Memuat...</p></div>
  }

  const e = profile.data.employee

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <aside style={{ width: 220, flexShrink: 0, background: '#fff', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="avatar" style={{ width: 68, height: 68, fontSize: 20, margin: '0 auto 12px' }}>{initials(e.full_name)}</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{e.full_name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 8px' }}>{e.position}</div>
          <span style={{ background: '#DCF3E6', color: '#1E8E5A', fontSize: 11, fontWeight: 700, borderRadius: 8, padding: '3px 10px' }}>
            {e.employment_status === 'inactive' ? 'Inactive employee' : 'Active employee'}
          </span>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {MENU.map((m) => (
            <button key={m.key} onClick={() => setSection(m.key)} style={{
              width: '100%', textAlign: 'left', background: section === m.key ? '#eef1fb' : 'none',
              color: section === m.key ? 'var(--blue)' : 'var(--text)', fontWeight: section === m.key ? 700 : 400,
              border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, cursor: 'pointer', marginBottom: 2,
            }}>
              {m.label}
            </button>
          ))}
          <button onClick={onSignOut} style={{
            width: '100%', textAlign: 'left', background: 'none', color: '#C0392B', border: 'none', borderRadius: 10,
            padding: '10px 12px', fontSize: 13.5, cursor: 'pointer', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <LogOut size={15} /> Keluar
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: 26, boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 20 }}>{MENU.find((m) => m.key === section)?.label}</h2>
        {section === 'personal' && <PersonalForm profile={profile} onToast={onToast} />}
        {section === 'job' && <JobView employee={e} />}
        {section === 'emergency' && <EmergencyForm profile={profile} onToast={onToast} />}
        {section === 'family' && <FamilyList profile={profile} onToast={onToast} />}
        {section === 'education' && <EducationList profile={profile} onToast={onToast} />}
        {section === 'payroll' && <PayrollForm profile={profile} onToast={onToast} />}
        {section === 'additional' && <AdditionalForm profile={profile} onToast={onToast} />}
        {section === 'files' && <FilesList employeeId={e.id} onToast={onToast} />}
        {section === 'warnings' && <WarningsList employeeId={e.id} />}
      </div>
    </div>
  )
}
