/* ─────────────────────────────────────────────────────────────
 *  CoffeeSoft — Service Worker
 *  Alcance: la carpeta donde vive este archivo (coffee/app/), así que
 *  cubre el login y todo el visor.
 *
 *  Criterio: sólo se cachea lo que vive bajo /src/ (css, js, img, fuentes)
 *  y los CDNs conocidos. Todo lo demás — PHP, /ctrl/, documentos, uploads,
 *  previews del forge — va siempre a la red. Es una lista blanca a
 *  propósito: en esta app casi todo el contenido es vivo.
 * ───────────────────────────────────────────────────────────── */

const VERSION     = 'v1';
const SHELL_CACHE = `coffeesoft-shell-${VERSION}`;
const RUNTIME     = `coffeesoft-runtime-${VERSION}`;
const OFFLINE_URL = 'offline.html';

const SHELL_URLS = [
    OFFLINE_URL,
    'manifest.json',
    'src/img/pwa/icon-192.png',
    'src/img/pwa/icon-512.png'
];

const CDN_HOSTS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'code.jquery.com',
    'cdn.tailwindcss.com',
    'cdn.sheetjs.com'
];

const STATIC_EXT = /\.(css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp3|wav)$/i;

// -- Ciclo de vida --

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(SHELL_URLS))
            .catch(() => null) // un asset faltante no debe abortar la instalación
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter((k) => k.startsWith('coffeesoft-') && k !== SHELL_CACHE && k !== RUNTIME)
                .map((k) => caches.delete(k))
        );
        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.enable();
        }
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// -- Estrategias --

self.addEventListener('fetch', (event) => {
    const req = event.request;

    if (req.method !== 'GET') return;      // POST a los ctrl: directo a la red
    if (req.headers.has('range')) return;  // audio/video parcial

    let url;
    try { url = new URL(req.url); } catch (e) { return; }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    const sameOrigin = url.origin === self.location.origin;

    // Previews y sandboxes del forge/playground: nunca interceptar, ni siquiera
    // para mostrar la página offline (confundiría dentro de un iframe).
    if (sameOrigin && /\/(prototipo|template|sandbox|uploads|documents|data)\//.test(url.pathname)) return;

    if (req.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(event));
        return;
    }

    if (sameOrigin) {
        if (!url.pathname.includes('/src/')) return; // sólo assets del proyecto
        if (url.searchParams.has('t'))       return; // cache-busting de PHP
        if (!STATIC_EXT.test(url.pathname))  return;
        event.respondWith(staleWhileRevalidate(req));
        return;
    }

    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(req));
    }
});

// Complements

async function networkFirstNavigation(event) {
    try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        return await fetch(event.request);
    } catch (e) {
        const cache = await caches.open(SHELL_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline || new Response('Sin conexión', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

async function staleWhileRevalidate(req) {
    const cache  = await caches.open(RUNTIME);
    const cached = await cache.match(req);

    const network = fetch(req).then((res) => {
        // Las respuestas opacas (CDN sin CORS) también sirven para pintar
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
    }).catch(() => null);

    if (cached) return cached;

    const res = await network;
    return res || new Response('', { status: 504, statusText: 'Sin conexión' });
}
