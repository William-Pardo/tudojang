// Golden del catalogo fusionado (openspec/changes/catalogo-soporte-marcadores-vivos, Fase 5).
//
// A diferencia de `catalogo-marcadores.test.js`/`rutas-app.test.js` (que ejercitan
// `escanearMarcadores`/`leerRutasApp` sobre fixtures aislados), este test arma el catalogo
// FUSIONADO real -- nucleo manual + marcadores de `vistas/`/`components/` -- contra la raiz
// real del repo, exactamente lo que consumen `generar-catalogo.mjs` y el gate de rutas.
// Rechazado explicitamente en design.md: hacerlo en jest importando `soporteMeta` desde
// `AgendaView` arrastraria el grafo de dependencias de React a un test de datos.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escanearMarcadores, leerNucleoManual, fusionarCatalogo } from './lib/catalogo-fuente.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');

// 55 entradas manuales que siguen viviendo en `shared/soporte/catalogo.v1.ts` tras la Fase 4
// (ver `shared/soporte/catalogo.v1.test.ts::INVENTARIO_ESPERADO`, misma lista).
const INVENTARIO_MANUAL_ESPERADO = [
  'shell.session',
  'admin.summary',
  'admin.late-fees',
  'finance.ledger',
  'finance.delete',
  'finance.student-payments',
  'finance.student-payment-undo',
  'finance.payment-validation',
  'finance.payment-validation-history',
  'students.directory',
  'students.manage',
  'students.kicho',
  'students.kicho-legalize',
  'students.live-class',
  'centro-estudios.material',
  'centro-estudios.biblioteca',
  'centro-estudios.progreso',
  'centro-estudios.consultor',
  'clase-en-vivo.checkpoint',
  'public.activation',
  'public.password-reset',
  'public.collaborator-contract-signature',
  'master.access',
  'students.certificates',
  'students.cards',
  'store.catalog',
  'store.inventory',
  'events.catalog',
  'events.manage',
  'alerts.payment',
  'alerts.history',
  'config.identity-payments',
  'config.annual-enrollment-fee',
  'config.branches',
  'config.staff',
  'config.programs',
  'config.alerts',
  'config.license',
  'profile.self',
  'profile.attendance',
  'profile.payment-report',
  'license.renew',
  'master.support',
  'master.tenants',
  'master.kicho',
  'master.analytics',
  'public.marketing',
  'public.auth',
  'public.enrollment',
  'public.census',
  'public.event',
  'public.contract-signature',
  'public.consent-signature',
  'public.image-signature',
  'public.payment-report',
  'public.pickup',
  'public.help',
];

// 4 entradas migradas de la Fase 4 (co-locadas como `soporteMeta` en BuzonNotificaciones.tsx y
// AgendaView.tsx) + 1 entrada nueva (`jornadas.manage`, co-locada en JornadasView.tsx).
const INVENTARIO_MARCADORES_ESPERADO = [
  'agenda.read',
  'agenda.manage',
  'agenda.standalone',
  'buzon.consultor',
  'jornadas.manage',
];

const INVENTARIO_FUSIONADO_ESPERADO = [...INVENTARIO_MANUAL_ESPERADO, ...INVENTARIO_MARCADORES_ESPERADO];

async function construirCatalogoFusionadoReal() {
  const marcadores = escanearMarcadores({ root: repoRoot });
  const nucleo = await leerNucleoManual({ root: repoRoot });
  return fusionarCatalogo(nucleo, marcadores);
}

test('catalogo fusionado real: expone exactamente las 62 entradas esperadas (57 manuales + 4 migradas + jornadas.manage)', async () => {
  const catalogo = await construirCatalogoFusionadoReal();

  assert.equal(catalogo.entries.length, 62);
  assert.deepEqual(
    catalogo.entries.map((entrada) => entrada.inventoryId).sort(),
    [...INVENTARIO_FUSIONADO_ESPERADO].sort(),
  );
});

test('catalogo fusionado real: no hay ids ni inventoryIds duplicados', async () => {
  const catalogo = await construirCatalogoFusionadoReal();

  const ids = catalogo.entries.map((entrada) => entrada.id);
  const inventoryIds = catalogo.entries.map((entrada) => entrada.inventoryId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(inventoryIds).size, inventoryIds.length);
});

test('catalogo fusionado real: las entradas migradas conservan su contenido (D2, sin introducedIn hardcodeado)', async () => {
  const catalogo = await construirCatalogoFusionadoReal();
  const porId = Object.fromEntries(catalogo.entries.map((entrada) => [entrada.inventoryId, entrada]));

  // Contenido real migrado desde `shared/soporte/catalogo.v1.ts` -- si el marcador co-locado
  // en la vista se desvia del original, esta asercion lo detecta.
  assert.deepEqual(porId['agenda.manage'].roles, ['Admin', 'SuperAdmin']);
  assert.equal(porId['agenda.manage'].sensitivity, 'privileged');
  assert.deepEqual(porId['agenda.standalone'].roles, ['Maestro', 'Estudiante', 'Tutor']);
  assert.equal(porId['agenda.standalone'].route, '/agenda');
  assert.deepEqual(porId['buzon.consultor'].sourceFiles, ['vistas/BuzonNotificaciones.tsx']);

  // Entrada nueva de la Fase 4: ruta real declarada en App.tsx, roles alineados con el gate
  // real de la ruta (`RolUsuario.Admin || RolUsuario.Editor`).
  assert.equal(porId['jornadas.manage'].route, '/jornadas');
  assert.deepEqual(porId['jornadas.manage'].roles, ['Admin', 'Editor']);
  assert.deepEqual(porId['jornadas.manage'].sourceFiles, ['vistas/admin/JornadasView.tsx']);

  // D2: `introducedIn` NO viene escrito a mano en el marcador (Omit<..., 'introducedIn'>) --
  // el generador lo estampa desde `catalogVersion` del nucleo al fusionar.
  assert.equal(porId['jornadas.manage'].introducedIn, catalogo.catalogVersion);
  assert.equal(porId['buzon.consultor'].introducedIn, catalogo.catalogVersion);

  // Una entrada del nucleo manual, sin tocar, sigue presente e intacta tras la fusion.
  assert.equal(porId['shell.session'].route, '/');
  assert.deepEqual(porId['shell.session'].sourceFiles, ['App.tsx']);
});

test('catalogo fusionado real: /jornadas queda declarada en routes (D8, alta manual)', async () => {
  const catalogo = await construirCatalogoFusionadoReal();

  assert.ok(catalogo.routes.includes('/jornadas'));
});
