import { supabase } from './supabaseClient'

import { tx } from './i18n'
// Bucket `leave-attachments` bersifat privat (bisa berisi surat dokter), jadi file dibuka
// lewat signed URL berumur pendek. Jendela dibuka lebih dulu (di dalam klik) supaya tidak
// diblokir popup-blocker, lalu diarahkan ke URL setelah URL-nya jadi.
export async function openLeaveAttachment(path, onToast) {
  const w = window.open('', '_blank')
  const { data, error } = await supabase.storage.from('leave-attachments').createSignedUrl(path, 120)
  if (error || !data?.signedUrl) {
    w?.close()
    onToast?.(tx("Gagal membuka lampiran: ") + (error?.message || tx("tidak ditemukan")))
    return
  }
  if (w) w.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}
