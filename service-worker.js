/* Quran Display — Service Worker (v11.0) */
'use strict';

// Bump this version string whenever you ship updates so the SW activates fresh.
const CACHE_VERSION = 'v11.0.0';
const SHELL_CACHE   = 'quran-shell-' + CACHE_VERSION;
const DATA_CACHE    = 'quran-data-' + CACHE_VERSION;

// Files to pre-cache on install (the app shell)
const SHELL_FILES = [
    './',
    './index.html',
    './css/Styles.css',
    './css/features.css',
    './js/script.js',
    './js/features.js',
    './manifest.json',
    './favicon.ico',
    './img/Besmeleh4.png',
    './img/makkah-icon1.png',
    './img/madinah-icon.png',
    './img/icon-64.png',
    './img/icon-192.png',
    './img/icon-512.png',
    './img/Banner2.jpg'
];

// Quran XML data files — also pre-cache so offline reading works immediately
const DATA_FILES = [
    './data/quran-arabic.xml',
    './data/quran-french.xml',
    './data/quran-english.xml',
    './data/quran-spanish.xml',
    './data/context/context-french1.xml',
    './data/context/context-french2.xml',
    './data/context/context-english1.xml',
    './data/context/context-english2.xml',
    './data/youtube_fr.json'
];

// ── INSTALL: pre-cache shell + data ──────────────────────────────────
self.addEventListener('install', function(event) {
    event.waitUntil(
        Promise.all([
            caches.open(SHELL_CACHE).then(function(cache) {
                // addAll fails atomically — use individual adds with catches
                // so a single missing file doesn't break the install
                return Promise.all(SHELL_FILES.map(function(url) {
                    return cache.add(url).catch(function(err) {
                        console.warn('[SW] Failed to cache shell:', url, err);
                    });
                }));
            }),
            caches.open(DATA_CACHE).then(function(cache) {
                return Promise.all(DATA_FILES.map(function(url) {
                    return cache.add(url).catch(function(err) {
                        console.warn('[SW] Failed to cache data:', url, err);
                    });
                }));
            })
        ]).then(function() {
            // Activate immediately on first install
            return self.skipWaiting();
        })
    );
});

// ── ACTIVATE: clean old caches ───────────────────────────────────────
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(names.map(function(name) {
                if (name !== SHELL_CACHE && name !== DATA_CACHE) {
                    return caches.delete(name);
                }
            }));
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ── FETCH: stale-while-revalidate for app shell, cache-first for data ──
self.addEventListener('fetch', function(event) {
    const req = event.request;
    const url = new URL(req.url);

    // Only handle same-origin GET requests
    if (req.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    // Skip third-party fonts (Google Fonts CDN) — let browser handle them
    if (url.hostname.indexOf('fonts.') === 0) return;

    const isData = url.pathname.indexOf('/data/') !== -1 ||
                   url.pathname.endsWith('.xml');

    if (isData) {
        // Cache-first for XML data (rarely changes, big files)
        event.respondWith(
            caches.match(req).then(function(cached) {
                return cached || fetch(req).then(function(resp) {
                    if (resp.ok) {
                        const copy = resp.clone();
                        caches.open(DATA_CACHE).then(function(c) { c.put(req, copy); });
                    }
                    return resp;
                });
            })
        );
        return;
    }

    // Stale-while-revalidate for shell files (HTML/CSS/JS/images)
    event.respondWith(
        caches.match(req).then(function(cached) {
            const networkFetch = fetch(req).then(function(resp) {
                if (resp.ok) {
                    const copy = resp.clone();
                    caches.open(SHELL_CACHE).then(function(c) { c.put(req, copy); });
                }
                return resp;
            }).catch(function() {
                // Offline — fall back to cached if available
                return cached;
            });
            // Return cached immediately if we have it; otherwise wait for network
            return cached || networkFetch;
        })
    );
});

// ── MESSAGE: handle skip-waiting requests from the page ──────────────
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── PUSH: receive push notification from server ───────────────────────
self.addEventListener('push', function(event) {
    var data = {};
    try { data = event.data ? event.data.json() : {}; } catch(e) {}
    var title = data.title || '🌅 Daily Verse';
    var options = {
        body:  data.body  || 'Your daily Quran reflection is waiting.',
        icon:  data.icon  || './img/icon-192.png',
        badge: data.badge || './img/icon-192.png',
        tag:   'daily-verse',
        renotify: false,
        data: { url: data.url || './' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// ── NOTIFICATIONCLICK: open the app when notification is tapped ───────
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var target = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) {
                    return list[i].focus();
                }
            }
            return clients.openWindow(target);
        })
    );
});
