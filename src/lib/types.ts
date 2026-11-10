// Modèles de données — transposés de lib/models/*.dart (KickFlow Flutter).
// Les dates sont stockées en chaînes ISO, comme dans les toJson() d'origine.

export interface UserStats {
  wins: number
  losses: number
  totalEarned: number
  totalLost: number
  level: number
  xp: number
}

export interface WalletBalance {
  available: number
  pending: number
  withdrawable: number
}

export interface User {
  id: string
  username: string
  email: string
  phone: string
  country: string
  birthDate: string
  pseudo: string
  profilePhoto?: string | null
  referralCode: string
  referredBy?: string | null
  stats: UserStats
  walletBalance: WalletBalance
  friendIds: string[]
  badges: string[]
  createdAt: string
  updatedAt: string
  /** Rôle arbitre/admin (pour l'écran des litiges). */
  isAdmin?: boolean
  /** Identifiant du joueur dans eFootball, pour s'ajouter en ami. */
  efootballId?: string
}

export type ChallengeStatus = 'pending' | 'accepted' | 'inProgress' | 'completed' | 'cancelled' | 'disputed'
export type ChallengeType = 'public' | 'friends' | 'private'

export interface ChatMessage {
  senderId: string
  message: string
  timestamp: string
}

export interface FraudInfo {
  appSwitchCount: number
  suspicionScore: number
  isInvalidated: boolean
  violations: string[]
  lastViolationAt?: string | null
}

export interface ScoreDetectionInfo {
  method: string
  confidence: number
  detectedAt: string
  wasManuallyEntered: boolean
}

export interface MatchDetails {
  duration: number
  creatorScore?: string | null
  opponentScore?: string | null
  winnerId?: string | null
  streamUrl?: string | null
  matchCode?: string | null
  creatorReady: boolean
  opponentReady: boolean
  creatorScreenSharing: boolean
  opponentScreenSharing: boolean
  matchStartedAt?: string | null
  matchEndedAt?: string | null
  videoUrls: string[]
  screenshotUrls: string[]
  fraudInfo?: FraudInfo | null
  scoreDetectionInfo?: ScoreDetectionInfo | null
  /** Score déclaré par chaque joueur (clé = id du joueur). Validé si les deux concordent. */
  reports?: Record<string, ScoreReport>
  /** Code de salle eFootball partagé par un joueur. */
  roomCode?: string | null
  /** Joueurs ayant demandé l'annulation d'un commun accord. */
  cancelVotes?: string[]
  /** Dernier match nul déclaré par les deux joueurs (il faut rejouer une manche décisive). */
  lastDraw?: { creatorScore: number; opponentScore: number; at: string } | null
  drawCount?: number
  /** Les gains ont déjà été versés (pour pouvoir les annuler en cas de litige). */
  paidOut?: boolean
}

export interface ScoreReport {
  creatorScore: number
  opponentScore: number
  screenshot?: string | null
  at: string
}

export interface DisputeInfo {
  initiatorId: string
  reason: string
  timestamp: string
  resolvedAt?: string | null
  resolution?: string | null
  proofUrls: string[]
  adminNote?: string | null
}

export interface Challenge {
  id: string
  creatorId: string
  opponentId?: string | null
  amount: number
  status: ChallengeStatus
  matchType: string
  platform: string
  requiredLevel: number
  challengeType: ChallengeType
  expiresAt?: string | null
  createdAt: string
  chatMessages: ChatMessage[]
  matchDetails?: MatchDetails | null
  dispute?: DisputeInfo | null
  completedAt?: string | null
  /** Défi lancé directement à un joueur (revanche, ami). */
  invitedUserId?: string | null
}

export type TransactionType = 'deposit' | 'withdraw' | 'transfer' | 'win' | 'loss' | 'commission' | 'referralBonus'
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  amount: number
  status: TransactionStatus
  timestamp: string
  relatedId?: string | null
  description?: string | null
}

export type TournamentStatus = 'registration' | 'ongoing' | 'completed'
export type TournamentType = 'singleElimination' | 'doubleElimination'
export type BracketType = 'winner' | 'loser'

export interface TournamentMatch {
  id: string
  player1Id: string
  player2Id: string
  winnerId?: string | null
  round: number
  matchNumber: number
  bracketType: BracketType
  scheduledAt?: string | null
  player1Score?: number | null
  player2Score?: number | null
}

export interface Tournament {
  id: string
  name: string
  description: string
  entryFee: number
  maxPlayers: number
  participants: string[]
  status: TournamentStatus
  type: TournamentType
  scores: Record<string, number>
  matches: TournamentMatch[]
  winnerId?: string | null
  top3?: string[] | null
  startDate: string
  endDate?: string | null
  createdAt: string
  createdBy: string
}

export const tournamentPrizes = (t: Tournament) => {
  const prizePool = t.entryFee * t.participants.length * 0.8
  return { prizePool, first: prizePool * 0.6, second: prizePool * 0.25, third: prizePool * 0.15 }
}

export type NotificationType =
  | 'challenge' | 'match' | 'event' | 'progression' | 'social' | 'wallet'
  | 'streaming' | 'referral' | 'security' | 'support' | 'tournament' | 'dispute'
export type NotificationChannel = 'push' | 'email' | 'sms'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  relatedId?: string | null
  createdAt: string
  channel: NotificationChannel
  priority: NotificationPriority
}

export type AnnouncementType = 'nouveaute' | 'evenement' | 'info' | 'maintenance' | 'miseAJour'

export interface Announcement {
  id: string
  title: string
  description: string
  type: AnnouncementType
  createdAt: string
  imageUrl?: string | null
  isImportant: boolean
  actionLabel?: string | null
  actionRoute?: string | null
  showAsPopup?: boolean
  showAsBanner?: boolean
}

export type EventType = 'tournament' | 'challenge' | 'happyHour'
export type EventStatus = 'upcoming' | 'active' | 'completed' | 'cancelled'

export interface AppEvent {
  id: string
  title: string
  type: EventType
  description: string
  startDate: string
  endDate: string
  entryFee: number
  maxParticipants: number
  rewards: string[]
  participantIds: string[]
  status: EventStatus
  createdAt: string
}

export type ReferralTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface Referral {
  id: string
  referrerId: string
  referredUserId: string
  commission: number
  createdAt: string
  tier: ReferralTier
  lifetimeEarnings: number
}

export type StreamStatus = 'live' | 'ended'
export type StreamQuality = 'auto' | 'hd' | 'sd' | 'low'

export interface Tip {
  id: string
  senderId: string
  amount: number
  message?: string | null
  timestamp: string
}

export interface Stream {
  id: string
  streamerId: string
  challengeId: string
  viewCount: number
  status: StreamStatus
  chatMessages: ChatMessage[]
  tips: Tip[]
  duration: number
  quality: StreamQuality
  createdAt: string
  /** Lien du live (TikTok, YouTube, Facebook…). */
  url?: string
  title?: string
}

export type PollCategory = string

export interface Poll {
  id: string
  title: string
  description: string
  options: string[]
  votes: Record<string, number>
  createdAt: string
  endsAt?: string | null
  creatorId: string
  category: PollCategory
  isActive: boolean
}

export interface Vote {
  id: string
  pollId: string
  userId: string
  selectedOption: string
  createdAt: string
}
