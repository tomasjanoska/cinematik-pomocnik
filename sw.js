const CACHE = "cinematik-v-mobile-8";
const PRECACHE = [
  "./index.html", "./films.json",
  "./css/base.css", "./css/header.css", "./css/board.css", "./css/list.css", "./css/dialogs.css", "./css/feedback.css", "./css/responsive.css",
  "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./loading.mp3"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  const dest = id ? "./?n=" + id : "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url && new URL(c.url).origin === self.location.origin) {
          c.postMessage({ type: "open-film", id });
          return c.focus();
        }
      }
      return self.clients.openWindow(dest);
    })
  );
});
