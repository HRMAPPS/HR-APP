import { useEffect, useState } from 'react'
import { ArrowLeft, User, FileText } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { linkifyText } from '../lib/linkify'

// Full-page announcement view, opened from the "Pengumuman" lists on
// Home. Shows the full body text and, when present, a downloadable
// attachment card.
export default function AnnouncementDetail({ id, onBack }) {
  const [a, setA] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase.from('announcements').select('*').eq('id', id).single()
      .then(({ data }) => { if (active) { setA(data); setLoading(false) } })
    return () => { active = false }
  }, [id])

  return (
    <div>
      <div className="topbar" style={{ paddingBottom: 4 }}>
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={22} /></button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Memuat...</p></div>
      ) : !a ? (
        <div className="empty-state"><p>Pengumuman tidak ditemukan.</p></div>
      ) : (
        <>
          <div style={{ padding: '4px 18px 22px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0 14px', lineHeight: 1.3 }}>{a.title}</h1>

            {a.author && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 14, color: 'var(--text-muted)' }}>
                Oleh
                {a.author_avatar_url
                  ? <img src={a.author_avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                  : <span className="avatar" style={{ width: 24, height: 24 }}><User size={13} /></span>}
                <span>{a.author}</span>
              </div>
            )}

            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Diposting pada {new Date(a.published_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' '}pukul {new Date(a.published_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {a.category && (
              <span style={{
                display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--blue)',
                borderRadius: 20, padding: '5px 14px',
              }}>
                {a.category}
              </span>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: '22px 22px 0 0', padding: '24px 18px', minHeight: '55vh' }}>
            {a.body && (
              <div style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{linkifyText(a.body)}</div>
            )}

            {a.attachment_url && (
              <div style={{ marginTop: 26 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Lampiran</div>
                <a
                  href={a.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                >
                  <div style={{
                    width: 76, height: 76, borderRadius: 16, background: '#2b303b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  }}>
                    <FileText size={30} color="#fff" />
                    <span style={{ position: 'absolute', bottom: 10, left: 10, width: 16, height: 16, borderRadius: 4, background: '#C0392B' }} />
                  </div>
                  <span style={{
                    fontSize: 12, color: 'var(--text)', maxWidth: 120, textAlign: 'center',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.attachment_name || 'Lampiran'}
                  </span>
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
