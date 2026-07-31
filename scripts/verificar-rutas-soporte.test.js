// Gate de rutas del catalogo de soporte (openspec/changes/catalogo-soporte-marcadores-vivos,
// Fase 7). Ejercita las 7 ramas de specs/catalogo-soporte-antideriva/spec.md (Requirement
// "Gate de rutas en CI") invocando el CLI real via spawnSync -- mismo patron que
// scripts/validar-catalogo.test.ts usa para generar-catalogo.mjs -- para que las aserciones de
// "exit 0"/"exit 1" verifiquen el codigo de salida real del proceso, no solo un booleano interno.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularCrecimientoBaseline } from './verificar-rutas-soporte.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const script = path.resolve(scriptsDir, 'verificar-rutas-soporte.mjs');
const fixturesRoot = path.join(scriptsDir, '__fixtures__', 'catalogo-gate');
const fixture = (nombre) => path.join(fixturesRoot, nombre);

function conArchivoTemporal(contenido, ejecutar) {
  const dir = mkdtempSync(path.join(tmpdir(), 'verificar-rutas-soporte-'));
  const archivo = path.join(dir, 'cambios.txt');
  writeFileSync(archivo, contenido, 'utf8');
  try {
    return ejecutar(archivo);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function ejecutarGate(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

// --- (a) Archivo enrutado sin cobertura ------------------------------------------------------

test('gate: archivo enrutado fuera de la linea base y sin cobertura falla nombrando ruta y archivo (escenario a)', () => {
  const result = ejecutarGate(['--source-root', fixture('gate-sin-cobertura')]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\/huerfano/);
  assert.match(result.stderr, /VistaHuerfana\.tsx/);
});

// --- (b) Marcador con ruta no enrutada --------------------------------------------------------

test('gate: soporteMeta con route inexistente en App.tsx falla nombrando la ruta declarada y el archivo del marcador (escenario b)', () => {
  const result = ejecutarGate(['--source-root', fixture('gate-marcador-ruta-inexistente')]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\/no-existe/);
  assert.match(result.stderr, /VistaConRutaFalsa\.tsx/);
});

// --- (c) Cobertura sin ningun rol activo -------------------------------------------------------

test('gate: cobertura nominal cuyos roles estan todos inactivos falla igual (escenario c)', () => {
  const result = ejecutarGate(['--source-root', fixture('gate-rol-inactivo')]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\/legado/);
  assert.match(result.stderr, /VistaLegado\.tsx/);
  assert.match(result.stderr, /rol/i);
});

// --- (d)/(e) Archivo en deuda: no tocado vs tocado en el diff ---------------------------------

test('gate: archivo de la linea base de deuda NO tocado en el diff pasa sin emitir ningun aviso (escenario d)', () => {
  conArchivoTemporal('vistas/VistaConMarcador.tsx\n', (changedFiles) => {
    const result = ejecutarGate([
      '--source-root', fixture('gate-limpio'),
      '--changed-files', changedFiles,
    ]);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /VistaCubierta\.tsx/);
  });
});

test('gate: archivo de la linea base de deuda tocado en el diff pasa (no bloquea) pero emite un aviso visible (escenario e)', () => {
  conArchivoTemporal('vistas/VistaCubierta.tsx\n', (changedFiles) => {
    const result = ejecutarGate([
      '--source-root', fixture('gate-limpio'),
      '--changed-files', changedFiles,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /VistaCubierta\.tsx/);
  });
});

// --- (f) Intento de crecer la linea base de deuda -----------------------------------------------

test('calcularCrecimientoBaseline: detecta el elemento agregado entre base y head de la fixture baseline-crece (unidad pura)', () => {
  const base = JSON.parse(readFileSync(fixture('baseline-crece/base/deuda-catalogo.json'), 'utf8'));
  const head = JSON.parse(readFileSync(fixture('baseline-crece/head/deuda-catalogo.json'), 'utf8'));

  assert.deepEqual(calcularCrecimientoBaseline(head, base), ['vistas/FixtureDeudaC.tsx']);
  assert.deepEqual(calcularCrecimientoBaseline(base, base), []);
});

test('gate: la linea base creció respecto de --baseline-base falla nombrando el elemento agregado (escenario f)', () => {
  const result = ejecutarGate([
    '--source-root', fixture('baseline-crece'),
    '--baseline-base', fixture('baseline-crece/base/deuda-catalogo.json'),
    '--strict-baseline',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /FixtureDeudaC\.tsx/);
  assert.doesNotMatch(result.stderr, /FixtureDeudaA\.tsx/);
});

// --- (h) Bootstrap: --baseline-base ausente/vacío bajo --strict-baseline ----------------------
// Reproduce el fallo real de CI (PR #26): la rama base del PR aun no tiene
// shared/soporte/deuda-catalogo.json (se crea recien en este PR), asi que
// `git show "$BASE:...deuda-catalogo.json" > archivo || true` deja `archivo` ausente/vacio.
// D6 (design.md): "si el archivo no existe en base (PR que lo introduce) => bootstrap, se salta
// con aviso" -- esto aplica SIEMPRE, incluso con --strict-baseline, porque no hay nada previo
// respecto a lo cual "crecer".

test('gate: --baseline-base apunta a un archivo inexistente con --strict-baseline activo no falla por eso (bootstrap, escenario h)', () => {
  conArchivoTemporal('vistas/VistaConMarcador.tsx\n', (changedFiles) => {
    const result = ejecutarGate([
      '--source-root', fixture('gate-limpio'),
      '--changed-files', changedFiles,
      '--baseline-base', fixture('gate-limpio/shared/soporte/no-existe-deuda-catalogo.json'),
      '--strict-baseline',
    ]);

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /No se pudo resolver --baseline-base/);
  });
});

test('gate: --baseline-base apunta a un archivo vacío con --strict-baseline activo no falla por eso (bootstrap, escenario h)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'verificar-rutas-soporte-baseline-vacio-'));
  const baselineBaseVacio = path.join(dir, 'deuda-base-vacia.json');
  writeFileSync(baselineBaseVacio, '', 'utf8');
  try {
    conArchivoTemporal('vistas/VistaConMarcador.tsx\n', (changedFiles) => {
      const result = ejecutarGate([
        '--source-root', fixture('gate-limpio'),
        '--changed-files', changedFiles,
        '--baseline-base', baselineBaseVacio,
        '--strict-baseline',
      ]);

      assert.equal(result.status, 0, `stderr: ${result.stderr}`);
      assert.doesNotMatch(result.stderr, /No se pudo resolver --baseline-base/);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- (g) Arbol integro: todos los chequeos a la vez, sin nada roto ------------------------------

test('gate: arbol integro con cobertura, deuda sin tocar y baseline sin crecimiento pasa limpio (escenario g)', () => {
  conArchivoTemporal('vistas/VistaConMarcador.tsx\n', (changedFiles) => {
    const result = ejecutarGate([
      '--source-root', fixture('gate-limpio'),
      '--changed-files', changedFiles,
      '--baseline-base', path.join(fixture('gate-limpio'), 'shared/soporte/deuda-catalogo.json'),
      '--strict-baseline',
    ]);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

// --- Bonus (tarea 7.3): dry run local contra la raiz real del repo -------------------------------

test('gate: dry run contra la raiz real del repo pasa limpio sin flags (regresion continua)', () => {
  const result = ejecutarGate(['--source-root', repoRoot]);

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
});
