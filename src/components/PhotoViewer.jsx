import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBackHandler } from '../lib/backStack'
import './PhotoViewer.css'

import { tx } from '../lib/i18n'
// Layar penuh untuk melihat foto profil. Tutup lewat tombol X, klik area gelap,
// tombol Esc, atau tombol back di HP.
export function PhotoViewer({ url, name, onClose }) {
  const closeRef = useRef(null)
  useBackHandler(onClose, true)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="pv-ovl" onClick={onClose}>
      <div className="pv-box" role="dialog" aria-modal="true" aria-label={name ? tx("Foto {0}", [name]) : tx("Foto profil")} onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="pv-close" onClick={onClose} aria-label={tx("Tutup")}><X size={20} /></button>
        <img src={url} alt={name ? tx("Foto {0}", [name]) : tx("Foto profil")} />
        {name && <div className="pv-cap">{name}</div>}
      </div>
    </div>,
    document.body,
  )
}

// Bungkus foto: kalau ada url, foto bisa diklik untuk dibuka. Tanpa url, tampil apa adanya.
export default function ViewablePhoto({ url, name, style, children }) {
  const [open, setOpen] = useState(false)
  if (!url) return children
  return (
    <>
      <button type="button" className="pv-trigger" style={style} onClick={() => setOpen(true)} aria-label={name ? tx("Lihat foto {0}", [name]) : tx("Lihat foto profil")}>
        {children}
      </button>
      {open && <PhotoViewer url={url} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}
