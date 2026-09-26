// Imported by the Workbox service worker (see vite.config.ts importScripts).
// Payloads come from worker/reminders.ts: { title, body, url, tag }. They never contain amounts.

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }

  const title = typeof data.title === 'string' ? data.title : 'FinTrack reminder'
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/'

  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === 'string' ? data.body : 'Open FinTrack to see what needs attention.',
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    tag: typeof data.tag === 'string' ? data.tag : 'fintrack-reminder',
    data: { url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) {
        client.navigate(target)
        return client.focus()
      }
    }
    return self.clients.openWindow(target)
  }))
})
