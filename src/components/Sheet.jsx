import { X } from 'lucide-react'

export default function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row">
          <h3>{title}</h3>
          <button className="sheet-close" onClick={onClose}><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
