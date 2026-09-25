// O site deixou de ser PWA. Este service worker só existe para desfazer o antigo nos
// aparelhos que já o instalaram: apaga os caches, se desregistra e recarrega as abas.
// Pode ser apagado quando ninguém mais tiver o antigo (algumas semanas depois).
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
