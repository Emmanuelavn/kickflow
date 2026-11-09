// Composants d'interface réutilisables (équivalents des widgets Material utilisés par l'app Flutter)
import { createContext, useCallback, useContext, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, type LucideIcon } from 'lucide-react'

// Retour arrière dans l'appli ; si l'écran a été ouvert directement (lien), retour à l'accueil.
export function goBack(navigate: ReturnType<typeof useNavigate>) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) navigate(-1)
  else navigate('/', { replace: true })
}

// ---------- App bar ----------
export function AppBar({ title, back = false, onBack, actions, transparent }: {
  title?: ReactNode; back?: boolean; onBack?: () => void; actions?: ReactNode; transparent?: boolean
}) {
  const navigate = useNavigate()
  return (
    <header className="app-bar" style={transparent ? { background: 'transparent', backdropFilter: 'none' } : undefined}>
      <div className="side">
        {back && (
          <IconButton icon={ArrowLeft} label="Retour" onClick={onBack ?? (() => goBack(navigate))} />
        )}
      </div>
      <div className="title">{title}</div>
      <div className="side right">{actions}</div>
    </header>
  )
}

export function IconButton({ icon: Icon, label, onClick, color, badge, size = 24 }: {
  icon: LucideIcon; label: string; onClick?: () => void; color?: string; badge?: number; size?: number
}) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick} style={color ? { color } : undefined}>
      <Icon size={size} />
      {badge ? <span className="dot">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  )
}

// ---------- Boutons ----------
type BtnVariant = 'primary' | 'outline' | 'text' | 'danger' | 'success' | 'yellow'
export function Button({ children, variant = 'primary', block, sm, loading, disabled, icon: Icon, onClick, type = 'button', style }: {
  children: ReactNode; variant?: BtnVariant; block?: boolean; sm?: boolean; loading?: boolean
  disabled?: boolean; icon?: LucideIcon; onClick?: () => void; type?: 'button' | 'submit'; style?: CSSProperties
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}${block ? ' block' : ''}${sm ? ' sm' : ''}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={style}
    >
      {loading ? <span className="spinner" /> : (<>{Icon && <Icon size={sm ? 18 : 22} />}{children}</>)}
    </button>
  )
}

// ---------- Champs ----------
export function TextField({ label, icon: Icon, error, help, password, suffix, ...rest }: {
  label: string; icon?: LucideIcon; error?: string | null; help?: string; password?: boolean; suffix?: ReactNode
} & InputHTMLAttributes<HTMLInputElement>) {
  const [hidden, setHidden] = useState(true)
  return (
    <label className={`field${error ? ' error' : ''}`}>
      <div className="field-box">
        {Icon && <Icon size={22} />}
        <div className="field-inner">
          <span className="field-label">{label}</span>
          <input {...rest} type={password ? (hidden ? 'password' : 'text') : rest.type} />
        </div>
        {password && (
          <button type="button" className="icon-btn" aria-label={hidden ? 'Afficher' : 'Masquer'} onClick={() => setHidden(!hidden)} style={{ width: 36, height: 36 }}>
            {hidden ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        )}
        {suffix}
      </div>
      {error ? <p className="field-error">{error}</p> : help ? <p className="field-help">{help}</p> : null}
    </label>
  )
}

export function TextArea({ label, icon: Icon, error, value, onChange, placeholder, rows = 4, maxLength }: {
  label: string; icon?: LucideIcon; error?: string | null; value: string; onChange: (v: string) => void
  placeholder?: string; rows?: number; maxLength?: number
}) {
  return (
    <label className={`field${error ? ' error' : ''}`}>
      <div className="field-box" style={{ alignItems: 'flex-start', paddingTop: 12 }}>
        {Icon && <Icon size={22} style={{ marginTop: 18 }} />}
        <div className="field-inner">
          <span className="field-label">{label}</span>
          <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} maxLength={maxLength} />
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
    </label>
  )
}

export function SelectField<T extends string | number>({ label, icon: Icon, value, options, onChange }: {
  label: string; icon?: LucideIcon; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <label className="field">
      <div className="field-box">
        {Icon && <Icon size={22} />}
        <div className="field-inner">
          <span className="field-label">{label}</span>
          <select
            value={String(value)}
            onChange={(e) => {
              const opt = options.find((o) => String(o.value) === e.target.value)
              if (opt) onChange(opt.value)
            }}
          >
            {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </label>
  )
}

// ---------- Snackbar ----------
type SnackKind = 'default' | 'success' | 'error' | 'info' | 'warning'
interface Snack { id: number; text: string; kind: SnackKind }
const SnackCtx = createContext<(text: string, kind?: SnackKind) => void>(() => {})

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snacks, setSnacks] = useState<Snack[]>([])
  const show = useCallback((text: string, kind: SnackKind = 'default') => {
    const id = Date.now() + Math.random()
    // Un seul message à la fois : le nouveau remplace l'ancien
    setSnacks([{ id, text, kind }])
    setTimeout(() => setSnacks((s) => s.filter((x) => x.id !== id)), 3000)
  }, [])
  return (
    <SnackCtx.Provider value={show}>
      {children}
      <div className="snackbar-host" role="status" aria-live="polite">
        {snacks.map((s) => <div key={s.id} className={`snackbar ${s.kind}`}>{s.text}</div>)}
      </div>
    </SnackCtx.Provider>
  )
}
export const useSnack = () => useContext(SnackCtx)

/** Exécute une action serveur : gère le chargement et affiche l'erreur éventuelle. */
export function useAction() {
  const snack = useSnack()
  const [busy, setBusy] = useState(false)
  const run = useCallback(async <T,>(fn: () => Promise<T>, okMessage?: string): Promise<T | undefined> => {
    setBusy(true)
    try {
      const r = await fn()
      if (okMessage) snack(okMessage, 'success')
      return r
    } catch (e) {
      snack((e as Error).message || 'Erreur, réessayez', 'error')
      return undefined
    } finally {
      setBusy(false)
    }
  }, [snack])
  return { run, busy }
}

// ---------- Dialogues ----------
export function Dialog({ open, onClose, children, dismissible = true }: {
  open: boolean; onClose: () => void; children: ReactNode; dismissible?: boolean
}) {
  if (!open) return null
  return (
    <div className="overlay" onClick={dismissible ? onClose : undefined}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="overlay bottom" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

// ---------- Avatar ----------
export function Avatar({ name, photo, size = 48 }: { name: string; photo?: string | null; size?: number }) {
  if (photo) {
    return <img src={photo} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function Spinner({ large }: { large?: boolean }) {
  return <span className={`spinner${large ? ' lg' : ''}`} style={{ color: 'var(--cyan)' }} />
}

export function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <div className="empty">
      <Icon size={64} />
      <p className="title-md" style={{ color: 'var(--text-white)' }}>{title}</p>
      {text && <p className="body-md mt-8">{text}</p>}
    </div>
  )
}
