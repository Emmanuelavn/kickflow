// Invitation à activer les notifications sur le téléphone
import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { kv } from '../lib/db'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'
import { useSnack } from './ui'

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null)
  useEffect(() => { pushState().then(setState).catch(() => setState('unsupported')) }, [])
  return [state, setState] as const
}

/** Carte de l'accueil : affichée tant que les notifications ne sont pas activées. */
export function PushCard() {
  const snack = useSnack()
  const [state, setState] = usePushState()
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(() => kv.get('push_card_hidden', false))
  if (hidden || !state || state === 'on' || state === 'unsupported') return null

  async function enable() {
    setBusy(true)
    try {
      const s = await enablePush()
      setState(s)
      if (s === 'on') snack('Notifications activées 🔔', 'success')
      else if (s === 'denied') snack('Notifications refusées : tu peux les réactiver dans les réglages du téléphone', 'warning')
    } catch (e) {
      snack((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="k-card row" style={{ marginBottom: 12, borderColor: 'rgba(0,229,255,.45)', alignItems: 'flex-start' }}>
      <BellRing size={22} color="var(--cyan)" style={{ marginTop: 2, flex: 'none' }} />
      <div className="grow">
        {state === 'needs-install' ? (
          <span className="k-small">Pour être prévenu quand on accepte ton défi, <b>ajoute KickFlow à ton écran d'accueil</b> : bouton Partager, puis « Sur l'écran d'accueil ».</span>
        ) : state === 'denied' ? (
          <span className="k-small">Les notifications sont bloquées. Active-les dans les réglages du téléphone pour ce site.</span>
        ) : (
          <>
            <span className="k-small">Sois prévenu même appli fermée quand <b>on accepte ton défi</b> ou que ton adversaire déclare le score.</span>
            <button type="button" className="k-btn primary sm" style={{ marginTop: 10 }} disabled={busy} onClick={enable}>Activer les notifications</button>
          </>
        )}
      </div>
      <button type="button" className="k-icon" style={{ width: 32, height: 32, background: 'transparent', color: 'var(--k-dim)' }} aria-label="Masquer" onClick={() => { kv.set('push_card_hidden', true); setHidden(true) }}><X size={18} /></button>
    </div>
  )
}

/** Réglage dans les Paramètres. */
export function PushSetting() {
  const snack = useSnack()
  const [state, setState] = usePushState()
  const [busy, setBusy] = useState(false)
  const label = state === 'on' ? 'Activées sur ce téléphone' : state === 'denied' ? 'Bloquées dans les réglages du téléphone'
    : state === 'needs-install' ? "Ajoute d'abord l'appli à l'écran d'accueil" : state === 'unsupported' ? 'Non disponibles sur ce navigateur' : 'Désactivées'
  async function toggle() {
    setBusy(true)
    try { setState(state === 'on' ? await disablePush() : await enablePush()) } catch (e) { snack((e as Error).message, 'error') } finally { setBusy(false) }
  }
  return (
    <label className="row" style={{ padding: '10px 0', cursor: state === 'off' || state === 'on' ? 'pointer' : 'default' }}>
      <span className="grow"><span className="bold" style={{ display: 'block' }}>Notifications sur le téléphone</span><span className="body-sm">{state ? label : '…'}</span></span>
      <input type="checkbox" role="switch" checked={state === 'on'} disabled={busy || !(state === 'off' || state === 'on')} onChange={toggle} style={{ width: 44, height: 24, accentColor: 'var(--cyan)' }} />
    </label>
  )
}
