'use strict';

// functions/facturacion.test.js — CJS (node:test), mirror exacto de utils/facturacion.test.ts
// (Jest). Ambas suites iteran facturacion-vectores.json (SDD pricing-cupo-real, Bloque 2, D1
// design.md): la paridad entre esta implementacion y utils/facturacion.ts es un contrato de
// datos verificado por 2 suites independientes, no una promesa de revision manual.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularFacturacionMensual,
  calcularCapacidad,
  esFacturable,
  normalizarEstadoMatricula,
} = require('./facturacion.js');
const vectores = require('./facturacion-vectores.json');

test('facturacion-vectores.json expone las 4 listas de vectores esperadas', () => {
  assert.equal(typeof vectores.version, 'number');
  assert.ok(Array.isArray(vectores.calcularFacturacionMensual) && vectores.calcularFacturacionMensual.length > 0);
  assert.ok(Array.isArray(vectores.calcularCapacidad) && vectores.calcularCapacidad.length > 0);
  assert.ok(Array.isArray(vectores.esFacturable) && vectores.esFacturable.length > 0);
  assert.ok(Array.isArray(vectores.normalizarEstadoMatricula) && vectores.normalizarEstadoMatricula.length > 0);
});

for (const vector of vectores.calcularFacturacionMensual) {
  test(`calcularFacturacionMensual: ${vector.nombre}`, () => {
    assert.deepEqual(calcularFacturacionMensual(vector.entrada), vector.esperado);
  });
}

for (const vector of vectores.calcularCapacidad) {
  test(`calcularCapacidad: ${vector.nombre}`, () => {
    assert.deepEqual(calcularCapacidad(vector.entrada), vector.esperado);
  });
}

for (const vector of vectores.esFacturable) {
  test(`esFacturable: ${vector.nombre}`, () => {
    assert.equal(esFacturable(vector.entrada), vector.esperado);
  });
}

for (const vector of vectores.normalizarEstadoMatricula) {
  test(`normalizarEstadoMatricula: ${vector.nombre}`, () => {
    assert.equal(normalizarEstadoMatricula(vector.entrada), vector.esperado);
  });
}

// calcularCapacidad es pura (D4, design.md): el bono se lee de un flag ya persistido, JAMAS
// de un conteo en vivo. Agregar un campo espurio de conteo al input no debe cambiar nada.
test('calcularCapacidad nunca lee un conteo de estudiantes del input (pureza, D4)', () => {
  const base = { sedeBonusOtorgada: true, sedesExtraContratadas: 2, equipoTecnicoExtraContratado: 1 };
  const conEstudiantesEspurios = { ...base, estudiantesFacturables: 999999 };
  assert.deepEqual(calcularCapacidad(conEstudiantesEspurios), calcularCapacidad(base));
});

// Continuidad exacta en cada ex-limite de tramo (spec facturacion-metered, Scenario
// "Continuidad exacta en cada limite de tramo") -- la pieza mas sensible a bugs sutiles de
// todo el cambio (design.md). Ya cubierto por pares de vectores arriba; estas 3 asserts lo
// hacen explicito como delta, no solo implicito por comparacion manual de dos vectores. Con
// descuentoVolumenActivo=false (ajuste de precios, 2026-08-25) TODOS los estudiantes pagan
// tarifaEstandarPorEstudiante ($5.000) sin importar el tramo historico: el delta de agregar 1
// estudiante en cualquier ex-limite de tramo debe ser exactamente esa tarifa plana, no la
// tarifa marginal vieja ($3.600/$3.400/$3.000). Cuando descuentoVolumenActivo vuelva a true,
// estos deltas vuelven a ser la tarifa marginal del tramo siguiente.
const sinExtras = (estudiantesFacturables) => ({ estudiantesFacturables, sedesExtraContratadas: 0, equipoTecnicoExtraContratado: 0 });

test('continuidad exacta: 70 -> 71 suma exactamente la tarifa plana ($5.000), tramo desactivado', () => {
  const en70 = calcularFacturacionMensual(sinExtras(70));
  const en71 = calcularFacturacionMensual(sinExtras(71));
  assert.equal(en71.totalPesos - en70.totalPesos, 5000);
});

test('continuidad exacta: 150 -> 151 suma exactamente la tarifa plana ($5.000), tramo desactivado', () => {
  const en150 = calcularFacturacionMensual(sinExtras(150));
  const en151 = calcularFacturacionMensual(sinExtras(151));
  assert.equal(en151.totalPesos - en150.totalPesos, 5000);
});

test('continuidad exacta: 350 -> 351 suma exactamente la tarifa plana ($5.000), tramo desactivado', () => {
  const en350 = calcularFacturacionMensual(sinExtras(350));
  const en351 = calcularFacturacionMensual(sinExtras(351));
  assert.equal(en351.totalPesos - en350.totalPesos, 5000);
});
