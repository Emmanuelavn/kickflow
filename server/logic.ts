// Règles du jeu, exécutées UNIQUEMENT sur le serveur (le téléphone ne peut plus modifier un solde lui-même).
// Portage des services de l'appli : défis, portefeuille, litiges, tournois, streaming, amis, notifications.
import { randomUUID } from 'node:crypto'
import { AppError, type Tx } from './db.ts'
import type {
  AppNotification, Challenge, ChallengeType, MatchDetails, NotificationPriority, NotificationType, Stream,
  Tournament, TournamentMatch, TournamentType, Transaction, TransactionStatus, TransactionType, User,
} from '../src/lib/types.ts'

export const COMMISSION_RATE = 0.2
export const DISPUTE_WINDOW_MINUTES = 5
export const START_DEADLINE_MINUTES = 15
const MAX_AMOUNT = 100_000

const now = () => new Date().toISOString()
const uid = () => randomUUID()

// ---------- Validation ----------
export function str(v: unknown, field: string, max = 200, min = 1): string {
  if (typeof v !== 'string') throw new AppError(`${field} invalide`)
  const s = v.trim()
  if (s.length < min) throw new AppError(`${field} requis`)
  if (s.length > max) throw new AppError(`${field} trop long`)
  return s
}
export function amount(v: unknown, field = 'Montant', allowZero = false): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n > MAX_AMOUNT) throw new AppError(`${field} invalide`)
  return Math.round(n)
}
function int(v: unknown, field: string, min = 0, max = 99): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(`${field} invalide`)
  return n
}

// ---------- Utilitaires ----------
async function getUser(t: Tx, id: string, lock = true) {
  const u = await t.get<User>('users', id, lock)
  if (!u) throw new AppError('Joueur introuvable')
  return u
}
async function saveUser(t: Tx, u: User) {
  return t.put('users', { ...u, updatedAt: now() })
}
async function addTx(t: Tx, userId: string, type: TransactionType, amt: number, description: string, status: TransactionStatus = 'completed', relatedId: string | null = null) {
  const doc: Transaction = { id: uid(), userId, type, amount: amt, status, timestamp: now(), description, relatedId }
  await t.put('transactions', doc)
}
export async function notify(t: Tx, p: { userId: string; type: NotificationType; title: string; message: string; relatedId?: string | null; priority?: NotificationPriority }) {
  const n: AppNotification = { id: uid(), isRead: false, createdAt: now(), channel: 'push', priority: 'normal', relatedId: null, ...p }
  await t.put('notifications', n)
  // Lien ouvert quand le joueur touche la notification sur son téléphone
  const url = n.relatedId && ['challenge', 'match', 'dispute'].includes(n.type) ? `/match/${n.relatedId}`
    : n.relatedId && n.type === 'tournament' ? `/tournaments/${n.relatedId}` : '/notifications'
  t.pushes.push({ userId: n.userId, title: n.title, message: n.message, url })
}
const pseudo = async (t: Tx, id?: string | null) => (id ? (await t.get<User>('users', id))?.pseudo ?? 'Joueur' : 'Joueur')

// ---------- Portefeuille en XOF ----------
async function changeBalance(t: Tx, userId: string, fn: (b: User['walletBalance']) => User['walletBalance']) {
  const u = await getUser(t, userId)
  return saveUser(t, { ...u, walletBalance: fn(u.walletBalance) })
}
async function lockStake(t: Tx, userId: string, stake: number) {
  const u = await getUser(t, userId)
  if (u.walletBalance.available < stake) throw new AppError('Solde insuffisant')
  await saveUser(t, { ...u, walletBalance: { ...u.walletBalance, available: u.walletBalance.available - stake, pending: u.walletBalance.pending + stake } })
}
const releaseStake = (t: Tx, userId: string, stake: number) =>
  changeBalance(t, userId, (b) => ({ ...b, available: b.available + stake, pending: Math.max(0, b.pending - stake) }))
async function addWinnings(t: Tx, userId: string, stake: number, winnings: number, relatedId: string) {
  await addTx(t, userId, 'win', winnings, `Gain de ${winnings} XOF`, 'completed', relatedId)
  await changeBalance(t, userId, (b) => ({ ...b, pending: Math.max(0, b.pending - stake), withdrawable: b.withdrawable + winnings }))
}
async function deductLoss(t: Tx, userId: string, stake: number, relatedId: string) {
  await addTx(t, userId, 'loss', -stake, `Perte de ${stake} XOF`, 'completed', relatedId)
  await changeBalance(t, userId, (b) => ({ ...b, pending: Math.max(0, b.pending - stake) }))
}
async function payOut(t: Tx, userId: string, amt: number, relatedId: string, label = "Gain attribué par l'arbitre") {
  await addTx(t, userId, 'win', amt, `${label} : ${amt} XOF`, 'completed', relatedId)
  await changeBalance(t, userId, (b) => ({ ...b, withdrawable: b.withdrawable + amt }))
}
async function reverseWinnings(t: Tx, userId: string, amt: number, relatedId: string) {
  await addTx(t, userId, 'loss', -amt, `Annulation de gain (litige) : ${amt} XOF`, 'completed', relatedId)
  await changeBalance(t, userId, (b) => {
    const w = b.withdrawable - amt
    return { ...b, withdrawable: Math.max(0, w), available: w < 0 ? Math.max(0, b.available + w) : b.available }
  })
}
async function refund(t: Tx, userId: string, stake: number, relatedId: string) {
  await addTx(t, userId, 'transfer', stake, `Remboursement de mise : ${stake} XOF`, 'completed', relatedId)
  await changeBalance(t, userId, (b) => ({ ...b, available: b.available + stake }))
}
async function updateStats(t: Tx, userId: string, d: { wins?: number; losses?: number; earned?: number; lost?: number; xp?: number }) {
  const u = await getUser(t, userId)
  const s = {
    ...u.stats,
    wins: u.stats.wins + (d.wins ?? 0), losses: u.stats.losses + (d.losses ?? 0),
    totalEarned: u.stats.totalEarned + (d.earned ?? 0), totalLost: u.stats.totalLost + (d.lost ?? 0),
    xp: u.stats.xp + (d.xp ?? 0),
  }
  if (s.xp >= s.level * 100) s.level++
  await saveUser(t, { ...u, stats: s })
}

