// Service Worker for Dashboard PWA
const CACHE_NAME = 'dashboard-v1';
const RUNTIME_CACHE = 'dashboard-runtime-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/favicon.svg',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/site.webmanifest',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete caches that don't match current version
              return name !== CACHE_NAME && name !== RUNTIME_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - network-first strategy with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests and chrome-extension requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip Convex API calls - always go to network
  if (url.pathname.startsWith('/.well-known') || 
      url.hostname.includes('convex.cloud') ||
      url.hostname.includes('convex.site')) {
    return;
  }

  event.respondWith(
    // Network-first strategy
    fetch(request)
      .then((response) => {
        // Don't cache if not a success response
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the fetched resource
        caches.open(RUNTIME_CACHE)
          .then((cache) => {
            // Only cache GET requests
            if (request.method === 'GET') {
              cache.put(request, responseToCache);
            }
          });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request)
          .then((response) => {
            if (response) {
              console.log('[SW] Serving from cache:', request.url);
              return response;
            }

            // If not in cache and it's a navigation request, serve a basic offline page
            if (request.mode === 'navigate') {
              return caches.match('/');
            }

            return new Response('Offline - content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain',
              }),
            });
          });
      })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Listen for updates
self.addEventListener('controllerchange', () => {
  console.log('[SW] Controller changed - new service worker activated');
});

console.log('[SW] Service worker script loaded');

