// ID perangkat acak yang disimpan di browser. Dipakai server hanya sebagai sinyal audit
// (mis. "perangkat baru") pada absensi; bukan identitas pribadi dan bisa direset pengguna.
const KEY = 'hrapp_device_id'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id || id.length < 16) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now())
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return null // mode privat / penyimpanan diblokir: server menandai "tanpa ID perangkat"
  }
}