// ---------- Défis ----------
const emptyDetails = (): MatchDetails => ({
  duration: 0, creatorReady: false, opponentReady: false, creatorScreenSharing: false, opponentScreenSharing: false,
  videoUrls: [], screenshotUrls: [], reports: {},
})
const withDetails = (c: Challenge, p: Partial<MatchDetails>): MatchDetails => ({ ...emptyDetails(), ...c.matchDetails, ...p })
function matchCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ', N = '23456789'
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  return `KF-${pick(L)}${pick(L)}${pick(N)}${pick(N)}`
}
const isParticipant = (c: Challenge, userId: string) => c.creatorId === userId || c.opponentId === userId
async function getChallenge(t: Tx, id: unknown, lock = true) {
  const c = await t.get<Challenge>('challenges', String(id), lock)
  if (!c) throw new AppError('Défi introuvable')
  return c
}
async function chat(t: Tx, c: Challenge, senderId: string, message: string) {
  return t.put('challenges', { ...c, chatMessages: [...c.chatMessages, { senderId, message, timestamp: now() }] })
}

async function completeChallenge(t: Tx, c: Challenge, winnerId: string) {
  if (!c.opponentId) throw new AppError('Défi incomplet')
  const pot = c.amount * 2
  const winnerAmount = Math.round(pot - pot * COMMISSION_RATE)
  const loserId = winnerId === c.creatorId ? c.opponentId : c.creatorId
  const started = c.matchDetails?.matchStartedAt ? new Date(c.matchDetails.matchStartedAt).getTime() : Date.now()
  const next: Challenge = {
    ...c, status: 'completed', completedAt: now(),
    matchDetails: withDetails(c, { winnerId, paidOut: true, duration: Math.max(1, Math.round((Date.now() - started) / 60000)) }),
  }
  const saved = await t.put('challenges', next)
  await addWinnings(t, winnerId, c.amount, winnerAmount, c.id)
  await updateStats(t, winnerId, { wins: 1, earned: winnerAmount, xp: 50 })
  await deductLoss(t, loserId, c.amount, c.id)
  await updateStats(t, loserId, { losses: 1, lost: c.amount, xp: 10 })
  await notify(t, { userId: winnerId, type: 'match', title: '🏆 Victoire !', message: `Vous avez gagné ${winnerAmount} XOF !`, relatedId: c.id, priority: 'high' })
  await notify(t, { userId: loserId, type: 'match', title: '😔 Défaite', message: `Vous avez perdu ce match. Vous avez ${DISPUTE_WINDOW_MINUTES} minutes pour ouvrir un litige si nécessaire.`, relatedId: c.id, priority: 'high' })
  return saved
}

