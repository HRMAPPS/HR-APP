import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, Maximize2, Minus, Pencil, Plus, Search, X } from 'lucide-react'
import { buildTierLayout, CARD_W, TEAM_PREVIEW, teamCols } from '../lib/orgTierLayout'
import './orgChart.css'

const PALETTE = ['#4F6BED', '#0E9F86', '#E8833A', '#B34BC4', '#2E90D1', '#D9467A', '#7A8B2C', '#8A5A44', '#5B6B7F', '#C79A1E']
const NEUTRAL = '#7A7370'
const LABEL_W = 132       // lebar kolom label golongan (kiri)
const ROW_GAP = 72        // jarak vertikal antar baris golongan (harus sama dengan --oc-rowgap)

// Golongan (employees.grade 1..5). Warna mengikuti Excel Struktur Organisasi.
export const GRADES = {
  5: { short: 'V', label: 'Golongan V', desc: 'BOD & Advisor', bg: '#4285F4', fg: '#fff' },
  4: { short: 'IV', label: 'Golongan IV', desc: 'Head', bg: '#B4A7D6', fg: '#2a2320' },
  3: { short: 'III', label: 'Golongan III', desc: 'Manager', bg: '#F9CB9C', fg: '#2a2320' },
  2: { short: 'II', label: 'Golongan II', desc: 'SPV/Leader', bg: '#76A5AF', fg: '#fff' },
  1: { short: 'I', label: 'Golongan I', desc: 'Staff', bg: '#B6D7A8', fg: '#2a2320' },
}
const gradeStyle = (g) => ({ '--gb': g.bg, '--gf': g.fg })

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
    const gradeCounts = employees.reduce((m, e) => (e.grade ? m.set(e.grade, (m.get(e.grade) || 0) + 1) : m), new Map())
    return { roots, nodes, parentOf, colorOf, deptName, legend, gradeCounts }
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

function GradePill({ grade, full }) {
  const g = GRADES[grade]
  if (!g) return null
  return <span className={`oc-grade ${full ? '' : 'sm'}`} style={gradeStyle(g)} title={`${g.label} · ${g.desc}`}>{full ? `Gol. ${g.short}` : g.short}</span>
}

// Area nama: tombol untuk edit jika boleh, div biasa jika tidak
function Hit({ p, ctx, className = '', children }) {
  if (!ctx.canEdit) return <div className={`oc-hit ${className}`}>{children}</div>
  return (
    <button type="button" className={`oc-hit is-edit ${className}`} onClick={() => ctx.onEdit(p)} title="Klik untuk edit struktur" aria-label={`Edit ${p.full_name}`}>
      {children}
      <Pencil size={12} className="oc-pen" />
    </button>
  )
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
      <Hit p={p} ctx={ctx}>
        <Avatar p={p} color={isRoot ? '#E9B949' : color} size={44} />
        <div className="oc-meta">
          <div className="oc-name" title={p.full_name}>{p.full_name}</div>
          <div className="oc-pos" title={p.position || ''}>{p.position || '-'}</div>
          {(dept || p.grade) && (
            <div className="oc-chips">
              {dept && <span className="oc-chip">{dept}</span>}
              <GradePill grade={p.grade} full />
            </div>
          )}
        </div>
      </Hit>
      {has && (
        <button className={`oc-toggle ${open ? '' : 'is-closed'}`} aria-expanded={open}
          aria-label={open ? 'Tutup bawahan' : 'Buka bawahan'} onClick={() => ctx.toggle(p.id)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{node.size - 1}
        </button>
      )}
    </div>
  )
}

function TeamPanel({ parent, members, teamKey: key, title = 'Tim', byPos = false, ctx }) {
  const anyMatch = members.some((m) => ctx.match(m.p.id))
  const all = ctx.openTeams.has(key) || ctx.openTeams.has(parent.p.id) || anyMatch || members.length <= TEAM_PREVIEW + 2
  const shown = all ? members : members.slice(0, TEAM_PREVIEW)
  const cols = teamCols(members.length)
  return (
    <div className="oc-team">
      <div className="oc-team-h"><span title={title}>{title}</span><span>{members.length} orang</span></div>
      <div className="oc-team-grid" style={{ '--cols': cols }}>
        {shown.map((m) => {
          const color = ctx.model.colorOf(m.p)
          return (
            <div key={m.p.id} className={['oc-mini', ctx.match(m.p.id) && 'is-match', ctx.dimmed(m.p.id) && 'oc-dim'].filter(Boolean).join(' ')}
              style={{ '--c': color }} data-oc-match={ctx.match(m.p.id) ? '1' : undefined}>
              <Hit p={m.p} ctx={ctx}>
                <Avatar p={m.p} color={color} size={30} />
                <div className="oc-meta">
                  <div className="oc-name" title={m.p.full_name}>{m.p.full_name}</div>
                  {!byPos && <div className="oc-pos" title={m.p.position || ''}>{m.p.position || '-'}</div>}
                </div>
                <GradePill grade={m.p.grade} />
              </Hit>
            </div>
          )
        })}
        {!all && (
          <button className="oc-more" onClick={() => ctx.openTeam(key)}>Lihat {members.length - TEAM_PREVIEW} lainnya</button>
        )}
      </div>
    </div>
  )
}

