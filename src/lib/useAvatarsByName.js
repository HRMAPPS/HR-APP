import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Untuk data yang hanya menyimpan NAMA orang (mis. notifications.actor_name):
// ambil foto profil terbaru dari tabel employees dan kembalikan map { nama: avatar_url }.
export function useAvatarsByName(names) {
  const [map, setMap] = useState({})
  const key = [...new Set((names || []).filter(Boolean))].sort().join('|')

  useEffect(() => {
    if (!key) { setMap({}); return }
    let cancelled = false
    supabase.from('employees')
      .select('full_name, avatar_url')
      .in('full_name', key.split('|'))
      .not('avatar_url', 'is', null)
      .then(({ data }) => {
        if (cancelled) return
        const m = {}
        ;(data || []).forEach((e) => { m[e.full_name] = e.avatar_url })
        setMap(m)
      })
    return () => { cancelled = true }
  }, [key])

  return map
}
