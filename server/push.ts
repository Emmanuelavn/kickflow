// Notifications sur le téléphone (Web Push), même quand l'appli est fermée.
// Nécessite VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT dans les variables d'environnement.
import webpush from 'web-push'
import { AppError, pool, type PushItem } from './db.ts'

const PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
export const pushEnabled = !!(PUBLIC && PRIVATE)

if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@kickflow.app', PUBLIC, PRIVATE)
else console.warn('⚠️  Notifications push désactivées : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquants.')

export const publicKey = () => PUBLIC

export async function subscribe(userId: string, sub: unknown) {
  const s = sub as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  if (typeof s?.endpoint !== 'string' || !s.endpoint.startsWith('https://') || typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') {
    throw new AppError('Abonnement invalide')
  }
  await pool.query(
    `insert into push_subscriptions (endpoint, user_id, subscription) values ($1, $2, $3)
     on conflict (endpoint) do update set user_id = excluded.user_id, subscription = excluded.subscription`,
    [s.endpoint, userId, JSON.stringify({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } })],
  )
}

export async function unsubscribe(userId: string, endpoint: unknown) {
  await pool.query('delete from push_subscriptions where user_id = $1 and endpoint = $2', [userId, String(endpoint ?? '')])
}

/** Envoie les notifications (sans bloquer la réponse) ; supprime les abonnements expirés. */
export function sendPushes(items: PushItem[]) {
  if (!pushEnabled || !items.length) return
  void (async () => {
    const users = [...new Set(items.map((i) => i.userId))]
    const r = await pool.query('select endpoint, user_id, subscription from push_subscriptions where user_id = any($1::text[])', [users])
    await Promise.all(items.flatMap((item) => r.rows.filter((row) => row.user_id === item.userId).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({ title: item.title, body: item.message, url: item.url }), { TTL: 3600, urgency: 'high' })
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await pool.query('delete from push_subscriptions where endpoint = $1', [row.endpoint]).catch(() => {})
        else console.error('push', code ?? (e as Error).message)
      }
    })))
  })().catch((e) => console.error('push', e))
}
