import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { tx } from '../lib/i18n'

// Posisi sebuah pengajuan dalam rantai persetujuan berjenjang ("Menunggu X (Gol. 3) · tahap 2 dari 2").
export function progressText(info) {
  if (!info || !info.waiting_step) return ''
  const who = info.waiting_hr ? 'HR' : (info.waiting_grade ? `${info.waiting_name} (${tx("Gol. {0}", [info.waiting_grade])})` : info.waiting_name)
  const stage = info.total > 1 ? ' · ' + tx("tahap {0} dari {1}", [info.approved + 1, info.total]) : ''
  return tx("Menunggu {0}", [who]) + stage
}

// Banyak baris sekaligus (daftar HR): peta request_id -> info
export function useApprovalProgress(table, rows) {
  const [map, setMap] = useState({})
  useEffect(() => {
    const ids = (rows || []).filter((r) => r.status === 'pending').map((r) => r.id)
    if (!ids.length) { setMap({}); return }
    let alive = true
    supabase.rpc('get_approval_progress', { p_table: table, p_ids: ids }).then(({ data }) => {
      if (alive) setMap(Object.fromEntries((Array.isArray(data) ? data : []).map((x) => [x.request_id, x])))
    })
    return () => { alive = false }
  }, [table, rows])
  return map
}

// Satu pengajuan (detail milik pemohon)
export function useRequestProgress(table, id, status) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!id || status !== 'pending') { setText(''); return }
    let alive = true
    supabase.rpc('get_approval_progress', { p_table: table, p_ids: [id] }).then(({ data }) => {
      if (alive) setText(progressText(Array.isArray(data) ? data[0] : null))
    })
    return () => { alive = false }
  }, [table, id, status])
  return text
}

export function WaitingLine({ info }) {
  const t = progressText(info)
  if (!t) return null
  return <div style={{ fontSize: 11.5, color: '#8a5a0b', marginTop: 2, fontWeight: 400 }}>{t}</div>
}
