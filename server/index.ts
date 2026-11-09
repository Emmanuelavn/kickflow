// Serveur KickFlow : API + temps réel + fichiers de l'appli (un seul service à déployer).
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import compression from 'compression'
import { AppError, migrate, pool, tx, type Tx } from './db.ts'
import { changePassword, deleteAccount, forgotPassword, login, register, resetPassword, verifyToken } from './auth.ts'
import { publicKey, pushEnabled, sendPushes, subscribe, unsubscribe } from './push.ts'
import { challenge, expirePendingChallenges, notification, stream, tournament, user, wallet } from './logic.ts'
import { attachRealtime, broadcast, changesFor } from './realtime.ts'
import { seed } from './seed.ts'
import type { User } from '../src/lib/types.ts'

type Handler = (t: Tx, me: User, args: Record<string, unknown>) => Promise<unknown>
const RPC: Record<string, Handler> = {
  'wallet.deposit': wallet.deposit as Handler,
  'wallet.withdraw': wallet.withdraw as Handler,
  'challenge.create': challenge.create as Handler,
  'challenge.accept': challenge.accept as Handler,
  'challenge.cancel': challenge.cancel as Handler,
  'challenge.setReady': challenge.setReady as Handler,
  'challenge.start': challenge.start as Handler,
  'challenge.addScreenshot': challenge.addScreenshot as Handler,
  'challenge.sendMessage': challenge.sendMessage as Handler,
  'challenge.reportScore': challenge.reportScore as Handler,
  'challenge.setRoomCode': challenge.setRoomCode as Handler,
  'challenge.openDispute': challenge.openDispute as Handler,
  'challenge.resolveDispute': challenge.resolveDispute as Handler,
  'user.updateProfile': user.updateProfile as Handler,
  'user.addFriend': user.addFriend as Handler,
  'user.removeFriend': user.removeFriend as Handler,
  'notification.markRead': notification.markRead as Handler,
  'notification.markAllRead': notification.markAllRead as Handler,
  'notification.remove': notification.remove as Handler,
  'tournament.create': tournament.create as Handler,
  'tournament.join': tournament.join as Handler,
  'tournament.start': tournament.start as Handler,
  'tournament.report': tournament.report as Handler,
  'stream.start': stream.start as Handler,
  'stream.end': stream.end as Handler,
  'stream.join': stream.join as Handler,
  'stream.leave': stream.leave as Handler,
  'stream.chat': stream.chat as Handler,
  'stream.tip': stream.tip as Handler,
  'account.changePassword': changePassword as Handler,
  'account.delete': deleteAccount as Handler,
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)
// Compression gzip : l'appli se charge ~3x plus vite sur réseau mobile
app.use(compression())
// En-têtes de sécurité de base
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Strict-Transport-Security', 'max-age=15552000')
  next()
})
app.use(express.json({ limit: '4mb' }))

// Limite simple anti-abus : 120 requêtes / minute / adresse IP sur l'API
const hits = new Map<string, { n: number; reset: number }>()
app.use('/api', (req, res, next) => {
  const key = req.ip ?? 'x'
  const h = hits.get(key)
  const nowMs = Date.now()
  if (!h || h.reset < nowMs) hits.set(key, { n: 1, reset: nowMs + 60000 })
  else if (++h.n > 120) return res.status(429).json({ error: 'Trop de requêtes, réessayez dans une minute' })
  next()
})

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)

async function currentUser(req: Request): Promise<User> {
  const header = req.headers.authorization ?? ''
  const userId = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : undefined)
  if (!userId) throw new AppError('Session expirée, reconnectez-vous', 401)
  const r = await pool.query(`select d.data from docs d join accounts a on a.user_id = d.id where d.col = 'users' and d.id = $1`, [userId])
  if (!r.rows[0]) throw new AppError('Session expirée, reconnectez-vous', 401)
  return r.rows[0].data as User
}

app.get('/api/health', wrap(async (_req, res) => {
  await pool.query('select 1')
  res.json({ ok: true })
}))

