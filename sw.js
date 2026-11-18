/* съБИТИЕ+ service worker
 *
 * Стратегия „първо мрежата“: когато има интернет, винаги се зарежда най-новата
 * версия от Netlify, а кешът е само резерва за офлайн. Така всеки ъпдейт в GitHub
 * стига до хората при следващото отваряне на приложението, без да правят нищо.
 *
 * При всяка промяна на този файл сменете VERSION — това изчиства стария кеш.
 */
const VERSION = "v1";
const CACHE = `subitie-${VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/config.js",
  "manifest.webmanifest",
  "data/events.json",
  "assets/logo-wordmark.png",
  "assets/logo-c.jpg",
  "assets/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting(); // новата версия поема веднага
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("subitie-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Шрифтове от Google — първо кеш (не се променят)
  if (url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;

  // Всичко наше — първо мрежата, после кеша
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: "no-cache" });
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
      return hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error());
    }
  })());
});
