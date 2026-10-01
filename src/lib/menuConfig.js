import {
  Receipt, Clock, MapPin, AlarmClock, ClipboardList, Wallet,
  CalendarDays, Grid3x3, Folder, Award, Package, FileEdit,
  Target, ListChecks, AlertTriangle, FolderKanban, CheckSquare, Network,
  Users2,
} from 'lucide-react'

import { tx } from './i18n'
// Quick-menu grid on Beranda (first 8 shown inline) + the rest inside
// "Semua Aplikasi". `page` is the key routed to in App.jsx; apps without
// a page yet just show a "coming soon" toast.
export const ALL_APPS = [
  { key: 'reimbursement', label: tx("Reimbursement"), icon: Receipt, bg: '#DCEEF0', fg: '#2C8C9C', page: 'reimbursement' },
  { key: 'cuti', label: tx("Cuti"), icon: Clock, bg: '#E2E6FB', fg: '#4356C4', page: 'cuti' },
  { key: 'presensi', label: tx("Presensi Online"), icon: MapPin, bg: '#FBE1DD', fg: '#C0392B', page: 'presensi' },
  { key: 'lembur', label: tx("Lembur"), icon: AlarmClock, bg: '#FBE1EC', fg: '#C23673', page: 'lembur' },
  { key: 'daftar_kehadiran', label: tx("Daftar Kehadiran"), icon: ClipboardList, bg: '#FDE3D3', fg: '#D2762B', page: 'absensi' },
  { key: 'slip_gaji', label: tx("Slip Gaji"), icon: Wallet, bg: '#DCEEF0', fg: '#2C8C9C', page: 'slip-gaji' },
  { key: 'kalender', label: tx("Kalender"), icon: CalendarDays, bg: '#FBE1EC', fg: '#C23673', page: 'calendar' },
  { key: 'semua', label: tx("Semua Aplikasi"), icon: Grid3x3, bg: '#EAE7E3', fg: '#5B554F', page: '__ALL_APPS__' },
  { key: 'file', label: tx("File"), icon: Folder, bg: '#FCE4D6', fg: '#D2762B', page: null },
  { key: 'review', label: tx("Review"), icon: Award, bg: '#E7E0FB', fg: '#6C4CC4', page: null },
  { key: 'aset', label: tx("Aset"), icon: Package, bg: '#E2E6FB', fg: '#4356C4', page: null },
  { key: 'formulir', label: tx("Formulir"), icon: FileEdit, bg: '#EAE0FB', fg: '#6C4CC4', page: null },
  { key: 'goal', label: tx("Goal"), icon: Target, bg: '#FBE1DD', fg: '#C0392B', page: null },
  { key: 'timesheet', label: 'Timesheet', icon: ListChecks, bg: '#DDE7FB', fg: '#3B6ECF', page: null },
  { key: 'peringatan', label: tx("Peringatan"), icon: AlertTriangle, bg: '#FDE3D3', fg: '#D2762B', page: null },
  { key: 'proyek', label: tx("Proyek"), icon: FolderKanban, bg: '#FBE1EC', fg: '#C23673', page: null },
  { key: 'tugas', label: tx("Tugas"), icon: CheckSquare, bg: '#DAF0E4', fg: '#1E8E5A', page: null },
  { key: 'struktur', label: tx("Struktur Organisasi"), icon: Network, bg: '#DDE7FB', fg: '#3B6ECF', page: 'org-chart' },
  { key: 'hr', label: 'HR', icon: Users2, bg: '#FBE8D6', fg: '#B4650C', page: 'hr-dashboard', hrOnly: true },
]

// Beranda shows the first 8 as the quick grid
export const HOME_QUICK_APPS = ALL_APPS.slice(0, 8)

// "Ajukan untuk" bottom sheet (from Karyawan tab / + button)
export const REQUEST_TYPES = [
  { key: 'reimbursement', label: tx("Reimbursement"), icon: Receipt, page: 'reimbursement-new' },
  { key: 'cuti', label: tx("Cuti"), icon: Clock, page: 'cuti-new' },
  { key: 'absensi', label: tx("Absensi"), icon: MapPin, page: 'absensi-new' },
  { key: 'shift', label: tx("Perubahan Shift"), icon: ClipboardList, page: 'shift-new' },
  { key: 'lembur', label: tx("Lembur"), icon: AlarmClock, page: 'lembur-new' },
  { key: 'data', label: tx("Perubahan Data"), icon: FileEdit, page: 'data-new' },
]