app.post('/api/auth/register', wrap(async (req, res) => {
  const { result, changes, pushes } = await register(req.body ?? {})
  broadcast(changes)
  sendPushes(pushes)
  res.json(result)
}))

app.post('/api/auth/login', wrap(async (req, res) => {
  res.json(await login(req.body ?? {}))
}))

// Mot de passe oublié : limite stricte de 5 demandes / 15 min / adresse IP
const forgotHits = new Map<string, { n: number; reset: number }>()
app.post('/api/auth/forgot', wrap(async (req, res) => {
  const key = req.ip ?? 'x'
  const h = forgotHits.get(key)
  if (!h || h.reset < Date.now()) forgotHits.set(key, { n: 1, reset: Date.now() + 15 * 60000 })
  else if (++h.n > 5) throw new AppError('Trop de demandes, réessayez dans 15 minutes', 429)
  await forgotPassword(req.body ?? {}, `${req.protocol}://${req.get('host')}`)
  res.json({ ok: true })
}))

app.post('/api/auth/reset', wrap(async (req, res) => {
  const { result } = await resetPassword(req.body ?? {})
  res.json(result)
}))

// Notifications sur le téléphone
app.get('/api/push/key', (_req, res) => { res.json({ enabled: pushEnabled, key: publicKey() }) })
app.post('/api/push/subscribe', wrap(async (req, res) => {
  const me = await currentUser(req)
  await subscribe(me.id, req.body?.subscription)
  res.json({ ok: true })
}))
app.post('/api/push/unsubscribe', wrap(async (req, res) => {
  const me = await currentUser(req)
  await unsubscribe(me.id, req.body?.endpoint)
  res.json({ ok: true })
}))

app.get('/api/me', wrap(async (req, res) => {
  res.json({ user: await currentUser(req) })
}))

app.post('/api/rpc/:name', wrap(async (req, res) => {
  const handler = RPC[req.params.name]
  if (!handler) throw new AppError('Action inconnue', 404)
  const me = await currentUser(req)
  const { result, changes, pushes } = await tx((t) => handler(t, me, req.body ?? {}))
  broadcast(changes)
  sendPushes(pushes)
  res.json({ result: result ?? null, changes: changesFor(changes, { userId: me.id, isAdmin: !!me.isAdmin }) })
}))

// Images (captures de score, preuves, photos de profil) — stockées dans PostgreSQL
app.post('/api/images', wrap(async (req, res) => {
  const me = await currentUser(req)
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl ?? ''))
  if (!m) throw new AppError('Image invalide')
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 2_500_000) throw new AppError('Image trop lourde (2,5 Mo max)')
  const id = randomUUID()
  await pool.query('insert into images (id, owner, mime, data) values ($1, $2, $3, $4)', [id, me.id, m[1], buf])
  res.json({ url: `/api/images/${id}` })
}))

app.get('/api/images/:id', wrap(async (req, res) => {
  const r = await pool.query('select mime, data from images where id = $1', [req.params.id])
  if (!r.rows[0]) return res.status(404).end()
  res.setHeader('Content-Type', r.rows[0].mime)
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
  res.end(r.rows[0].data)
}))

app.use('/api', (_req, res) => res.status(404).json({ error: 'Introuvable' }))

// Fichiers de l'appli (dossier dist/ produit par « npm run build »)
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(dist, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (p.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') } }))
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }))

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message })
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Requête invalide' })
  console.error(err)
  res.status(500).json({ error: 'Erreur du serveur, réessayez' })
})

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant')
  await migrate()
  await seed()
  const server = createServer(app)
  attachRealtime(server)
  const port = Number(process.env.PORT ?? 8787)
  server.listen(port, () => console.log(`✅ KickFlow en ligne sur le port ${port}`))
  // Toutes les minutes : les défis en attente expirés sont annulés et la mise rendue
  setInterval(() => {
    tx(expirePendingChallenges).then(({ changes, pushes }) => { broadcast(changes); sendPushes(pushes) }).catch((e) => console.error('expiration', e))
  }, 60000).unref()
}

main().catch((e) => {
  console.error('❌ Démarrage impossible :', e.message)
  process.exit(1)
})
