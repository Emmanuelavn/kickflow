// Annonces : publiées par le serveur (server/seed.ts). Lues / popups vus / bannières fermées : propres à chaque appareil.
import { db, kv } from '../lib/db'
import type { Announcement, AnnouncementType } from '../lib/types'

export const ANNOUNCEMENT_TYPE: Record<AnnouncementType, { label: string; emoji: string; color: string }> = {
  nouveaute: { label: 'Nouveauté', emoji: '🆕', color: '#00E5FF' },
  evenement: { label: 'Événement', emoji: '🎉', color: '#FF006E' },
  info: { label: 'Info', emoji: 'ℹ️', color: '#2196F3' },
  maintenance: { label: 'Maintenance', emoji: '🔧', color: '#FF9800' },
  miseAJour: { label: 'Mise à jour', emoji: '⚡', color: '#4CAF50' },
}

const getSet = (k: string) => new Set(kv.get<string[]>(k, []))
const addToSet = (k: string, id: string) => kv.set(k, [...getSet(k), id])

export const announcementService = {
  getAll(): Announcement[] {
    return [...db.list('announcements')].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  isRead: (id: string) => getSet('read_announcements').has(id),
  getUnreadCount() {
    const read = getSet('read_announcements')
    return db.list('announcements').filter((a) => !read.has(a.id)).length
  },
  markAsRead: (id: string) => addToSet('read_announcements', id),
  markAllAsRead: () => kv.set('read_announcements', db.list('announcements').map((a) => a.id)),

  getNextPopup(): Announcement | null {
    const shown = getSet('shown_popups')
    return this.getAll().find((a) => a.isImportant && !shown.has(a.id)) ?? null
  },
  markPopupAsShown: (id: string) => addToSet('shown_popups', id),

  getActiveBanner(): Announcement | null {
    const dismissed = getSet('dismissed_banners')
    return this.getAll().find((a) =>
      (a.type === 'maintenance' || a.type === 'evenement') && a.isImportant && !dismissed.has(a.id)) ?? null
  },
  dismissBanner: (id: string) => addToSet('dismissed_banners', id),
}
