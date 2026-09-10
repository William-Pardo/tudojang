// functions/manifestPwa.js
// Sirve `/manifest.json` YA RESUELTO POR EL SERVIDOR segun el subdominio del request
// (gajog.tudojang.com -> manifest de Gajog), para que al instalar el PWA el icono en el
// celular muestre el logo y el nombre de esa academia y no "TuDojang".
//
// Por que se hace desde el servidor y NUNCA mutando el manifest en el cliente (ERR-0033,
// PR #99): Android hornea nombre e icono en un WebAPK al instalar e identifica la app
// instalada contra el manifest de origen; reemplazar `<link rel="manifest">` por una Blob URL
// distinta en cada sesion le da al WebAPK una identidad nueva cada vez y la app instalada
// quedaba colgada, habia que forzar el cierre. La forma correcta de tener varias PWAs
// instalables con identidad propia bajo un mismo dominio es un ORIGEN (subdominio) por cada
// una -- documentacion oficial de Google, "Build multiple PWAs on the same domain" -- que es
// exactamente lo que esta funcion habilita: una URL de manifest estable por tenant, con
// contenido distinto segun el host.
//
// Regla de degradacion: ante CUALQUIER duda (sin subdominio, slug inexistente, tenant sin
// nombre, Firestore caido) se devuelve el manifest generico con 200. Nunca un 404 ni un 500:
// un manifest roto impide instalar la app, y el dominio raiz (tudojang.com) es el sitio
// comercial que ya funciona hoy y no se puede romper.

'use strict';

// Copia EXACTA de manifest.json de la raiz del repo (el generico del dominio principal). Vive
// aca duplicada porque el deploy de functions solo sube el directorio `functions/`, no puede
// leer un archivo de la raiz en runtime. manifestPwa.test.js compara ambos y falla si se
// desincronizan.
const MANIFEST_GENERICO = {
  short_name: 'TuDojang',
  name: 'TuDojang',
  description: 'Módulo integral para la gestión de escuelas de Taekwondo.',
  icons: [
    {
      src: '/Logo_TuDojang.svg',
      type: 'image/svg+xml',
      sizes: 'any',
    },
    {
      src: '/Logo_TuDojang.svg',
      type: 'image/svg+xml',
      sizes: '192x192',
    },
    {
      src: '/Logo_TuDojang.svg',
      type: 'image/svg+xml',
      sizes: '512x512',
    },
  ],
  start_url: '.',
  display: 'standalone',
  theme_color: '#1f3e90',
  background_color: '#ffffff',
};

// Primeras etiquetas que NO son el slug de una academia: el sitio comercial y los hosts por
// defecto de Firebase Hosting (tudojang.web.app, tudojang.firebaseapp.com).
const SUBDOMINIOS_RESERVADOS = new Set(['www', 'tudojang', 'localhost']);

const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]*$/;
const COLOR_HEX_VALIDO = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const TIPOS_POR_EXTENSION = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Extrae el slug de la academia desde el header `Host`. Devuelve `null` cuando el host es el
 * dominio raiz, un host de desarrollo, una IP, o cualquier cosa que no sea un subdominio
 * plausible -- todos esos casos los sirve el manifest generico.
 */
function extraerSlugDeHost(host) {
  // El puerto no es parte del hostname (`localhost:5173`, `gajog.tudojang.com:8080`).
  const hostname = String(host || '')
    .trim()
    .toLowerCase()
    .split(':')[0]
    .replace(/\.$/, ''); // FQDN con punto final: `gajog.tudojang.com.`

  if (!hostname) return null;
  // Una IP literal (127.0.0.1) tiene etiquetas pero ninguna es un slug.
  if (/^[\d.]+$/.test(hostname)) return null;

  const etiquetas = hostname.split('.').filter(Boolean);
  // `tudojang.com` o `localhost`: no hay subdominio que resolver.
  if (etiquetas.length < 3) return null;

  const slug = etiquetas[0];
  if (SUBDOMINIOS_RESERVADOS.has(slug)) return null;
  if (!SLUG_VALIDO.test(slug)) return null;

  return slug;
}

