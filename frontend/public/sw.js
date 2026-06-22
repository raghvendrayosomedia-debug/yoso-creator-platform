self.addEventListener('push', event => { const d = event.data?.json() || {}; event.waitUntil(self.registration.showNotification(d.title || 'YOSO', { body: d.body || 'You have a new update.', data: d.url })); });
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data || '/')); });
