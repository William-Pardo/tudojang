const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  MANIFEST_GENERICO,
  extraerSlugDeHost,
  crearServicioManifestPwa,
} = require('./manifestPwa');

// Fake minimo de `res` de Express: solo lo que usa el servicio (set/status/send). Mismo estilo
// que createResponse en http.test.js.
const crearResponse = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  set(nombre, valor) {
    this.headers[nombre.toLowerCase()] = valor;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  send(payload) {
    this.body = payload;
    return this;
  },
});

// Doble de `resolverTenantPublico` (academico/tenantPublico.js): mismo contrato -- recibe
// { slug } y devuelve la proyeccion publica del tenant o `null` si no existe.
const crearResolverFake = (tenantsPorSlug = {}) => {
  const llamadas = [];
  const resolver = async ({ slug }) => {
    llamadas.push(slug);
    return tenantsPorSlug[String(slug).toLowerCase().trim()] || null;
  };
  resolver.llamadas = llamadas;
  return resolver;
};

const ejecutar = async (servicio, host, headersExtra = {}) => {
  const req = { headers: { ...(host === undefined ? {} : { host }), ...headersExtra } };
  const res = crearResponse();
  await servicio(req, res);
  return res;
};

const leerManifest = (res) => JSON.parse(res.body);

// --- extraerSlugDeHost -------------------------------------------------------------------

test('extraerSlugDeHost: extrae el slug del subdominio', () => {
  assert.equal(extraerSlugDeHost('gajog.tudojang.com'), 'gajog');
  assert.equal(extraerSlugDeHost('COCODRILOS.tudojang.com'), 'cocodrilos');
  assert.equal(extraerSlugDeHost('gajog.tudojang.com:8080'), 'gajog');
});

test('extraerSlugDeHost: devuelve null en los hosts del sitio comercial (sin subdominio)', () => {
  assert.equal(extraerSlugDeHost('tudojang.com'), null);
  assert.equal(extraerSlugDeHost('www.tudojang.com'), null);
  assert.equal(extraerSlugDeHost('tudojang.web.app'), null);
  assert.equal(extraerSlugDeHost('tudojang.firebaseapp.com'), null);
  assert.equal(extraerSlugDeHost('localhost'), null);
  assert.equal(extraerSlugDeHost('localhost:5173'), null);
  assert.equal(extraerSlugDeHost('127.0.0.1'), null);
});

test('extraerSlugDeHost: devuelve null ante un Host ausente o basura', () => {
  assert.equal(extraerSlugDeHost(undefined), null);
  assert.equal(extraerSlugDeHost(''), null);
  assert.equal(extraerSlugDeHost('   '), null);
  assert.equal(extraerSlugDeHost(':::'), null);
  assert.equal(extraerSlugDeHost('..'), null);
  assert.equal(extraerSlugDeHost('gajog<script>.tudojang.com'), null);
});

// --- Manifest generico -------------------------------------------------------------------

test('MANIFEST_GENERICO no se desincroniza del manifest.json estatico de la raiz', () => {
  const rutaRaiz = path.join(__dirname, '..', 'manifest.json');
  const estatico = JSON.parse(fs.readFileSync(rutaRaiz, 'utf8'));

  assert.deepEqual(MANIFEST_GENERICO, estatico);
});

test('servicio: sin subdominio devuelve el manifest generico y ni consulta el tenant', async () => {
  const resolver = crearResolverFake();
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: resolver });

  const res = await ejecutar(servicio, 'www.tudojang.com');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(leerManifest(res), MANIFEST_GENERICO);
  assert.deepEqual(resolver.llamadas, []);
});

test('servicio: sin header Host no explota y devuelve el manifest generico', async () => {
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: crearResolverFake() });

  const res = await ejecutar(servicio, undefined);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(leerManifest(res), MANIFEST_GENERICO);
});

test('servicio: un slug que no resuelve a ningun tenant devuelve el generico, no un 404', async () => {
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: crearResolverFake() });

  const res = await ejecutar(servicio, 'no-existe.tudojang.com');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(leerManifest(res), MANIFEST_GENERICO);
});

test('servicio: si la resolucion del tenant falla, sirve el generico en vez de romper la instalacion', async () => {
  const resolverQueExplota = async () => {
    throw new Error('Firestore caido');
  };
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: resolverQueExplota });

  const res = await ejecutar(servicio, 'gajog.tudojang.com');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(leerManifest(res), MANIFEST_GENERICO);
});

// --- Manifest del tenant -----------------------------------------------------------------

const TENANT_GAJOG = {
  tenantId: 'tnt-1',
  slug: 'gajog',
  nombreClub: 'Gajog Taekwondo',
  logoUrl: 'https://storage.googleapis.com/tudojang/logos/gajog.png',
  colorPrimario: '#CD2E3A',
};

