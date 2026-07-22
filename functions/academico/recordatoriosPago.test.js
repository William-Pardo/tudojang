'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioRecordatoriosPago, periodoBogota } = require('./recordatoriosPago');

const ahoraFijo = new Date('2026-07-15T13:00:00Z');

function crearDeps({ estudiantes, yaNotificados = new Set() }) {
  const creadas = [];
  return {
    creadas,
    deps: {
      listarEstudiantesConSaldo: async () => estudiantes,
      estudiantesYaNotificadosEnPeriodo: async () => yaNotificados,
      crearNotificacion: async (n) => { creadas.push(n); },
    },
  };
}

test('crea una notificación de pago por cada estudiante con saldo pendiente', async () => {
  const { creadas, deps } = crearDeps({
    estudiantes: [
      { id: 'e1', nombres: 'Ana', apellidos: 'P', saldoDeudor: 180000, tutor: { nombres: 'Papa', apellidos: 'P', correo: 'papa@test.com' } },
      { id: 'e2', nombres: 'Leo', apellidos: 'G', saldoDeudor: 50000, correo: 'leo@test.com' },
    ],
  });
  const servicio = crearServicioRecordatoriosPago(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 2);
  assert.equal(creadas.length, 2);
  assert.equal(creadas[0].estudianteId, 'e1');
  assert.equal(creadas[0].tipo, 'RecordatorioPago');
  assert.equal(creadas[0].leida, false);
  assert.equal(creadas[0].destinatario, 'papa@test.com'); // prioriza el tutor
  assert.match(creadas[0].mensaje, /saldo pendiente de \$180.000/);
  assert.equal(creadas[1].destinatario, 'leo@test.com'); // sin tutor -> correo del estudiante
});

test('no duplica: salta estudiantes ya notificados en el periodo', async () => {
  const { creadas, deps } = crearDeps({
    estudiantes: [
      { id: 'e1', nombres: 'Ana', apellidos: 'P', saldoDeudor: 180000 },
      { id: 'e2', nombres: 'Leo', apellidos: 'G', saldoDeudor: 50000 },
    ],
    yaNotificados: new Set(['e1']),
  });
  const servicio = crearServicioRecordatoriosPago(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 1);
  assert.equal(creadas.length, 1);
  assert.equal(creadas[0].estudianteId, 'e2');
});

test('ignora estudiantes sin saldo (guarda defensiva)', async () => {
  const { creadas, deps } = crearDeps({
    estudiantes: [
      { id: 'e1', nombres: 'Ana', apellidos: 'P', saldoDeudor: 0 },
      { id: 'e2', nombres: 'Leo', apellidos: 'G', saldoDeudor: -100 },
    ],
  });
  const servicio = crearServicioRecordatoriosPago(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 0);
  assert.equal(creadas.length, 0);
});

test('el periodo se calcula en hora Bogota (YYYY-MM)', () => {
  assert.equal(periodoBogota(new Date('2026-07-15T13:00:00Z')), '2026-07');
  // 2026-08-01T02:00Z = 2026-07-31 21:00 Bogota -> periodo julio
  assert.equal(periodoBogota(new Date('2026-08-01T02:00:00Z')), '2026-07');
});