export const challenge = {
  async create(t: Tx, me: User, a: Record<string, unknown>) {
    const stake = amount(a.amount)
    const type = (['public', 'friends', 'private'] as ChallengeType[]).includes(a.challengeType as ChallengeType) ? a.challengeType as ChallengeType : 'public'
    const hours = [1, 6, 24, 48].includes(Number(a.expirationHours)) ? Number(a.expirationHours) : 24
    let invited: User | undefined
    if (a.invitedUserId) {
      invited = await getUser(t, String(a.invitedUserId), false)
      if (invited.id === me.id) throw new AppError('Vous ne pouvez pas vous défier vous-même')
    }
    await lockStake(t, me.id, stake)
    const c: Challenge = {
      id: uid(), creatorId: me.id, opponentId: null, amount: stake, status: 'pending', invitedUserId: invited?.id ?? null,
      matchType: str(a.matchType, 'Type de match', 40), platform: str(a.platform, 'Plateforme', 20),
      requiredLevel: int(a.requiredLevel ?? 1, 'Niveau', 1, 100), challengeType: invited ? 'private' : type,
      expiresAt: new Date(Date.now() + hours * 3600000).toISOString(), createdAt: now(),
      chatMessages: [], matchDetails: null, dispute: null, completedAt: null,
    }
    if (invited) await notify(t, { userId: invited.id, type: 'challenge', title: '⚔️ Tu es défié !', message: `${me.pseudo} te lance un défi de ${stake} XOF.`, relatedId: c.id, priority: 'high' })
    return t.put('challenges', c)
  },

  async accept(t: Tx, me: User, a: { id: unknown }) {
    const c = await getChallenge(t, a.id)
    if (c.status !== 'pending') throw new AppError("Ce défi n'est plus disponible")
    if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) throw new AppError('Ce défi a expiré')
    if (c.creatorId === me.id) throw new AppError('Vous ne pouvez pas accepter votre propre défi')
    if (!c.invitedUserId && me.stats.level < c.requiredLevel) throw new AppError(`Niveau ${c.requiredLevel} requis`)
    if (c.invitedUserId && c.invitedUserId !== me.id) throw new AppError('Ce défi est réservé à un autre joueur')
    if (c.challengeType === 'friends') {
      const creator = await getUser(t, c.creatorId, false)
      if (!creator.friendIds.includes(me.id) && !me.friendIds.includes(c.creatorId)) throw new AppError('Défi réservé aux amis')
    }
    await lockStake(t, me.id, c.amount)
    const saved = await t.put('challenges', { ...c, opponentId: me.id, status: 'accepted', matchDetails: { ...emptyDetails(), matchCode: matchCode(), acceptedAt: now(), inRoom: [] } })
    await notify(t, { userId: c.creatorId, type: 'challenge', title: '🎮 Défi accepté !', message: `${me.pseudo} a accepté votre défi de ${c.amount} XOF`, relatedId: c.id, priority: 'high' })
    return saved
  },

  async cancel(t: Tx, me: User, a: { id: unknown }) {
    const c = await getChallenge(t, a.id)
    if (c.creatorId !== me.id) throw new AppError('Seul le créateur peut annuler')
    if (c.status !== 'pending') throw new AppError('Ce défi ne peut plus être annulé')
    await t.put('challenges', { ...c, status: 'cancelled' })
    await releaseStake(t, c.creatorId, c.amount)
  },

  async setReady(t: Tx, me: User, a: { id: unknown; ready: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id)) throw new AppError('Accès refusé', 403)
    if (c.status !== 'accepted') throw new AppError('Le match a déjà commencé')
    const ready = a.ready === true
    const next = { ...c, matchDetails: withDetails(c, c.creatorId === me.id ? { creatorReady: ready } : { opponentReady: ready }) }
    return chat(t, next, me.id, ready ? `✅ ${me.pseudo} est prêt !` : `⏸️ ${me.pseudo} n'est plus prêt`)
  },

  async start(t: Tx, me: User, a: { id: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id)) throw new AppError('Accès refusé', 403)
    if (c.status === 'inProgress') return c
    if (c.status !== 'accepted') throw new AppError("Ce match ne peut plus être lancé")
    const saved = await t.put('challenges', { ...c, status: 'inProgress', matchDetails: withDetails(c, { matchStartedAt: now() }) })
    const other = c.creatorId === me.id ? c.opponentId : c.creatorId
    if (other) await notify(t, { userId: other, type: 'match', title: '⚽ Le match a commencé', message: `${me.pseudo} a indiqué que vous jouez. Déclarez le score à la fin.`, relatedId: c.id, priority: 'high' })
    return saved
  },

  /**
   * Avant-match : chaque joueur confirme qu'il est dans la partie eFootball.
   * Quand les deux ont confirmé, le match démarre automatiquement.
   */
  async setInRoom(t: Tx, me: User, a: { id: unknown; inRoom: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id) || !c.opponentId) throw new AppError('Accès refusé', 403)
    if (c.status === 'inProgress') return { state: 'started' as const }
    if (c.status !== 'accepted') throw new AppError('Ce match ne peut plus commencer')
    const room = new Set(c.matchDetails?.inRoom ?? [])
    if (a.inRoom === false) room.delete(me.id)
    else room.add(me.id)
    const other = c.creatorId === me.id ? c.opponentId : c.creatorId
    if (room.has(c.creatorId) && room.has(c.opponentId)) {
      await t.put('challenges', { ...c, status: 'inProgress', matchDetails: withDetails(c, { inRoom: [...room], matchStartedAt: now() }) })
      for (const id of [c.creatorId, c.opponentId]) {
        await notify(t, { userId: id, type: 'match', title: '⚽ Le match a commencé', message: 'Vous êtes tous les deux dans la partie. Bon match ! Déclare le score à la fin.', relatedId: c.id, priority: 'high' })
      }
      return { state: 'started' as const }
    }
    await t.put('challenges', { ...c, matchDetails: withDetails(c, { inRoom: [...room] }) })
    if (a.inRoom !== false) await notify(t, { userId: other, type: 'match', title: '🎮 Ton adversaire est prêt', message: `${me.pseudo} est dans la partie eFootball. Rejoins-le puis confirme dans KickFlow.`, relatedId: c.id, priority: 'high' })
    return { state: 'waiting' as const }
  },

  /** Si le match n'a pas commencé 15 min après l'acceptation, chacun peut annuler et récupérer sa mise. */
  async cancelNoShow(t: Tx, me: User, a: { id: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id) || !c.opponentId) throw new AppError('Accès refusé', 403)
    if (c.status !== 'accepted') throw new AppError('Le match a déjà commencé ou est terminé')
    const since = new Date(c.matchDetails?.acceptedAt ?? c.createdAt).getTime()
    if (Date.now() - since < START_DEADLINE_MINUTES * 60000) throw new AppError(`Attends la fin des ${START_DEADLINE_MINUTES} minutes avant d'annuler`)
    await releaseStake(t, c.creatorId, c.amount)
    await releaseStake(t, c.opponentId, c.amount)
    await t.put('challenges', { ...c, status: 'cancelled', completedAt: now() })
    const other = c.creatorId === me.id ? c.opponentId : c.creatorId
    await notify(t, { userId: other, type: 'match', title: '⌛ Match annulé', message: `Le match n'a pas commencé à temps : ${me.pseudo} l'a annulé. Ta mise de ${c.amount} XOF t'est rendue.`, relatedId: c.id })
    await notify(t, { userId: me.id, type: 'match', title: '⌛ Match annulé', message: `Ta mise de ${c.amount} XOF t'est rendue.`, relatedId: c.id })
  },

  /** Code de salle eFootball partagé entre les deux joueurs. */
  async setRoomCode(t: Tx, me: User, a: { id: unknown; code: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id)) throw new AppError('Accès refusé', 403)
    if (c.status !== 'accepted' && c.status !== 'inProgress') throw new AppError('Le match est terminé')
    const code = typeof a.code === 'string' ? a.code.trim().slice(0, 40) : ''
    const saved = await t.put('challenges', { ...c, matchDetails: withDetails(c, { roomCode: code || null }) })
    const other = c.creatorId === me.id ? c.opponentId : c.creatorId
    if (other && code) await notify(t, { userId: other, type: 'match', title: '🔑 Code de salle', message: `${me.pseudo} a partagé le code de salle : ${code}`, relatedId: c.id, priority: 'high' })
    return saved
  },

  async addScreenshot(t: Tx, me: User, a: { id: unknown; url: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id)) throw new AppError('Accès refusé', 403)
    const url = str(a.url, 'Image', 200)
    if (!url.startsWith('/api/images/')) throw new AppError('Image invalide')
    return t.put('challenges', { ...c, matchDetails: withDetails(c, { screenshotUrls: [...(c.matchDetails?.screenshotUrls ?? []), url] }) })
  },

  async sendMessage(t: Tx, me: User, a: { id: unknown; message: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id) && !me.isAdmin) throw new AppError('Accès refusé', 403)
    return chat(t, c, me.id, str(a.message, 'Message', 500))
  },

  async reportScore(t: Tx, me: User, a: { id: unknown; creatorScore: unknown; opponentScore: unknown; screenshot?: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id) || !c.opponentId) throw new AppError('Accès refusé', 403)
    if (c.status !== 'inProgress') throw new AppError("Le match n'est pas en cours")
    const cs = int(a.creatorScore, 'Score'), os = int(a.opponentScore, 'Score')
    const shot = typeof a.screenshot === 'string' && a.screenshot.startsWith('/api/images/') ? a.screenshot : null
    const reports = { ...(c.matchDetails?.reports ?? {}), [me.id]: { creatorScore: cs, opponentScore: os, screenshot: shot, at: now() } }
    let cur = await t.put('challenges', { ...c, matchDetails: withDetails(c, { reports }) })

    const r1 = reports[c.creatorId], r2 = reports[c.opponentId]
    if (!r1 || !r2) {
      const other = me.id === c.creatorId ? c.opponentId : c.creatorId
      await notify(t, { userId: other, type: 'match', title: '📝 Score déclaré', message: `${me.pseudo} a déclaré ${cs} - ${os}. Confirmez le résultat.`, relatedId: c.id, priority: 'high' })
      return { state: 'waiting' as const }
    }
    if (r1.creatorScore !== r2.creatorScore || r1.opponentScore !== r2.opponentScore) {
      await t.put('challenges', {
        ...cur, status: 'disputed',
        dispute: { initiatorId: me.id, reason: `Scores déclarés différents (${r1.creatorScore}-${r1.opponentScore} contre ${r2.creatorScore}-${r2.opponentScore})`, timestamp: now(), proofUrls: [r1.screenshot, r2.screenshot].filter((x): x is string => !!x) },
        matchDetails: withDetails(cur, { matchEndedAt: now() }),
      })
      for (const id of [c.creatorId, c.opponentId]) {
        await notify(t, { userId: id, type: 'dispute', title: '⚖️ Litige ouvert', message: 'Les scores déclarés ne concordent pas. Un arbitre va examiner les preuves.', relatedId: c.id, priority: 'urgent' })
      }
      return { state: 'disputed' as const }
    }
    if (r1.creatorScore === r1.opponentScore) {
      await t.put('challenges', { ...cur, matchDetails: withDetails(cur, {
        reports: {},
        lastDraw: { creatorScore: r1.creatorScore, opponentScore: r1.opponentScore, at: now() },
        drawCount: (cur.matchDetails?.drawCount ?? 0) + 1,
      }) })
      for (const id of [c.creatorId, c.opponentId]) {
        await notify(t, { userId: id, type: 'match', title: '🤝 Match nul', message: 'Rejouez une manche décisive puis déclarez à nouveau le score.', relatedId: c.id, priority: 'high' })
      }
      return { state: 'draw' as const }
    }
    const winnerId = r1.creatorScore > r1.opponentScore ? c.creatorId : c.opponentId
    cur = {
      ...cur, matchDetails: withDetails(cur, {
        creatorScore: String(r1.creatorScore), opponentScore: String(r1.opponentScore), matchEndedAt: now(),
        scoreDetectionInfo: { method: 'Déclaration des deux joueurs', confidence: 1, detectedAt: now(), wasManuallyEntered: true },
      }),
    }
    await completeChallenge(t, cur, winnerId)
    return { state: 'completed' as const }
  },

  async openDispute(t: Tx, me: User, a: { id: unknown; reason: unknown; proofUrls?: unknown }) {
    const c = await getChallenge(t, a.id)
    if (!isParticipant(c, me.id)) throw new AppError('Accès refusé', 403)
    const minutes = c.completedAt ? (Date.now() - new Date(c.completedAt).getTime()) / 60000 : Infinity
    if (c.status !== 'completed' || c.dispute || minutes > DISPUTE_WINDOW_MINUTES) throw new AppError('Le délai pour contester ce match est dépassé')
    const proofs = Array.isArray(a.proofUrls) ? a.proofUrls.filter((u): u is string => typeof u === 'string' && u.startsWith('/api/images/')).slice(0, 5) : []
    await t.put('challenges', { ...c, status: 'disputed', dispute: { initiatorId: me.id, reason: str(a.reason, 'Raison', 500), timestamp: now(), proofUrls: [...proofs, ...(c.matchDetails?.screenshotUrls ?? [])] } })
    const other = me.id === c.creatorId ? c.opponentId : c.creatorId
    if (other) await notify(t, { userId: other, type: 'dispute', title: '⚖️ Litige ouvert', message: `${me.pseudo} conteste le résultat du match.`, relatedId: c.id, priority: 'urgent' })
  },

  /** Décision de l'arbitre : winnerId = gagnant, ou null = match annulé et mises remboursées. */
  async resolveDispute(t: Tx, me: User, a: { id: unknown; winnerId: unknown; resolution: unknown; note?: unknown }) {
    if (!me.isAdmin) throw new AppError('Réservé aux arbitres', 403)
    let c = await getChallenge(t, a.id)
    if (!c.dispute || c.dispute.resolvedAt || !c.opponentId) throw new AppError('Aucun litige en cours sur ce défi')
    const winnerId = a.winnerId === null ? null : String(a.winnerId)
    if (winnerId !== null && !isParticipant(c, winnerId)) throw new AppError('Gagnant invalide')
    const resolution = str(a.resolution, 'Décision', 300)
    const paid = !!c.matchDetails?.paidOut
    const prev = c.matchDetails?.winnerId ?? null
    const winnerAmount = Math.round(c.amount * 2 * (1 - COMMISSION_RATE))

    if (paid && prev && prev !== winnerId) {
      const prevLoser = prev === c.creatorId ? c.opponentId : c.creatorId
      await reverseWinnings(t, prev, winnerAmount, c.id)
      await updateStats(t, prev, { wins: -1, earned: -winnerAmount })
      await updateStats(t, prevLoser, { losses: -1, lost: -c.amount })
      if (winnerId === null) {
        await refund(t, c.creatorId, c.amount, c.id)
        await refund(t, c.opponentId, c.amount, c.id)
      } else {
        await payOut(t, winnerId, winnerAmount, c.id)
        await updateStats(t, winnerId, { wins: 1, earned: winnerAmount })
        await updateStats(t, prev, { losses: 1, lost: c.amount })
      }
    } else if (!paid) {
      if (winnerId === null) {
        await releaseStake(t, c.creatorId, c.amount)
        await releaseStake(t, c.opponentId, c.amount)
      } else {
        c = await completeChallenge(t, c, winnerId)
      }
    }
    await t.put('challenges', {
      ...c, status: winnerId === null ? 'cancelled' : 'completed', completedAt: c.completedAt ?? now(),
      dispute: { ...c.dispute!, resolvedAt: now(), resolution, adminNote: typeof a.note === 'string' ? a.note.slice(0, 500) : null },
      matchDetails: withDetails(c, { winnerId, paidOut: winnerId !== null }),
    })
    const winnerName = await pseudo(t, winnerId)
    for (const id of [c.creatorId, c.opponentId!]) {
      await notify(t, { userId: id, type: 'dispute', title: '⚖️ Litige résolu', message: `${resolution}${winnerId ? ` — Gagnant : ${winnerName}` : ' — Mises remboursées'}`, relatedId: c.id, priority: 'high' })
    }
  },
}

