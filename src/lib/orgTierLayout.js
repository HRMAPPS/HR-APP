// Layout struktur organisasi per GOLONGAN (baris sejajar).
//
// Aturan baris:
//   baris 0 = puncak  -> root Gol. V (CEO & Finance Advisor)
//   baris 1 = Gol. V  (Chief / BOD)
//   baris 2 = Gol. IV
//   baris 3 = Gol. III
//   baris 4 = Gol. II
//   baris 5 = Gol. I
// - Golongan yang sama dengan atasannya TETAP di baris golongannya (tidak turun baris);
//   orang itu diletakkan di samping atasannya, garis penghubung tetap keluar dari bawah atasan.
// - Orang tanpa golongan ditaruh 1 baris di bawah atasannya.
// - Anggota tanpa bawahan dikelompokkan jadi panel tim. Jabatan yang sama dan jumlahnya
//   lebih dari 2 dipisah jadi panel sendiri (mis. Reseller, Online Sales, SPG).
// Baris yang kosong tidak ditampilkan.

export const CARD_W = 220
export const GAP_X = 28          // jarak antar kartu bersaudara
export const ROOT_GAP = 72       // jarak antar pohon root
export const SIDE_GAP = 40       // jarak Advisor di samping CEO
export const TEAM_MIN = 3        // >= 3 anggota tanpa bawahan dijadikan satu panel tim
export const POS_GROUP_MIN = 3   // jabatan yang sama > 2 orang dipisah jadi panel sendiri
export const TEAM_PREVIEW = 8    // jumlah anggota panel yang tampil sebelum "lihat semua"

export const teamCols = (n) => (n > 6 ? 2 : 1)
export const teamWidth = (n) => (teamCols(n) === 2 ? 444 : 232)

export const tierRow = (grade) => (grade >= 1 && grade <= 5 ? 6 - grade : null)
const rootRow = (node) => (node.p.grade === 5 ? 0 : tierRow(node.p.grade) ?? 0)
// golongan sama/lebih tinggi dari atasan -> baris golongannya sendiri (bisa sama dengan atasan)
const childRow = (grade, parentRow) => {
  const t = tierRow(grade)
  return t == null ? parentRow + 1 : Math.max(t, parentRow)
}

const posKey = (p) => (p.position || '').toLowerCase().replace(/\s+/g, ' ').trim()

// Pecah daftar anggota (tanpa bawahan) jadi panel per jabatan + panel sisa
function groupLeaves(list) {
  const byPos = new Map()
  list.forEach((c) => {
    const k = posKey(c.p)
    byPos.set(k, [...(byPos.get(k) || []), c])
  })
  const groups = []
  let rest = []
  for (const [k, members] of byPos) {
    if (k && members.length >= POS_GROUP_MIN) groups.push({ key: k, title: members[0].p.position.trim(), members, byPos: true })
    else rest = rest.concat(members)
  }
  groups.sort((a, b) => b.members.length - a.members.length)
  if (rest.length >= TEAM_MIN) {
    groups.push({ key: '_rest', title: groups.length ? 'Lainnya' : 'Tim', members: rest, byPos: false })
    rest = []
  }
  return { groups, singles: rest }
}

/**
 * @param roots       node dari useModel: { p, depth, children, size }
 * @param isCollapsed (id) => boolean
 * @returns { rows: [{ row, items }], edges, width }
 *   edge: { from, fromRow, to, lateral? }
 */
export function buildTierLayout(roots, isCollapsed) {
  const all = []

  // makeCard memasukkan dirinya sendiri ke `peers` (daftar saudara pada level layout yang sama)
  const makeCard = (node, row, peers) => {
    const u = { id: node.p.id, kind: 'card', node, row, w: CARD_W, kids: [], lat: [] }
    all.push(u)
    peers.push(u)
    if (node.children.length === 0 || isCollapsed(node.p.id)) return u

    const placed = node.children.map((c) => ({ c, row: childRow(c.p.grade, row) }))

    // cabang (punya bawahan)
    placed.filter(({ c }) => c.children.length > 0).forEach(({ c, row: r }) => {
      if (r === row) u.lat.push(makeCard(c, r, peers))   // golongan sama: satu baris di samping atasan
      else makeCard(c, r, u.kids)
    })

    // anggota tanpa bawahan, dikelompokkan per baris golongan
    const leafByRow = new Map()
    placed.filter(({ c }) => c.children.length === 0).forEach(({ c, row: r }) => leafByRow.set(r, [...(leafByRow.get(r) || []), c]))
    for (const [r, list] of [...leafByRow].sort((a, b) => a[0] - b[0])) {
      const lateral = r === row
      const target = lateral ? peers : u.kids
      const { groups, singles } = groupLeaves(list)
      groups.forEach((g) => {
        const t = {
          id: `team:${node.p.id}:${r}:${g.key}`, kind: 'team', parent: node, members: g.members, row: r,
          title: g.title, byPos: g.byPos, teamKey: `${node.p.id}:${r}:${g.key}`,
          w: teamWidth(g.members.length), kids: [], lat: [],
        }
        all.push(t)
        target.push(t)
        if (lateral) u.lat.push(t)
      })
      singles.forEach((c) => {
        const cu = makeCard(c, r, target)
        if (lateral) u.lat.push(cu)
      })
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
  const mainUnits = []
  const sideUnits = []
  sorted.filter((n) => n.children.length > 0).forEach((n) => makeCard(n, rootRow(n), mainUnits))
  sorted.filter((n) => n.children.length === 0).forEach((n) => makeCard(n, rootRow(n), sideUnits))

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
  all.forEach((u) => {
    u.kids.forEach((k) => edges.push({ from: u.id, fromRow: u.row, to: k.id }))
    u.lat.forEach((k) => edges.push({ from: u.id, fromRow: u.row, to: k.id, lateral: true }))
  })

  return { rows, edges, width: maxX - minX }
}
