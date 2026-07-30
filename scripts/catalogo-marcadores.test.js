import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escanearMarcadores } from './lib/catalogo-fuente.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
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
