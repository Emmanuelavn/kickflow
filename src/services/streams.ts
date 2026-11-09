// Lives : les joueurs diffusent sur TikTok / YouTube / Facebook et partagent le lien ici.
import { db } from '../lib/db'
import { rpc } from '../lib/api'
import type { Stream } from '../lib/types'

export const streamService = {
  live: (): Stream[] => db.list('streams').filter((s) => s.status === 'live' && !!s.url).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  publish: (url: string, title?: string, challengeId?: string) => rpc<Stream>('stream.start', { url, title, challengeId }),
  end: (id: string) => rpc('stream.end', { id }),
}

export function platformOf(url?: string) {
  if (!url) return 'Live'
  if (/tiktok\./i.test(url)) return 'TikTok'
  if (/youtu\.?be/i.test(url)) return 'YouTube'
  if (/facebook\.|fb\./i.test(url)) return 'Facebook'
  if (/twitch\./i.test(url)) return 'Twitch'
  return 'Live'
}
