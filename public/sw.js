const CACHE = 'wins-v3'
const ASSETS = ['/', '/dashboard', '/icon-192.svg', '/icon-512.svg']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = req.url

  // Selalu fresh: API, Next data, manifest
  if (url.includes('/api/') || url.includes('/_next/data/') || url.includes('manifest')) {
    e.respondWith(fetch(req).catch(() => caches.match(req)))
    return
  }

  // Halaman / navigasi (HTML) -> NETWORK-FIRST supaya deploy baru langsung kebaca,
  // fallback ke cache cuma kalau offline.
  const accept = req.headers.get('accept') || ''
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{})
        return res
      }).catch(() => caches.match(req).then(c => c || caches.match('/dashboard')))
    )
    return
  }

  // Aset statik hashed (_next/static, ikon, dll) -> cache-first (nama file ada hash-nya, aman)
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.status === 200 && url.startsWith('http')) {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{})
      }
      return res
    }).catch(() => caches.match('/dashboard')))
  )
})

// ── Web Push: show a notification when the server sends one (Quick Note reminders) ──
self.addEventListener('push', e => {
  let data = { title: 'WinS', body: 'Kamu punya pengingat baru', url: '/dashboard' }
  try { if (e.data) data = { ...data, ...e.data.json() } } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: data.tag || 'wins-notif',
      data: { url: data.url || '/dashboard' },
    })
  )
})

// Clicking the notification focuses an existing tab if open, else opens a new one
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/dashboard'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      for (const c of clientsArr) {
        if (c.url.includes(self.location.origin) && 'focus' in c) { c.navigate(url); return c.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
