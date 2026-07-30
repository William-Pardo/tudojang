import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escanearMarcadores, leerNucleoManual, fusionarCatalogo } from './lib/catalogo-fuente.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const fixturesRoot = path.resolve(scriptsDir, '__fixtures__', 'catalogo-gate');
const fixture = (nombre) => path.join(fixturesRoot, nombre);

// --- escanearMarcadores: camino feliz -----------------------------------------------------

test('escanearMarcadores: marcador-simple devuelve una entrada con archivo, entrada y ubicacion', () => {
  const resultado = escanearMarcadores({ root: fixture('marcador-simple') });

  assert.equal(resultado.length, 1);
  const [marcador] = resultado;
  assert.equal(marcador.archivo, 'VistaSimple.tsx');
  assert.equal(marcador.entrada.id, 'fixture.simple');
  assert.equal(marcador.entrada.route, '/fixture-simple');
  assert.deepEqual(marcador.entrada.sourceFiles, ['VistaSimple.tsx']);
  // El evaluador debe resolver arrays de string reales, no solo campos escalares.
  assert.deepEqual(marcador.entrada.aliases, ['vista simple de fixture']);
  assert.deepEqual(marcador.entrada.negativeTerms, []);
  assert.equal(typeof marcador.linea, 'number');
  assert.ok(marcador.linea > 0);
  assert.equal(typeof marcador.columna, 'number');
  assert.ok(marcador.columna > 0);
});

test('escanearMarcadores: marcador-multiple devuelve las 3 entradas en orden de declaracion (D1: siempre array)', () => {
  const resultado = escanearMarcadores({ root: fixture('marcador-multiple') });

  assert.equal(resultado.length, 3);
  assert.deepEqual(
    resultado.map((m) => m.entrada.id),
    ['fixture.multiple.read', 'fixture.multiple.manage', 'fixture.multiple.standalone'],
  );
  assert.ok(resultado.every((m) => m.archivo === 'VistaMultiple.tsx'));
  // Dos entradas, misma ruta -> N:1 real dentro de un mismo archivo.
  assert.equal(resultado[0].entrada.route, '/fixture-multiple');
  assert.equal(resultado[1].entrada.route, '/fixture-multiple');
  assert.equal(resultado[2].entrada.route, '/fixture-multiple-standalone');
});

test('escanearMarcadores: marcador-jsx-pesado se lee por AST sin ejecutar el modulo (canario window.matchMedia)', () => {
  // Si esto llegase a transpilar+importar la vista en vez de leerla por AST, explotaria con
  // "window is not defined" en Node. Que NO explote es la prueba de comportamiento real.
  const resultado = escanearMarcadores({ root: fixture('marcador-jsx-pesado') });

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].entrada.id, 'fixture.jsxPesado');
  assert.equal(resultado[0].archivo, 'VistaJsxPesada.tsx');
});

// --- escanearMarcadores: fallas duras -------------------------------------------------------

test('escanearMarcadores: marcador-duplicado falla duro nombrando ambos archivos y el id colisionado', () => {
  assert.throws(
    () => escanearMarcadores({ root: fixture('marcador-duplicado') }),
    (error) => {
      assert.match(error.message, /fixture\.duplicado/);
      assert.match(error.message, /VistaDuplicadoA\.tsx/);
      assert.match(error.message, /VistaDuplicadoB\.tsx/);
      return true;
    },
  );
});

test('escanearMarcadores: marcador-dinamico falla duro con archivo:linea:columna y el SyntaxKind del spread (D3)', () => {
  assert.throws(
    () => escanearMarcadores({ root: fixture('marcador-dinamico') }),
    (error) => {
      assert.match(error.message, /VistaDinamica\.tsx:\d+:\d+/);
      assert.match(error.message, /Spread/);
      return true;
    },
  );
});

test('escanearMarcadores: marcador-sin-selfref falla duro porque sourceFiles no incluye el propio archivo (D9)', () => {
  assert.throws(
    () => escanearMarcadores({ root: fixture('marcador-sin-selfref') }),
    (error) => {
      assert.match(error.message, /VistaSinSelfref\.tsx:\d+:\d+/);
      assert.match(error.message, /sourceFiles/);
      return true;
    },
  );
});

