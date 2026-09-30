// Layout struktur organisasi per GOLONGAN (baris sejajar).
//
// Aturan baris:
//   baris 0 = puncak  -> root Gol. V (CEO & Finance Advisor)
//   baris 1 = Gol. V  (Chief / BOD)
//   baris 2 = Gol. IV
//   baris 3 = Gol. III
//   baris 4 = Gol. II
//   baris 5 = Gol. I
// - Bawahan yang golongannya SAMA dengan atasannya (mis. Gol. I lapor ke Gol. I) tetap berada
//   di baris golongannya: kartunya ditumpuk ke bawah tepat di bawah atasan dalam satu kolom
//   (atasan di atas, bawahan di bawahnya), tidak pindah ke baris lain.
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
// baris bawahan = baris golongannya, tapi minimal 1 baris di bawah atasan
const childRow = (grade, parentRow) => Math.max(tierRow(grade) ?? 0, parentRow + 1)

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

const teamUnit = (parent, row, g, from) => ({
  id: `team:${parent.p.id}:${row}:${g.key}`, kind: 'team', parent, members: g.members, row,
  title: g.title, byPos: g.byPos, teamKey: `${parent.p.id}:${row}:${g.key}`,
  w: teamWidth(g.members.length), kids: [], stack: [], from,
})

/**
 * @param roots       node dari useModel: { p, depth, children, size }
 * @param isCollapsed (id) => boolean
 * @returns { rows: [{ row, items }], edges, width }
 *   item : { id, kind: 'card'|'team', w, cx, gap, stack: [item ditumpuk di bawahnya], ... }
 *   edge : { from, fromRow, to }
 */
export function buildTierLayout(roots, isCollapsed) {
  const all = []

  // makeCard memasukkan dirinya sendiri ke `peers` (daftar saudara pada level yang sama)
  const makeCard = (node, row, peers) => {
    const u = { id: node.p.id, kind: 'card', node, row, w: CARD_W, kids: [], stack: [] }
    all.push(u)
    peers.push(u)
    addChildren(u, node, row)
    u.w = Math.max(CARD_W, ...u.stack.map((s) => s.w))
    return u
  }

  // host = unit kolom (kartu di baris `row`); node = orang yang bawahannya sedang diproses
  // (node bisa host sendiri, atau anggota tumpukan di bawah host)
  const addChildren = (host, node, row) => {
    if (node.children.length === 0 || isCollapsed(node.p.id)) return

    const placed = node.children.map((c) => ({ c, row: childRow(c.p.grade, row) }))
    const sameGrade = (c) => !!c.p.grade && c.p.grade === node.p.grade && tierRow(c.p.grade) <= row
    const stacked = placed.filter(({ c }) => sameGrade(c)).map(({ c }) => c)
    const normal = placed.filter(({ c }) => !sameGrade(c))

    // ---- golongan sama dengan atasan: ditumpuk ke bawah dalam baris yang sama ----
    stacked.filter((c) => c.children.length > 0).forEach((c) => {
      host.stack.push({ id: c.p.id, kind: 'card', node: c, w: CARD_W, from: node.p.id })
      addChildren(host, c, row)
    })
    const stackedLeaves = stacked.filter((c) => c.children.length === 0)
    if (stackedLeaves.length) {
      const { groups, singles } = groupLeaves(stackedLeaves)
      groups.forEach((g) => host.stack.push(teamUnit(node, row, g, node.p.id)))
      singles.forEach((c) => host.stack.push({ id: c.p.id, kind: 'card', node: c, w: CARD_W, from: node.p.id }))
    }

    // ---- golongan lebih rendah: baris golongannya sendiri ----
    normal.filter(({ c }) => c.children.length > 0).forEach(({ c, row: r }) => {
      makeCard(c, r, host.kids).from = node.p.id
    })
    const leafByRow = new Map()
    normal.filter(({ c }) => c.children.length === 0).forEach(({ c, row: r }) => leafByRow.set(r, [...(leafByRow.get(r) || []), c]))
    for (const [r, list] of [...leafByRow].sort((a, b) => a[0] - b[0])) {
      const { groups, singles } = groupLeaves(list)
      groups.forEach((g) => {
        const t = teamUnit(node, r, g, node.p.id)
        all.push(t)
        host.kids.push(t)
      })
      singles.forEach((c) => { makeCard(c, r, host.kids).from = node.p.id })
    }
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
    u.kids.forEach((k) => edges.push({ from: k.from ?? u.id, fromRow: u.row, to: k.id }))
    u.stack.forEach((s) => edges.push({ from: s.from, fromRow: u.row, to: s.id }))
  })

  return { rows, edges, width: maxX - minX }
}