test('servicio: con subdominio valido sirve nombre y logo del tenant', async () => {
  const resolver = crearResolverFake({ gajog: TENANT_GAJOG });
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: resolver });

  const res = await ejecutar(servicio, 'gajog.tudojang.com');
  const manifest = leerManifest(res);

  assert.deepEqual(resolver.llamadas, ['gajog']);
  assert.equal(manifest.name, 'Gajog Taekwondo');
  assert.equal(manifest.short_name, 'Gajog');
  assert.ok(manifest.icons.length > 0);
  assert.ok(manifest.icons.every((icono) => icono.src === TENANT_GAJOG.logoUrl));
  assert.ok(manifest.icons.some((icono) => icono.sizes === '192x192'));
  assert.ok(manifest.icons.some((icono) => icono.sizes === '512x512'));
  assert.ok(manifest.icons.every((icono) => icono.type === 'image/png'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
});

test('servicio: `nombreCortoApp` explicito gana sobre el slug capitalizado', async () => {
  const tenant = { ...TENANT_GAJOG, nombreCortoApp: 'TKD Gajog' };
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: crearResolverFake({ gajog: tenant }) });

  const manifest = leerManifest(await ejecutar(servicio, 'gajog.tudojang.com'));

  assert.equal(manifest.short_name, 'TKD Gajog');
  assert.equal(manifest.name, 'Gajog Taekwondo');
});

test('servicio: un nombreClub largo no se cuela en el texto bajo el icono', async () => {
  const tenant = { ...TENANT_GAJOG, nombreClub: 'Club deportivo de taekwondo gajog' };
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: crearResolverFake({ gajog: tenant }) });

  const manifest = leerManifest(await ejecutar(servicio, 'gajog.tudojang.com'));

  assert.equal(manifest.short_name, 'Gajog');
  assert.equal(manifest.name, 'Club deportivo de taekwondo gajog');
});

test('servicio: sin slug ni nombre corto, el short_name cae al nombre completo', async () => {
  const tenant = { nombreClub: 'Academia Bushido', logoUrl: TENANT_GAJOG.logoUrl };
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: crearResolverFake({ bushido: tenant }) });

  const manifest = leerManifest(await ejecutar(servicio, 'bushido.tudojang.com'));

  assert.equal(manifest.short_name, 'Bushido');
});

test('servicio: el `id` es estable y propio del tenant', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({ gajog: TENANT_GAJOG, otro: { ...TENANT_GAJOG, slug: 'otro' } }),
  });

  const primera = leerManifest(await ejecutar(servicio, 'gajog.tudojang.com'));
  const segunda = leerManifest(await ejecutar(servicio, 'gajog.tudojang.com'));
  const ajena = leerManifest(await ejecutar(servicio, 'otro.tudojang.com'));

  assert.equal(primera.id, segunda.id);
  assert.notEqual(primera.id, ajena.id);
  assert.equal(primera.id, '/?tenant=gajog');
});

test('servicio: usa el color del tenant como theme_color y el generico como respaldo', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({
      gajog: TENANT_GAJOG,
      sincolor: { tenantId: 'tnt-2', slug: 'sincolor', nombreClub: 'Club Sin Color', logoUrl: TENANT_GAJOG.logoUrl },
    }),
  });

  const conColor = leerManifest(await ejecutar(servicio, 'gajog.tudojang.com'));
  const sinColor = leerManifest(await ejecutar(servicio, 'sincolor.tudojang.com'));

  assert.equal(conColor.theme_color, '#CD2E3A');
  assert.equal(conColor.background_color, MANIFEST_GENERICO.background_color);
  assert.equal(sinColor.theme_color, MANIFEST_GENERICO.theme_color);
  assert.equal(sinColor.background_color, MANIFEST_GENERICO.background_color);
});

test('servicio: ignora un color con formato invalido y cae al generico', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({
      raro: { ...TENANT_GAJOG, slug: 'raro', colorPrimario: 'rojo brillante' },
    }),
  });

  const manifest = leerManifest(await ejecutar(servicio, 'raro.tudojang.com'));

  assert.equal(manifest.theme_color, MANIFEST_GENERICO.theme_color);
});

test('servicio: un logoUrl ausente o no http(s) cae a los iconos genericos', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({
      sinlogo: { tenantId: 'tnt-3', slug: 'sinlogo', nombreClub: 'Club Sin Logo' },
      malicioso: {
        tenantId: 'tnt-4',
        slug: 'malicioso',
        nombreClub: 'Club Raro',
        logoUrl: 'javascript:alert(1)',
      },
    }),
  });

  const sinLogo = leerManifest(await ejecutar(servicio, 'sinlogo.tudojang.com'));
  const malicioso = leerManifest(await ejecutar(servicio, 'malicioso.tudojang.com'));

  assert.deepEqual(sinLogo.icons, MANIFEST_GENERICO.icons);
  assert.equal(sinLogo.name, 'Club Sin Logo');
  assert.deepEqual(malicioso.icons, MANIFEST_GENERICO.icons);
});

