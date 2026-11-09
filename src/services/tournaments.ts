// Tournois : lecture depuis le cache, actions exécutées par le serveur.
import { db } from '../lib/db'
import { rpc } from '../lib/api'
import type { Tournament, TournamentType } from '../lib/types'

export const TOURNAMENT_STATUS = {
  registration: { label: 'Inscriptions ouvertes', color: 'var(--success)' },
  ongoing: { label: 'En cours', color: 'var(--orange)' },
  completed: { label: 'Terminé', color: 'var(--text-grey)' },
} as const

export function roundName(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round
  if (fromEnd === 0) return 'Finale'
  if (fromEnd === 1) return 'Demi-finale'
  if (fromEnd === 2) return 'Quart de finale'
  return `Round ${round}`
}

export const tournamentService = {
  list: (): Tournament[] => [...db.list('tournaments')].sort((a, b) => b.startDate.localeCompare(a.startDate)),
  get: (id: string) => db.get('tournaments', id),
  create: (p: { name: string; description: string; entryFee: number; maxPlayers: number; type: TournamentType; startDate: string }) =>
    rpc<Tournament>('tournament.create', p),
  join: (id: string) => rpc('tournament.join', { id }),
  start: (id: string) => rpc('tournament.start', { id }),
  report: (id: string, matchId: string, s1: number, s2: number) => rpc('tournament.report', { id, matchId, s1, s2 }),
}