/**
 * Annulation d'un commun accord : quand les deux joueurs l'ont demandée, le match est annulé
 * et chacun récupère sa mise (y compris après un résultat déjà versé, en cas de litige).
 */
export async function agreeCancel(t: Tx, me: User, a: { id: unknown; withdraw?: unknown }) {
  const c = await getChallenge(t, a.id)
  if (!isParticipant(c, me.id) || !c.opponentId) throw new AppError('Accès refusé', 403)
  const open = c.status === 'accepted' || c.status === 'inProgress' || (c.status === 'disputed' && !c.dispute?.resolvedAt)
  if (!open) throw new AppError('Ce match ne peut plus être annulé')
  const votes = new Set(c.matchDetails?.cancelVotes ?? [])
  if (a.withdraw === true) votes.delete(me.id)
  else votes.add(me.id)
  const other = c.creatorId === me.id ? c.opponentId : c.creatorId
  if (!(votes.has(c.creatorId) && votes.has(c.opponentId))) {
    const saved = await t.put('challenges', { ...c, matchDetails: withDetails(c, { cancelVotes: [...votes] }) })
    if (a.withdraw !== true) await notify(t, { userId: other, type: 'match', title: "🤝 Demande d'annulation", message: `${me.pseudo} propose d'annuler le match et de récupérer chacun sa mise.`, relatedId: c.id, priority: 'high' })
    return { state: 'waiting' as const, challenge: saved }
  }
  // Les deux sont d'accord : on rend les mises
  const paid = !!c.matchDetails?.paidOut
  const prev = c.matchDetails?.winnerId ?? null
  if (paid && prev) {
    const winnerAmount = Math.round(c.amount * 2 * (1 - COMMISSION_RATE))
    const prevLoser = prev === c.creatorId ? c.opponentId : c.creatorId
    await reverseWinnings(t, prev, winnerAmount, c.id)
    await updateStats(t, prev, { wins: -1, earned: -winnerAmount })
    await updateStats(t, prevLoser, { losses: -1, lost: -c.amount })
    await refund(t, c.creatorId, c.amount, c.id)
    await refund(t, c.opponentId, c.amount, c.id)
  } else {
    await releaseStake(t, c.creatorId, c.amount)
    await releaseStake(t, c.opponentId, c.amount)
  }
  const resolution = "Match annulé d'un commun accord"
  await t.put('challenges', {
    ...c, status: 'cancelled', completedAt: c.completedAt ?? now(),
    dispute: c.dispute ? { ...c.dispute, resolvedAt: now(), resolution } : null,
    matchDetails: withDetails(c, { cancelVotes: [...votes], winnerId: null, paidOut: false }),
  })
  for (const id of [c.creatorId, c.opponentId]) {
    await notify(t, { userId: id, type: 'match', title: '🤝 Match annulé', message: `${resolution} : ta mise de ${c.amount} XOF t'est rendue.`, relatedId: c.id })
  }
  return { state: 'cancelled' as const }
}

