import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import { RequestShell, StatTiles, RecentList, StatusPill, fmtDate } from '../components/RequestDesktop'

const MAX_FILE = 5 * 1024 * 1024
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1
const fmtDays = (n) => `${Number(n) % 1 === 0 ? Number(n) : Number(n).toFixed(1)} hari`

export default function CutiRequestDesktop({ employee, onCancel, onDone, onToast }) {
  const [types, setTypes] = useState([])
  const [typeId, setTypeId] = useState('')
  const [reqType, setReqType] = useState('full_day')
  const [start, setStart] = useState(todayStr())
  const [end, setEnd] = useState(todayStr())
  const [reason, setReason] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.from('leave_types').select('id, name').order('name').then(({ data }) => setTypes(data || []))
    supabase.rpc('get_leave_summary').then(({ data }) => setSummary(data || { sakit_used: 0, unpaid_used: 0 }))
    let q = supabase.from('leave_requests')
      .select('id, start_date, end_date, total_days, status, leave_types(name)')
      .order('created_at', { ascending: false }).limit(30)
    if (employee?.id) q = q.eq('employee_id', employee.id)
    q.then(({ data }) => setHistory(data || []))
  }, [employee?.id])

  const half = reqType === 'half_day'
  const effEnd = half ? start : end
  const days = start && effEnd && effEnd >= start ? (half ? 0.5 : daysBetween(start, effEnd)) : null
  const year = todayStr().slice(0, 4)
  const approvedYear = (history || []).filter((h) => h.status === 'approved' && h.start_date.startsWith(year))
    .reduce((s, h) => s + Number(h.total_days || 0), 0)
  const pending = (history || []).filter((h) => h.status === 'pending').length

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_FILE) { setError('Ukuran lampiran maksimal 5 MB'); e.target.value = ''; return }
    setError(''); setFile(f)
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!typeId) { setError('Pilih jenis cuti'); return }
    if (!start || !effEnd) { setError('Lengkapi tanggal mulai dan selesai'); return }
    if (effEnd < start) { setError('Tanggal selesai tidak boleh sebelum tanggal mulai'); return }
    setBusy(true)
    let path = null
    if (file) {
      const { data: u } = await supabase.auth.getUser()
      path = `${u?.user?.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('leave-attachments').upload(path, file)
      if (upErr) { setBusy(false); setError('Gagal unggah lampiran: ' + upErr.message); return }
    }
    const { error: err } = await supabase.rpc('submit_leave_request', {
      p_leave_type_id: typeId, p_start_date: start, p_end_date: effEnd, p_reason: reason,
      p_request_type: reqType, p_attachment_path: path, p_attachment_name: file?.name || null,
      p_delegate_to: null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onToast?.('Pengajuan cuti terkirim')
    onDone()
  }

  const form = (
    <form onSubmit={submit}>
      <h2>Detail pengajuan</h2>
      <p className="rq-lead">Isi jenis dan tanggal cuti. Atasan Anda akan menerima notifikasi untuk persetujuan.</p>
      <div className="rq-grid">
        <label className="rq-fld full"><span>Jenis cuti</span>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Pilih jenis cuti</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <div className="rq-fld full"><span>Durasi</span>
          <div className="rq-seg" role="group" aria-label="Durasi">
            <button type="button" aria-pressed={!half} onClick={() => setReqType('full_day')}>Hari penuh</button>
            <button type="button" aria-pressed={half} onClick={() => setReqType('half_day')}>Setengah hari</button>
          </div>
        </div>
        <label className="rq-fld"><span>{half ? 'Tanggal' : 'Tanggal mulai'}</span>
          <input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value) }} />
        </label>
        <label className="rq-fld"><span>Tanggal selesai</span>
          <input type="date" value={half ? start : end} min={start} disabled={half} onChange={(e) => setEnd(e.target.value)} />
        </label>
        {days != null && (
          <div className="rq-sum"><span>Perkiraan durasi</span><b>{fmtDays(days)}</b></div>
        )}
        <label className="rq-fld full"><span>Alasan</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tambahkan alasan pengajuan..." />
        </label>
        <div className="rq-fld full"><span>Lampiran <small>(opsional, maks. 5 MB)</small></span>
          <div className="rq-file">
            <span className="name">{file ? file.name : 'Belum ada file dipilih'}</span>
            {file && <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>Hapus</button>}
            <button type="button" onClick={() => fileRef.current?.click()}>Pilih file</button>
            <input ref={fileRef} type="file" hidden onChange={pickFile} />
          </div>
        </div>
        {error && <p className="rq-err" role="alert">{error}</p>}
      </div>
      <div className="rq-actions">
        <button className="primary-btn" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim pengajuan'}</button>
        <button type="button" className="rq-ghost" onClick={onCancel}>Batal</button>
      </div>
    </form>
  )

  const aside = (
    <>
      <StatTiles tiles={[
        ['Sakit terpakai', summary ? fmtDays(summary.sakit_used) : '…'],
        ['Unpaid terpakai', summary ? fmtDays(summary.unpaid_used) : '…'],
        [`Cuti disetujui ${year}`, history ? fmtDays(approvedYear) : '…', 'g'],
        ['Menunggu persetujuan', history ? pending : '…', pending ? 'w' : ''],
      ]} />
      <RecentList title="Pengajuan terakhir" rows={history && history.slice(0, 5)} empty="Belum ada pengajuan cuti."
        render={(r) => (
          <>
            <div>
              <b>{r.leave_types?.name || 'Cuti'}</b>
              <small>{fmtDate(r.start_date)}{r.end_date !== r.start_date ? ` – ${fmtDate(r.end_date)}` : ''}</small>
            </div>
            <StatusPill status={r.status} />
          </>
        )} />
    </>
  )

  return <RequestShell title="Ajukan Cuti" subtitle="Ajukan cuti dan pantau saldo serta riwayat Anda." onBack={onCancel} form={form} aside={aside} />
}