test('servicio: un logo SVG se declara con sizes "any" (no puede mentir un tamano fijo)', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({
      svg: { ...TENANT_GAJOG, slug: 'svg', logoUrl: 'https://cdn.tudojang.com/logos/svg.svg' },
    }),
  });

  const manifest = leerManifest(await ejecutar(servicio, 'svg.tudojang.com'));

  assert.ok(manifest.icons.every((icono) => icono.type === 'image/svg+xml'));
  assert.ok(manifest.icons.some((icono) => icono.sizes === 'any'));
});

test('servicio: un tenant sin nombreClub cae al manifest generico (una PWA sin nombre es peor)', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({
      anonimo: { tenantId: 'tnt-5', slug: 'anonimo', logoUrl: TENANT_GAJOG.logoUrl },
    }),
  });

  const res = await ejecutar(servicio, 'anonimo.tudojang.com');

  assert.deepEqual(leerManifest(res), MANIFEST_GENERICO);
});

test('servicio: prefiere x-forwarded-host, que es el host que pidio el navegador', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({ gajog: TENANT_GAJOG }),
  });

  // Hosting proxea hacia la funcion; si en el camino `host` termina siendo el dominio interno
  // de Cloud Functions, el host original sigue viajando en x-forwarded-host.
  const res = await ejecutar(servicio, 'us-central1-tudojang.cloudfunctions.net', {
    'x-forwarded-host': 'gajog.tudojang.com',
  });

  assert.equal(leerManifest(res).name, 'Gajog Taekwondo');
});

test('servicio: si x-forwarded-host trae una lista, usa el primero', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({ gajog: TENANT_GAJOG }),
  });

  const res = await ejecutar(servicio, 'tudojang.com', {
    'x-forwarded-host': 'gajog.tudojang.com, interno.gcp.local',
  });

  assert.equal(leerManifest(res).name, 'Gajog Taekwondo');
});

// --- Cabeceras ---------------------------------------------------------------------------

test('servicio: responde con Content-Type de manifest y SIN cache compartido', async () => {
  const servicio = crearServicioManifestPwa({
    resolverTenantPublico: crearResolverFake({ gajog: TENANT_GAJOG }),
  });

  const res = await ejecutar(servicio, 'gajog.tudojang.com');

  assert.match(res.headers['content-type'], /^application\/manifest\+json/);
  assert.equal(res.headers['cache-control'], 'private, no-store');
});

test('servicio: el manifest generico tampoco se cachea en el CDN', async () => {
  const servicio = crearServicioManifestPwa({ resolverTenantPublico: crearResolverFake() });

  const res = await ejecutar(servicio, 'tudojang.com');

  assert.equal(res.headers['cache-control'], 'private, no-store');
});

// --- Cableado ----------------------------------------------------------------------------
// Mismo criterio que asistente/escalamiento-wiring.test.js: el rewrite es la pieza que hace
// que la funcion se ejecute -- sin el, todo lo de arriba pasa y `/manifest.json` sigue cayendo
// en el rewrite catch-all `**` que devuelve index.html.

const raizRepo = path.join(__dirname, '..');

test('cableado: /manifest.json esta ruteado a la funcion en firebase.json', () => {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(raizRepo, 'firebase.json'), 'utf8'));
  const rewrites = firebaseConfig.hosting.rewrites;

  const rewriteManifest = rewrites.find((r) => r.source === '/manifest.json');
  assert.ok(rewriteManifest, 'falta el rewrite de /manifest.json');
  assert.equal(rewriteManifest.function, 'manifestPwa');

  // Debe ir ANTES del catch-all `**`, que si no se lo come.
  const catchAll = rewrites.findIndex((r) => r.source === '**');
  assert.ok(rewrites.indexOf(rewriteManifest) < catchAll);
});

test('cableado: la funcion manifestPwa esta exportada como onRequest', () => {
  const indexSource = fs.readFileSync(path.join(raizRepo, 'functions', 'index.js'), 'utf8');

  assert.match(indexSource, /exports\.manifestPwa = functionsV1[\s\S]{0,80}\.https\.onRequest\(/);
  assert.match(
    indexSource,
    /crearServicioManifestPwa\(\{[\s\S]{0,120}resolverTenantPublico: servicioResolverTenantPublico/
  );
});
