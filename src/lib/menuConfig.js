import {
  Receipt, Clock, MapPin, AlarmClock, ClipboardList, Wallet,
  CalendarDays, Grid3x3, Folder, Award, Package, FileEdit,
  Target, ListChecks, AlertTriangle, FolderKanban, CheckSquare, Network,
  Users2,
} from 'lucide-react'

// Quick-menu grid on Beranda (first 8 shown inline) + the rest inside
// "Semua Aplikasi". `page` is the key routed to in App.jsx; apps without
// a page yet just show a "coming soon" toast.
export const ALL_APPS = [
  { key: 'reimbursement', label: 'Reimbursement', icon: Receipt, bg: '#DCEEF0', fg: '#2C8C9C', page: 'reimbursement' },
  { key: 'cuti', label: 'Cuti', icon: Clock, bg: '#E2E6FB', fg: '#4356C4', page: 'cuti' },
  { key: 'presensi', label: 'Presensi Online', icon: MapPin, bg: '#FBE1DD', fg: '#C0392B', page: 'presensi' },
  { key: 'lembur', label: 'Lembur', icon: AlarmClock, bg: '#FBE1EC', fg: '#C23673', page: 'lembur' },
  { key: 'daftar_kehadiran', label: 'Daftar Kehadiran', icon: ClipboardList, bg: '#FDE3D3', fg: '#D2762B', page: 'absensi' },
  { key: 'slip_gaji', label: 'Slip Gaji', icon: Wallet, bg: '#DCEEF0', fg: '#2C8C9C', page: null },
  { key: 'kalender', label: 'Kalender', icon: CalendarDays, bg: '#FBE1EC', fg: '#C23673', page: 'calendar' },
  { key: 'semua', label: 'Semua Aplikasi', icon: Grid3x3, bg: '#EAE7E3', fg: '#5B554F', page: '__ALL_APPS__' },
  { key: 'file', label: 'File', icon: Folder, bg: '#FCE4D6', fg: '#D2762B', page: null },
  { key: 'review', label: 'Review', icon: Award, bg: '#E7E0FB', fg: '#6C4CC4', page: null },
  { key: 'aset', label: 'Aset', icon: Package, bg: '#E2E6FB', fg: '#4356C4', page: null },
  { key: 'formulir', label: 'Formulir', icon: FileEdit, bg: '#EAE0FB', fg: '#6C4CC4', page: null },
  { key: 'goal', label: 'Goal', icon: Target, bg: '#FBE1DD', fg: '#C0392B', page: null },
  { key: 'timesheet', label: 'Timesheet', icon: ListChecks, bg: '#DDE7FB', fg: '#3B6ECF', page: null },
  { key: 'peringatan', label: 'Peringatan', icon: AlertTriangle, bg: '#FDE3D3', fg: '#D2762B', page: null },
  { key: 'proyek', label: 'Proyek', icon: FolderKanban, bg: '#FBE1EC', fg: '#C23673', page: null },
  { key: 'tugas', label: 'Tugas', icon: CheckSquare, bg: '#DAF0E4', fg: '#1E8E5A', page: null },
  { key: 'struktur', label: 'Struktur Organisasi', icon: Network, bg: '#DDE7FB', fg: '#3B6ECF', page: 'org-chart' },
  { key: 'hr', label: 'HR', icon: Users2, bg: '#FBE8D6', fg: '#B4650C', page: 'hr-dashboard', hrOnly: true },
]

// Beranda shows the first 8 as the quick grid
export const HOME_QUICK_APPS = ALL_APPS.slice(0, 8)

// "Ajukan untuk" bottom sheet (from Karyawan tab / + button)
export const REQUEST_TYPES = [
  { key: 'reimbursement', label: 'Reimbursement', icon: Receipt, page: 'reimbursement-new' },
  { key: 'cuti', label: 'Cuti', icon: Clock, page: 'cuti-new' },
  { key: 'absensi', label: 'Absensi', icon: MapPin, page: 'absensi-new' },
  { key: 'shift', label: 'Perubahan Shift', icon: ClipboardList, page: 'shift-new' },
  { key: 'lembur', label: 'Lembur', icon: AlarmClock, page: 'lembur-new' },
  { key: 'data', label: 'Perubahan Data', icon: FileEdit, page: 'data-new' },
]
