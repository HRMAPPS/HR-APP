import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/useAuth'

function rupiah(n) {
  return Number(n || 0).toLocaleString('id-ID')
}

const PENDAPATAN_FIELDS = [
  ['Tunjangan Jabatan', 'tunjangan_jabatan'],
  ['Tunjangan Kinerja', 'tunjangan_kinerja'],
  ['Tunjangan Fullshift', 'tunjangan_fullshift'],
  ['Business Trip Allowance', 'business_trip_allowance'],
  ['Lembur', 'lembur'],
  ['Insentif Penjualan', 'insentif_penjualan'],
  ['Insentif Event', 'insentif_event'],
  ['Lain-Lain', 'lain_lain'],
  ['Medical Claim', 'medical_claim'],
  ['Subsidi BPJS Kesehatan', 'subsidi_bpjs_kesehatan'],
]
const POTONGAN_FIELDS = [
  ['Unpaid Leave', 'unpaid_leave'],
  ['Hutang Karyawan', 'hutang_karyawan'],
  ['Cicilan Seragam', 'cicilan_seragam'],
  ['Potongan Stock Opname', 'potongan_stock_opname'],
  ['Potongan Lain-Lain', 'potongan_lain_lain'],
  ['BPJS Kesehatan Karyawan', 'bpjs_kesehatan_karyawan'],
  ['JHT Karyawan', 'jht_karyawan'],
  ['JP Karyawan', 'jp_karyawan'],
  ['PPH 21', 'pph21'],
]

// Payroll cut off ala Napocut: tanggal 25 bulan sebelumnya s.d. tanggal 24
// di bulan periode.
function cutoffRange(period) {
  const d = new Date(period)
  const end = new Date(d.getFullYear(), d.getMonth(), 24)
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 25)
  const fmt = (x) => x.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
}

