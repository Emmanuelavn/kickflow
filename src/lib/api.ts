// Communication avec le serveur KickFlow : appels d'API + connexion temps réel.
import { db, type DbShape, type DocChange } from './db'
import { presence } from './presence'

const TOKEN_KEY = 'kickflow_token'

// Le jeton est lu d'abord dans l'onglet (sessionStorage) pour permettre deux comptes dans deux onglets.
export function getToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token: string | null) {
  try {
    if (token) { sessionStorage.setItem(TOKEN_KEY, token); localStorage.setItem(TOKEN_KEY, token) }
    else { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY) }
  } catch { /* ignore */ }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

export async function http<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  let res: Response
  try {
    const token = getToken()
    res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Pas de connexion internet. Réessayez.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && getToken()) onUnauthorized()
    throw new ApiError(data.error ?? 'Erreur du serveur, réessayez', res.status)
  }
  return data as T
}

/** Exécute une action côté serveur et applique tout de suite les données modifiées. */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await http<{ result: T; changes: DocChange[] }>(`/api/rpc/${name}`, args)
  db.apply(r.changes)
  return r.result
}

/** Envoie une image (data URL) et renvoie son adresse. */
export async function uploadImage(dataUrl: string): Promise<string> {
  const r = await http<{ url: string }>('/api/images', { dataUrl })
  return r.url
}

// ---------- Temps réel ----------
let ws: WebSocket | null = null
let retry = 0
let wanted = false
let readyResolve: (() => void) | null = null
type Status = 'offline' | 'connecting' | 'online'
let status: Status = 'offline'
const statusListeners = new Set<() => void>()
const setStatus = (s: Status) => { status = s; statusListeners.forEach((l) => l()) }
export const connection = {
  get status() { return status },
  subscribe(l: () => void) { statusListeners.add(l); return () => statusListeners.delete(l) },
}

/** Ouvre la connexion temps réel ; la promesse se résout quand les données initiales sont reçues. */
export function connectRealtime(): Promise<void> {
  wanted = true
  const ready = new Promise<void>((r) => { readyResolve = r })
  open()
  return ready
}

function open() {
  const token = getToken()
  if (!token || !wanted) return
  setStatus('connecting')
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const sock = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`)
  ws = sock
  let ping: ReturnType<typeof setInterval> | undefined
  sock.onopen = () => { retry = 0; ping = setInterval(() => sock.readyState === 1 && sock.send('ping'), 20000) }
  sock.onmessage = (e) => {
    if (e.data === 'pong') return
    const msg = JSON.parse(e.data)
    if (msg.type === 'snapshot') {
      db.load(msg.data as Partial<DbShape>)
      setStatus('online')
      readyResolve?.()
      readyResolve = null
    } else if (msg.type === 'changes') {
      db.apply(msg.changes as DocChange[])
    } else if (msg.type === 'presence') {
      presence.set(msg.online as string[])
    }
  }
  sock.onclose = () => {
    clearInterval(ping)
    if (ws !== sock) return
    ws = null
    setStatus('offline')
    if (!wanted) return
    // Reconnexion automatique (1s, 2s, 4s… max 15s)
    const delay = Math.min(15000, 1000 * 2 ** retry++)
    setTimeout(open, delay)
  }
}

// Reconnexion immédiate quand on revient sur l'appli ou que le réseau revient
if (typeof window !== 'undefined') {
  const kick = () => { if (wanted && !ws && document.visibilityState === 'visible') { retry = 0; open() } }
  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', kick)
}

export function disconnectRealtime() {
  wanted = false
  const s = ws
  ws = null
  s?.close()
  setStatus('offline')
  presence.clear()
  db.reset()
}
