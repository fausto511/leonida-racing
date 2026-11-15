// Minimal service worker (Fausto 15.11.2026): only so Android browsers can offer "Add to Home screen".
// It caches nothing and does not handle requests, so visitors always get the live site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
