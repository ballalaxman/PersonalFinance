self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  event.waitUntil(self.registration.showNotification('FINTRACK reminder', {
    body: 'A recurring transaction needs confirmation.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { occurrenceId: data.occurrenceId || null },
    tag: data.occurrenceId ? `recurring-${data.occurrenceId}` : 'recurring-reminder',
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const id = event.notification.data && event.notification.data.occurrenceId
  const target = id ? `/recurring?occurrence=${encodeURIComponent(id)}` : '/recurring'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) { client.navigate(target); return client.focus() }
    }
    return self.clients.openWindow(target)
  }))
})
