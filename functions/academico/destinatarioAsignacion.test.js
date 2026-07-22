'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { aplicaAlEstudiante } = require('./destinatarioAsignacion');

test('destinatario "estudiante": solo aplica a los ids listados', () => {
  const asignacion = { destinatario: { tipo: 'estudiante', estudianteIds: ['e1', 'e2'] } };
  assert.equal(aplicaAlEstudiante(asignacion, { id: 'e1' }), true);
  assert.equal(aplicaAlEstudiante(asignacion, { id: 'e3' }), false);
});

test('destinatario "grupo": aplica por coincidencia de grupo o "Todos"', () => {
  const asignacion = { destinatario: { tipo: 'grupo', grupo: 'Infantil' } };
  assert.equal(aplicaAlEstudiante(asignacion, { grupo: 'Infantil' }), true);
  assert.equal(aplicaAlEstudiante(asignacion, { grupo: 'Competencia' }), false);

  const paraTodos = { destinatario: { tipo: 'grupo', grupo: 'Todos' } };
  assert.equal(aplicaAlEstudiante(paraTodos, { grupo: 'Cualquiera' }), true);
});

test('destinatario "grado": exige grupo Y grado dentro de la lista', () => {
  const asignacion = { destinatario: { tipo: 'grado', grupo: 'Infantil', grados: ['Blanco', 'Amarillo'] } };
  assert.equal(aplicaAlEstudiante(asignacion, { grupo: 'Infantil', grado: 'Blanco' }), true);
  assert.equal(aplicaAlEstudiante(asignacion, { grupo: 'Infantil', grado: 'Verde' }), false);
  assert.equal(aplicaAlEstudiante(asignacion, { grupo: 'Competencia', grado: 'Blanco' }), false);
});

test('destinatario "grado" sin lista de grados: solo exige que coincida el grupo', () => {
  const asignacion = { destinatario: { tipo: 'grado', grupo: 'Infantil', grados: [] } };
  assert.equal(aplicaAlEstudiante(asignacion, { grupo: 'Infantil', grado: 'CualquieraSirve' }), true);
  assert.equal(aplicaAlEstudiante(asignacion, { grupo: 'Competencia', grado: 'X' }), false);
});

test('tipo de destinatario desconocido no aplica a nadie', () => {
  const asignacion = { destinatario: { tipo: 'otro' } };
  assert.equal(aplicaAlEstudiante(asignacion, { id: 'e1', grupo: 'Infantil' }), false);
});
