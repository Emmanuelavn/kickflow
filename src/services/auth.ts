// Comptes : inscription / connexion email + mot de passe, via le serveur.
import { useSyncExternalStore } from 'react'
import { db, useDb } from '../lib/db'
import { connectRealtime, disconnectRealtime, getToken, http, rpc, setToken, setUnauthorizedHandler } from '../lib/api'
import type { User } from '../lib/types'
import { detachPush, syncPush } from '../lib/push'

let currentUserId: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

async function startSession(token: string, user: User) {
  setToken(token)
  currentUserId = user.id
  db.apply([{ col: 'users', id: user.id, doc: user as unknown as Record<string, unknown> }])
  // Les données arrivent en direct ; on n'attend pas plus de 2,5 s pour afficher l'appli
  await Promise.race([connectRealtime(), new Promise((r) => setTimeout(r, 2500))])
  emit()
  void syncPush()
}

export const authService = {
  get currentUser(): User | null {
    return currentUserId ? db.get('users', currentUserId) ?? null : null
  },
  get isLoggedIn() {
    return this.currentUser !== null
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },

  /** Au lancement : reprend la session si un jeton est enregistré. */
  async restore(): Promise<void> {
    if (!getToken()) return
    try {
      const { user } = await http<{ user: User }>('/api/me')
      await startSession(getToken()!, user)
    } catch (e) {
      // Jeton expiré : on repart de l'écran de connexion. Sans réseau : on réessaiera plus tard.
      if ((e as { status?: number }).status === 401) this.logout()
    }
  },

  async register(p: {
    username: string; email: string; phone: string; password: string; country: string;
    birthDate: string; pseudo: string; referralCode?: string | null
  }): Promise<void> {
    const r = await http<{ token: string; user: User }>('/api/auth/register', p)
    await startSession(r.token, r.user)
  },

  async login(email: string, password: string): Promise<void> {
    const r = await http<{ token: string; user: User }>('/api/auth/login', { email, password })
    await startSession(r.token, r.user)
  },

  /** Envoie un email avec un lien pour choisir un nouveau mot de passe. */
  forgotPassword: (email: string) => http('/api/auth/forgot', { email }),

  async resetPassword(token: string, password: string) {
    const r = await http<{ token: string; user: User }>('/api/auth/reset', { token, password })
    await startSession(r.token, r.user)
  },

  logout() {
    void detachPush(getToken())
    setToken(null)
    currentUserId = null
    disconnectRealtime()
    emit()
  },

  changePassword: (old: string, next: string) => rpc('account.changePassword', { old, next }),
  async deleteAccount() {
    await rpc('account.delete')
    this.logout()
  },
}

setUnauthorizedHandler(() => authService.logout())

/** Utilisateur connecté, mis à jour en direct. */
export function useCurrentUser(): User | null {
  useDb()
  useSyncExternalStore(authService.subscribe, () => currentUserId)
  return authService.currentUser
}

/** Variante pour les écrans protégés (l'utilisateur est garanti par le routeur). */
export function useUser(): User {
  return useCurrentUser() as User
}
