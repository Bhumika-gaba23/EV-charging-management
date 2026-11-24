// Shows Pluggo's charging alerts and opens the app when one is tapped.
// It does not cache anything or intercept network requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow("./#sessions");
    }),
  );
});
