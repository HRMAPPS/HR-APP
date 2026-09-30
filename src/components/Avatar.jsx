// Avatar bulat: foto kalau ada, kalau tidak inisial nama. Dipakai bersama di banyak halaman
// supaya semua tempat yang menampilkan orang konsisten memakai foto profil.
function initialsOf(name) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function Avatar({ url, name, size = 40, fontSize, style }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0, ...style }}
      />
    )
  }
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: fontSize || Math.round(size * 0.33), ...style }}>
      {initialsOf(name)}
    </div>
  )
}
