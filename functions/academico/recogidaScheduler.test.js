const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioAvisarRecogidaProxima } = require('./recogidaScheduler');

// Clase 18:00-19:00 Bogota. Ventana de aviso = [18:45, 19:00] = [23:45Z, 00:00Z(+1)].
const EN_VENTANA_AVISO = new Date('2026-07-25T23:50:00.000Z'); // 18:50 Bogota
const MUY_TEMPRANO = new Date('2026-07-25T23:30:00.000Z');     // 18:30 Bogota

function crearSnap(id, data) {
  const updates = [];
  return { id, ref: { update: async (p) => updates.push(p) }, data: () => data, _updates: updates };
}

const jornadaBase = (over = {}) => ({
  tenantId: 'tenant-1', estado: 'en_curso', fecha: '2026-07-25', horaInicio: '18:00', horaFin: '19:00',
  tema: 'Taeguk 1', ...over,
});

// Helper para armar el servicio con datos en memoria.
function crearServicio({ jornadas, asistenciasPorJornada = {}, estudiantes = {}, notificaciones }) {
  return crearServicioAvisarRecogidaProxima({
    listarJornadasEnCurso: async () => jornadas,
    listarAsistenciasDeJornada: async (jSnap) => asistenciasPorJornada[jSnap.id] || [],
    obtenerEstudiante: async (id) => estudiantes[id] || null,
    crearNotificacion: async (n) => { notificaciones[n.id] = n; },
  });
}

test('avisa a un chico de RECOGIDA presente cuando la clase esta por terminar', async () => {
  const notificaciones = {};
  const jornada = crearSnap('jor-1', jornadaBase());
  const servicio = crearServicio({
    jornadas: [jornada],
    asistenciasPorJornada: { 'jor-1': [{ estudianteId: 'est-1', horaEntrada: '2026-07-25T23:05:00Z' }] },
    estudiantes: { 'est-1': { nombres: 'Sofia', apellidos: 'Perez', modoTransporte: 'recogida', tutor: { correo: 'papa@test.com' } } },
    notificaciones,
  });

  const r = await servicio(EN_VENTANA_AVISO);

  assert.equal(r.avisados, 1);
  const notif = notificaciones['recogida-jor-1-est-1'];
  assert.ok(notif);
  assert.equal(notif.destinatario, 'papa@test.com');
  assert.equal(notif.tipo, 'RecogidaProxima');
  assert.match(notif.mensaje, /Sofia Perez/);
  // Marca la jornada como avisada (idempotencia).
  assert.deepEqual(jornada._updates, [{ avisoRecogidaEnviado: true, actualizadoEn: EN_VENTANA_AVISO.toISOString() }]);
});

test('NO avisa si todavia es muy temprano (fuera de la ventana horaFin-15)', async () => {
  const notificaciones = {};
  const jornada = crearSnap('jor-1', jornadaBase());
  const servicio = crearServicio({
    jornadas: [jornada],
    asistenciasPorJornada: { 'jor-1': [{ estudianteId: 'est-1', horaEntrada: '2026-07-25T23:05:00Z' }] },
    estudiantes: { 'est-1': { nombres: 'Sofia', modoTransporte: 'recogida', tutor: { correo: 'papa@test.com' } } },
    notificaciones,
  });

  const r = await servicio(MUY_TEMPRANO);

  assert.equal(r.avisados, 0);
  assert.deepEqual(notificaciones, {});
  assert.deepEqual(jornada._updates, []);
});

test('NO avisa a un chico de RUTA DE BUS (ese se maneja en el check-out, WS-3a)', async () => {
  const notificaciones = {};
  const jornada = crearSnap('jor-1', jornadaBase());
  const servicio = crearServicio({
    jornadas: [jornada],
    asistenciasPorJornada: { 'jor-1': [{ estudianteId: 'est-bus', horaEntrada: '2026-07-25T23:05:00Z' }] },
    estudiantes: { 'est-bus': { nombres: 'Juan', modoTransporte: 'ruta_bus', tutor: { correo: 'papa@test.com' } } },
    notificaciones,
  });

  const r = await servicio(EN_VENTANA_AVISO);
  assert.equal(r.avisados, 0);
});

