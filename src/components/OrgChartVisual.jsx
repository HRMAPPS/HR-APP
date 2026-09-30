import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, Maximize2, Minus, Plus, Search, X } from 'lucide-react'
import './orgChart.css'

const PALETTE = ['#4F6BED', '#0E9F86', '#E8833A', '#B34BC4', '#2E90D1', '#D9467A', '#7A8B2C', '#8A5A44', '#5B6B7F', '#C79A1E']
const NEUTRAL = '#7A7370'
const TEAM_MIN = 3        // >= 3 anggota tanpa bawahan dikelompokkan jadi satu panel tim
const TEAM_PREVIEW = 8    // jumlah anggota yang tampil sebelum "lihat semua"

const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
const norm = (s) => (s || '').toLowerCase()

/* ---------------------------------------------------------------- model */
function useModel(employees, departments) {
  return useMemo(() => {
    const byId = new Map(employees.map((e) => [e.id, e]))
    const kids = new Map()
    const rootsRaw = []
    for (const e of employees) {
      if (e.manager_id && e.manager_id !== e.id && byId.has(e.manager_id)) {
        if (!kids.has(e.manager_id)) kids.set(e.manager_id, [])
        kids.get(e.manager_id).push(e)
      } else rootsRaw.push(e)
    }
    const byName = (a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'id')
    const visited = new Set()
    const parentOf = new Map()
    const build = (e, depth, parent) => {
      visited.add(e.id)
      if (parent) parentOf.set(e.id, parent)
      const children = (kids.get(e.id) || []).slice().sort(byName)
        .map((k) => (visited.has(k.id) ? null : build(k, depth + 1, e.id))).filter(Boolean)
      children.sort((a, b) => (b.children.length > 0) - (a.children.length > 0) || byName(a.p, b.p))
      return { p: e, depth, children, size: 1 + children.reduce((s, c) => s + c.size, 0) }
    }
    const roots = rootsRaw.sort(byName).map((r) => (visited.has(r.id) ? null : build(r, 0, null))).filter(Boolean)
    for (const e of employees) if (!visited.has(e.id)) roots.push(build(e, 0, null)) // jaga-jaga siklus

    // warna per departemen induk
    const deptById = new Map((departments || []).map((d) => [d.id, d]))
    // naik sampai departemen tepat di bawah puncak (mis. BOD) supaya warnanya beragam
    const topOf = (id) => {
      let d = deptById.get(id), g = 0
      while (d && d.parent_id && deptById.has(d.parent_id) && deptById.get(d.parent_id).parent_id && g++ < 10) d = deptById.get(d.parent_id)
      return d
    }
    const tops = [...new Map((departments || []).map((d) => topOf(d.id)).filter(Boolean).map((d) => [d.id, d])).values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    const colorByTop = new Map(tops.map((d, i) => [d.id, PALETTE[i % PALETTE.length]]))
    const colorOf = (p) => { const t = p.department_id && topOf(p.department_id); return (t && colorByTop.get(t.id)) || NEUTRAL }
    const deptName = (p) => deptById.get(p.department_id)?.name || p.department_text || ''
    const legend = tops.map((d) => ({ id: d.id, name: d.name, color: colorByTop.get(d.id) }))

    const nodes = []
    const walk = (n) => { nodes.push(n); n.children.forEach(walk) }
    roots.forEach(walk)
    return { roots, nodes, parentOf, colorOf, deptName, legend }
  }, [employees, departments])
}

/* ---------------------------------------------------------------- small parts */
function Avatar({ p, color, size }) {
  const [bad, setBad] = useState(false)
  return (
    <span className="oc-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 70%, #1a1410))` }}>
      {p.avatar_url && !bad ? <img src={p.avatar_url} alt="" loading="lazy" onError={() => setBad(true)} /> : initials(p.full_name)}
    </span>
  )
}

function groupKids(node) {
  const leaves = node.children.filter((c) => c.children.length === 0)
  const branches = node.children.filter((c) => c.children.length > 0)
  const team = leaves.length >= TEAM_MIN ? leaves : null
  return { branches, singles: team ? [] : leaves, team }
}

/* ---------------------------------------------------------------- desktop */
function Card({ node, ctx }) {
  const { p } = node
  const color = ctx.model.colorOf(p)
  const dept = ctx.model.deptName(p)
  const isRoot = node.depth === 0
  const open = !ctx.isCollapsed(p.id)
  const has = node.children.length > 0
  const cls = ['oc-card', isRoot && 'is-root', ctx.match(p.id) && 'is-match', ctx.dimmed(p.id) && 'oc-dim'].filter(Boolean).join(' ')
  return (
    <div className={cls} style={{ '--c': color }} data-oc-match={ctx.match(p.id) ? '1' : undefined}>
      <Avatar p={p} color={isRoot ? '#E9B949' : color} size={44} />
      <div className="oc-meta">
        <div className="oc-name" title={p.full_name}>{p.full_name}</div>
        <div className="oc-pos" title={p.position || ''}>{p.position || '-'}</div>
        {dept && <span className="oc-chip">{dept}</span>}
      </div>
      {has && (
        <button className={`oc-toggle ${open ? '' : 'is-closed'}`} aria-expanded={open}
          aria-label={open ? 'Tutup bawahan' : 'Buka bawahan'} onClick={() => ctx.toggle(p.id)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{node.size - 1}
        </button>
      )}
    </div>
  )
}

function TeamPanel({ parent, members, ctx }) {
  const anyMatch = members.some((m) => ctx.match(m.p.id))
  const all = ctx.openTeams.has(parent.p.id) || anyMatch || members.length <= TEAM_PREVIEW + 2
  const shown = all ? members : members.slice(0, TEAM_PREVIEW)
  const cols = members.length > 6 ? 2 : 1
  return (
    <div className="oc-team">
      <div className="oc-team-h"><span>Tim</span><span>{members.length} orang</span></div>
      <div className="oc-team-grid" style={{ '--cols': cols }}>
        {shown.map((m) => {
          const color = ctx.model.colorOf(m.p)
          return (
            <div key={m.p.id} className={['oc-mini', ctx.match(m.p.id) && 'is-match', ctx.dimmed(m.p.id) && 'oc-dim'].filter(Boolean).join(' ')}
              style={{ '--c': color }} data-oc-match={ctx.match(m.p.id) ? '1' : undefined}>
              <Avatar p={m.p} color={color} size={30} />
              <div className="oc-meta">
                <div className="oc-name" title={m.p.full_name}>{m.p.full_name}</div>
                <div className="oc-pos" title={m.p.position || ''}>{m.p.position || '-'}</div>
              </div>
            </div>
          )
        })}
        {!all && (
          <button className="oc-more" onClick={() => ctx.openTeam(parent.p.id)}>Lihat {members.length - TEAM_PREVIEW} lainnya</button>
        )}
      </div>
    </div>
  )
}

function DesktopNode({ node, ctx }) {
  const open = !ctx.isCollapsed(node.p.id)
  const { branches, singles, team } = groupKids(node)
  return (
    <li>
      <Card node={node} ctx={ctx} />
      {node.children.length > 0 && open && (
        <ul>
          {branches.map((b) => <DesktopNode key={b.p.id} node={b} ctx={ctx} />)}
          {singles.map((s) => <li key={s.p.id}><Card node={s} ctx={ctx} /></li>)}
          {team && <li><TeamPanel parent={node} members={team} ctx={ctx} /></li>}
        </ul>
      )}
    </li>
  )
}

/* ---------------------------------------------------------------- mobile */
function MobileNode({ node, ctx }) {
  const { p } = node
  const color = ctx.model.colorOf(p)
  const dept = ctx.model.deptName(p)
  const has = node.children.length > 0
  const open = has && !ctx.isCollapsed(p.id)
  const isRoot = node.depth === 0

  let kids = node.children
  let hidden = 0
  if (open) {
    const leaves = kids.filter((c) => c.children.length === 0)
    const anyMatch = leaves.some((l) => ctx.match(l.p.id))
    if (leaves.length > TEAM_PREVIEW + 2 && !ctx.openTeams.has(p.id) && !anyMatch) {
      const keep = new Set(leaves.slice(0, TEAM_PREVIEW).map((l) => l.p.id))
      hidden = leaves.length - TEAM_PREVIEW
      kids = kids.filter((c) => c.children.length > 0 || keep.has(c.p.id))
    }
  }

  const cls = ['oc-row', isRoot && 'is-root', ctx.match(p.id) && 'is-match', ctx.dimmed(p.id) && 'oc-dim'].filter(Boolean).join(' ')
  const inner = (
    <>
      <Avatar p={p} color={isRoot ? '#E9B949' : color} size={38} />
      <div className="oc-meta">
        <div className="oc-name">{p.full_name}</div>
        <div className="oc-pos">{[p.position, dept].filter(Boolean).join(' · ') || '-'}</div>
      </div>
      {has && <span className={`oc-badge ${open ? 'is-open' : ''}`}>{node.size - 1}<ChevronRight size={14} /></span>}
    </>
  )
  return (
    <li>
      {has
        ? <button className={cls} style={{ '--c': color }} aria-expanded={open} onClick={() => ctx.toggle(p.id)} data-oc-match={ctx.match(p.id) ? '1' : undefined}>{inner}</button>
        : <div className={cls} style={{ '--c': color }} data-oc-match={ctx.match(p.id) ? '1' : undefined}>{inner}</div>}
      {open && (
        <ul>
          {kids.map((k) => <MobileNode key={k.p.id} node={k} ctx={ctx} />)}
          {hidden > 0 && <li><button className="oc-more-row" onClick={() => ctx.openTeam(p.id)}>Lihat {hidden} anggota lainnya</button></li>}
        </ul>
      )}
    </li>
  )
}

/* ---------------------------------------------------------------- main */
export default function OrgChartVisual({ employees, departments = [], isDesktop }) {
  const model = useModel(employees, departments)
  const [collapsed, setCollapsed] = useState(() => new Set(model.nodes.filter((n) => n.depth >= 1 && n.children.length > 0).map((n) => n.p.id)))
  const [openTeams, setOpenTeams] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [zoom, setZoom] = useState(1)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const viewRef = useRef(null)
  const innerRef = useRef(null)
  const drag = useRef(null)
  const didFit = useRef(false)

  // pencarian
  const query = norm(q.trim())
  const { matches, forced } = useMemo(() => {
    const m = new Set(), f = new Set()
    if (query.length >= 2) {
      for (const n of model.nodes) {
        const hay = norm(`${n.p.full_name} ${n.p.position || ''} ${model.deptName(n.p)}`)
        if (hay.includes(query)) {
          m.add(n.p.id)
          let cur = model.parentOf.get(n.p.id), g = 0
          while (cur && g++ < 50) { f.add(cur); cur = model.parentOf.get(cur) }
        }
      }
    }
    return { matches: m, forced: f }
  }, [query, model])
  const searching = query.length >= 2

  const ctx = useMemo(() => ({
    model, openTeams,
    isCollapsed: (id) => collapsed.has(id) && !forced.has(id),
    toggle: (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }),
    openTeam: (id) => setOpenTeams((s) => new Set(s).add(id)),
    match: (id) => matches.has(id),
    dimmed: (id) => searching && !matches.has(id) && !forced.has(id),
  }), [model, collapsed, forced, matches, openTeams, searching])

  const expandAll = () => { setCollapsed(new Set()); setOpenTeams(new Set(model.nodes.map((n) => n.p.id))) }
  const collapseAll = () => { setCollapsed(new Set(model.nodes.filter((n) => n.depth >= 1 && n.children.length > 0).map((n) => n.p.id))); setOpenTeams(new Set()) }

  // ukuran konten (desktop) + fit awal
  useLayoutEffect(() => {
    if (!isDesktop || !innerRef.current) return
    const el = innerRef.current
    const update = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isDesktop])

  const needCenter = useRef(false)
  const fit = useCallback(() => {
    const v = viewRef.current
    if (!v || !size.w) return
    const f = Math.max(0.4, Math.min(1, (v.clientWidth - 4) / size.w))
    needCenter.current = true
    setZoom(Math.floor(f * 100) / 100)
  }, [size.w])
  useLayoutEffect(() => {
    const v = viewRef.current
    if (!needCenter.current || !v) return
    needCenter.current = false
    v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2
    v.scrollTop = 0
  }, [zoom, size.w])

  useEffect(() => { if (isDesktop && size.w && !didFit.current) { didFit.current = true; fit() } }, [isDesktop, size.w, fit])

  // lompat ke hasil pencarian pertama
  useEffect(() => {
    if (!searching) return
    const t = setTimeout(() => {
      document.querySelector('[data-oc-match="1"]')?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    }, 200)
    return () => clearTimeout(t)
  }, [query, searching])

  // geser dengan drag (mouse)
  const onDown = (e) => {
    const v = viewRef.current
    if (!v || e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button,input,a')) return
    drag.current = { x: e.clientX, y: e.clientY, l: v.scrollLeft, t: v.scrollTop }
    v.setPointerCapture(e.pointerId); v.classList.add('is-drag')
  }
  const onMove = (e) => {
    const d = drag.current, v = viewRef.current
    if (!d || !v) return
    v.scrollLeft = d.l - (e.clientX - d.x); v.scrollTop = d.t - (e.clientY - d.y)
  }
  const onUp = (e) => { drag.current = null; viewRef.current?.classList.remove('is-drag'); try { viewRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ } }

  if (model.roots.length === 0) {
    return <div className="empty-state"><p>Belum ada data karyawan untuk ditampilkan.</p></div>
  }

  const toolbar = (
    <div className="oc-toolbar">
      <div className="oc-search">
        <Search size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, jabatan, atau departemen" aria-label="Cari" />
        {q && <button className="clear" onClick={() => setQ('')} aria-label="Hapus"><X size={15} /></button>}
      </div>
      {searching && <span className="oc-count">{matches.size} ditemukan</span>}
      <div className="oc-tools">
        <button className="oc-btn" onClick={expandAll} title="Buka semua"><ChevronsUpDown size={16} />{isDesktop ? 'Buka' : ''}</button>
        <button className="oc-btn" onClick={collapseAll} title="Tutup semua"><ChevronsDownUp size={16} />{isDesktop ? 'Tutup' : ''}</button>
        {isDesktop && (
          <>
            <button className="oc-btn" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))} aria-label="Perkecil"><Minus size={16} /></button>
            <span className="oc-zoom">{Math.round(zoom * 100)}%</span>
            <button className="oc-btn" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} aria-label="Perbesar"><Plus size={16} /></button>
            <button className="oc-btn" onClick={fit} title="Pas ke layar"><Maximize2 size={15} />Pas</button>
          </>
        )}
      </div>
      {model.legend.length > 0 && (
        <div className="oc-legend" style={{ flexBasis: '100%' }}>
          {model.legend.map((l) => <span key={l.id} className="lg" style={{ '--c': l.color }}><i />{l.name}</span>)}
        </div>
      )}
    </div>
  )

  if (!isDesktop) {
    return (
      <div className="oc-wrap">
        {toolbar}
        {searching && matches.size === 0 && <div className="oc-empty">Tidak ada yang cocok dengan “{q}”.</div>}
        <ul className="oc-outline">
          {model.roots.map((r) => <MobileNode key={r.p.id} node={r} ctx={ctx} />)}
        </ul>
      </div>
    )
  }

  return (
    <div className="oc-wrap">
      {toolbar}
      <div ref={viewRef} className="oc-viewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="oc-scaler" style={{ width: size.w * zoom || undefined, height: size.h * zoom || undefined }}>
          <div ref={innerRef} className="oc-inner" style={{ transform: `scale(${zoom})` }}>
            <ul className="oc-tree">
              {model.roots.map((r) => <DesktopNode key={r.p.id} node={r} ctx={ctx} />)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
