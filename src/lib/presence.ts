// Joueurs qui ont l'appli ouverte en ce moment (envoyé par le serveur en temps réel)
import { useSyncExternalStore } from 'react'

let online = new Set<string>()
let version = 0
const listeners = new Set<() => void>()

export const presence = {
  set(ids: string[]) {
    online = new Set(ids)
    version++
    listeners.forEach((l) => l())
  },
  clear() { this.set([]) },
  isOnline: (id?: string | null) => (id ? online.has(id) : false),
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) },
}

/** true si ce joueur a l'appli ouverte. */
export function useOnline(id?: string | null) {
  useSyncExternalStore(presence.subscribe, () => version)
  return presence.isOnline(id)
}
