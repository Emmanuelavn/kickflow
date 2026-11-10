// Données initiales créées au premier démarrage : annonces et deux tournois d'exemple.
import { randomUUID } from 'node:crypto'
import { tx } from './db.ts'
import type { Announcement, Tournament } from '../src/lib/types.ts'

const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString()

const ANNOUNCEMENTS: Announcement[] = [
  { id: '1', title: '🎮 Bienvenue sur KickFlow !', description: 'Merci de rejoindre la communauté KickFlow ! Défie tes amis, participe à des tournois et grimpe au classement. Prêt à montrer tes skills ?', type: 'nouveaute', createdAt: ago(2), isImportant: true },
  { id: '2', title: '🏆 Tournoi Hebdomadaire', description: 'Le grand tournoi hebdomadaire commence vendredi ! Inscriptions ouvertes dès maintenant. Ne rate pas cette occasion de prouver que tu es le meilleur !', type: 'evenement', createdAt: ago(5), isImportant: true, actionLabel: 'Voir les tournois', actionRoute: '/tournaments' },
  { id: '3', title: '💰 Nouveau système de récompenses', description: 'Gagne des points à chaque match et débloque des badges exclusifs ! Plus tu joues, plus tu progresses.', type: 'nouveaute', createdAt: ago(24), isImportant: false },
  { id: '5', title: '🎁 Parrainage : XOF offerts', description: 'Invite tes amis et gagne des XOF bonus pour chaque ami inscrit ! Ton ami reçoit aussi un bonus de bienvenue.', type: 'info', createdAt: ago(72), isImportant: false, actionLabel: 'Parrainer', actionRoute: '/referral' },
  { id: '6', title: '⚡ Défis Express disponibles', description: 'Nouveaux défis express avec peu de XOF en jeu pour les débutants. Parfait pour commencer !', type: 'nouveaute', createdAt: ago(96), isImportant: false },
]

export async function seed() {
  await tx(async (t) => {
    if ((await t.list('announcements')).length === 0) for (const a of ANNOUNCEMENTS) await t.put('announcements', a)
    if ((await t.list('tournaments')).length === 0) {
      const mk = (name: string, description: string, entryFee: number, maxPlayers: number, type: Tournament['type'], days: number): Tournament => ({
        id: randomUUID(), name, description, entryFee, maxPlayers, participants: [], status: 'registration', type, scores: {}, matches: [],
        winnerId: null, top3: null, startDate: new Date(Date.now() + days * 86400000).toISOString(), endDate: null,
        createdAt: new Date().toISOString(), createdBy: 'system',
      })
      await t.put('tournaments', mk('Tournoi du Weekend 🏆', 'Grand tournoi hebdomadaire avec élimination simple', 50, 16, 'singleElimination', 2))
      await t.put('tournaments', mk('Challenge Hebdomadaire ⚽', 'Tournoi rapide avec double élimination', 20, 8, 'doubleElimination', 5))
    }
  })
}
