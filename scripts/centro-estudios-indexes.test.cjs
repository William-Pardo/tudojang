const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes ?? [];

function hasIndex(collectionGroup, queryScope, fieldPaths) {
  return indexes.some((index) => (
    index.collectionGroup === collectionGroup
    && index.queryScope === queryScope
    && fieldPaths.every((fieldPath, position) => index.fields?.[position]?.fieldPath === fieldPath)
  ));
}

test('Centro de Estudios tiene indices Firestore criticos para produccion', () => {
  assert.equal(hasIndex('asignaciones', 'COLLECTION', ['tenantId', 'estado', 'fechaCierre']), true);
  assert.equal(hasIndex('asignaciones', 'COLLECTION', ['tenantId', 'destinatario.grupoId', 'fechaApertura']), true);
  assert.equal(hasIndex('asignaciones', 'COLLECTION', ['tenantId', 'jornadaId', 'fechaApertura']), true);
  assert.equal(hasIndex('progreso', 'COLLECTION_GROUP', ['tenantId', 'estudianteId', 'estado']), true);
  assert.equal(hasIndex('progreso', 'COLLECTION_GROUP', ['tenantId', 'asignacionId', 'estado']), true);
  assert.equal(hasIndex('jornadas', 'COLLECTION', ['tenantId', 'sedeId', 'fechaHora']), true);
  assert.equal(hasIndex('jornadas', 'COLLECTION', ['tenantId', 'instructorId', 'fechaHora']), true);
  assert.equal(hasIndex('jornadas', 'COLLECTION', ['tenantId', 'espacioId', 'fechaHora']), true);
  assert.equal(hasIndex('recursos', 'COLLECTION', ['tenantId', 'estado', 'ficha.disciplina']), true);
  assert.equal(hasIndex('invitaciones', 'COLLECTION', ['tenantId', 'estado', 'rol']), true);
  assert.equal(hasIndex('tickets_soporte', 'COLLECTION', ['tenantId', 'userId', 'status', 'createdAt']), true);
});