/** Annule les défis en attente expirés et rend la mise (tâche périodique). */
export async function expirePendingChallenges(t: Tx) {
  const list = await t.list<Challenge>('challenges')
  for (const c of list) {
    if (c.status === 'pending' && c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) {
      const locked = await t.get<Challenge>('challenges', c.id, true)
      if (locked?.status !== 'pending') continue
      await t.put('challenges', { ...locked, status: 'cancelled' })
      await releaseStake(t, c.creatorId, c.amount)
      await notify(t, { userId: c.creatorId, type: 'challenge', title: '⌛ Défi expiré', message: `Personne n'a accepté votre défi de ${c.amount} XOF. Votre mise est rendue.`, relatedId: c.id })
    }
  }
}

// ---------- Joueurs / amis ----------
export const user = {
  async updateProfile(t: Tx, me: User, a: Record<string, unknown>) {
    const u = await getUser(t, me.id)
    const phone = a.phone === undefined ? u.phone : str(a.phone, 'Téléphone', 30)
    if (!/^\+?[\d\s\-()]+$/.test(phone) && phone) throw new AppError('Format de téléphone invalide')
    const photo = a.profilePhoto === undefined ? u.profilePhoto : a.profilePhoto === null ? null : str(a.profilePhoto, 'Photo', 200)
    if (photo && !photo.startsWith('/api/images/')) throw new AppError('Photo invalide')
    return saveUser(t, {
      ...u,
      pseudo: a.pseudo === undefined ? u.pseudo : str(a.pseudo, 'Pseudo', 30),
      country: a.country === undefined ? u.country : str(a.country, 'Pays', 60),
      phone, profilePhoto: photo,
      efootballId: a.efootballId === undefined ? u.efootballId : (typeof a.efootballId === 'string' ? a.efootballId.trim().slice(0, 40) : ''),
    })
  },
  async addFriend(t: Tx, me: User, a: { friendId: unknown }) {
    const fid = String(a.friendId)
    if (fid === me.id) throw new AppError('Vous ne pouvez pas vous ajouter vous-même')
    const friend = await getUser(t, fid, false)
    const u = await getUser(t, me.id)
    if (!u.friendIds.includes(fid)) await saveUser(t, { ...u, friendIds: [...u.friendIds, fid] })
    await notify(t, { userId: friend.id, type: 'social', title: '👋 Nouvel ami', message: `${me.pseudo} vous a ajouté en ami.`, relatedId: me.id })
  },
  async removeFriend(t: Tx, me: User, a: { friendId: unknown }) {
    const u = await getUser(t, me.id)
    await saveUser(t, { ...u, friendIds: u.friendIds.filter((f) => f !== String(a.friendId)) })
  },
}

