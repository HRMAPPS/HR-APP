import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Shared clock-in/out logic (camera capture + geolocation + RPC calls) used by
// both the Beranda shift card and the dedicated Presensi Online page, so both
// screens always reflect the same "already clocked in today" state.
export function useAttendance(employee) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cameraMode, setCameraMode] = useState(null) // 'in' | 'out' | null

  async function load() {
    const { data: home, error } = await supabase.rpc('get_home_data')
    if (!error) setData(home)
  }

  useEffect(() => { load() }, [])

  function withGeolocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ lat: null, lng: null })
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { timeout: 6000, enableHighAccuracy: true }
      )
    })
  }

  async function uploadSelfie(blob, kind) {
    const path = `${employee?.auth_user_id}/${new Date().toISOString().slice(0, 10)}-${kind}-${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage.from('attendance-photos').upload(path, blob, {
      contentType: 'image/jpeg', upsert: true,
    })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('attendance-photos').getPublicUrl(path)
    return pub.publicUrl
  }

  async function handleCapture(blob, onDone, notes) {
    const kind = cameraMode
    setCameraMode(null)
    setBusy(true)
    let result = { ok: false, message: '' }
    try {
      const [{ lat, lng }, photoUrl] = await Promise.all([
        withGeolocation(),
        uploadSelfie(blob, kind),
      ])
      const rpcName = kind === 'in' ? 'clock_in' : 'clock_out'
      const { error } = await supabase.rpc(rpcName, {
        p_lat: lat, p_lng: lng, p_photo_url: photoUrl, p_notes: notes || null,
      })
      if (error) throw error
      result = { ok: true, message: kind === 'in' ? 'Berhasil clock in' : 'Berhasil clock out' }
      await load()
    } catch (e) {
      result = { ok: false, message: e.message || 'Gagal memproses absensi' }
    } finally {
      setBusy(false)
      onDone?.(result)
    }
  }

  return { data, busy, cameraMode, setCameraMode, handleCapture, load }
}
