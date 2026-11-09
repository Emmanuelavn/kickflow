// Transposé de widgets/announcement_banner_widget.dart et announcement_popup_widget.dart
import { X } from 'lucide-react'
import { ANNOUNCEMENT_TYPE } from '../services/announcements'
import type { Announcement } from '../lib/types'

const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`

export function AnnouncementBanner({ a, onTap, onDismiss }: { a: Announcement; onTap: () => void; onDismiss: () => void }) {
  const t = ANNOUNCEMENT_TYPE[a.type]
  return (
    <div className="anim-up" style={{
      margin: '8px 16px', borderRadius: 16, cursor: 'pointer',
      background: `linear-gradient(90deg, ${alpha(t.color, .2)}, ${alpha(t.color, .1)})`,
      border: `1.5px solid ${alpha(t.color, .4)}`, backdropFilter: 'blur(12px)',
    }} onClick={onTap}>
      <div className="row" style={{ padding: '12px 14px' }}>
        <span style={{ padding: 8, borderRadius: 10, background: alpha(t.color, .2), fontSize: 18, lineHeight: 1 }}>{t.emoji}</span>
        <div className="grow">
          <p className="ellipsis" style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</p>
          <p className="ellipsis" style={{ color: 'var(--text-grey)', fontSize: 11 }}>{a.description}</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Fermer" style={{ width: 32, height: 32, color: 'var(--text-grey)' }}
          onClick={(e) => { e.stopPropagation(); onDismiss() }}>
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

export function AnnouncementPopup({ a, onClose, onAction }: { a: Announcement; onClose: () => void; onAction: () => void }) {
  const t = ANNOUNCEMENT_TYPE[a.type]
  return (
    <div className="overlay">
      <div role="dialog" aria-modal="true" className="anim-scale" style={{
        width: '100%', maxWidth: 400, borderRadius: 24, overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--deep-blue), var(--card-dark))',
        border: '1.5px solid rgba(0,229,255,.3)',
        boxShadow: '0 0 30px 5px rgba(0,229,255,.2), 0 0 20px rgba(0,0,0,.5)',
      }}>
        <div className="row" style={{ padding: 20, alignItems: 'flex-start' }}>
          <span style={{ padding: 10, borderRadius: 14, background: 'rgba(0,229,255,.15)', fontSize: 24, lineHeight: 1 }}>{t.emoji}</span>
          <div className="grow">
            <span className="pill" style={{ background: alpha(t.color, .2), color: t.color }}>{t.label}</span>
            <p className="mt-8" style={{ fontWeight: 700, fontSize: 18 }}>{a.title}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose} style={{ color: 'var(--text-grey)' }}><X /></button>
        </div>
        <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,.3)', borderTop: '1px solid rgba(0,229,255,.1)', borderBottom: '1px solid rgba(0,229,255,.1)' }}>
          <p style={{ color: 'var(--text-grey)', fontSize: 14, lineHeight: 1.5 }}>{a.description}</p>
        </div>
        <div className="row" style={{ padding: 20 }}>
          {a.actionLabel && (
            <button type="button" className="btn btn-primary sm grow" style={{ padding: '14px 0' }} onClick={onAction}>{a.actionLabel}</button>
          )}
          <button type="button" className="btn btn-outline sm grow" style={{ padding: '14px 0', borderColor: 'rgba(0,229,255,.5)', borderWidth: 1 }} onClick={onClose}>
            {a.actionLabel ? 'Plus tard' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  )
}
