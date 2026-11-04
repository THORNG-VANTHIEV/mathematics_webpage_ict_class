/*
 * Service worker: lets students keep studying without internet.
 *
 * - The page, CSS, JS, KaTeX and lesson text are saved on first visit (SHELL_FILES).
 * - Lesson diagrams and circuit images are saved the first time a student opens that lesson,
 *   so every lesson viewed once online also works offline later.
 * - Page/CSS/JS are fetched fresh when online (network first), so edits show up
 *   right away; the saved copy is only used when offline.
 */
const CACHE_VERSION = 'v11';
const SHELL_CACHE = `math-shell-${CACHE_VERSION}`;
const IMAGE_CACHE = `math-images-${CACHE_VERSION}`;
const FONT_CACHE = `math-fonts-${CACHE_VERSION}`;

const SHELL_FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/course-data.js',
  'js/app.js',
  'manifest.json',
  'images/logo.webp',
  'images/logo.png',
  'images/cover.webp',
  'images/icons/icon-192.png',
  'images/icons/icon-512.png',
  'vendor/katex/katex.min.css',
  'vendor/katex/katex.min.js',
  'vendor/katex/auto-render.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE, IMAGE_CACHE, FONT_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com' || url.pathname.includes('/vendor/katex/fonts/')) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  if (url.pathname.includes('/images/lessons/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  event.respondWith(networkFirst(request));
});
