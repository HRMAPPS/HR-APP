import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const BUCKET = 'attendance-photos'
const TTL = 60 * 60 // 1 jam
const cache = new Map() // path -> { url, exp }

// URL lama disimpan sebagai ".../object/public/attendance-photos/<path>" — ambil <path>-nya saja.
export function photoPath(urlOrPath) {
  if (!urlOrPath) return null
  const marker = `/${BUCKET}/`
  const i = urlOrPath.indexOf(marker)
  if (i === -1) return urlOrPath.startsWith('http') ? null : urlOrPath
  return decodeURIComponent(urlOrPath.slice(i + marker.length).split('?')[0])
}

export async function getSignedPhotoUrl(urlOrPath) {
  const path = photoPath(urlOrPath)
  if (!path) return urlOrPath || null
  const hit = cache.get(path)
  if (hit && hit.exp > Date.now() + 60_000) return hit.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL)
  if (error || !data?.signedUrl) return null
  cache.set(path, { url: data.signedUrl, exp: Date.now() + TTL * 1000 })
  return data.signedUrl
}

// Hook: kembalikan URL yang bisa dipakai <img src>, atau null selagi memuat / gagal.
export function useSignedPhoto(urlOrPath) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (urlOrPath) getSignedPhotoUrl(urlOrPath).then((u) => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [urlOrPath])
  return url
}
