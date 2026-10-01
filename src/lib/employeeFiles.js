import { supabase } from './supabaseClient'

// Bucket 'employee-files' bersifat PRIVATE: file hanya bisa dibuka lewat signed URL
// berumur pendek, dan hanya oleh pemilik / HR / atasan langsung (diatur di policy storage).
const BUCKET = 'employee-files'
const TTL = 120 // detik

// Data lama menyimpan URL publik ".../object/public/employee-files/<path>"; ambil <path>-nya.
export function employeeFilePath(urlOrPath) {
  if (!urlOrPath) return null
  const marker = `/${BUCKET}/`
  const i = urlOrPath.indexOf(marker)
  if (i === -1) return urlOrPath.startsWith('http') ? null : urlOrPath
  return decodeURIComponent(urlOrPath.slice(i + marker.length).split('?')[0])
}

const safeName = (name) => String(name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80)

// Unggah ke folder <auth uid>/ lalu simpan baris di employee_files. Menyimpan PATH (bukan URL publik).
export async function uploadEmployeeFile(file, employeeId) {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('Sesi berakhir, silakan masuk lagi')
  const path = `${uid}/${Date.now()}-${safeName(file.name)}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
  if (upErr) throw upErr
  const { error: insErr } = await supabase.from('employee_files').insert({
    employee_id: employeeId, file_name: file.name, file_url: path,
  })
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {}) // jangan tinggalkan file yatim
    throw insErr
  }
}

export async function getSignedEmployeeFileUrl(urlOrPath) {
  const path = employeeFilePath(urlOrPath)
  if (!path) return urlOrPath || null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL)
  return error || !data?.signedUrl ? null : data.signedUrl
}

// Buka tab dulu (sinkron) agar tidak diblokir pop-up blocker, lalu arahkan ke signed URL.
export async function openEmployeeFile(urlOrPath) {
  const w = window.open('', '_blank')
  const url = await getSignedEmployeeFileUrl(urlOrPath)
  if (!url) { if (w) w.close(); return false }
  if (w) { w.opener = null; w.location.href = url } else { window.location.href = url }
  return true
}

export async function removeEmployeeFile(id, urlOrPath) {
  const { error } = await supabase.from('employee_files').delete().eq('id', id)
  if (error) throw error
  const path = employeeFilePath(urlOrPath)
  if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
}