// ---------- Notifications ----------
export const notification = {
  async markRead(t: Tx, me: User, a: { id: unknown }) {
    const n = await t.get<AppNotification>('notifications', String(a.id), true)
    if (n && n.userId === me.id) await t.put('notifications', { ...n, isRead: true })
  },
  async markAllRead(t: Tx, me: User) {
    for (const n of await t.list<AppNotification>('notifications', me.id)) if (!n.isRead) await t.put('notifications', { ...n, isRead: true })
  },
  async remove(t: Tx, me: User, a: { id: unknown }) {
    const n = await t.get<AppNotification>('notifications', String(a.id), true)
    if (n && n.userId === me.id) await t.remove('notifications', n.id)
  },
}

// ---------- Tournois ----------
function pairUp(players: string[], round: number): TournamentMatch[] {
  const out: TournamentMatch[] = []
  for (let i = 0; i < players.length; i += 2) {
    const p2 = players[i + 1] ?? ''
    out.push({ id: uid(), player1Id: players[i], player2Id: p2, round, matchNumber: i / 2 + 1, bracketType: 'winner', winnerId: p2 ? null : players[i], player1Score: null, player2Score: null, scheduledAt: null })
  }
  return out
}
async function getTournament(t: Tx, id: unknown) {
  const x = await t.get<Tournament>('tournaments', String(id), true)
  if (!x) throw new AppError('Tournoi introuvable')
  return x
}
async function advance(t: Tx, tour: Tournament): Promise<Tournament> {
  const round = Math.max(...tour.matches.map((m) => m.round))
  const current = tour.matches.filter((m) => m.round === round)
  if (current.some((m) => !m.winnerId)) return t.put('tournaments', tour)
  const winners = current.map((m) => m.winnerId!)
  if (winners.length > 1) return advance(t, { ...tour, matches: [...tour.matches, ...pairUp(winners, round + 1)] })
  const champion = winners[0]
  const final = current[0]
  const runnerUp = final.player1Id === champion ? final.player2Id : final.player1Id
  const third = tour.matches.filter((m) => m.round === round - 1 && m.winnerId)
    .map((m) => (m.winnerId === m.player1Id ? m.player2Id : m.player1Id)).find((p) => p && p !== champion && p !== runnerUp)
  const top3 = [champion, runnerUp, third].filter((x): x is string => !!x)
  const pool = tour.entryFee * tour.participants.length * 0.8
  const prizes = [pool * 0.6, pool * 0.25, pool * 0.15].map(Math.round)
  for (const p of tour.participants) if (tour.entryFee > 0) await deductLoss(t, p, tour.entryFee, tour.id)
  for (let i = 0; i < top3.length; i++) if (prizes[i] > 0) await payOut(t, top3[i], prizes[i], tour.id, `Prix du tournoi (${i + 1}e)`)
  for (const p of tour.participants) await notify(t, { userId: p, type: 'tournament', title: '🏁 Tournoi terminé', message: `${tour.name} est terminé !`, relatedId: tour.id })
  return t.put('tournaments', { ...tour, status: 'completed', winnerId: champion, top3, endDate: now() })
}

