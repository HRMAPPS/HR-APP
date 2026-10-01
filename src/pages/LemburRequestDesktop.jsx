import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'
import { RequestShell, StatTiles, RecentList, StatusPill, fmtDate } from '../components/RequestDesktop'

import { tx } from '../lib/i18n'
const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m }
const fmtDur = (m) => `${Math.floor(m / 60)} j ${String(m % 60).padStart(2, '0')} m`
// Overtime that ends after midnight (end < start) counts into the next day.
const durMin = (s, e) => { const d = toMin(e) - toMin(s); return d > 0 ? d : d + 1440 }

export default function LemburRequestDesktop({ onCancel, onDone, onToast }) {
  const [date, setDate] = useState(todayStr())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    supabase.from('overtime_requests')
      .select('id, work_date, start_time, end_time, status')
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setHistory(data || []))
  }, [])

  const dur = start && end && start !== end ? durMin(start, end) : null
  const overnight = start && end && toMin(end) < toMin(start)
  const month = todayStr().slice(0, 7)
  const approvedMin = (history || [])
    .filter((h) => h.status === 'approved' && h.work_date.startsWith(month))
    .reduce((s, h) => s + durMin(h.start_time.slice(0, 5), h.end_time.slice(0, 5)), 0)
  const pending = (history || []).filter((h) => h.status === 'pending').length

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!date || !start || !end) { setError(tx("Lengkapi tanggal dan jam lembur")); return }
    if (start === end) { setError(tx("Jam selesai tidak boleh sama dengan jam mulai")); return }
    setBusy(true)
    const { error: err } = await supabase.rpc('submit_overtime_request', {
      p_work_date: date, p_start_time: start, p_end_time: end, p_reason: reason,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onToast?.('Pengajuan lembur terkirim')
    onDone()
  }

  const form = (
    <form onSubmit={submit}>
      <h2>{tx("Detail lembur")}</h2>
      <p className="rq-lead">{tx("Isi tanggal dan jam lembur. Pengajuan akan diteruskan ke atasan untuk disetujui.")}</p>
      <div className="rq-grid">
        <label className="rq-fld full"><span>{tx("Tanggal lembur")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="rq-fld"><span>{tx("Jam mulai")}</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="rq-fld"><span>{tx("Jam selesai")}</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        {dur != null && (
          <div className="rq-sum">
            <span>{tx("Total durasi lembur")}{overnight ? tx(" (melewati tengah malam)") : ''}</span>
            <b>{fmtDur(dur)}</b>
          </div>
        )}
        <label className="rq-fld full"><span>{tx("Alasan")}</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("Jelaskan pekerjaan yang perlu diselesaikan...")} />
        </label>
        {error && <p className="rq-err" role="alert">{error}</p>}
      </div>
      <div className="rq-actions">
        <button className="primary-btn" disabled={busy}>{busy ? tx("Mengirim...") : tx("Kirim pengajuan")}</button>
        <button type="button" className="rq-ghost" onClick={onCancel}>{tx("Batal")}</button>
      </div>
    </form>
  )

  const aside = (
    <>
      <StatTiles tiles={[
        [tx("Lembur disetujui bulan ini"), history ? fmtDur(approvedMin) : '…', 'g'],
        [tx("Menunggu persetujuan"), history ? pending : '…', pending ? 'w' : ''],
      ]} />
      <RecentList title={tx("Pengajuan terakhir")} rows={history && history.slice(0, 5)} empty={tx("Belum ada pengajuan lembur.")}
        render={(r) => (
          <>
            <div>
              <b>{fmtDate(r.work_date)}</b>
              <small>{r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}</small>
            </div>
            <StatusPill status={r.status} />
          </>
        )} />
    </>
  )

  return <RequestShell title={tx("Ajukan Lembur")} subtitle={tx("Ajukan lembur dan pantau riwayat pengajuan Anda.")} onBack={onCancel} form={form} aside={aside} />
}
