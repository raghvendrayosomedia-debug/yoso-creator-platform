self.addEventListener('install', event => { console.info('push:sw:install'); self.skipWaiting(); });
self.addEventListener('activate', event => { console.info('push:sw:activate'); event.waitUntil(self.clients.claim()); });
self.addEventListener('push', event => { console.info('push:sw:received', { hasData:!!event.data }); const d = event.data?.json() || {}; event.waitUntil(self.registration.showNotification(d.title || 'YOSO', { body: d.body || 'You have a new update.', data: d.url || '/' })); });
self.addEventListener('notificationclick', event => { console.info('push:sw:notification-click', { url:event.notification.data }); event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data || '/')); });
