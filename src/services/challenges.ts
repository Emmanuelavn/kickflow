// Défis : lecture depuis le cache temps réel, actions exécutées par le serveur (server/logic.ts).
import { db } from '../lib/db'
import { rpc } from '../lib/api'
import type { Challenge, ChallengeStatus, ChallengeType, User } from '../lib/types'

export const COMMISSION_RATE = 0.2
export const DISPUTE_WINDOW_MINUTES = 5

export const STATUS_META: Record<ChallengeStatus, { label: string; short: string; color: string }> = {
  pending: { label: 'EN ATTENTE', short: 'En attente', color: 'var(--yellow)' },
  accepted: { label: 'ACCEPTÉ', short: 'Accepté', color: 'var(--cyan)' },
  inProgress: { label: 'EN COURS', short: 'En cours', color: 'var(--success)' },
  completed: { label: 'TERMINÉ', short: 'Terminé', color: 'var(--pink)' },
  cancelled: { label: 'ANNULÉ', short: 'Annulé', color: 'var(--error)' },
  disputed: { label: 'LITIGE', short: 'Contesté', color: 'var(--orange)' },
}

export const TYPE_META: Record<ChallengeType, { label: string; color: string }> = {
  public: { label: 'PUBLIC', color: 'var(--cyan)' },
  friends: { label: 'AMIS', color: 'var(--success)' },
  private: { label: 'PRIVÉ', color: 'var(--orange)' },
}

export const isParticipant = (c: Challenge, userId: string) => c.creatorId === userId || c.opponentId === userId

export function canDispute(c: Challenge, userId: string) {
  if (c.status !== 'completed' || !c.completedAt || c.dispute) return false
  const minutes = (Date.now() - new Date(c.completedAt).getTime()) / 60000
  return minutes <= DISPUTE_WINDOW_MINUTES && isParticipant(c, userId)
}

export type ReportState = 'waiting' | 'completed' | 'draw' | 'disputed'

export const challengeService = {
  getById: (id: string) => db.get('challenges', id),

  /** Défis disponibles : publics, + ceux de mes amis pour le type « Amis ». */
  getAvailable(user: User): Challenge[] {
    const now = Date.now()
    return db.list('challenges')
      .filter((c) => c.status === 'pending' && c.creatorId !== user.id)
      .filter((c) => !c.expiresAt || new Date(c.expiresAt).getTime() > now)
      .filter((c) => c.invitedUserId ? c.invitedUserId === user.id
        : c.challengeType === 'public' || (c.challengeType === 'friends' && user.friendIds.includes(c.creatorId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
  },
  getMine: (userId: string) => db.list('challenges').filter((c) => isParticipant(c, userId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getCreatedBy: (userId: string) => db.list('challenges').filter((c) => c.creatorId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  /** Match en cours du joueur (accepté ou en jeu), le plus récent. */
  getCurrentMatch(userId: string): Challenge | undefined {
    return this.getMine(userId).find((c) => (c.status === 'accepted' || c.status === 'inProgress') && !!c.opponentId)
  },
  getActive(userId: string) {
    return this.getMine(userId).filter((c) => ['pending', 'accepted', 'inProgress'].includes(c.status))
  },
  getDisputed: () => db.list('challenges').filter((c) => c.dispute).sort((a, b) => b.dispute!.timestamp.localeCompare(a.dispute!.timestamp)),

  create: (p: { amount: number; matchType: string; platform: string; requiredLevel?: number; challengeType: ChallengeType; expirationHours: number; invitedUserId?: string | null }) =>
    rpc<Challenge>('challenge.create', p),
  accept: (id: string) => rpc<Challenge>('challenge.accept', { id }),
  cancel: (id: string) => rpc('challenge.cancel', { id }),
  setReady: (id: string, ready: boolean) => rpc('challenge.setReady', { id, ready }),
  start: (id: string) => rpc('challenge.start', { id }),
  setRoomCode: (id: string, code: string) => rpc('challenge.setRoomCode', { id, code }),
  addScreenshot: (id: string, url: string) => rpc('challenge.addScreenshot', { id, url }),
  sendMessage: (id: string, message: string) => rpc('challenge.sendMessage', { id, message }),
  reportScore: (id: string, creatorScore: number, opponentScore: number, screenshot?: string | null) =>
    rpc<{ state: ReportState }>('challenge.reportScore', { id, creatorScore, opponentScore, screenshot }),
  openDispute: (id: string, reason: string, proofUrls: string[]) => rpc('challenge.openDispute', { id, reason, proofUrls }),
  resolveDispute: (id: string, winnerId: string | null, resolution: string, note?: string) =>
    rpc('challenge.resolveDispute', { id, winnerId, resolution, note }),
}