test('NO avisa a un chico que YA hizo check-out (ya se fue)', async () => {
  const notificaciones = {};
  const jornada = crearSnap('jor-1', jornadaBase());
  const servicio = crearServicio({
    jornadas: [jornada],
    asistenciasPorJornada: { 'jor-1': [{ estudianteId: 'est-1', horaEntrada: '2026-07-25T23:05:00Z', horaSalida: '2026-07-25T23:40:00Z' }] },
    estudiantes: { 'est-1': { nombres: 'Sofia', modoTransporte: 'recogida', tutor: { correo: 'papa@test.com' } } },
    notificaciones,
  });

  const r = await servicio(EN_VENTANA_AVISO);
  assert.equal(r.avisados, 0);
});

test('NO reavisa una jornada ya marcada (avisoRecogidaEnviado=true)', async () => {
  const notificaciones = {};
  const jornada = crearSnap('jor-1', jornadaBase({ avisoRecogidaEnviado: true }));
  const servicio = crearServicio({
    jornadas: [jornada],
    asistenciasPorJornada: { 'jor-1': [{ estudianteId: 'est-1', horaEntrada: '2026-07-25T23:05:00Z' }] },
    estudiantes: { 'est-1': { nombres: 'Sofia', modoTransporte: 'recogida', tutor: { correo: 'papa@test.com' } } },
    notificaciones,
  });

  const r = await servicio(EN_VENTANA_AVISO);
  assert.equal(r.avisados, 0);
  assert.deepEqual(jornada._updates, []);
});

test('un chico de recogida SIN acudiente no genera aviso', async () => {
  const notificaciones = {};
  const jornada = crearSnap('jor-1', jornadaBase());
  const servicio = crearServicio({
    jornadas: [jornada],
    asistenciasPorJornada: { 'jor-1': [{ estudianteId: 'est-1', horaEntrada: '2026-07-25T23:05:00Z' }] },
    estudiantes: { 'est-1': { nombres: 'Sofia', modoTransporte: 'recogida' } }, // sin tutor
    notificaciones,
  });

  const r = await servicio(EN_VENTANA_AVISO);
  assert.equal(r.avisados, 0);
  // Igual marca la jornada como procesada (no hay a quién avisar, pero no hay que reintentar).
  assert.deepEqual(jornada._updates, [{ avisoRecogidaEnviado: true, actualizadoEn: EN_VENTANA_AVISO.toISOString() }]);
});

test('mezcla: en una jornada avisa solo a los de recogida presentes', async () => {
  const notificaciones = {};
  const jornada = crearSnap('jor-1', jornadaBase());
  const servicio = crearServicio({
    jornadas: [jornada],
    asistenciasPorJornada: { 'jor-1': [
      { estudianteId: 'recoge', horaEntrada: '2026-07-25T23:05:00Z' },
      { estudianteId: 'bus', horaEntrada: '2026-07-25T23:05:00Z' },
      { estudianteId: 'yaSalio', horaEntrada: '2026-07-25T23:05:00Z', horaSalida: '2026-07-25T23:40:00Z' },
    ] },
    estudiantes: {
      recoge: { nombres: 'A', modoTransporte: 'recogida', tutor: { correo: 'a@test.com' } },
      bus: { nombres: 'B', modoTransporte: 'ruta_bus', tutor: { correo: 'b@test.com' } },
      yaSalio: { nombres: 'C', modoTransporte: 'recogida', tutor: { correo: 'c@test.com' } },
    },
    notificaciones,
  });

  const r = await servicio(EN_VENTANA_AVISO);
  assert.equal(r.avisados, 1);
  assert.ok(notificaciones['recogida-jor-1-recoge']);
  assert.equal(Object.keys(notificaciones).length, 1);
});

test('un estudiante sin modoTransporte (default) se trata como recogida y SI se avisa', async () => {
  const notificaciones = {};
  const jornada = crearSnap('jor-1', jornadaBase());
  const servicio = crearServicio({
    jornadas: [jornada],
    asistenciasPorJornada: { 'jor-1': [{ estudianteId: 'est-1', horaEntrada: '2026-07-25T23:05:00Z' }] },
    estudiantes: { 'est-1': { nombres: 'Sofia', tutor: { correo: 'papa@test.com' } } }, // sin modoTransporte
    notificaciones,
  });

  const r = await servicio(EN_VENTANA_AVISO);
  assert.equal(r.avisados, 1);
});