export const tournament = {
  async create(t: Tx, me: User, a: Record<string, unknown>) {
    const type: TournamentType = a.type === 'doubleElimination' ? 'doubleElimination' : 'singleElimination'
    const start = new Date(String(a.startDate))
    if (Number.isNaN(start.getTime())) throw new AppError('Date invalide')
    const doc: Tournament = {
      id: uid(), name: str(a.name, 'Nom', 80), description: typeof a.description === 'string' ? a.description.slice(0, 500) : '',
      entryFee: amount(a.entryFee, "Frais d'inscription", true), maxPlayers: [4, 8, 16, 32].includes(Number(a.maxPlayers)) ? Number(a.maxPlayers) : 8,
      participants: [], status: 'registration', type, scores: {}, matches: [], winnerId: null, top3: null,
      startDate: start.toISOString(), endDate: null, createdAt: now(), createdBy: me.id,
    }
    return t.put('tournaments', doc)
  },
  async join(t: Tx, me: User, a: { id: unknown }) {
    const tour = await getTournament(t, a.id)
    if (tour.status !== 'registration') throw new AppError('Inscriptions fermées')
    if (tour.participants.includes(me.id)) throw new AppError('Déjà inscrit')
    if (tour.participants.length >= tour.maxPlayers) throw new AppError('Tournoi complet')
    if (tour.entryFee > 0) await lockStake(t, me.id, tour.entryFee)
    return t.put('tournaments', { ...tour, participants: [...tour.participants, me.id] })
  },
  async start(t: Tx, me: User, a: { id: unknown }) {
    const tour = await getTournament(t, a.id)
    if (tour.createdBy !== me.id && !me.isAdmin) throw new AppError("Seul l'organisateur peut lancer le tournoi", 403)
    if (tour.status !== 'registration' || tour.participants.length < 2) throw new AppError('Il faut au moins 2 joueurs')
    const shuffled = [...tour.participants].sort(() => Math.random() - 0.5)
    const saved = await advance(t, { ...tour, status: 'ongoing', matches: pairUp(shuffled, 1) })
    for (const p of tour.participants) await notify(t, { userId: p, type: 'tournament', title: '🏆 Tournoi lancé !', message: `${tour.name} commence. Consultez le bracket.`, relatedId: tour.id })
    return saved
  },
  async report(t: Tx, me: User, a: { id: unknown; matchId: unknown; s1: unknown; s2: unknown }) {
    const tour = await getTournament(t, a.id)
    const m = tour.matches.find((x) => x.id === String(a.matchId))
    if (!m || m.winnerId || tour.status !== 'ongoing') throw new AppError('Match introuvable')
    if (tour.createdBy !== me.id && !me.isAdmin && m.player1Id !== me.id && m.player2Id !== me.id) throw new AppError('Accès refusé', 403)
    const s1 = int(a.s1, 'Score'), s2 = int(a.s2, 'Score')
    if (s1 === s2) throw new AppError('Il faut un vainqueur')
    const winnerId = s1 > s2 ? m.player1Id : m.player2Id
    return advance(t, { ...tour, matches: tour.matches.map((x) => (x.id === m.id ? { ...x, player1Score: s1, player2Score: s2, winnerId } : x)) })
  },
}

