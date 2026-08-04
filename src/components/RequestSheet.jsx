import { ChevronRight } from 'lucide-react'
import Sheet from './Sheet'
import { REQUEST_TYPES } from '../lib/menuConfig'

export default function RequestSheet({ onClose, onNavigate }) {
  return (
    <Sheet title="Ajukan untuk" onClose={onClose}>
      {REQUEST_TYPES.map((r) => {
        const Icon = r.icon
        return (
          <button key={r.key} className="sheet-list-item" onClick={() => { onNavigate(r.page); onClose() }}>
            <span className="ic" style={{ background: '#f2ede7', color: '#5b554f' }}>
              <Icon size={18} />
            </span>
            {r.label}
            <ChevronRight size={18} className="chev" />
          </button>
        )
      })}
    </Sheet>
  )
}