// --- leerNucleoManual: contra la raiz real del repo ------------------------------------------

test('leerNucleoManual: lee el catalogo manual real y devuelve su forma completa', async () => {
  const nucleo = await leerNucleoManual({ root: repoRoot });

  assert.equal(nucleo.schemaVersion, 1);
  assert.match(nucleo.catalogVersion, /^\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(nucleo.routes) && nucleo.routes.includes('/'));
  assert.ok(Array.isArray(nucleo.entries) && nucleo.entries.length > 0);

  const shell = nucleo.entries.find((entrada) => entrada.id === 'shell.session');
  assert.ok(shell, 'debe incluir la entrada real shell.session del nucleo manual');
  assert.deepEqual(shell.sourceFiles, ['App.tsx']);
});

// --- fusionarCatalogo: fusion pura, sin tocar disco ------------------------------------------

function nucleoDePrueba(overrides = {}) {
  return {
    schemaVersion: 1,
    catalogVersion: '9.9.9',
    lastVerifiedAt: '2026-01-01',
    roles: { Admin: { status: 'active', description: 'x' } },
    routes: ['/a'],
    entries: [
      {
        id: 'nucleo.a',
        inventoryId: 'nucleo.a',
        module: 'm',
        label: 'Nucleo A',
        intent: 'x',
        aliases: ['a'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['x'],
        route: '/a',
        sensitivity: 'internal',
        escalationReason: 'x',
        sourceFiles: ['shared/soporte/catalogo.v1.ts'],
        authorizationRef: 'x',
        owner: 'x',
        introducedIn: '1.0.0', // version vieja a proposito: la fusion debe re-estampar (D2)
        lastVerifiedAt: '2026-01-01',
        status: 'active',
      },
    ],
    ...overrides,
  };
}

function marcadorDePrueba(overrides = {}) {
  return {
    archivo: 'vistas/X.tsx',
    linea: 10,
    columna: 5,
    entrada: {
      id: 'marcador.b',
      inventoryId: 'marcador.b',
      module: 'm',
      label: 'Marcador B',
      intent: 'x',
      aliases: ['b'],
      actions: ['consultar'],
      negativeTerms: [],
      roles: ['Admin'],
      steps: ['x'],
      route: '/b',
      sensitivity: 'internal',
      escalationReason: 'x',
      sourceFiles: ['vistas/X.tsx'],
      authorizationRef: 'x',
      owner: 'x',
      lastVerifiedAt: '2026-01-01',
      status: 'active',
    },
    ...overrides,
  };
}

test('fusionarCatalogo: nucleo primero, marcadores despues, introducedIn re-estampado desde catalogVersion (D2)', () => {
  const nucleo = nucleoDePrueba();
  const marcadores = [marcadorDePrueba()];

  const fusion = fusionarCatalogo(nucleo, marcadores);

  assert.equal(fusion.entries.length, 2);
  assert.equal(fusion.entries[0].id, 'nucleo.a');
  assert.equal(fusion.entries[1].id, 'marcador.b');
  // Re-estampado universal: hasta la entrada manual (que ya traia 1.0.0) queda en catalogVersion.
  assert.equal(fusion.entries[0].introducedIn, '9.9.9');
  assert.equal(fusion.entries[1].introducedIn, '9.9.9');
  // D8: sin union automatica de rutas de marcadores.
  assert.deepEqual(fusion.routes, ['/a']);
  assert.equal(fusion.schemaVersion, 1);
  assert.equal(fusion.catalogVersion, '9.9.9');
});

test('fusionarCatalogo: ordena los marcadores por archivo y luego por indice, sin importar el orden de entrada', () => {
  const nucleo = nucleoDePrueba({ entries: [] });
  const marcadores = [
    marcadorDePrueba({ archivo: 'vistas/Z.tsx', entrada: { ...marcadorDePrueba().entrada, id: 'm.z', inventoryId: 'm.z', sourceFiles: ['vistas/Z.tsx'] } }),
    marcadorDePrueba({ archivo: 'vistas/A.tsx', entrada: { ...marcadorDePrueba().entrada, id: 'm.a1', inventoryId: 'm.a1', sourceFiles: ['vistas/A.tsx'] } }),
    marcadorDePrueba({ archivo: 'vistas/A.tsx', entrada: { ...marcadorDePrueba().entrada, id: 'm.a2', inventoryId: 'm.a2', sourceFiles: ['vistas/A.tsx'] } }),
  ];

  const fusion = fusionarCatalogo(nucleo, marcadores);

  // vistas/A.tsx antes que vistas/Z.tsx; dentro de A.tsx, a1 antes que a2 (orden de llegada).
  assert.deepEqual(
    fusion.entries.map((e) => e.id),
    ['m.a1', 'm.a2', 'm.z'],
  );
});

test('fusionarCatalogo: colision de id entre nucleo y marcador falla duro nombrando ambas ubicaciones', () => {
  const nucleo = nucleoDePrueba();
  const marcadores = [marcadorDePrueba({ entrada: { ...marcadorDePrueba().entrada, id: 'nucleo.a', inventoryId: 'marcador.b' } })];

  assert.throws(
    () => fusionarCatalogo(nucleo, marcadores),
    (error) => {
      assert.match(error.message, /nucleo\.a/);
      assert.match(error.message, /catalogo\.v1\.ts/);
      assert.match(error.message, /vistas\/X\.tsx:10:5/);
      return true;
    },
  );
});

test('fusionarCatalogo: colision de inventoryId entre dos marcadores falla duro nombrando ambos archivos', () => {
  const nucleo = nucleoDePrueba({ entries: [] });
  const marcadores = [
    marcadorDePrueba({ archivo: 'vistas/Uno.tsx', entrada: { ...marcadorDePrueba().entrada, id: 'marcador.uno', inventoryId: 'compartido', sourceFiles: ['vistas/Uno.tsx'] } }),
    marcadorDePrueba({ archivo: 'vistas/Dos.tsx', entrada: { ...marcadorDePrueba().entrada, id: 'marcador.dos', inventoryId: 'compartido', sourceFiles: ['vistas/Dos.tsx'] } }),
  ];

  assert.throws(
    () => fusionarCatalogo(nucleo, marcadores),
    (error) => {
      assert.match(error.message, /compartido/);
      assert.match(error.message, /vistas\/Uno\.tsx/);
      assert.match(error.message, /vistas\/Dos\.tsx/);
      return true;
    },
  );
});

test('fusionarCatalogo: acumula colision nucleo<->marcador y marcador<->marcador y las reporta juntas antes de fallar', () => {
  const nucleo = nucleoDePrueba();
  const marcadores = [
    marcadorDePrueba({ archivo: 'vistas/Uno.tsx', entrada: { ...marcadorDePrueba().entrada, id: 'nucleo.a', inventoryId: 'nucleo.a', sourceFiles: ['vistas/Uno.tsx'] } }),
    marcadorDePrueba({ archivo: 'vistas/Dos.tsx', entrada: { ...marcadorDePrueba().entrada, id: 'marcador.dos', inventoryId: 'repetido', sourceFiles: ['vistas/Dos.tsx'] } }),
    marcadorDePrueba({ archivo: 'vistas/Tres.tsx', entrada: { ...marcadorDePrueba().entrada, id: 'marcador.tres', inventoryId: 'repetido', sourceFiles: ['vistas/Tres.tsx'] } }),
  ];

  assert.throws(
    () => fusionarCatalogo(nucleo, marcadores),
    (error) => {
      // Ambas colisiones deben aparecer en el MISMO error (una sola corrida revela todo).
      assert.match(error.message, /nucleo\.a/);
      assert.match(error.message, /repetido/);
      assert.match(error.message, /vistas\/Dos\.tsx/);
      assert.match(error.message, /vistas\/Tres\.tsx/);
      return true;
    },
  );
});
