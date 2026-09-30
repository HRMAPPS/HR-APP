// Layout struktur organisasi per GOLONGAN (baris sejajar).
//
// Aturan baris:
//   baris 0 = puncak  -> root Gol. V (CEO & Finance Advisor)
//   baris 1 = Gol. V  (Chief / BOD)
//   baris 2 = Gol. IV
//   baris 3 = Gol. III
//   baris 4 = Gol. II
//   baris 5 = Gol. I
// Orang tanpa golongan, atau yang golongannya tidak lebih rendah dari atasannya,
// ditaruh 1 baris di bawah atasannya supaya garis tetap mengalir ke bawah.
// Baris yang kosong tidak ditampilkan.

export const CARD_W = 220
export const GAP_X = 28        // jarak antar kartu bersaudara
export const ROOT_GAP = 72     // jarak antar pohon root
export const SIDE_GAP = 40     // jarak Advisor di samping CEO
export const TEAM_MIN = 3      // >= 3 anggota tanpa bawahan (satu baris) jadi panel tim
export const TEAM_PREVIEW = 8  // jumlah anggota tim yang tampil sebelum "lihat semua"

export const teamCols = (n) => (n > 6 ? 2 : 1)
export const teamWidth = (n) => (teamCols(n) === 2 ? 444 : 232)

export const tierRow = (grade) => (grade >= 1 && grade <= 5 ? 6 - grade : null)
const rootRow = (node) => (node.p.grade === 5 ? 0 : tierRow(node.p.grade) ?? 0)
const childRow = (grade, parentRow) => Math.max(tierRow(grade) ?? 0, parentRow + 1)

/**
 * @param roots       node dari useModel: { p, depth, children, size }
 * @param isCollapsed (id) => boolean
 * @returns { rows: [{ row, items: [{ id, kind, w, cx, gap, node|parent+members }] }], edges, width }
 */
export function buildTierLayout(roots, isCollapsed) {
  const all = []

  const makeCard = (node, row) => {
    const u = { id: node.p.id, kind: 'card', node, row, w: CARD_W, kids: [] }
    all.push(u)
    if (node.children.length === 0 || isCollapsed(node.p.id)) return u

    const placed = node.children.map((c) => ({ c, row: childRow(c.p.grade, row) }))
    const branches = placed.filter(({ c }) => c.children.length > 0)
    const leaves = placed.filter(({ c }) => c.children.length === 0)

    branches.forEach(({ c, row: r }) => u.kids.push(makeCard(c, r)))

    const leafByRow = new Map()
    leaves.forEach(({ c, row: r }) => leafByRow.set(r, [...(leafByRow.get(r) || []), c]))
    for (const [r, list] of [...leafByRow].sort((a, b) => a[0] - b[0])) {
      if (list.length >= TEAM_MIN) {
        const t = { id: `team:${node.p.id}:${r}`, kind: 'team', parent: node, members: list, row: r, w: teamWidth(list.length), kids: [] }
        all.push(t)
        u.kids.push(t)
      } else {
        list.forEach((c) => u.kids.push(makeCard(c, r)))
      }
    }
    return u
  }

  // ---- lebar tiap subtree, lalu posisi x (pusat) ----
  const span = (u) => {
    if (!u.kids.length) return (u.sw = u.w)
    u.kw = u.kids.reduce((s, k) => s + span(k), 0) + GAP_X * (u.kids.length - 1)
    return (u.sw = Math.max(u.w, u.kw))
  }
  const place = (u, left) => {
    if (!u.kids.length) { u.cx = left + u.sw / 2; return }
    let cur = left + (u.sw - u.kw) / 2
    for (const k of u.kids) { place(k, cur); cur += k.sw + GAP_X }
    const first = u.kids[0], last = u.kids[u.kids.length - 1]
    u.cx = u.kw >= u.w ? (first.cx + last.cx) / 2 : left + u.sw / 2
  }

  // root yang punya bawahan dulu; root tanpa bawahan (mis. Finance Advisor) ditaruh di samping
  const sorted = roots.slice().sort((a, b) => (b.children.length > 0) - (a.children.length > 0))
  const mainUnits = sorted.filter((n) => n.children.length > 0).map((n) => makeCard(n, rootRow(n)))
  const sideUnits = sorted.filter((n) => n.children.length === 0).map((n) => makeCard(n, rootRow(n)))

  let cursor = 0
  for (const u of mainUnits) { span(u); place(u, cursor); cursor += u.sw + ROOT_GAP }

  if (mainUnits.length) {
    const lead = mainUnits[0]
    let nextX = lead.cx + CARD_W + SIDE_GAP   // tepat di kanan CEO
    for (const u of sideUnits) {
      u.sw = u.w
      if (u.row === lead.row) { u.cx = nextX; nextX += CARD_W + SIDE_GAP }
      else { u.cx = cursor + u.w / 2; cursor += u.w + ROOT_GAP }
    }
  } else {
    for (const u of sideUnits) { u.sw = u.w; u.cx = cursor + u.w / 2; cursor += u.w + ROOT_GAP }
  }

  // ---- normalisasi ke x >= 0 ----
  const minX = Math.min(...all.map((u) => u.cx - u.w / 2))
  const maxX = Math.max(...all.map((u) => u.cx + u.w / 2))
  all.forEach((u) => { u.cx -= minX })

  // ---- kelompokkan per baris ----
  const byRow = new Map()
  all.forEach((u) => byRow.set(u.row, [...(byRow.get(u.row) || []), u]))
  const rows = [...byRow.keys()].sort((a, b) => a - b).map((row) => {
    const items = byRow.get(row).sort((a, b) => a.cx - b.cx)
    let prevRight = 0
    items.forEach((u) => { const left = u.cx - u.w / 2; u.gap = left - prevRight; prevRight = left + u.w })
    return { row, items }
  })

  const edges = []
  all.forEach((u) => u.kids.forEach((k) => edges.push({ from: u.id, fromRow: u.row, to: k.id })))

  return { rows, edges, width: maxX - minX }
}
