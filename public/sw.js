/* BTB Solutions service worker.
 *
 * Goal: pages, photos and drawings you have already opened keep working with no signal.
 * It never handles sign-in (/api/auth), data changes (non-GET, which the app queues itself),
 * exports, or Next.js client-navigation data requests (those fall back to a normal page load,
 * which this worker then serves from cache).
 *
 * Everything cached here is private to the signed-in user. The app deletes ALL of these caches
 * on sign-out and when a different person signs in (see lib/offline/clear.ts).
 */
const VERSION = "v1";
const STATIC = `btb-static-${VERSION}`;
const PAGES = `btb-pages-${VERSION}`;
const FILES = `btb-files-${VERSION}`;
const KEEP = [STATIC, PAGES, FILES];
const PROD = new URL(self.location.href).searchParams.get("mode") === "prod";
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll(["/offline", "/manifest.webmanifest", "/logo.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("btb-") && !KEEP.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_CACHES") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("btb-")).map((key) => caches.delete(key)))));
  }
});

const sameOriginGet = (request) => request.method === "GET" && new URL(request.url).origin === self.location.origin;

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("network timeout")), ms));
}

/** Only store good, direct answers: never an error page or a redirect to the sign-in screen. */
const cacheable = (response) => response && response.ok && !response.redirected && response.type !== "opaque";

async function networkFirst(request, cacheName, { fallbackToOfflinePage = false } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([fetch(request), timeout(NETWORK_TIMEOUT_MS)]);
    if (cacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    if (fallbackToOfflinePage) {
      const offline = await caches.match("/offline");
      if (offline) return offline;
    }
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!sameOriginGet(request)) return;
  const url = new URL(request.url);
  const path = url.pathname;

  // Never intercept sign-in, exports, health checks or other live endpoints.
  if (path.startsWith("/api/auth") || path === "/api/export" || path === "/api/health" || path.startsWith("/api/projects/")) return;

  // Next.js client-side navigation data: let it hit the network. If that fails Next performs a
  // normal page load instead, and the page itself is served from the cache below.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  // Photos and drawings never change once uploaded (each upload has its own id), so cache-first is exact.
  if (path.startsWith("/api/photos/") || path.startsWith("/api/documents/")) {
    event.respondWith(cacheFirst(request, FILES));
    return;
  }

  if (path.startsWith("/_next/static/")) {
    // In production these file names contain a content hash, so they can be served from cache forever.
    event.respondWith(PROD ? cacheFirst(request, STATIC) : networkFirst(request, STATIC));
    return;
  }

  const wantsHtml = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
  if (wantsHtml) {
    event.respondWith(networkFirst(request, PAGES, { fallbackToOfflinePage: true }));
    return;
  }

  if (path.startsWith("/api/")) return;
  event.respondWith(networkFirst(request, STATIC));
});
