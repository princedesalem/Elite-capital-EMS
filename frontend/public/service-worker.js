// Bumped: 2026-04-24 — force clients to take the latest assets and purge any
// stale Cache Storage entries (fix BOM + question mark rendering).
const SW_VERSION = '2026-04-24-fix-bom-questionmark'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch {}
    await self.clients.claim()
    try {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      clientsList.forEach((client) => {
        try { client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION }) } catch {}
      })
    } catch {}
  })())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = String(payload?.title || 'Nouvelle notification EMS')
  const body = String(payload?.body || '')
  const data = payload?.data || {}

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      data,
      tag: `ems-push-${Date.now()}`,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/rh/notifications'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          return client.navigate(targetUrl)
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return undefined
    })
  )
})
