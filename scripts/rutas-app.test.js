import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerRutasApp } from './lib/catalogo-fuente.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '__fixtures__', 'catalogo-gate', 'app-rutas');

test('leerRutasApp: encuentra exactamente los 6 pares {route, archivo} reales del fixture', () => {
  const pares = leerRutasApp({ root });

  assert.equal(pares.length, 6);
  assert.ok(pares.every((par) => typeof par.route === 'string' && typeof par.archivo === 'string'));
});

test('leerRutasApp: resuelve un path literal a su archivo importado', () => {
  const pares = leerRutasApp({ root });

  const simple = pares.find((par) => par.route === '/simple');
  assert.ok(simple);
  assert.equal(simple.archivo, 'vistas/VistaSimple.tsx');
});

test('leerRutasApp: el comodin "*" nunca se reporta como ruta real', () => {
  const pares = leerRutasApp({ root });

  assert.ok(pares.every((par) => par.route !== '*'));
});

test('leerRutasApp: una ruta de layout sin `path` se salta, pero sus hijas anidadas se recorren igual', () => {
  const pares = leerRutasApp({ root });

  // La ruta de layout en si misma (element con ternario ComponenteLocal/Navigate) no produce
  // ningun par: no tiene atributo `path`. Su hija anidada "/anidada" si debe aparecer.
  const anidada = pares.find((par) => par.route === '/anidada');
  assert.ok(anidada, 'la ruta anidada /anidada debe seguir siendo encontrada');
  assert.equal(anidada.archivo, 'vistas/VistaSimple.tsx');
});

test('leerRutasApp: un `element` ternario recolecta el subarbol completo, excluyendo tags de react-router-dom', () => {
  const pares = leerRutasApp({ root });

  const conTernario = pares.filter((par) => par.route === '/con-ternario');
  // Solo el tag real de vista sobrevive; <ReactRouterDOM.Navigate .../> queda excluido.
  assert.equal(conTernario.length, 1);
  assert.equal(conTernario[0].archivo, 'vistas/VistaConTernario.tsx');
  assert.ok(pares.every((par) => par.archivo !== 'react-router-dom'));
});

test('leerRutasApp: dos rutas distintas pueden apuntar al mismo archivo (relacion N:M real)', () => {
  const pares = leerRutasApp({ root });

  const compartida = pares.find((par) => par.route === '/compartida');
  const compartidaAlias = pares.find((par) => par.route === '/compartida-alias');
  assert.ok(compartida && compartidaAlias);
  assert.equal(compartida.archivo, 'vistas/VistaCompartida.tsx');
  assert.equal(compartidaAlias.archivo, 'vistas/VistaCompartida.tsx');
});

test('leerRutasApp: un componente declarado localmente (sin ImportDeclaration) mapea al propio App.tsx', () => {
  const pares = leerRutasApp({ root });

  const raiz = pares.find((par) => par.route === '/');
  assert.ok(raiz);
  assert.equal(raiz.archivo, 'App.tsx');
});
