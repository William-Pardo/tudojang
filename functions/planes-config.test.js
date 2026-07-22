'use strict';

// Red de seguridad para planes-config.json (raiz del repo), fuente unica de verdad de
// los valores numericos de planes/addons consumida por constantes.ts (frontend),
// wompiCobroAutomatico.js, academico/sedes.js y academico/estudiantes.js. Este test NO
// busca detectar discrepancias entre copias (ya no pueden existir: todo lee del mismo
// archivo) -- es una alarma si alguien edita el JSON a mano y le cambia la forma o un
// valor sin darse cuenta del impacto en los 4 consumidores.

const test = require('node:test');
const assert = require('node:assert/strict');
const planesConfig = require('./planes-config.json');

test('planes-config: expone exactamente los 3 planes esperados (starter/growth/pro)', () => {
  assert.deepEqual(Object.keys(planesConfig.planes).sort(), ['growth', 'pro', 'starter']);
});

test('planes-config: expone exactamente los 3 addons esperados (estudiantes/instructor/sede)', () => {
  assert.deepEqual(Object.keys(planesConfig.addons).sort(), ['estudiantes', 'instructor', 'sede']);
});

test('planes-config: valores numericos de cada plan (precio, limiteEstudiantes, limiteUsuarios, limiteSedes)', () => {
  assert.deepEqual(planesConfig.planes.starter, {
    precio: 200000,
    limiteEstudiantes: 50,
    limiteUsuarios: 2,
    limiteSedes: 2,
  });
  assert.deepEqual(planesConfig.planes.growth, {
    precio: 540000,
    limiteEstudiantes: 150,
    limiteUsuarios: 5,
    limiteSedes: 3,
  });
  assert.deepEqual(planesConfig.planes.pro, {
    precio: 1200000,
    limiteEstudiantes: 350,
    limiteUsuarios: 10,
    limiteSedes: 6,
  });
});

test('planes-config: valores numericos de cada addon (cantidad, precio)', () => {
  assert.deepEqual(planesConfig.addons.estudiantes, { cantidad: 10, precio: 36000 });
  assert.deepEqual(planesConfig.addons.instructor, { cantidad: 1, precio: 36000 });
  assert.deepEqual(planesConfig.addons.sede, { cantidad: 1, precio: 89900 });
});