async function downloadPayslipPdf(payslip, employee) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const marginX = 42
  let y = 56

  const comp = payslip.components || {}
  const periodLabel = new Date(payslip.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  // Header
  doc.setFont('times', 'italic')
  doc.setFontSize(22)
  doc.text('napocut', marginX, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(200, 40, 30)
  doc.text('*RAHASIA', pageW - marginX, y, { align: 'right' })
  doc.setTextColor(20, 20, 20)

  y += 30
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`Payslip ${periodLabel}`, marginX, y)

  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const colL = marginX
  const colR = pageW / 2 + 10
  const rowsInfo = [
    ['Payroll cut off', cutoffRange(payslip.period), 'Divisi', employee.department || '-'],
    ['Nama Karyawan', employee.full_name, 'PTKP', payslip.ptkp_status || '-'],
    ['Posisi', employee.position || '-', 'Badan Usaha', payslip.business_entity || '-'],
  ]
  rowsInfo.forEach(([l1, v1, l2, v2]) => {
    doc.text(l1, colL, y)
    doc.text(`: ${v1}`, colL + 90, y)
    doc.text(l2, colR, y)
    doc.text(`: ${v2}`, colR + 70, y)
    y += 16
  })

  y += 14
  const tableTop = y
  const colWidth = (pageW - marginX * 2) / 2
  const rightColX = marginX + colWidth

  doc.setFillColor(224, 224, 224)
  doc.rect(marginX, tableTop, colWidth - 8, 20, 'F')
  doc.rect(rightColX + 8, tableTop, colWidth - 8, 20, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Pendapatan', marginX + 6, tableTop + 14)
  doc.text('Potongan', rightColX + 14, tableTop + 14)

  const pendapatanRows = [['Gaji Pokok', payslip.basic_salary], ...PENDAPATAN_FIELDS.map(([label, key]) => [label, comp[key] || 0])]
  const potonganRows = POTONGAN_FIELDS.map(([label, key]) => [label, comp[key] || 0])

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let yL = tableTop + 36
  pendapatanRows.forEach(([label, val]) => {
    doc.text(label, marginX + 6, yL)
    doc.text(rupiah(val), marginX + colWidth - 14, yL, { align: 'right' })
    yL += 17
  })
  let yR = tableTop + 36
  potonganRows.forEach(([label, val]) => {
    doc.text(label, rightColX + 14, yR)
    doc.text(rupiah(val), pageW - marginX, yR, { align: 'right' })
    yR += 17
  })

  const yTotals = Math.max(yL, yR) + 8
  doc.setDrawColor(210, 210, 210)
  doc.line(marginX, yTotals - 12, pageW - marginX, yTotals - 12)

  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL PENDAPATAN', marginX + 6, yTotals)
  doc.text(rupiah(payslip.basic_salary + payslip.allowances), marginX + colWidth - 14, yTotals, { align: 'right' })
  doc.text('TOTAL POTONGAN', rightColX + 14, yTotals)
  doc.text(rupiah(payslip.deductions), pageW - marginX, yTotals, { align: 'right' })

  const yTHP = yTotals + 22
  doc.setFontSize(11)
  doc.text('TAKE HOME PAY', rightColX + 14, yTHP)
  doc.text(`Rp ${rupiah(payslip.net_salary)}`, pageW - marginX, yTHP, { align: 'right' })

  // Footer disclaimer
  let yFoot = yTHP + 90
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  const footer = [
    'THIS IS COMPUTER GENERATED PRINTOUT AND NO SIGNATURE IS REQUIRED.',
    '',
    'PLEASE NOTE THAT THE CONTENTS OF THIS STATEMENT SHOULD BE TREATED WITH ABSOLUTE CONFIDENTIALITY EXCEPT TO THE EXTENT YOU ARE REQUIRED TO MAKE DISCLOSURE FOR ANY TAX, LEGAL, OR REGULATORY PURPOSES. ANY BREACH OF THIS CONFIDENTIALITY OBLIGATION WILL BE DEALT WITH SERIOUSLY, WHICH MAY INVOLVE DISCIPLINARY ACTION BEING TAKEN.',
    '',
    'HARAP DIPERHATIKAN, ISI PERNYATAAN INI ADALAH RAHASIA KECUALI ANDA DIMINTA UNTUK MENGUNGKAPKANNYA UNTUK KEPERLUAN PAJAK, HUKUM, ATAU KEPENTINGAN PEMERINTAH. SETIAP PELANGGARAN ATAS KEWAJIBAN MENJAGA KERAHASIAAN INI AKAN DIKENAKAN SANKSI, YANG MUNGKIN BERUPA TINDAKAN KEDISIPLINAN.',
  ]
  footer.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, pageW - marginX * 2)
    doc.text(wrapped, marginX, yFoot)
    yFoot += wrapped.length * 9 + 4
  })

  const fileName = `Slip-Gaji-${periodLabel.replace(' ', '-')}-${(employee.full_name || '').replace(/\s+/g, '-')}.pdf`
  doc.save(fileName)
}

export default function SlipGaji({ onBack, onToast }) {
  const { employee } = useAuth()
  const [payslips, setPayslips] = useState(null)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    if (!employee?.id) return
    supabase.from('payslips').select('*').eq('employee_id', employee.id).order('period', { ascending: false })
      .then(({ data }) => setPayslips(data || []))
  }, [employee?.id])

  async function handleDownload(p) {
    setDownloading(p.id)
    try {
      await downloadPayslipPdf(p, employee)
    } catch (err) {
      onToast?.('Gagal membuat PDF: ' + err.message)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Slip Gaji</h1>
        <span style={{ width: 22 }} />
      </div>
      {payslips === null ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : payslips.length === 0 ? (
        <div className="empty-state"><p>Belum ada slip gaji.</p></div>
      ) : (
        payslips.map((p) => (
          <button key={p.id} className="list-item" style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => handleDownload(p)} disabled={downloading === p.id}>
            <span className="ic" style={{ background: '#DCEEF0', color: '#2C8C9C', width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} />
            </span>
            <div className="info">
              <div className="name">{new Date(p.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</div>
              <div className="sub">Rp {rupiah(p.net_salary)}</div>
            </div>
            {downloading === p.id ? <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Membuat PDF...</span> : <Download size={18} color="#ccc" />}
          </button>
        ))
      )}
    </div>
  )
}
