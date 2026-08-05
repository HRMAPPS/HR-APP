import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Users, User } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function OrgChart({ onBack, onToast }) {
  const [data, setData] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [editingDept, setEditingDept] = useState(null)   // null closed, {} new, {...} edit
  const [editingEmp, setEditingEmp] = useState(null)      // employee being reassigned

  async function load() {
    const { data: result, error } = await supabase.rpc('get_org_chart')
    if (!error) setData(result)
  }
  useEffect(() => { load() }, [])

  function toggle(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  if (!data) {
    return (
      <div>
        <Header onBack={onBack} />
        <div className="empty-state"><p>Memuat...</p></div>
      </div>
    )
  }

  const { departments, employees } = data
  const roots = departments.filter((d) => !d.parent_id)
  const unassigned = employees.filter((e) => !e.department_id)

  return (
    <div>
      <Header onBack={onBack} />
      <div className="form-page">
        {departments.length === 0 && (
          <div className="empty-state"><p>Belum ada departemen. Mulai dengan menambah departemen pertama.</p></div>
        )}

        {roots.map((dept) => (
          <DeptNode
            key={dept.id}
            dept={dept}
            depth={0}
            departments={departments}
            employees={employees}
            expanded={expanded}
            onToggle={toggle}
            onEditDept={setEditingDept}
            onEditEmp={setEditingEmp}
          />
        ))}

        {unassigned.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 8px 2px' }}>
              Belum punya departemen
            </div>
            {unassigned.map((e) => <EmpRow key={e.id} emp={e} onEdit={() => setEditingEmp(e)} />)}
          </div>
        )}

        <button
          className="primary-btn"
          style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setEditingDept({})}
        >
          <Plus size={18} /> Tambah departemen
        </button>
      </div>

      {editingDept !== null && (
        <DeptForm
          row={editingDept}
          departments={departments}
          employees={employees}
          onClose={() => setEditingDept(null)}
          onSaved={async (msg) => { setEditingDept(null); await load(); onToast(msg) }}
        />
      )}

      {editingEmp && (
        <EmpForm
          emp={editingEmp}
          departments={departments}
          employees={employees}
          onClose={() => setEditingEmp(null)}
          onSaved={async (msg) => { setEditingEmp(null); await load(); onToast(msg) }}
        />
      )}
    </div>
  )
}

function Header({ onBack }) {
  return (
    <div className="page-header">
      <button className="back-btn" onClick={onBack}><ArrowLeft size={22} /></button>
      <h1>Struktur Organisasi</h1>
      <span style={{ width: 22 }} />
    </div>
  )
}

function DeptNode({ dept, depth, departments, employees, expanded, onToggle, onEditDept, onEditEmp }) {
  const children = departments.filter((d) => d.parent_id === dept.id)
  const members = employees.filter((e) => e.department_id === dept.id)
  const isOpen = expanded[dept.id] !== false // default expanded

  return (
    <div style={{ marginLeft: depth * 14, marginTop: 10 }}>
      <div className="list-item" style={{ margin: 0 }}>
        <button onClick={() => onToggle(dept.id)} style={{ background: 'none', border: 'none', padding: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <span className="ic" style={{ background: '#E2E6FB', color: '#4356C4', width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={16} />
        </span>
        <div className="info">
          <div className="name">{dept.name}</div>
          {dept.head_name && <div className="sub">Kepala: {dept.head_name}</div>}
        </div>
        <div className="actions">
          <button onClick={() => onEditDept(dept)}><Pencil size={16} /></button>
        </div>
      </div>

      {isOpen && (
        <div style={{ marginLeft: 18 }}>
          {members.map((e) => <EmpRow key={e.id} emp={e} onEdit={() => onEditEmp(e)} />)}
          {children.map((child) => (
            <DeptNode
              key={child.id}
              dept={child}
              depth={1}
              departments={departments}
              employees={employees}
              expanded={expanded}
              onToggle={onToggle}
              onEditDept={onEditDept}
              onEditEmp={onEditEmp}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmpRow({ emp, onEdit }) {
  const manager = emp.manager_name
  return (
    <div className="list-item" style={{ margin: '8px 0 0' }}>
      <span className="ic" style={{ background: '#F3ECE4', color: '#8a847c', width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <User size={15} />
      </span>
      <div className="info">
        <div className="name">{emp.full_name}</div>
        <div className="sub">{emp.position || '-'}{manager ? ` · lapor ke ${manager}` : ''}</div>
      </div>
      <div className="actions">
        <button onClick={onEdit}><Pencil size={16} /></button>
      </div>
    </div>
  )
}

function DeptForm({ row, departments, employees, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: row.name || '', parent_id: row.parent_id || '', head_employee_id: row.head_employee_id || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const otherDepts = departments.filter((d) => d.id !== row.id)

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Nama departemen wajib diisi'); return }
    setSaving(true)
    const { error } = await supabase.rpc('upsert_department', {
      p_id: row.id || null, p_name: form.name, p_parent_id: form.parent_id || null, p_head_employee_id: form.head_employee_id || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(row.id ? 'Departemen diperbarui' : 'Departemen ditambahkan')
  }

  async function remove() {
    setSaving(true)
    const { error } = await supabase.rpc('delete_department', { p_id: row.id })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved('Departemen dihapus')
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{row.id ? 'Edit Departemen' : 'Tambah Departemen'}</h3></div>
        <form onSubmit={submit}>
          <div className="field"><label>Nama departemen</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div className="field">
            <label>Induk departemen (opsional)</label>
            <select value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}>
              <option value="">- Tidak ada (level teratas) -</option>
              {otherDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Kepala departemen (opsional)</label>
            <select value={form.head_employee_id} onChange={(e) => setForm((f) => ({ ...f, head_employee_id: e.target.value }))}>
              <option value="">- Belum ditentukan -</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            {row.id && (
              <button type="button" className="primary-btn" style={{ background: '#fbe1dd', color: '#c0392b' }} onClick={remove} disabled={saving}>
                <Trash2 size={16} style={{ verticalAlign: -3 }} /> Hapus
              </button>
            )}
            <button className="primary-btn" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmpForm({ emp, departments, employees, onClose, onSaved }) {
  const [departmentId, setDepartmentId] = useState(emp.department_id || '')
  const [managerId, setManagerId] = useState(emp.manager_id || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const managerOptions = employees.filter((e) => e.id !== emp.id)

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    setSaving(true)
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.rpc('update_employee_department', { p_employee_id: emp.id, p_department_id: departmentId || null }),
      supabase.rpc('update_employee_manager', { p_employee_id: emp.id, p_manager_id: managerId || null }),
    ])
    setSaving(false)
    if (e1 || e2) { setError((e1 || e2).message); return }
    onSaved('Posisi karyawan diperbarui')
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row"><h3>{emp.full_name}</h3></div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Departemen</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">- Belum punya departemen -</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Melapor ke (atasan langsung)</label>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">- Tidak ada atasan -</option>
              {managerOptions.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </form>
      </div>
    </div>
  )
}
