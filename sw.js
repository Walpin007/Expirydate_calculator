'use strict';
const VERSION = 'v0.1.5';
const BASE = self.registration.scope;
const PREFIX = 'time-limit:' + BASE + ':';
const CACHE = PREFIX + VERSION;
const FILES = ['index.html', 'pwa.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const URLS = FILES.map(path => new URL(path, BASE).href);
const INDEX = new URL('index.html', BASE).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS.map(url => new Request(url, { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const clean = url.origin + url.pathname;
  const navigation = request.mode === 'navigate' && (clean === BASE || clean === INDEX);
  if (!navigation && !URLS.includes(clean)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = navigation ? INDEX : clean;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(request, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Network response not usable');
      await cache.put(key, response.clone()).catch(() => {});
      return response;
    } catch (_) {
      const cached = await cache.match(key);
      return cached || new Response('오프라인 파일이 없습니다. 인터넷 연결 후 다시 열어 주세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } finally { clearTimeout(timer); }
  })());
});
