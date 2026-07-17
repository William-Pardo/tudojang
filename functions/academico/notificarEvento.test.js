'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioNotificarEventoNuevo } = require('./notificarEvento');

const ahora = new Date('2026-07-15T13:00:00Z');

function deps({ estudiantes, yaNotificados = new Set() }) {
  const creadas = [];
  return {
    creadas,
    dep: {
      listarEstudiantesDelTenant: async () => estudiantes,
      estudiantesYaNotificadosDelEvento: async () => yaNotificados,
      crearNotificacion: async (n) => { creadas.push(n); },
    },
  };
}

test('notifica a todos los estudiantes del tenant cuando la inscripción está abierta', async () => {
  const { creadas, dep } = deps({
    estudiantes: [
      { id: 'e1', nombres: 'Ana', apellidos: 'P', tutor: { correo: 'papa@test.com', nombres: 'Papa' } },
      { id: 'e2', nombres: 'Leo', apellidos: 'G', correo: 'leo@test.com' },
    ],
  });
  const servicio = crearServicioNotificarEventoNuevo(dep);

  const res = await servicio(
    { tenantId: 't1', nombre: 'Torneo Nacional', fechaEvento: '2026-09-01', fechaFinInscripcion: '2026-08-20' },
    'evt-1',
    ahora
  );

  assert.equal(res.creadas, 2);
  assert.equal(creadas[0].tipo, 'EventoNuevo');
  assert.equal(creadas[0].eventoId, 'evt-1');
  assert.equal(creadas[0].destinatario, 'papa@test.com');
  assert.match(creadas[0].mensaje, /Torneo Nacional/);
});

test('no notifica si la inscripción ya cerró', async () => {
  const { creadas, dep } = deps({ estudiantes: [{ id: 'e1', nombres: 'Ana' }] });
  const servicio = crearServicioNotificarEventoNuevo(dep);

  const res = await servicio(
    { tenantId: 't1', nombre: 'Viejo', fechaFinInscripcion: '2026-07-01' },
    'evt-viejo',
    ahora
  );

  assert.equal(res.creadas, 0);
  assert.equal(res.motivo, 'inscripcion-cerrada');
  assert.equal(creadas.length, 0);
});

test('dedup: no repite a estudiantes ya notificados del evento', async () => {
  const { creadas, dep } = deps({
    estudiantes: [{ id: 'e1', nombres: 'Ana' }, { id: 'e2', nombres: 'Leo' }],
    yaNotificados: new Set(['e1']),
  });
  const servicio = crearServicioNotificarEventoNuevo(dep);

  const res = await servicio({ tenantId: 't1', nombre: 'X', fechaFinInscripcion: '2026-08-20' }, 'evt-1', ahora);

  assert.equal(res.creadas, 1);
  assert.equal(creadas[0].estudianteId, 'e2');
});

test('evento inválido no crea nada', async () => {
  const { creadas, dep } = deps({ estudiantes: [{ id: 'e1' }] });
  const servicio = crearServicioNotificarEventoNuevo(dep);
  const res = await servicio(null, 'evt-1', ahora);
  assert.equal(res.creadas, 0);
  assert.equal(creadas.length, 0);
});
