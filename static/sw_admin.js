// CrickNova Mobile Admin Service Worker with Private Lock-Screen Push Notifications
const CACHE_NAME = 'cricknova-admin-v1';
const ASSETS_TO_CACHE = [
  '/admin/mobile',
  '/static/css/style.css',
  '/static/images/admin_icon_192.png',
  '/static/manifest_admin.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Generic, private lock-screen push notification handler
// Complies strictly with security policy: NO UTRs, NO customer names, NO bank details on lock screen
self.addEventListener('push', (event) => {
  let title = 'New deposit request';
  let options = {
    body: 'New deposit waiting for verification. Open admin app to review.',
    icon: '/static/images/admin_icon_192.png',
    badge: '/static/images/admin_icon_192.png',
    vibrate: [200, 100, 200],
    tag: 'admin-deposit-alert',
    renotify: true,
    requireInteraction: true,
    data: {
      url: '/admin/mobile'
    }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.title) title = payload.title;
      if (payload.body) options.body = payload.body;
      if (payload.url) options.data.url = payload.url;
    } catch (e) {
      // Keep generic text if non-json
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Message listener from foreground or WebSocket
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title || 'New deposit request', {
      body: event.data.body || 'New deposit waiting for verification. Open admin to review.',
      icon: '/static/images/admin_icon_192.png',
      badge: '/static/images/admin_icon_192.png',
      vibrate: [200, 100, 200],
      tag: 'admin-deposit-alert',
      data: { url: '/admin/mobile' }
    });
  }
});

// Open admin PWA on notification tap
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/admin/mobile';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
