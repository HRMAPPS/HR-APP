// Splits plain text on URLs (http/https/www.) and returns an array of
// strings and <a> elements, so announcement bodies with links (Google
// Maps, bit.ly, etc.) render as clickable text instead of a dead string.
export function linkifyText(text) {
  if (!text) return text

  const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/g
  const nodes = []
  let lastIndex = 0
  let match
  let key = 0

  while ((match = urlRegex.exec(text)) !== null) {
    const start = match.index
    let raw = match[0]

    // Trailing punctuation ("...link.", "(link)") usually belongs to the
    // sentence, not the URL — peel it off so the link target stays clean.
    let trail = ''
    while (raw && /[.,;:!?)\]]$/.test(raw)) {
      trail = raw.slice(-1) + trail
      raw = raw.slice(0, -1)
    }

    if (start > lastIndex) nodes.push(text.slice(lastIndex, start))

    const href = raw.startsWith('http') ? raw : `https://${raw}`
    nodes.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: 'var(--blue)', wordBreak: 'break-all' }}
      >
        {raw}
      </a>
    )
    if (trail) nodes.push(trail)

    lastIndex = start + match[0].length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}