const rowMeta = (row) => {
  if (row === 0) return { pill: 'Puncak', desc: 'CEO & Advisor', g: GRADES[5] }
  const g = GRADES[6 - row]
  if (g) return { pill: `Gol. ${g.short}`, desc: g.desc, g }
  // di bawah baris Gol. I: bawahan Gol. I yang lapor ke Gol. I
  return { pill: `Gol. ${GRADES[1].short}`, desc: 'Lapor ke Gol. I', g: GRADES[1] }
}

// garis siku: turun dari induk -> horizontal di celah bawah baris induk -> turun lurus ke anak
function elbow(px, py, cx, cy, busY) {
  if (Math.abs(cx - px) < 1) return `M${px} ${py}V${cy}`
  const dir = cx > px ? 1 : -1
  const r = Math.max(0, Math.min(12, Math.abs(cx - px) / 2, busY - py, cy - busY))
  return `M${px} ${py}V${busY - r}Q${px} ${busY} ${px + dir * r} ${busY}H${cx - dir * r}Q${cx} ${busY} ${cx} ${busY + r}V${cy}`
}

function TierChart({ roots, ctx }) {
  const layout = useMemo(() => buildTierLayout(roots, ctx.isCollapsed), [roots, ctx.isCollapsed])
  const boxRef = useRef(null)
  const slots = useRef(new Map())
  const rowEls = useRef(new Map())
  const [geo, setGeo] = useState({ w: 0, bands: [], paths: [] })

  const measure = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const br = box.getBoundingClientRect()
    const sc = box.offsetWidth ? br.width / box.offsetWidth : 1 // skala zoom saat ini
    const q = (v) => Math.round(v * 2) / 2
    const rel = (el) => {
      const r = el.getBoundingClientRect()
      return { l: q((r.left - br.left) / sc), t: q((r.top - br.top) / sc), r: q((r.right - br.left) / sc), b: q((r.bottom - br.top) / sc) }
    }
    const rowRect = new Map()
    const bands = []
    for (const r of layout.rows) {
      const el = rowEls.current.get(r.row)
      if (!el) continue
      const b = rel(el)
      rowRect.set(r.row, b)
      bands.push({ key: r.row, y: b.t - 16, h: b.b - b.t + 32 })
    }
    const paths = []
    for (const e of layout.edges) {
      const a = slots.current.get(e.from), b = slots.current.get(e.to), row = rowRect.get(e.fromRow)
      if (!a || !b || !row) continue
      const qa = rel(a), qb = rel(b)
      paths.push({ d: elbow((qa.l + qa.r) / 2, qa.b, (qb.l + qb.r) / 2, qb.t, row.b + ROW_GAP / 2) })
    }
    const next = { w: box.offsetWidth, bands, paths }
    setGeo((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [layout])

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (boxRef.current) ro.observe(boxRef.current)
    document.fonts?.ready?.then(measure)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div ref={boxRef} className="oc-tier" style={{ width: layout.width + LABEL_W, '--oc-label': `${LABEL_W}px`, '--oc-rowgap': `${ROW_GAP}px` }}>
      <svg className="oc-lines" aria-hidden="true">
        {geo.bands.map((b) => <rect key={b.key} className="oc-band" x={0} y={b.y} width={geo.w} height={b.h} rx={18} />)}
        {geo.paths.map((p, i) => <path key={i} d={p.d} />)}
      </svg>
      {layout.rows.map((r) => {
        const meta = rowMeta(r.row)
        return (
          <div key={r.row} className="oc-tier-row" ref={(el) => (el ? rowEls.current.set(r.row, el) : rowEls.current.delete(r.row))}>
            <div className="oc-tier-label">
              <span className="oc-grade" style={meta.g ? gradeStyle(meta.g) : undefined}>{meta.pill}</span>
              <span className="oc-tier-desc">{meta.desc}</span>
            </div>
            {r.items.map((u) => (
              <div key={u.id} className="oc-slot" style={{ width: u.w, marginLeft: u.gap }}>
                {[u, ...u.stack].map((it) => (
                  <div key={it.id} className="oc-cell" style={{ width: it.kind === 'team' ? it.w : CARD_W }}
                    ref={(el) => (el ? slots.current.set(it.id, el) : slots.current.delete(it.id))}>
                    {it.kind === 'team'
                      ? <TeamPanel parent={it.parent} members={it.members} teamKey={it.teamKey} title={it.title} byPos={it.byPos} ctx={ctx} />
                      : <Card node={it.node} ctx={ctx} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </div>
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
  const main = (
    <>
      <Avatar p={p} color={isRoot ? '#E9B949' : color} size={38} />
      <div className="oc-meta">
        <div className="oc-name">{p.full_name}</div>
        <div className="oc-pos">{[p.position, dept].filter(Boolean).join(' · ') || '-'}</div>
      </div>
    </>
  )
  return (
    <li>
      <div className={cls} style={{ '--c': color }} data-oc-match={ctx.match(p.id) ? '1' : undefined}>
        {ctx.canEdit
          ? <button type="button" className="oc-hit" onClick={() => ctx.onEdit(p)} aria-label={`Edit ${p.full_name}`}>{main}</button>
          : has
            ? <button type="button" className="oc-hit" aria-expanded={open} onClick={() => ctx.toggle(p.id)}>{main}</button>
            : <div className="oc-hit">{main}</div>}
        <GradePill grade={p.grade} />
        {has && <button type="button" className={`oc-badge ${open ? 'is-open' : ''}`} aria-expanded={open} aria-label={open ? 'Tutup bawahan' : 'Buka bawahan'} onClick={() => ctx.toggle(p.id)}>{node.size - 1}<ChevronRight size={14} /></button>}
      </div>
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
export default function OrgChartVisual({ employees, departments = [], isDesktop, canEdit = false, onEdit }) {
  const model = useModel(employees, departments)
  const [collapsed, setCollapsed] = useState(() => new Set(model.nodes.filter((n) => n.depth >= 1 && n.children.length > 0).map((n) => n.p.id)))
  const [openTeams, setOpenTeams] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [gradeFilter, setGradeFilter] = useState(null) // 1..5 atau null
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
    if (query.length >= 2 || gradeFilter) {
      for (const n of model.nodes) {
        const hay = norm(`${n.p.full_name} ${n.p.position || ''} ${model.deptName(n.p)}`)
        if ((query.length < 2 || hay.includes(query)) && (!gradeFilter || n.p.grade === gradeFilter)) {
          m.add(n.p.id)
          let cur = model.parentOf.get(n.p.id), g = 0
          while (cur && g++ < 50) { f.add(cur); cur = model.parentOf.get(cur) }
        }
      }
    }
    return { matches: m, forced: f }
  }, [query, model, gradeFilter])
  const searching = query.length >= 2 || !!gradeFilter

  const ctx = useMemo(() => ({
    model, openTeams, canEdit, onEdit,
    isCollapsed: (id) => collapsed.has(id) && !forced.has(id),
    toggle: (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }),
    openTeam: (id) => setOpenTeams((s) => new Set(s).add(id)),
    match: (id) => matches.has(id),
    // filter golongan: semua yang bukan golongan terpilih diredupkan (termasuk atasannya);
    // pencarian teks: atasan di jalur hasil tetap terang supaya konteksnya terlihat
    dimmed: (id) => searching && !matches.has(id) && (!!gradeFilter || !forced.has(id)),
  }), [model, collapsed, forced, matches, openTeams, searching, gradeFilter, canEdit, onEdit])

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
      {model.gradeCounts.size > 0 && (
        <div className="oc-legend oc-legend-grade" style={{ flexBasis: '100%' }} role="group" aria-label="Filter golongan">
          {[5, 4, 3, 2, 1].filter((k) => model.gradeCounts.has(k)).map((k) => {
            const g = GRADES[k]
            return (
              <button key={k} type="button" className={`lg lg-grade ${gradeFilter === k ? 'is-on' : ''}`} style={gradeStyle(g)} aria-pressed={gradeFilter === k}
                onClick={() => setGradeFilter((cur) => (cur === k ? null : k))} title={`Sorot ${g.label}`}>
                <i />{g.label} · {g.desc}<b>{model.gradeCounts.get(k)}</b>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  if (!isDesktop) {
    return (
      <div className="oc-wrap">
        {toolbar}
        {searching && matches.size === 0 && <div className="oc-empty">{q.trim() ? `Tidak ada yang cocok dengan “${q}”.` : 'Tidak ada karyawan pada golongan ini.'}</div>}
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
            <TierChart roots={model.roots} ctx={ctx} />
          </div>
        </div>
      </div>
    </div>
  )
}
