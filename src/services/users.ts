// Joueurs et amis.
import { db } from '../lib/db'
import { rpc } from '../lib/api'
import type { User } from '../lib/types'

export const userService = {
  getById: (id?: string | null): User | undefined => (id ? db.get('users', id) : undefined),
  getAll: (): User[] => db.list('users').slice(0, 100),
  search(query: string): User[] {
    const q = query.toLowerCase()
    return db.list('users').filter((u) => u.username !== 'compte_supprime' && (u.username.toLowerCase().includes(q) || u.pseudo.toLowerCase().includes(q)))
  },
  getFriends(userId: string): User[] {
    const u = db.get('users', userId)
    return (u?.friendIds ?? []).map((id) => db.get('users', id)).filter((x): x is User => !!x)
  },
  addFriend: (friendId: string) => rpc('user.addFriend', { friendId }),
  removeFriend: (friendId: string) => rpc('user.removeFriend', { friendId }),
  updateProfile: (p: { pseudo?: string; country?: string; phone?: string; profilePhoto?: string | null }) => rpc('user.updateProfile', p),
}

export const winRate = (u: User) => (u.stats.wins + u.stats.losses > 0 ? u.stats.wins / (u.stats.wins + u.stats.losses) : 0)
