// Notifications du joueur (créées par le serveur).
import { db } from '../lib/db'
import { rpc } from '../lib/api'
import type { AppNotification } from '../lib/types'

export const notificationService = {
  list(userId: string): AppNotification[] {
    return db.list('notifications').filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
  },
  getUnreadCount: (userId: string) => db.list('notifications').filter((n) => n.userId === userId && !n.isRead).length,
  markAsRead: (id: string) => rpc('notification.markRead', { id }),
  markAllAsRead: () => rpc('notification.markAllRead'),
  remove: (id: string) => rpc('notification.remove', { id }),
}
