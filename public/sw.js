// sw.js
// Este archivo es el Service Worker para la Progressive Web App (PWA).
// Se encarga de gestionar el caché para permitir el funcionamiento offline.

const CACHE_NAME = 'taekwondogajog-gestion-cache-v4-feb16-2026';

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
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // No interceptar peticiones que no sean GET
  if (request.method !== 'GET') {
    return;
  }

  // ESTRATEGIA: "Network First" (Red primero, luego caché)
  // Esto asegura que si hay internet, siempre se vea la ULTIMA VERSIÓN.
  // Si falla la red, se usa lo que esté en caché (modo offline).
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Si la red responde bien, actualizamos el caché y devolvemos la respuesta.
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si falla la red (offline), intentamos buscar en el caché.
        return caches.match(request);
      })
  );
});