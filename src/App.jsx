import { useState } from 'react'
import { useAuth } from './lib/useAuth'
import BottomNav from './components/BottomNav'
import AllAppsSheet from './components/AllAppsSheet'
import RequestSheet from './components/RequestSheet'
import Login from './pages/Login'
import Home from './pages/Home'
import Employees from './pages/Employees'
import Inbox from './pages/Inbox'
import Account from './pages/Account'
import Reimbursement from './pages/Reimbursement'
import Cuti from './pages/Cuti'
import Lembur from './pages/Lembur'
import Absensi from './pages/Absensi'
import PresensiOnline from './pages/PresensiOnline'
import ShiftChangeForm from './pages/ShiftChangeForm'
import DataChangeForm from './pages/DataChangeForm'
import CalendarPage from './pages/CalendarPage'
import ProfileDetail from './pages/ProfileDetail'
import OrgChart from './pages/OrgChart'
import HRDashboard from './pages/HRDashboard'
import SlipGaji from './pages/SlipGaji'
import InstallPrompt from './components/InstallPrompt'
import DesktopShell from './components/DesktopShell'
import { useIsDesktop } from './lib/useIsDesktop'
import { ApprovalCategoryPage } from './components/ApprovalCenter'
import DesktopProfile from './pages/DesktopProfile'

export default function App() {
  const { isLoggedIn, loading, employee, signOut } = useAuth()
  const isDesktop = useIsDesktop()
  const [tab, setTab] = useState('home')
  const [page, setPage] = useState(null) // full-screen page overlay, e.g. 'reimbursement'
  const [showAllApps, setShowAllApps] = useState(false)
  const [showRequestSheet, setShowRequestSheet] = useState(false)
  const [toast, setToast] = useState('')

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function handleTabChange(key) {
    if (key === 'request') { setShowRequestSheet(true); return }
    setPage(null)
    setTab(key)
  }

  // Navigation target used both by quick-grid and the "Ajukan untuk" sheet.
  // '-new' suffix opens the list page pre-armed to show its form.
  function navigateTo(target) {
    setPage(target)
  }

  if (loading) {
    return <div className="app-shell"><div className="empty-state"><p>Memuat...</p></div></div>
  }

  if (!isLoggedIn) {
    return <div className="app-shell"><Login /></div>
  }

  const content = page ? (
    <PageRouter page={page} employee={employee} onBack={() => setPage(null)} onToast={flash} onNavigate={navigateTo} />
  ) : (
    <>
      {tab === 'home' && <><InstallPrompt /><Home employee={employee} onNavigate={navigateTo} onOpenAllApps={() => setShowAllApps(true)} /></>}
      {tab === 'employees' && <Employees viewer={employee} />}
      {tab === 'inbox' && <Inbox employee={employee} onToast={flash} onNavigate={navigateTo} />}
      {tab === 'account' && (isDesktop
        ? <DesktopProfile employee={employee} onSignOut={signOut} onToast={flash} />
        : <Account employee={employee} onSignOut={signOut} onToast={flash} onNavigate={navigateTo} />
      )}
    </>
  )

  const overlays = (
    <>
      {showAllApps && (
        <AllAppsSheet onClose={() => setShowAllApps(false)} onNavigate={navigateTo} onToast={flash} employee={employee} />
      )}
      {showRequestSheet && (
        <RequestSheet onClose={() => setShowRequestSheet(false)} onNavigate={navigateTo} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )

  if (isDesktop) {
    return (
      <>
        <DesktopShell employee={employee} active={page ? null : tab} onChange={handleTabChange} onOpenAllApps={() => setShowAllApps(true)}
          wide={!page && (tab === 'account' || tab === 'home')}>
          {content}
        </DesktopShell>
        {overlays}
      </>
    )
  }

  return (
    <div className="app-shell">
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {content}
      </div>

      {!page && <BottomNav active={tab} onChange={handleTabChange} />}

      {overlays}
    </div>
  )
}

function PageRouter({ page, employee, onBack, onToast, onNavigate }) {
  if (page?.startsWith('approval:')) {
    return <ApprovalCategoryPage categoryKey={page.replace('approval:', '')} onBack={onBack} onToast={onToast} />
  }
  switch (page) {
    case 'reimbursement':
      return <Reimbursement onBack={onBack} onToast={onToast} />
    case 'reimbursement-new':
      return <Reimbursement onBack={onBack} startNew onToast={onToast} />
    case 'cuti':
      return <Cuti onBack={onBack} onToast={onToast} />
    case 'cuti-new':
      return <Cuti onBack={onBack} startNew onToast={onToast} />
    case 'lembur':
      return <Lembur onBack={onBack} onToast={onToast} />
    case 'lembur-new':
      return <Lembur onBack={onBack} startNew onToast={onToast} />
    case 'presensi':
      return <PresensiOnline employee={employee} onBack={onBack} onToast={onToast} />
    case 'absensi':
      return <Absensi employee={employee} onBack={onBack} onToast={onToast} onNavigate={onNavigate} />
    case 'absensi-new':
      return <Absensi employee={employee} onBack={onBack} startNew onToast={onToast} onNavigate={onNavigate} />
    case 'shift-new':
      return <ShiftChangeForm onBack={onBack} onToast={onToast} />
    case 'data-new':
      return <DataChangeForm employee={employee} onBack={onBack} onToast={onToast} />
    case 'calendar':
      return <CalendarPage onBack={onBack} />
    case 'org-chart':
      return <OrgChart onBack={onBack} onToast={onToast} />
    case 'hr-dashboard':
      return <HRDashboard onBack={onBack} onToast={onToast} />
    case 'slip-gaji':
      return <SlipGaji onBack={onBack} onToast={onToast} />
    case 'profile-personal':
    case 'profile-job':
    case 'profile-emergency':
    case 'profile-family':
    case 'profile-education':
    case 'profile-payroll':
    case 'profile-additional':
    case 'profile-files':
    case 'profile-warnings':
      return <ProfileDetail section={page.replace('profile-', '')} onBack={onBack} onToast={onToast} />
    default:
      return null
  }
}
