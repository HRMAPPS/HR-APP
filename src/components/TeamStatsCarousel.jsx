import { useState } from 'react'
import { CircleHelp } from 'lucide-react'
import Sheet from './Sheet'
import { tx } from '../lib/i18n'
import '../pages/TeamReportMobile.css'

// Kartu statistik yang bisa digeser: kartu "Hadir" (6 angka, lebih lebar dari layar)
// lalu kartu "Tidak hadir". Dipakai di laporan harian tim dan kehadiran bulanan anggota.
export default function TeamStatsCarousel({ hadir, absent, onHelp }) {
  const [page, setPage] = useState(0)
  function onScroll(e) {
    const el = e.currentTarget
    const max = el.scrollWidth - el.clientWidth
    setPage(max > 0 && el.scrollLeft > max / 2 ? 1 : 0)
  }
  return (
    <section className="tr-stats">
      <div className="tr-strip" onScroll={onScroll}>
        <div className="tr-card">
          <div className="tr-card-h">
            {tx('Hadir')}
            <button type="button" className="tr-help" onClick={onHelp} aria-label={tx('Bantuan')}><CircleHelp size={24} /></button>
          </div>
          <div className="tr-cols">
            {hadir.map(([label, value]) => (
              <div className="tr-col" key={label}><span className="tr-lbl">{label}</span><b className="tr-num">{value}</b></div>
            ))}
          </div>
        </div>
        <div className="tr-card">
          <div className="tr-card-h">{tx('Tidak hadir')}</div>
          <div className="tr-cols">
            {absent.map(([label, value]) => (
              <div className="tr-col" key={label}><span className="tr-lbl">{label}</span><b className="tr-num">{value}</b></div>
            ))}
          </div>
        </div>
      </div>
      <div className="tr-dots" aria-hidden="true"><i className={page === 0 ? 'on' : ''} /><i className={page === 1 ? 'on' : ''} /></div>
    </section>
  )
}

export function StatsHelpSheet({ onClose }) {
  const rows = [
    ['Tepat waktu', 'Clock in tidak melewati jam mulai shift dan jam clock out valid.'],
    ['Terlambat masuk', 'Clock in setelah jam mulai shift.'],
    ['Pulang lebih awal', 'Clock out sebelum jam selesai shift.'],
    ['Tidak clock in', 'Ada data pulang tetapi tidak ada data masuk.'],
    ['Tidak clock out', 'Sudah clock in tetapi belum clock out.'],
    ['Tidak valid', 'Jam clock out sama dengan atau lebih awal dari jam clock in.'],
    ['Absen', 'Hari kerja tanpa presensi dan tanpa cuti disetujui.'],
    ['Cuti', 'Karyawan sedang cuti yang sudah disetujui.'],
  ]
  return (
    <Sheet title={tx('Keterangan statistik')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 6 }}>
        {rows.map(([k, d]) => (
          <div key={k}><b style={{ fontSize: 15 }}>{tx(k)}</b><div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{tx(d)}</div></div>
        ))}
      </div>
    </Sheet>
  )
}