// ---------- Streaming ----------
async function getStream(t: Tx, id: unknown) {
  const s = await t.get<Stream>('streams', String(id), true)
  if (!s) throw new AppError('Stream introuvable')
  return s
}
export const stream = {
  /** Publie un live : lien TikTok / YouTube / Facebook / Twitch. */
  async start(t: Tx, me: User, a: { url: unknown; title?: unknown; challengeId?: unknown }) {
    const raw = str(a.url, 'Lien du live', 300)
    let url: URL
    try { url = new URL(raw) } catch { throw new AppError('Lien invalide') }
    if (url.protocol !== 'https:') throw new AppError('Le lien doit commencer par https://')
    let challengeId = ''
    if (a.challengeId) {
      const c = await getChallenge(t, a.challengeId, false)
      if (!isParticipant(c, me.id)) throw new AppError('Vous ne participez pas à ce défi', 403)
      challengeId = c.id
    }
    for (const s of (await t.list<Stream>('streams')).filter((x) => x.status === 'live' && x.streamerId === me.id)) {
      await t.put('streams', { ...s, status: 'ended' })
    }
    const title = typeof a.title === 'string' && a.title.trim() ? a.title.trim().slice(0, 80) : `Live de ${me.pseudo}`
    return t.put('streams', { id: uid(), streamerId: me.id, challengeId, url: url.toString(), title, viewCount: 0, status: 'live', chatMessages: [], tips: [], duration: 0, quality: 'auto', createdAt: now() } as Stream)
  },
  async end(t: Tx, me: User, a: { id: unknown }) {
    const s = await getStream(t, a.id)
    if (s.streamerId !== me.id) throw new AppError('Accès refusé', 403)
    return t.put('streams', { ...s, status: 'ended' })
  },
  async join(t: Tx, _me: User, a: { id: unknown }) {
    const s = await getStream(t, a.id)
    return t.put('streams', { ...s, viewCount: s.viewCount + 1 })
  },
  async leave(t: Tx, _me: User, a: { id: unknown }) {
    const s = await getStream(t, a.id)
    return t.put('streams', { ...s, viewCount: Math.max(0, s.viewCount - 1) })
  },
  async chat(t: Tx, me: User, a: { id: unknown; message: unknown }) {
    const s = await getStream(t, a.id)
    return t.put('streams', { ...s, chatMessages: [...s.chatMessages, { senderId: me.id, message: str(a.message, 'Message', 300), timestamp: now() }] })
  },
  async tip(t: Tx, me: User, a: { id: unknown; amount: unknown; message?: unknown }) {
    const s = await getStream(t, a.id)
    const n = amount(a.amount)
    if (s.streamerId === me.id) throw new AppError('Vous ne pouvez pas vous envoyer un tip')
    const from = await getUser(t, me.id)
    if (from.walletBalance.available < n) throw new AppError('Solde insuffisant')
    const to = await getUser(t, s.streamerId)
    await saveUser(t, { ...from, walletBalance: { ...from.walletBalance, available: from.walletBalance.available - n } })
    await saveUser(t, { ...to, walletBalance: { ...to.walletBalance, available: to.walletBalance.available + n } })
    await addTx(t, from.id, 'transfer', -n, `Tip à ${to.pseudo}`, 'completed', to.id)
    await addTx(t, to.id, 'transfer', n, `Tip de ${from.pseudo}`, 'completed', from.id)
    const message = typeof a.message === 'string' && a.message.trim() ? a.message.trim().slice(0, 200) : null
    return t.put('streams', { ...s, tips: [...s.tips, { id: uid(), senderId: me.id, amount: n, message, timestamp: now() }] })
  },
}
