import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { todayStr } from './dateUtils'

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Shared clock-in/out logic (camera capture + geolocation + RPC calls) used by
// both the Beranda shift card and the dedicated Presensi Online page, so both
// screens always reflect the same "already clocked in today" state.
export function useAttendance(employee) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cameraMode, setCameraMode] = useState(null) // 'in' | 'out' | null
  // Client-side hint only — the server (check_attendance_radius inside
  // clock_in/clock_out) is the actual source of truth and always
  // re-validates on submit, so this is purely informational UX.
  const [locationStatus, setLocationStatus] = useState(null) // { withinRadius, distance, nearestName, radius } | null

  async function load() {
    const { data: home, error } = await supabase.rpc('get_home_data')
    if (!error) setData(home)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let cancelled = false
    async function checkLocation() {
      const { data: locations, error } = await supabase.rpc('get_attendance_locations')
      if (error || !locations?.length || !navigator.geolocation) return
      navigator.geolocation.getCurrentPosition((pos) => {
        if (cancelled) return
        let nearest = null
        for (const l of locations) {
          const distance = haversineMeters(pos.coords.latitude, pos.coords.longitude, l.lat, l.lng)
          if (!nearest || distance < nearest.distance) nearest = { name: l.name, distance, radius: l.radius_meters }
        }
        if (nearest) setLocationStatus({ withinRadius: nearest.distance <= nearest.radius, distance: nearest.distance, nearestName: nearest.name, radius: nearest.radius })
      }, () => {}, { enableHighAccuracy: true, timeout: 8000 })
    }
    checkLocation()
    return () => { cancelled = true }
  }, [])

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
    const path = `${employee?.auth_user_id}/${todayStr()}-${kind}-${Date.now()}.jpg`
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

  return { data, busy, cameraMode, setCameraMode, handleCapture, load, locationStatus }
}