const esUrlHttpValida = (valor) => {
  if (typeof valor !== 'string' || !valor.trim()) return false;
  try {
    const url = new URL(valor.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const tipoMimeDeLogo = (logoUrl) => {
  try {
    const extension = new URL(logoUrl).pathname.split('.').pop().toLowerCase();
    return TIPOS_POR_EXTENSION[extension] || null;
  } catch {
    return null;
  }
};

/**
 * Construye las entradas `icons` del logo del tenant. Chrome exige declarar 192x192 y 512x512
 * para considerar la PWA instalable; un SVG se declara ademas con `sizes: "any"` porque no
 * tiene tamano intrinseco. Si el logo no es una URL http(s) usable, se devuelven los iconos
 * genericos (mejor el logo de TuDojang que una PWA no instalable).
 */
function construirIconos(logoUrl) {
  if (!esUrlHttpValida(logoUrl)) return MANIFEST_GENERICO.icons;

  const src = logoUrl.trim();
  const type = tipoMimeDeLogo(src);
  const tamanos = type === 'image/svg+xml' ? ['any', '192x192', '512x512'] : ['192x192', '512x512'];

  // `type` se omite cuando la extension no dice nada (URL firmada de Storage sin extension):
  // es opcional en la especificacion y el navegador lo detecta al descargar el archivo.
  return tamanos.map((sizes) => (type ? { src, type, sizes } : { src, sizes }));
}

const colorValido = (valor, respaldo) =>
  typeof valor === 'string' && COLOR_HEX_VALIDO.test(valor.trim()) ? valor.trim() : respaldo;

/**
 * Arma el manifest del tenant. Devuelve `null` si el tenant no tiene nombre: un manifest sin
 * `name` deja la PWA instalada sin etiqueta, peor que servir el generico.
 */
function construirManifestTenant(tenant, slugSolicitado) {
  const nombre = String(tenant?.nombreClub || '').trim();
  if (!nombre) return null;

  const slug = String(tenant.slug || slugSolicitado || '').trim().toLowerCase();

  return {
    short_name: nombre,
    name: nombre,
    description: MANIFEST_GENERICO.description,
    icons: construirIconos(tenant.logoUrl),
    // `id` fija la identidad de la PWA instalada y NO puede cambiar nunca para un tenant: si
    // cambia, Android trata la app como otra distinta y la instalada queda huerfana.
    id: `/?tenant=${encodeURIComponent(slug)}`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: colorValido(tenant.colorPrimario, MANIFEST_GENERICO.theme_color),
    // `tenants` no guarda un color de fondo propio; el blanco generico mantiene legible el
    // splash con cualquier logo.
    background_color: MANIFEST_GENERICO.background_color,
  };
}

/**
 * Host que pidio el navegador. Hosting proxea `/manifest.json` hacia la funcion, asi que el
 * host original viaja en `x-forwarded-host` (una lista separada por comas si hubo mas de un
 * salto) y `host` puede quedar como el dominio interno de Cloud Functions. Que sea un header
 * falsificable no es un problema aca: lo peor que consigue quien lo falsee es el nombre y el
 * logo de otra academia, que son publicos (los muestra su propia landing).
 */
function hostDelRequest(headers = {}) {
  const reenviado = String(headers['x-forwarded-host'] || '').split(',')[0].trim();
  return reenviado || headers.host;
}

/**
 * Handler `onRequest` de `/manifest.json`. Recibe ya construido el servicio
 * `resolverTenantPublico` (academico/tenantPublico.js) -- la misma resolucion slug->tenant que
 * usa BrandingProvider.tsx, sin duplicar la consulta a Firestore.
 */
function crearServicioManifestPwa({ resolverTenantPublico }) {
  return async function servirManifest(req, res) {
    const slug = extraerSlugDeHost(hostDelRequest(req?.headers));
    let manifest = MANIFEST_GENERICO;

    if (slug) {
      try {
        const tenant = await resolverTenantPublico({ slug });
        manifest = (tenant && construirManifestTenant(tenant, slug)) || MANIFEST_GENERICO;
      } catch (error) {
        console.error(`Error resolviendo el manifest del subdominio "${slug}":`, error);
      }
    }

    res.set('Content-Type', 'application/manifest+json; charset=utf-8');
    // No se cachea por SEGURIDAD, no por frescura: si el CDN guardara esta respuesta sin
    // discriminar por Host, una academia recibiria el nombre y el logo de otra.
    res.set('Cache-Control', 'private, no-store');
    return res.status(200).send(JSON.stringify(manifest));
  };
}

module.exports = {
  MANIFEST_GENERICO,
  extraerSlugDeHost,
  construirManifestTenant,
  crearServicioManifestPwa,
};
