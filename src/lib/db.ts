// Cache local des données envoyées par le serveur (temps réel via WebSocket).
// Les écrans LISENT ici de façon synchrone ; toutes les MODIFICATIONS passent par le serveur (lib/api.ts),
// qui renvoie les documents modifiés et les diffuse aux autres joueurs.
import { useSyncExternalStore } from 'react'
import type {
  Announcement, AppEvent, AppNotification, Challenge, Poll, Referral, Stream,
  Tournament, Transaction, User, Vote,
} from './types'

export interface DbShape {
  users: User[]
  challenges: Challenge[]
  transactions: Transaction[]
  notifications: AppNotification[]
  tournaments: Tournament[]
  announcements: Announcement[]
  events: AppEvent[]
  referrals: Referral[]
  streams: Stream[]
  polls: Poll[]
  votes: Vote[]
}

export type CollectionName = keyof DbShape
type Doc<C extends CollectionName> = DbShape[C][number]

export interface DocChange { col: CollectionName; id: string; doc: Record<string, unknown> | null; deleted?: boolean }

const empty = (): DbShape => ({
  users: [], challenges: [], transactions: [], notifications: [], tournaments: [],
  announcements: [], events: [], referrals: [], streams: [], polls: [], votes: [],
})

let state: DbShape = empty()
let version = 0
const listeners = new Set<() => void>()
const emit = () => { version++; listeners.forEach((l) => l()) }

export const db = {
  list<C extends CollectionName>(col: C): Doc<C>[] {
    return state[col] as Doc<C>[]
  },
  get<C extends CollectionName>(col: C, id: string): Doc<C> | undefined {
    return (state[col] as Doc<C>[]).find((d) => (d as { id: string }).id === id)
  },
  /** Remplace tout le cache (instantané reçu à la connexion). */
  load(snapshot: Partial<DbShape>) {
    state = { ...empty(), ...snapshot }
    emit()
  },
  /** Applique des modifications reçues du serveur. */
  apply(changes: DocChange[]) {
    if (!changes?.length) return
    const next = { ...state } as Record<CollectionName, { id: string }[]>
    for (const c of changes) {
      if (!(c.col in next)) continue
      const list = next[c.col].filter((d) => d.id !== c.id)
      if (c.doc && !c.deleted) list.push(c.doc as unknown as { id: string })
      next[c.col] = list
    }
    state = next as unknown as DbShape
    emit()
  },
  reset() {
    state = empty()
    emit()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getVersion: () => version,
}

/** Re-rend le composant à chaque modification des données. */
export function useDb() {
  useSyncExternalStore(db.subscribe, db.getVersion)
  return db
}

// --- Préférences propres à l'appareil (paramètres, annonces lues…) ---
export const kv = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`kickflow_${key}`)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(`kickflow_${key}`, JSON.stringify(value)) } catch { /* ignore */ }
    emit()
  },
}
