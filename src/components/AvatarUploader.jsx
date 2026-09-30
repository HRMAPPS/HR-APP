import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// Avatar bulat dengan tombol kamera untuk ganti foto profil.
// Alur: pilih gambar -> potong persegi (center-crop) & kecilkan ke 512px (JPEG)
//       -> upload ke bucket "avatars" di folder <auth.uid()>/ -> RPC set_my_avatar(url).
// Lihat supabase/migrations/20260930_avatar_upload.sql

const MAX_INPUT_MB = 10
const OUT_SIZE = 512

function initials(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

async function toSquareJpeg(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Gambar tidak bisa dibaca. Gunakan JPG, PNG, atau WEBP.'))
      i.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = OUT_SIZE
    canvas.height = OUT_SIZE
    canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('Gagal memproses gambar')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

// "https://xxx.supabase.co/storage/v1/object/public/avatars/<path>" -> "<path>"
function pathFromUrl(url) {
  const marker = '/storage/v1/object/public/avatars/'
  const i = (url || '').indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0])
}

export default function AvatarUploader({ name, url, size = 68, fontSize = 20, onChanged, onToast }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  async function removeOld(oldUrl) {
    const p = pathFromUrl(oldUrl)
    if (p) await supabase.storage.from('avatars').remove([p]).catch(() => {})
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return onToast?.('File harus berupa gambar')
    if (file.size > MAX_INPUT_MB * 1024 * 1024) return onToast?.(`Ukuran gambar maksimal ${MAX_INPUT_MB} MB`)

    setBusy(true)
    let path = null
    try {
      const blob = await toSquareJpeg(file)
      const { data: auth } = await supabase.auth.getUser()
      path = `${auth.user.id}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: rpcErr } = await supabase.rpc('set_my_avatar', { p_url: pub.publicUrl })
      if (rpcErr) throw rpcErr
      await removeOld(url)
      onToast?.('Foto profil diperbarui')
      await onChanged?.(pub.publicUrl)
    } catch (err) {
      if (path) await supabase.storage.from('avatars').remove([path]).catch(() => {})
      onToast?.(err.message || 'Gagal mengunggah foto')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('set_my_avatar', { p_url: null })
      if (error) throw error
      await removeOld(url)
      onToast?.('Foto profil dihapus')
      await onChanged?.(null)
    } catch (err) {
      onToast?.(err.message || 'Gagal menghapus foto')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {url
          ? <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', opacity: busy ? 0.5 : 1 }} />
          : <div className="avatar" style={{ width: size, height: size, fontSize, opacity: busy ? 0.5 : 1 }}>{initials(name)}</div>}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title="Ganti foto profil"
          aria-label="Ganti foto profil"
          style={{
            position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: '50%',
            border: '2px solid #fff', background: 'var(--blue)', color: '#fff', cursor: busy ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >
          <Camera size={14} />
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {busy && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>Mengunggah…</div>}
      {!busy && url && (
        <button type="button" onClick={handleRemove} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', marginTop: 6, textDecoration: 'underline',
        }}>
          Hapus foto
        </button>
      )}
    </div>
  )
}
