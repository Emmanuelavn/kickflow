// Temps réel : chaque téléphone connecté reçoit, par WebSocket, les documents qu'il a le droit de voir,
// puis chaque modification dès qu'elle est enregistrée. Les données privées sont filtrées ici.
import type { IncomingMessage, Server } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { COLLECTIONS, pool, type Change, type Col } from './db.ts'
import { verifyToken } from './auth.ts'
import type { Challenge, User } from '../src/lib/types.ts'

interface Viewer { userId: string; isAdmin: boolean }
const clients = new Map<WebSocket, Viewer>()

/** Version d'un joueur visible par les AUTRES joueurs (sans email, téléphone, solde…). */
function publicUser(u: User): User {
  return {
    ...u, email: '', phone: '', birthDate: '', referralCode: '',
    walletBalance: { available: 0, pending: 0, withdrawable: 0 },
  }
}

/** Version d'un défi visible par quelqu'un qui n'y joue pas (sans chat ni preuves). */
function publicChallenge(c: Challenge): Challenge {
  return {
    ...c, chatMessages: [],
    matchDetails: c.matchDetails ? { ...c.matchDetails, reports: {}, screenshotUrls: [], matchCode: null } : null,
    dispute: c.dispute ? { ...c.dispute, proofUrls: [] } : null,
  }
}

/** Renvoie le document tel que ce joueur peut le voir, ou null s'il ne doit pas le voir. */
export function visible(col: Col, doc: Record<string, unknown>, v: Viewer): Record<string, unknown> | null {
  switch (col) {
    case 'users':
      return doc.id === v.userId ? doc : (publicUser(doc as unknown as User) as unknown as Record<string, unknown>)
    case 'challenges': {
      const c = doc as unknown as Challenge
      return c.creatorId === v.userId || c.opponentId === v.userId || v.isAdmin ? doc : (publicChallenge(c) as unknown as Record<string, unknown>)
    }
    case 'transactions':
    case 'notifications':
      return doc.userId === v.userId ? doc : null
    case 'referrals':
      return doc.referrerId === v.userId ? doc : null
    default:
      return doc
  }
}

export async function snapshotFor(v: Viewer) {
  const r = await pool.query(
    `select col, data from docs where col = any($1::text[]) or owner = $2`,
    [COLLECTIONS.filter((c) => !['transactions', 'notifications', 'referrals'].includes(c)), v.userId],
  )
  const out: Record<string, unknown[]> = Object.fromEntries(COLLECTIONS.map((c) => [c, []]))
  for (const row of r.rows) {
    const d = visible(row.col, row.data, v)
    if (d) out[row.col].push(d)
  }
  return out
}

export function broadcast(changes: Change[]) {
  if (!changes.length) return
  for (const [ws, v] of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue
    // Si le rôle du joueur change (arbitre), on le met à jour
    const self = changes.find((c) => c.col === 'users' && c.id === v.userId && c.doc)
    if (self) v.isAdmin = !!(self.doc as unknown as User).isAdmin
    const batch = changes
      .map((c) => ({ col: c.col, id: c.id, doc: c.doc ? visible(c.col, c.doc, v) : null, deleted: !c.doc }))
      .filter((c) => c.doc || c.deleted)
    if (batch.length) ws.send(JSON.stringify({ type: 'changes', changes: batch }))
  }
}

/** Filtre une liste de changements pour la réponse HTTP d'un joueur. */
export function changesFor(changes: Change[], v: Viewer) {
  return changes
    .map((c) => ({ col: c.col, id: c.id, doc: c.doc ? visible(c.col, c.doc, v) : null, deleted: !c.doc }))
    .filter((c) => c.doc || c.deleted)
}

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', async (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (url.pathname !== '/ws') return socket.destroy()
    const userId = verifyToken(url.searchParams.get('token') ?? undefined)
    if (!userId) return socket.destroy()
    const r = await pool.query(`select data from docs where col = 'users' and id = $1`, [userId]).catch(() => null)
    const me = r?.rows[0]?.data as User | undefined
    if (!me) return socket.destroy()
    wss.handleUpgrade(req, socket, head, async (ws) => {
      const v: Viewer = { userId, isAdmin: !!me.isAdmin }
      clients.set(ws, v)
      ws.on('close', () => clients.delete(ws))
      ws.on('error', () => clients.delete(ws))
      ws.on('message', (m) => { if (String(m) === 'ping') ws.send('pong') })
      try {
        ws.send(JSON.stringify({ type: 'snapshot', data: await snapshotFor(v) }))
      } catch {
        ws.close()
      }
    })
  })
  // Garde les connexions ouvertes derrière les proxys
  setInterval(() => { for (const ws of clients.keys()) if (ws.readyState === WebSocket.OPEN) ws.ping() }, 25000).unref()
}
