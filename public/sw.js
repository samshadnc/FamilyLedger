// FamilyLedger Service Worker — handles weekly backup reminder notifications

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'backup-reminder') {
    event.waitUntil(
      self.registration.showNotification('FamilyLedger — Backup Reminder', {
        body: 'Time to back up your family expenses to Google Drive.',
        icon: '/icon.png',
        badge: '/icon.png',
        tag: 'backup-reminder',
        renotify: true,
        data: { url: '/?settings=1' },
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
