self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Lets Chat ???? ??????! ??';
  const options = {
    body: data.body || '?????????? ??? ????? ?????? ??????????.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: '/chat' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/chat');
    })
  );
});
