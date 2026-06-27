self.addEventListener('install', event => { console.info('push:sw:install'); self.skipWaiting(); });
self.addEventListener('activate', event => { console.info('push:sw:activate'); event.waitUntil(self.clients.claim()); });
self.addEventListener('push', event => {
  console.info('push:sw:received', { hasData:!!event.data });
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (error) { console.error('push:sw:payload-parse-failed', error); data = { body:event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'YOSO task assigned', {
    body: data.body || 'You have a new task in YOSO.',
    data: data.url || '/',
    tag: data.taskId || data.event || 'yoso-task',
    renotify: true,
    requireInteraction: true
  }));
});
self.addEventListener('notificationclick', event => { console.info('push:sw:notification-click', { url:event.notification.data }); event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data || '/')); });
