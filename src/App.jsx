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
import SlipGaji from './pages/SlipGaji'
import Timesheet from './pages/Timesheet'

export default function App() {
  const { isLoggedIn, loading, employee, signOut } = useAuth()
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

  return (
    <div className="app-shell">
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {page ? (
          <PageRouter page={page} employee={employee} onBack={() => setPage(null)} onToast={flash} />
        ) : (
          <>
            {tab === 'home' && <Home employee={employee} onNavigate={navigateTo} onOpenAllApps={() => setShowAllApps(true)} />}
            {tab === 'employees' && <Employees />}
            {tab === 'inbox' && <Inbox employee={employee} onToast={flash} />}
            {tab === 'account' && <Account employee={employee} onSignOut={signOut} onToast={flash} onNavigate={navigateTo} />}
          </>
        )}
      </div>

      {!page && <BottomNav active={tab} onChange={handleTabChange} />}

      {showAllApps && (
        <AllAppsSheet onClose={() => setShowAllApps(false)} onNavigate={navigateTo} onToast={flash} />
      )}
      {showRequestSheet && (
        <RequestSheet onClose={() => setShowRequestSheet(false)} onNavigate={navigateTo} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function PageRouter({ page, employee, onBack, onToast }) {
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
      return <Absensi onBack={onBack} onToast={onToast} />
    case 'absensi-new':
      return <Absensi onBack={onBack} startNew onToast={onToast} />
    case 'shift-new':
      return <ShiftChangeForm onBack={onBack} onToast={onToast} />
    case 'data-new':
      return <DataChangeForm employee={employee} onBack={onBack} onToast={onToast} />
    case 'calendar':
      return <CalendarPage onBack={onBack} />
    case 'slip_gaji':
      return <SlipGaji onBack={onBack} />
    case 'timesheet':
      return <Timesheet employee={employee} onBack={onBack} onToast={onToast} />
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
