const LEVEL_COLORS = [
  ['#ec4899', '#db2777'], // level 0 - CEO
  ['#fb923c', '#f97316'], // level 1 - Manager
  ['#34d399', '#0d9488'], // level 2 - Foreman / Sales Officer
  ['#60a5fa', '#2563eb'], // level 3+ - Workers / Sales
]

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function colorFor(depth) {
  return LEVEL_COLORS[Math.min(depth, LEVEL_COLORS.length - 1)]
}

function Node({ person, depth, childrenByManager }) {
  const [c1, c2] = colorFor(depth)
  const kids = childrenByManager[person.id] || []
  return (
    <li>
      <div className="org-node">
        <div className="circle" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
          {initials(person.full_name)}
        </div>
        <div className="badge" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
          <div className="name">{person.full_name}</div>
          <div className="role">({person.position || '-'})</div>
        </div>
      </div>
      {kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <Node key={k.id} person={k} depth={depth + 1} childrenByManager={childrenByManager} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function OrgChartVisual({ employees }) {
  const childrenByManager = {}
  for (const e of employees) {
    if (e.manager_id) {
      childrenByManager[e.manager_id] = childrenByManager[e.manager_id] || []
      childrenByManager[e.manager_id].push(e)
    }
  }
  const roots = employees.filter((e) => !e.manager_id)

  if (roots.length === 0) {
    return <div className="empty-state"><p>Belum ada karyawan tanpa atasan (titik puncak struktur).</p></div>
  }

  return (
    <div style={{ overflowX: 'auto', padding: '30px 20px' }}>
      <ul className="org-tree">
        {roots.map((r) => (
          <Node key={r.id} person={r} depth={0} childrenByManager={childrenByManager} />
        ))}
      </ul>
    </div>
  )
}
