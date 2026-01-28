// sw.js
// Este archivo es el Service Worker para la Progressive Web App (PWA).
// Se encarga de gestionar el caché para permitir el funcionamiento offline.

const CACHE_NAME = 'taekwondogajog-gestion-cache-v1';

// Lista de los recursos fundamentales de la aplicación (el "app shell").
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// --- Evento de Instalación ---
// Se dispara cuando el Service Worker se instala por primera vez.
// Se aprovecha para descargar y almacenar en caché los recursos del App Shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // `addAll` es atómico: si un recurso falla, toda la operación de caché falla.
        return cache.addAll(APP_SHELL_URLS);
      })
      .then(() => {
        // Forza al Service Worker en espera a convertirse en el activo.
        // Esto asegura que la nueva versión se active inmediatamente.
        return self.skipWaiting();
      })
  );
});

// --- Evento de Activación ---
// Se dispara después de la instalación, cuando el Service Worker se activa.
// Es el momento ideal para limpiar cachés antiguos que ya no se necesiten.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME) // Filtra para encontrar cachés con nombres diferentes al actual.
          .map(cacheName => {
            return caches.delete(cacheName); // Elimina los cachés obsoletos.
          })
      );
    }).then(() => {
      // Toma el control de todos los clientes (pestañas) abiertos inmediatamente.
      return self.clients.claim();
    })
  );
});

// --- Evento Fetch ---
// Se dispara cada vez que la aplicación realiza una petición de red (fetch).
// Intercepta la petición y decide si responder desde el caché o desde la red.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // No interceptar peticiones que no sean GET (como POST, PUT, etc.)
  if (request.method !== 'GET') {
    return;
  }
  
  // Estrategia: "Cache First, falling back to Network" (Primero caché, si no, red).
  // Es ideal para los recursos estáticos del App Shell (CSS, JS, imágenes).
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Si la respuesta está en el caché, la devolvemos directamente.
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si no está en el caché, la pedimos a la red.
        return fetch(request)
          .then((networkResponse) => {
            // Si la petición de red fue exitosa, la guardamos en el caché para el futuro.
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone(); // Clonamos la respuesta porque es un stream que solo se puede leer una vez.
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch(error => {
            // Este catch se activa si la petición de red falla (ej: sin conexión).
            // Opcionalmente, se podría devolver una página de "offline" genérica.
          });
      })
  );
});