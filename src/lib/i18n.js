import { PAIRS, ONEWAY } from './i18nDict'

// Bahasa aplikasi: 'id' (Indonesia) atau 'en' (Inggris). Disimpan di localStorage.
// Semua teks di kode ditulis lewat tx('...'). Kamus dua arah: string sumber boleh
// berbahasa Indonesia atau Inggris, hasilnya selalu mengikuti bahasa yang dipilih.
// Mengganti bahasa memuat ulang halaman supaya konstanta level-modul ikut berubah.
const KEY = 'napocut_lang'

function detect() {
  try {
    const s = localStorage.getItem(KEY)
    if (s === 'en' || s === 'id') return s
  } catch { /* storage tidak tersedia */ }
  return 'id'
}

let lang = detect()
try { document.documentElement.lang = lang } catch { /* noop */ }

const exact = { id: new Map(), en: new Map() }
const folded = { id: new Map(), en: new Map() }
const isUpper = (s) => s === s.toUpperCase() && /[A-Z]/.test(s)
function put(l, key, val) {
  if (!exact[l].has(key)) exact[l].set(key, val)
  if (isUpper(key)) return // varian HURUF BESAR hanya untuk pencocokan persis
  const k = key.toLowerCase()
  if (!folded[l].has(k)) folded[l].set(k, val)
}
for (const [id, en] of PAIRS) {
  put('id', id, id); put('en', id, en)
  put('id', en, id); put('en', en, en)
}
for (const [key, id, en] of ONEWAY) {
  exact.id.set(key, id); exact.en.set(key, en)
  folded.id.set(key.toLowerCase(), id); folded.en.set(key.toLowerCase(), en)
}

const squash = (s) => s.replace(/\s+/g, ' ').trim()

function lookup(core) {
  const hit = exact[lang].get(core)
  if (hit !== undefined) return hit
  const f = folded[lang].get(core.toLowerCase())
  if (f !== undefined) return isUpper(core) ? f.toUpperCase() : f
  return core
}

// tx('Teks') atau tx('Halo {0}, {1} hari', [nama, n])
export function tx(text, args) {
  if (typeof text !== 'string' || !text) return text
  const lead = text.match(/^\s*/)[0]
  const trail = text.match(/\s*$/)[0]
  let out = lookup(squash(text))
  if (args) out = out.replace(/\{(\d+)\}/g, (_, i) => (args[i] === undefined ? '' : args[i]))
  return lead + out + trail
}

export const getLang = () => lang
export const locale = () => (lang === 'en' ? 'en-GB' : 'id-ID')
export function setLang(next) {
  if (next !== 'id' && next !== 'en') return
  try { localStorage.setItem(KEY, next) } catch { /* noop */ }
  // Tandai bahwa reload ini karena ganti bahasa, supaya App memulihkan modul
  // yang sedang dibuka (tab/page) beserta posisi scroll, bukan kembali ke Beranda.
  try { sessionStorage.setItem('napocut_restore', JSON.stringify({ y: window.scrollY || 0 })) } catch { /* noop */ }
  window.location.reload()
}
