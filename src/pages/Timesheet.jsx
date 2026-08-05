import { useEffect, useState } from 'react'
import { ArrowLeft, ListChecks, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function Timesheet({ employee, onBack, onToast }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, {...row} = edit

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('timesheet_entries')
      .select('id, work_date, hours, project, description')
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (editing) {
    return (
      <TimesheetForm
        row={editing}
        employee={employee}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); onToast('Jam kerja disimpan') }}
      />
    )
  }

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthTotal = items
    .filter((it) => it.work_date?.slice(0, 7) === thisMonth)
    .reduce((sum, it) => sum + Number(it.hours || 0), 0)

  async function onDelete(id) {
    const { error } = await supabase.from('timesheet_entries').delete().eq('id', id)
    if (error) { onToast(error.message); return }
    onToast('Entri dihapus')
    load()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Timesheet</h1>
        <span style={{ width: 22 }} />
      </div>

      <div style={{ margin: '0 16px 14px', background: '#DDE7FB', color: '#3B6ECF', borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontSize: 12.5 }}>Total jam bulan ini</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{monthTotal} jam</div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <p style={{ color: '#a39c94' }}>Memuat...</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <ListChecks size={40} color="#c8c1b9" />
            <h3>Belum ada catatan</h3>
            <p>Jam kerja yang Anda catat akan tampil di sini.</p>
          </div>
        ) : items.map((it) => (
          <div key={it.id} className="list-item">
            <div className="info">
              <div className="name">
                {new Date(it.work_date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}
                {' · '}{it.hours} jam
              </div>
              <div className="sub">{it.project || '-'}{it.description ? ` — ${it.description}` : ''}</div>
            </div>
            <div className="actions">
              <button onClick={() => setEditing(it)}><Pencil size={17} /></button>
              <button onClick={() => onDelete(it.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))}
      </div>

      <button className="fab-bottom-btn" onClick={() => setEditing({})}>Catat Jam Kerja</button>
    </div>
  )
}

function TimesheetForm({ row, employee, onCancel, onSaved }) {
  const [form, setForm] = useState({
    work_date: row.work_date || new Date().toISOString().slice(0, 10),
    hours: row.hours || '', project: row.project || '', description: row.description || '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.work_date || !form.hours) { setError('Tanggal dan jumlah jam wajib diisi'); return }
    setLoading(true)
    const payload = {
      work_date: form.work_date, hours: Number(form.hours),
      project: form.project || null, description: form.description || null,
    }
    const { error } = row.id
      ? await supabase.from('timesheet_entries').update(payload).eq('id', row.id)
      : await supabase.from('timesheet_entries').insert({ ...payload, employee_id: employee?.id })
    setLoading(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}><ArrowLeft size={22} /></button>
        <h1>{row.id ? 'Ubah Jam Kerja' : 'Catat Jam Kerja'}</h1>
        <span style={{ width: 22 }} />
      </div>
      <form className="form-page" onSubmit={submit}>
        <div className="field">
          <label>Tanggal</label>
          <input type="date" value={form.work_date} onChange={(e) => set('work_date', e.target.value)} />
        </div>
        <div className="field">
          <label>Jumlah jam</label>
          <input type="number" step="0.5" min="0" value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="mis. 8" />
        </div>
        <div className="field">
          <label>Proyek / task (opsional)</label>
          <input value={form.project} onChange={(e) => set('project', e.target.value)} />
        </div>
        <div className="field">
          <label>Keterangan (opsional)</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Apa yang dikerjakan..." />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
      </form>
    </div>
  )
}
