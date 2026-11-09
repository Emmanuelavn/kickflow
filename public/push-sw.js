// Notifications KickFlow reçues même quand l'appli est fermée (chargé par le service worker)
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'KickFlow', body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(data.title || 'KickFlow', {
    body: data.body || '',
    icon: '/icons/Icon-192.png',
    badge: '/icons/Icon-192.png',
    data: { url: data.url || '/' },
    tag: data.url || undefined,
    renotify: true,
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus()
        if ('navigate' in w) await w.navigate(url)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
