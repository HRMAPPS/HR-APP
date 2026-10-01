import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Users, User, List, Network } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import OrgChartVisual, { GRADES } from '../components/OrgChartVisual'
import { useIsDesktop } from '../lib/useIsDesktop'

import { tx } from '../lib/i18n'
export default function OrgChart({ onBack, onToast, employee }) {
  const isDesktop = useIsDesktop()
  const canEdit = employee?.role === 'hr' || employee?.role === 'admin' // sama dengan is_hr() di database
  const [data, setData] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [editingDept, setEditingDept] = useState(null)   // null closed, {} new, {...} edit
  const [editingEmp, setEditingEmp] = useState(null)      // employee being reassigned
  const [view, setView] = useState('chart') // 'chart' | 'list'

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
        <div className="empty-state"><p>{tx("Memuat...")}</p></div>
      </div>
    )
  }

  const { departments, employees } = data
  const roots = departments.filter((d) => !d.parent_id)
  const unassigned = employees.filter((e) => !e.department_id)

  return (
    <div>
      <Header onBack={onBack} />

      <div className="tabs" style={{ padding: '10px 16px 0' }}>
        <button className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Network size={15} />{' '}{tx("Chart")}</button>
        {canEdit && (
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <List size={15} />{' '}{tx("Kelola")}</button>
        )}
      </div>

      {view === 'chart' && <OrgChartVisual employees={employees} departments={departments} isDesktop={isDesktop} canEdit={canEdit} onEdit={setEditingEmp} />}

      {view === 'list' && canEdit && (
      <div className="form-page">
        {departments.length === 0 && (
          <div className="empty-state"><p>{tx("Belum ada departemen. Mulai dengan menambah departemen pertama.")}</p></div>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 8px 2px' }}>{tx("Belum punya departemen")}</div>
            {unassigned.map((e) => <EmpRow key={e.id} emp={e} onEdit={() => setEditingEmp(e)} />)}
          </div>
        )}

        <button
          className="primary-btn"
          style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setEditingDept({})}
        >
          <Plus size={18} />{' '}{tx("Tambah departemen")}</button>
      </div>
      )}

      {canEdit && editingDept !== null && (
        <DeptForm
          row={editingDept}
          departments={departments}
          employees={employees}
          onClose={() => setEditingDept(null)}
          onSaved={async (msg) => { setEditingDept(null); await load(); onToast(msg) }}
        />
      )}

      {canEdit && editingEmp && (
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
      <h1>{tx("Struktur Organisasi")}</h1>
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
          {dept.head_name && <div className="sub">{tx("Kepala:")}{' '}{dept.head_name}</div>}
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
        <div className="sub">{emp.position || '-'}{emp.grade ? tx("· Gol. {0}", [GRADES[emp.grade]?.short]) : ''}{manager ? tx("· lapor ke {0}", [manager]) : ''}</div>
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
    if (!form.name.trim()) { setError(tx("Nama departemen wajib diisi")); return }
    setSaving(true)
    const { error } = await supabase.rpc('upsert_department', {
      p_id: row.id || null, p_name: form.name, p_parent_id: form.parent_id || null, p_head_employee_id: form.head_employee_id || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(row.id ? tx("Departemen diperbarui") : tx("Departemen ditambahkan"))
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
        <div className="sheet-title-row"><h3>{row.id ? tx("Edit Departemen") : tx("Tambah Departemen")}</h3></div>
        <form onSubmit={submit}>
          <div className="field"><label>{tx("Nama departemen")}</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div className="field">
            <label>{tx("Induk departemen (opsional)")}</label>
            <select value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}>
              <option value="">{tx("- Tidak ada (level teratas) -")}</option>
              {otherDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{tx("Kepala departemen (opsional)")}</label>
            <select value={form.head_employee_id} onChange={(e) => setForm((f) => ({ ...f, head_employee_id: e.target.value }))}>
              <option value="">{tx("- Belum ditentukan -")}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            {row.id && (
              <button type="button" className="primary-btn" style={{ background: '#fbe1dd', color: '#c0392b' }} onClick={remove} disabled={saving}>
                <Trash2 size={16} style={{ verticalAlign: -3 }} />{' '}{tx("Hapus")}</button>
            )}
            <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Simpan")}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmpForm({ emp, departments, employees, onClose, onSaved }) {
  const [departmentId, setDepartmentId] = useState(emp.department_id || '')
  const [managerId, setManagerId] = useState(emp.manager_id || '')
  const [grade, setGrade] = useState(emp.grade ? String(emp.grade) : '')
  const [position, setPosition] = useState(emp.position || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Atasan tidak boleh diri sendiri atau siapa pun di bawahnya (mencegah lingkaran)
  const managerOptions = useMemo(() => {
    const kids = new Map()
    employees.forEach((e) => { if (e.manager_id) kids.set(e.manager_id, [...(kids.get(e.manager_id) || []), e.id]) })
    const below = new Set([emp.id])
    const stack = [emp.id]
    while (stack.length) for (const k of kids.get(stack.pop()) || []) if (!below.has(k)) { below.add(k); stack.push(k) }
    return employees.filter((e) => !below.has(e.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'))
  }, [employees, emp.id])
  const reports = employees.filter((e) => e.manager_id === emp.id).length

  async function submit(ev) {
    ev.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.rpc('update_employee_org', {
      p_employee_id: emp.id,
      p_department_id: departmentId || null,
      p_manager_id: managerId || null,
      p_grade: grade ? Number(grade) : null,
      p_position: position,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved('Struktur karyawan diperbarui')
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title-row">
          <h3>{emp.full_name}</h3>
        </div>
        {reports > 0 && <p className="sub-text" style={{ margin: '-4px 0 12px' }}>{reports}{' '}{tx("orang melapor langsung ke")}{' '}{emp.full_name}</p>}
        <form onSubmit={submit}>
          <div className="field">
            <label>{tx("Jabatan")}</label>
            <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder={tx("Contoh: Brand Marketing Strategy Manager")} />
          </div>
          <div className="field">
            <label>{tx("Golongan")}</label>
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">{tx("- Belum ditentukan -")}</option>
              {[5, 4, 3, 2, 1].map((k) => <option key={k} value={k}>{GRADES[k].label} · {GRADES[k].desc}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{tx("Departemen")}</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">{tx("- Belum punya departemen -")}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{tx("Melapor ke (atasan langsung)")}</label>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">{tx("- Tidak ada atasan -")}</option>
              {managerOptions.map((e) => <option key={e.id} value={e.id}>{e.full_name}{e.position ? ` — ${e.position}` : ''}</option>)}
            </select>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={saving}>{saving ? tx("Menyimpan...") : tx("Simpan")}</button>
        </form>
      </div>
    </div>
  )
}
