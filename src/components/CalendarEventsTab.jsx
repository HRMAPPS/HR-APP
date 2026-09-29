import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { todayStr } from '../lib/dateUtils'

// Tab "Kalender" di Dashboard HR: HR menjadwalkan Aktivitas dan mencatat Hari libur.
// Baca langsung dari tabel calendar_events (SELECT terbuka untuk karyawan login);
// tulis lewat RPC upsert_calendar_event_hr / delete_calendar_event_hr (dibatasi is_hr()).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const fmt = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}` }
const KIND_LABEL = { activity: 'Aktivitas', holiday: 'Hari libur' }

export default function CalendarEventsTab({ onToast, isDesktop }) {
  const [list, setList] = useState(null)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('')

  async function load() {
    const { data, error } = await supabase.from('calendar_events').select('*').order('start_date', { ascending: false })
    if (error) { onToast(error.message); return }
    setList(data || [])
  }
  useEffect(() => { load() }, [])

  async function remove(id) {
    if (!confirm('Hapus acara ini?')) return
    const { error } = await supabase.rpc('delete_calendar_event_hr', { p_id: id })
    if (error) { onToast(error.message); return }
    onToast('Acara dihapus')
    load()
  }

  const shown = (list || []).filter((e) => !filter || e.kind === filter)

  return (
    <div className="form-page" style={isDesktop ? { maxWidth: 'none' } : undefined}>
      {isDesktop ? (
        <div className="dsk-toolbar" style={{ marginBottom: 4 }}>
          <button className="dsk-outline-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setEditing({})}>
            <Plus size={16} /> TAMBAH ACARA
          </button>
          <div className="tabs" style={{ padding: 0, border: 'none' }}>
            {[['', 'Semua'], ['activity', 'Aktivitas'], ['holiday', 'Hari libur']].map(([k, l]) => (
              <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <button
            className="primary-btn"
            style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => setEditing({})}
          >
            <Plus size={18} /> Tambah acara
          </button>

          <div className="tabs" style={{ padding: '0 0 6px', gap: 18 }}>
            {[['', 'Semua'], ['activity', 'Aktivitas'], ['holiday', 'Hari libur']].map(([k, l]) => (
              <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </>
      )}

      {isDesktop ? (
        <div className="dsk-table-wrap" style={{ marginTop: 18 }}>
          <table className="dsk-table">
            <thead><tr><th>Acara</th><th>Jenis</th><th>Tanggal</th><th>Jam / Lokasi</th><th>Aksi</th></tr></thead>
            <tbody>
              {list === null ? <tr><td colSpan={5} className="empty">Memuat...</td></tr>
                : shown.length === 0 ? <tr><td colSpan={5} className="empty">Belum ada acara. Tambahkan aktivitas atau hari libur agar muncul di Kalender semua karyawan.</td></tr>
                : shown.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.title}{e.description && <div style={{ fontWeight: 400, fontSize: 12.5, color: '#888', marginTop: 3, whiteSpace: 'pre-wrap' }}>{e.description}</div>}</td>
                    <td>
                      <span style={{
                        display: 'inline-block', fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '2px 10px',
                        color: e.kind === 'holiday' ? 'var(--red)' : '#96101c', background: e.kind === 'holiday' ? 'var(--red-soft)' : '#f4e8e9',
                      }}>{KIND_LABEL[e.kind]}</span>
                    </td>
                    <td>{e.start_date === e.end_date ? fmt(e.start_date) : `${fmt(e.start_date)} – ${fmt(e.end_date)}`}</td>
                    <td>{[e.start_time ? `${e.start_time.slice(0, 5)}${e.end_time ? '–' + e.end_time.slice(0, 5) : ''}` : null, e.location].filter(Boolean).join(' · ') || '-'}</td>
                    <td className="acts">
                      <button className="btn" onClick={() => setEditing(e)}><Pencil size={13} /></button>
                      <button className="btn muted" onClick={() => remove(e.id)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : list === null ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : shown.length === 0 ? (
        <div className="empty-state"><p>Belum ada acara. Tambahkan aktivitas atau hari libur agar muncul di Kalender semua karyawan.</p></div>
      ) : shown.map((e) => (
        <div key={e.id} className="list-item" style={{ margin: '10px 0 0', alignItems: 'flex-start' }}>
          <div className="info">
            <div className="name">{e.title}</div>
            <span style={{
              display: 'inline-block', fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: '1px 8px', marginTop: 4,
              color: e.kind === 'holiday' ? 'var(--red)' : 'var(--blue)', background: e.kind === 'holiday' ? 'var(--red-soft)' : '#eef2ff',
            }}>{KIND_LABEL[e.kind]}</span>
            <div className="sub" style={{ marginTop: 4 }}>
              {e.start_date === e.end_date ? fmt(e.start_date) : `${fmt(e.start_date)} – ${fmt(e.end_date)}`}
              {e.start_time ? ` · ${e.start_time.slice(0, 5)}${e.end_time ? '–' + e.end_time.slice(0, 5) : ''}` : ''}
              {e.location ? ` · ${e.location}` : ''}
            </div>
            {e.description && <div className="sub" style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>{e.description}</div>}
          </div>
          <div className="actions">
            <button onClick={() => setEditing(e)}><Pencil size={17} /></button>
            <button onClick={() => remove(e.id)}><Trash2 size={17} /></button>
          </div>
        </div>
      ))}

      {editing !== null && (
        <EventForm row={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); load(); onToast(msg) }} />
      )}
    </div>
  )
}

function EventForm({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    kind: row.kind || 'activity',
    title: row.title || '',
    description: row.description || '',
    start_date: row.start_date || todayStr(),
    end_date: row.end_date || row.start_date || todayStr(),
    start_time: row.start_time?.slice(0, 5) || '',
    end_time: row.end_time?.slice(0, 5) || '',
    location: row.location || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isActivity = form.kind === 'activity'

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('Judul wajib diisi'); return }
    if (form.end_date < form.start_date) { setError('Tanggal selesai tidak boleh sebelum tanggal mulai'); return }
    setSaving(true)
    const { error } = await supabase.rpc('upsert_calendar_event_hr', {
      p_id: row.id || null, p_kind: form.kind, p_title: form.title, p_description: form.description || null,
      p_start_date: form.start_date, p_end_date: form.end_date,
      p_start_time: isActivity && form.start_time ? form.start_time : null,
      p_end_time: isActivity && form.end_time ? form.end_time : null,
      p_location: isActivity ? form.location || null : null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(row.id ? 'Acara diperbarui' : 'Acara ditambahkan')
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.id ? 'Edit Acara' : 'Tambah Acara'}</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Jenis</label>
            <select value={form.kind} onChange={set('kind')}>
              <option value="activity">Aktivitas (dijadwalkan HR)</option>
              <option value="holiday">Hari libur</option>
            </select>
          </div>
          <div className="field">
            <label>Judul</label>
            <input value={form.title} onChange={set('title')} placeholder={isActivity ? 'mis. Town Hall Bulanan' : 'mis. Hari Raya Idul Adha'} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Mulai</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Selesai</label>
              <input type="date" min={form.start_date} value={form.end_date} onChange={set('end_date')} />
            </div>
          </div>
          {isActivity && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Jam mulai (opsional)</label>
                  <input type="time" value={form.start_time} onChange={set('start_time')} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Jam selesai (opsional)</label>
                  <input type="time" value={form.end_time} onChange={set('end_time')} />
                </div>
              </div>
              <div className="field">
                <label>Lokasi (opsional)</label>
                <input value={form.location} onChange={set('location')} placeholder="mis. Ruang Meeting Lt. 2" />
              </div>
            </>
          )}
          <div className="field">
            <label>Keterangan (opsional)</label>
            <textarea value={form.description} onChange={set('description')} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? 'Menyimpan...' : row.id ? 'Simpan' : 'Tambah'}</button>
        </form>
      </div>
    </div>
  )
}
