import { getLang, setLang } from '../lib/i18n'
import './LanguageSwitch.css'

// Pilihan bahasa: ID (Indonesia) atau EN (English). Mengganti bahasa memuat ulang halaman.
export default function LanguageSwitch({ style }) {
  const cur = getLang()
  const opts = [['id', 'ID', 'Bahasa Indonesia'], ['en', 'EN', 'English']]
  return (
    <div className="lang-switch" role="group" aria-label="Bahasa / Language" style={style}>
      {opts.map(([k, label, title]) => (
        <button key={k} type="button" title={title} aria-pressed={cur === k} onClick={() => { if (cur !== k) setLang(k) }}>
          {label}
        </button>
      ))}
    </div>
  )
}
