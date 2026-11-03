const CACHE_VERSION = "pivot-shell-v2";
const SHELL_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const OFFLINE_URL = "/offline";
const SHELL_PATHS = ["/", "/onboarding", "/settings", "/help", OFFLINE_URL, "/manifest.webmanifest", "/icons/pivot-192.png", "/icons/pivot-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_PATHS)),
    self.registration.active ? Promise.resolve() : self.skipWaiting(),
  ]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("pivot-") && ![SHELL_CACHE, ASSET_CACHE].includes(key)).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(request, url) {
  return url.origin === self.location.origin && ["font", "image", "script", "style"].includes(request.destination);
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (isStaticAsset(request, url)) event.respondWith(cacheFirstAsset(request));
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification("Pivot", {
    body: "Your Pivot check-in is ready.",
    icon: "/icons/pivot-192.png",
    badge: "/icons/pivot-192.png",
    tag: payload.tag ?? "pivot-check-in",
    data: { url: payload.url === "/settings" ? "/settings" : "/?screen=history" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/?screen=history", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    return existing ? existing.navigate(target).then(() => existing.focus()) : self.clients.openWindow(target);
  }));
});
