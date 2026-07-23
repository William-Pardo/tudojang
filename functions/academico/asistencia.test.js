const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioRegistrarAsistencia } = require('./asistencia');

// Patrón de mocks: makeFirestore/makeContext (ver design.md, Testing Strategy,
// inspirado en las factories de invitaciones.test.js), ejecutado con node:test
// (mismo runner que ya usa functions/academico/asignaciones.test.js en este repo).

function makeContext({ uid = 'maestro-1', rol = 'Editor', tenantId = 'tenant-1' } = {}) {
  if (rol === null) return { auth: null };
  return { auth: { uid, token: { rol, tenantId } } };
}

function makeFirestore({
  jornada, inscripciones = [], asistencias = {}, writes = [], estudiantes = {}, ejecucion,
  metricasAsistencia = {}, historialNotificaciones = {},
} = {}) {
  const state = { jornada, inscripciones, asistencias, writes, estudiantes, ejecucion, metricasAsistencia, historialNotificaciones };
  return {
    collection: (name) => makeRef([name], state),
    _state: state,
  };
}

function makeRef(path, state) {
  return {
    doc: (id) => makeRef([...path, id], state),
    collection: (name) => makeRef([...path, name], state),
    get: async () => {
      const joined = path.join('/');

      const jornadaMatch = joined.match(/^tenants\/([^/]+)\/jornadas\/([^/]+)$/);
      if (jornadaMatch) {
        const [, , jornadaId] = jornadaMatch;
        return makeSnap(state.jornada && state.jornada.id === jornadaId ? state.jornada : null);
      }

      const inscripcionMatch = joined.match(
        /^tenants\/([^/]+)\/ejecucionesPrograma\/([^/]+)\/inscripciones\/([^/]+)$/
      );
      if (inscripcionMatch) {
        const [, , ejecucionProgramaId, estudianteId] = inscripcionMatch;
        const inscripcion = state.inscripciones.find(
          (i) => i.ejecucionProgramaId === ejecucionProgramaId && i.estudianteId === estudianteId
        );
        return makeSnap(inscripcion || null);
      }

      // Colección top-level (no anidada bajo tenants/{t}), igual que en produccion
      // (servicios/estudiantesApi.ts: doc(db, 'estudiantes', id)).
      const estudianteMatch = joined.match(/^estudiantes\/([^/]+)$/);
      if (estudianteMatch) {
        const [, estudianteId] = estudianteMatch;
        return makeSnap(state.estudiantes[estudianteId] || null);
      }

      const ejecucionMatch = joined.match(/^tenants\/([^/]+)\/ejecucionesPrograma\/([^/]+)$/);
      if (ejecucionMatch) {
        const [, , ejecucionProgramaId] = ejecucionMatch;
        return makeSnap(state.ejecucion && state.ejecucion.id === ejecucionProgramaId ? state.ejecucion : null);
      }

      const asistenciaMatch = joined.match(
        /^tenants\/([^/]+)\/jornadas\/([^/]+)\/asistencias\/([^/]+)$/
      );
      if (asistenciaMatch) {
        const [, , jornadaId, estudianteId] = asistenciaMatch;
        const registro = state.asistencias[`${jornadaId}/${estudianteId}`];
        return makeSnap(registro || null);
      }

      const metricaMatch = joined.match(/^tenants\/([^/]+)\/metricasAsistencia\/([^/]+)$/);
      if (metricaMatch) {
        const [, , estudianteId] = metricaMatch;
        return makeSnap(state.metricasAsistencia[estudianteId] || null);
      }

      return makeSnap(null);
    },
    set: async (data, options) => {
      const joined = path.join('/');
      state.writes.push({ path: joined, data, options });

      const asistenciaMatch = joined.match(
        /^tenants\/([^/]+)\/jornadas\/([^/]+)\/asistencias\/([^/]+)$/
      );
      if (asistenciaMatch) {
        const [, , jornadaId, estudianteId] = asistenciaMatch;
        const key = `${jornadaId}/${estudianteId}`;
        const previo = options && options.merge ? state.asistencias[key] || {} : {};
        state.asistencias[key] = { ...previo, ...data };
      }

      const metricaMatch = joined.match(/^tenants\/([^/]+)\/metricasAsistencia\/([^/]+)$/);
      if (metricaMatch) {
        const [, , estudianteId] = metricaMatch;
        const previo = options && options.merge ? state.metricasAsistencia[estudianteId] || {} : {};
        state.metricasAsistencia[estudianteId] = { ...previo, ...data };
      }

      const notifMatch = joined.match(/^historialNotificaciones\/([^/]+)$/);
      if (notifMatch) {
        const [, notifId] = notifMatch;
        state.historialNotificaciones[notifId] = { ...data };
      }
    },
  };
}

function makeSnap(data) {
  return { exists: Boolean(data), data: () => data };
}

function dataBase(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    jornadaId: 'jornada-1',
    estudianteId: 'estudiante-1',
    ...overrides,
  };
}

const jornadaEnCurso = {
  id: 'jornada-1',
  tenantId: 'tenant-1',
  ejecucionProgramaId: 'ejecucion-1',
  estado: 'en_curso',
  instructorId: 'maestro-1',
};

// --- Cycle A: unauthenticated, rol, tenant, estado de la jornada -----------

test('registrarAsistenciaJornada rechaza si no hay usuario autenticado', async () => {
  const servicio = crearServicioRegistrarAsistencia({ firestore: makeFirestore() });

  await assert.rejects(
    () => servicio(dataBase(), makeContext({ rol: null })),
    /no autenticado/i
  );
});

test('registrarAsistenciaJornada rechaza rol Estudiante', async () => {
  const servicio = crearServicioRegistrarAsistencia({ firestore: makeFirestore() });

  await assert.rejects(
    () => servicio(dataBase(), makeContext({ rol: 'Estudiante' })),
    /rol no autorizado/i
  );
});

test('registrarAsistenciaJornada rechaza rol Tutor', async () => {
  const servicio = crearServicioRegistrarAsistencia({ firestore: makeFirestore() });

  await assert.rejects(
    () => servicio(dataBase(), makeContext({ rol: 'Tutor' })),
    /rol no autorizado/i
  );
});

test('registrarAsistenciaJornada rechaza tenantId que no coincide con el token del usuario', async () => {
  const servicio = crearServicioRegistrarAsistencia({ firestore: makeFirestore() });

  await assert.rejects(
    () => servicio(dataBase({ tenantId: 'otro-tenant' }), makeContext({ tenantId: 'tenant-1' })),
    /tenant no autorizado/i
  );
});

test('registrarAsistenciaJornada rechaza jornada inexistente', async () => {
  const servicio = crearServicioRegistrarAsistencia({ firestore: makeFirestore({ jornada: null }) });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /jornada no encontrada/i
  );
});

test('registrarAsistenciaJornada rechaza jornada que no esta en_curso', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({ jornada: { ...jornadaEnCurso, estado: 'confirmada' } }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /en curso/i
  );
});

// --- Cycle A-ventana: brecha 4-bis-C, la ENTRADA solo dentro de la ventana horaria ---------
//
// La jornada de estos tests SI tiene horario. Clase 18:00-19:00 hora Bogota (UTC-5) => ventana
// [17:45, 19:15] Bogota = [22:45Z, 00:15Z(+1)]. `ahora` se inyecta para ser determinista.

const jornadaConHorario = {
  ...jornadaEnCurso,
  fecha: '2026-07-25',
  horaInicio: '18:00',
  horaFin: '19:00',
};

test('registrarAsistenciaJornada registra la ENTRADA cuando ahora cae dentro de la ventana', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({ jornada: jornadaConHorario, inscripciones: [inscripcionEstudiante1] }),
    ahora: () => new Date('2026-07-25T23:30:00.000Z'), // 18:30 Bogota, en plena clase
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.ok, true);
  assert.equal(resultado.tipo, 'entrada');
});

test('registrarAsistenciaJornada RECHAZA la entrada DIAS despues (la brecha 4-bis-C)', async () => {
  // Jornada que quedo en_curso sin cerrar; alguien reusa el link/bookmark 3 dias despues.
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({ jornada: jornadaConHorario, inscripciones: [inscripcionEstudiante1] }),
    ahora: () => new Date('2026-07-28T23:30:00.000Z'), // 3 dias despues, misma hora
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /ventana horaria/i
  );
});

test('registrarAsistenciaJornada RECHAZA la entrada apenas pasada la ventana (fin+15)', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({ jornada: jornadaConHorario, inscripciones: [inscripcionEstudiante1] }),
    ahora: () => new Date('2026-07-26T00:30:00.000Z'), // 19:30 Bogota, 15 min pasado el cierre (00:15Z)
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /ventana horaria/i
  );
});

test('registrarAsistenciaJornada NO aplica la ventana a la SALIDA: un check-out tardio igual se registra', async () => {
  // Con entrada previa valida, la salida no se bloquea por ventana (no perder el dato de quien
  // SI estuvo). La entrada ya fue dentro de la ventana; el check-out puede ser un rato despues.
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaConHorario,
      inscripciones: [inscripcionEstudiante1],
      asistencias: { 'jornada-1/estudiante-1': { estudianteId: 'estudiante-1', horaEntrada: '2026-07-25T23:10:00.000Z' } },
    }),
    ahora: () => new Date('2026-07-26T01:00:00.000Z'), // pasada la ventana, pero es la SALIDA
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.ok, true);
  assert.equal(resultado.tipo, 'salida');
});

test('registrarAsistenciaJornada: una jornada SIN horario no evalua ventana (compatibilidad/doc malformado)', async () => {
  // jornadaEnCurso no tiene fecha/horaInicio/horaFin -> se salta la ventana (defensivo).
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({ jornada: jornadaEnCurso, inscripciones: [inscripcionEstudiante1] }),
    ahora: () => new Date('2030-01-01T00:00:00.000Z'),
  });

  const resultado = await servicio(dataBase(), makeContext());
  assert.equal(resultado.ok, true);
});

// --- WS-1: auditoria (checkedInBy/checkedOutBy) + puntualidad (isLate/minutesLate) ---------

test('registrarAsistenciaJornada: el check-in guarda checkedInBy con el uid de quien escaneo', async () => {
  const state = { jornada: jornadaConHorario, inscripciones: [inscripcionEstudiante1], writes: [], asistencias: {} };
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:05:00.000Z'), // 18:05, en clase
  });

  await servicio(dataBase(), makeContext({ uid: 'maestro-1' }));

  assert.equal(state.asistencias['jornada-1/estudiante-1'].checkedInBy, 'maestro-1');
});

test('registrarAsistenciaJornada: check-in a tiempo => isLate=false, minutesLate=0', async () => {
  const state = { jornada: jornadaConHorario, inscripciones: [inscripcionEstudiante1], writes: [], asistencias: {} };
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T22:55:00.000Z'), // 17:55, 5 min antes del inicio
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.isLate, false);
  assert.equal(resultado.minutesLate, 0);
  assert.equal(state.asistencias['jornada-1/estudiante-1'].isLate, false);
});

test('registrarAsistenciaJornada: check-in tarde => isLate=true, minutesLate calculado', async () => {
  const state = { jornada: jornadaConHorario, inscripciones: [inscripcionEstudiante1], writes: [], asistencias: {} };
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:12:00.000Z'), // 18:12, 12 min tarde
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.isLate, true);
  assert.equal(resultado.minutesLate, 12);
  assert.equal(state.asistencias['jornada-1/estudiante-1'].minutesLate, 12);
});

test('registrarAsistenciaJornada: el check-out guarda checkedOutBy', async () => {
  const state = {
    jornada: jornadaConHorario,
    inscripciones: [inscripcionEstudiante1],
    writes: [],
    asistencias: { 'jornada-1/estudiante-1': { estudianteId: 'estudiante-1', horaEntrada: '2026-07-25T23:05:00.000Z' } },
  };
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:50:00.000Z'),
  });

  const resultado = await servicio(dataBase(), makeContext({ uid: 'admin-9', rol: 'Admin' }));

  assert.equal(resultado.tipo, 'salida');
  assert.equal(state.asistencias['jornada-1/estudiante-1'].checkedOutBy, 'admin-9');
});

// --- WS-2: acumular horas reales por estudiante en el check-out (§7/§11) --------------------

test('registrarAsistenciaJornada: el check-out acumula minutos y clases en metricasAsistencia', async () => {
  const state = {
    jornada: jornadaConHorario,
    inscripciones: [inscripcionEstudiante1],
    writes: [],
    asistencias: { 'jornada-1/estudiante-1': { estudianteId: 'estudiante-1', horaEntrada: '2026-07-25T23:05:00.000Z' } },
    metricasAsistencia: {},
  };
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:50:00.000Z'), // 45 min despues de la entrada
  });

  await servicio(dataBase(), makeContext());

  const metrica = state.metricasAsistencia['estudiante-1'];
  assert.equal(metrica.minutosTotales, 45);
  assert.equal(metrica.clasesAsistidas, 1);
  assert.equal(metrica.estudianteId, 'estudiante-1');
  assert.equal(metrica.tenantId, 'tenant-1');
});

test('registrarAsistenciaJornada: dos clases distintas SUMAN sobre el acumulado previo', async () => {
  const state = {
    jornada: jornadaConHorario,
    inscripciones: [inscripcionEstudiante1],
    writes: [],
    asistencias: { 'jornada-1/estudiante-1': { estudianteId: 'estudiante-1', horaEntrada: '2026-07-25T23:05:00.000Z' } },
    // Ya asistio a una clase de 60 min antes.
    metricasAsistencia: { 'estudiante-1': { estudianteId: 'estudiante-1', tenantId: 'tenant-1', minutosTotales: 60, clasesAsistidas: 1 } },
  };
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:35:00.000Z'), // +30 min
  });

  await servicio(dataBase(), makeContext());

  const metrica = state.metricasAsistencia['estudiante-1'];
  assert.equal(metrica.minutosTotales, 90); // 60 + 30
  assert.equal(metrica.clasesAsistidas, 2);
});

test('registrarAsistenciaJornada: un 3er escaneo (rechazado) NO vuelve a acumular', async () => {
  const state = {
    jornada: jornadaConHorario,
    inscripciones: [inscripcionEstudiante1],
    writes: [],
    // Asistencia YA completa (entrada + salida).
    asistencias: {
      'jornada-1/estudiante-1': {
        estudianteId: 'estudiante-1',
        horaEntrada: '2026-07-25T23:05:00.000Z',
        horaSalida: '2026-07-25T23:50:00.000Z',
      },
    },
    metricasAsistencia: { 'estudiante-1': { estudianteId: 'estudiante-1', tenantId: 'tenant-1', minutosTotales: 45, clasesAsistidas: 1 } },
  };
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-26T00:00:00.000Z'),
  });

  await assert.rejects(() => servicio(dataBase(), makeContext()), /ya quedo completa/i);

  // El acumulado no cambio.
  assert.equal(state.metricasAsistencia['estudiante-1'].minutosTotales, 45);
  assert.equal(state.metricasAsistencia['estudiante-1'].clasesAsistidas, 1);
});

test('registrarAsistenciaJornada: el CHECK-IN no acumula (solo el check-out)', async () => {
  const state = {
    jornada: jornadaConHorario,
    inscripciones: [inscripcionEstudiante1],
    writes: [],
    asistencias: {},
    metricasAsistencia: {},
  };
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:05:00.000Z'),
  });

  await servicio(dataBase(), makeContext()); // check-in

  assert.equal(state.metricasAsistencia['estudiante-1'], undefined);
});

// --- WS-3a: notificacion al acudiente al salir en RUTA DE BUS (§8) --------------------------

const jornadaConTema = { ...jornadaConHorario, tema: 'Taeguk 1', sedeId: 'sede-norte' };

// Estado base para un check-out: entrada previa registrada.
const stateCheckoutBus = (estudiante) => ({
  jornada: jornadaConTema,
  inscripciones: [inscripcionEstudiante1],
  writes: [],
  asistencias: { 'jornada-1/estudiante-1': { estudianteId: 'estudiante-1', horaEntrada: '2026-07-25T23:05:00.000Z' } },
  metricasAsistencia: {},
  historialNotificaciones: {},
  estudiantes: { 'estudiante-1': estudiante },
});

test('registrarAsistenciaJornada: un estudiante de RUTA DE BUS genera aviso al acudiente en el check-out', async () => {
  const state = stateCheckoutBus({
    nombres: 'Sofia', apellidos: 'Perez', modoTransporte: 'ruta_bus', tutor: { correo: 'papa@test.com' },
  });
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:50:00.000Z'), // 18:50 Bogota
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.notificationStatus, 'ruta_bus');
  const notif = state.historialNotificaciones['salida-bus-jornada-1-estudiante-1'];
  assert.ok(notif, 'debe existir la notificacion');
  assert.equal(notif.estudianteId, 'estudiante-1');
  assert.equal(notif.destinatario, 'papa@test.com');
  assert.equal(notif.tipo, 'SalidaRutaBus');
  assert.match(notif.mensaje, /Sofia Perez/);
  assert.match(notif.mensaje, /ruta de bus/i);
  assert.match(notif.mensaje, /18:50/); // hora local del club
  // Se guarda el estado en la asistencia.
  assert.equal(state.asistencias['jornada-1/estudiante-1'].notificationStatus, 'ruta_bus');
});

test('registrarAsistenciaJornada: un estudiante de RECOGIDA (default) NO genera aviso en el check-out', async () => {
  const state = stateCheckoutBus({
    nombres: 'Ana', modoTransporte: 'recogida', tutor: { correo: 'mama@test.com' },
  });
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:50:00.000Z'),
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.notificationStatus, null);
  assert.deepEqual(state.historialNotificaciones, {});
});

test('registrarAsistenciaJornada: sin modoTransporte (ausente) se trata como recogida -> sin aviso', async () => {
  const state = stateCheckoutBus({ nombres: 'Ana', tutor: { correo: 'mama@test.com' } });
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:50:00.000Z'),
  });

  const resultado = await servicio(dataBase(), makeContext());
  assert.equal(resultado.notificationStatus, null);
});

test('registrarAsistenciaJornada: ruta de bus SIN acudiente -> sin_acudiente, no crea notificacion', async () => {
  const state = stateCheckoutBus({ nombres: 'Sofia', modoTransporte: 'ruta_bus' }); // sin tutor
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:50:00.000Z'),
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.notificationStatus, 'sin_acudiente');
  assert.deepEqual(state.historialNotificaciones, {});
});

test('registrarAsistenciaJornada: el aviso es idempotente por doc-id determinista (no duplica)', async () => {
  // Aunque el helper corriera dos veces, el id `salida-bus-...` es el mismo -> un solo doc.
  const state = stateCheckoutBus({
    nombres: 'Sofia', modoTransporte: 'ruta_bus', tutor: { correo: 'papa@test.com' },
  });
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore(state),
    ahora: () => new Date('2026-07-25T23:50:00.000Z'),
  });

  await servicio(dataBase(), makeContext());

  assert.equal(Object.keys(state.historialNotificaciones).length, 1);
});

// --- Cycle A2: "maestro solo opera clases donde esta asignado" (.txt §12) --
// Admin/Asistente/SuperAdmin operan cualquier jornada del tenant (ya lo
// contempla `isInstructor()` en firestore.rules); Editor ("maestro" en este
// dominio, ver design.md Bloque B "Roles y permisos") solo la suya. Mismo
// patron ya establecido en `validarJornada` de asignaciones.js:50-57.

test('registrarAsistenciaJornada rechaza rol Editor que no es el instructor asignado a la jornada', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso, // instructorId: 'maestro-1'
      inscripciones: [inscripcionEstudiante1],
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext({ uid: 'otro-maestro', rol: 'Editor' })),
    /maestro asignado/i
  );
});

test('registrarAsistenciaJornada permite rol Admin operar la jornada de otro instructor', async () => {
  const firestore = makeFirestore({
    jornada: jornadaEnCurso, // instructorId: 'maestro-1'
    inscripciones: [inscripcionEstudiante1],
  });
  const servicio = crearServicioRegistrarAsistencia({ firestore });

  const resultado = await servicio(dataBase(), makeContext({ uid: 'admin-1', rol: 'Admin' }));

  assert.equal(resultado.ok, true);
});

test('registrarAsistenciaJornada permite rol Asistente operar la jornada de otro instructor', async () => {
  const firestore = makeFirestore({
    jornada: jornadaEnCurso, // instructorId: 'maestro-1'
    inscripciones: [inscripcionEstudiante1],
  });
  const servicio = crearServicioRegistrarAsistencia({ firestore });

  const resultado = await servicio(dataBase(), makeContext({ uid: 'asistente-1', rol: 'Asistente' }));

  assert.equal(resultado.ok, true);
});

// Bug relacionado al reportado por el usuario en verificacion manual (2026-07-11):
// ROLES_AUTORIZADOS y assertInstructorAsignado nunca se actualizaron cuando 'Maestro'
// se separo de 'Editor' como rol docente real (14.9). Un Maestro real quedaba
// rechazado por rol al intentar registrar asistencia de SU PROPIA jornada, y (en
// sentido opuesto) un Maestro SI podia operar la jornada de OTRO instructor sin ser
// rechazado, porque assertInstructorAsignado solo miraba rol === 'Editor'.
test('registrarAsistenciaJornada permite rol Maestro asignado a su propia jornada', async () => {
  const firestore = makeFirestore({
    jornada: jornadaEnCurso, // instructorId: 'maestro-1'
    inscripciones: [inscripcionEstudiante1],
  });
  const servicio = crearServicioRegistrarAsistencia({ firestore });

  const resultado = await servicio(dataBase(), makeContext({ uid: 'maestro-1', rol: 'Maestro' }));

  assert.equal(resultado.ok, true);
});

test('registrarAsistenciaJornada rechaza rol Maestro que NO es el instructor asignado a la jornada', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso, // instructorId: 'maestro-1'
      inscripciones: [inscripcionEstudiante1],
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext({ uid: 'otro-maestro', rol: 'Maestro' })),
    /maestro asignado/i
  );
});

// --- Cycle B: matricula automatica por grupo+sede+pago (reemplaza el roster ---
// 100% manual/fail-closed de Fase 0). Decision de arquitectura 2026-07-11 (ver
// engram centro-estudios/matricula-automatica): sin inscripcion explicita, un
// estudiante pertenece si esta en el mismo grupo+sede que la ejecucion y su
// pago no esta Vencido. Una inscripcion explicita SIGUE mandando: 'retirada' es
// una excepcion (excluye aunque coincida todo), 'activa' es una inclusion manual
// (incluye aunque NO coincida, ej. clase de prueba). gradosExcluidos en la
// jornada permite armar clases especificas para ciertos grados sin romper la
// regla general (ver models/academico/jornada.ts).

// grupoId: mismo slug que produce vistas/admin/AsignacionesView.tsx::slugificar
// para EjecucionPrograma.grupoId real ('Precadetes' -> 'precadetes', SIN prefijo
// 'grupo-' -- no confundir con jornadaContextService.ts::grupoId(), que es una
// funcion distinta sin relacion, solo para options de un <select>).
const ejecucionActiva = {
  id: 'ejecucion-1',
  tenantId: 'tenant-1',
  grupoId: 'precadetes',
  sedeId: 'sede-1',
};

const estudianteActivo = {
  id: 'estudiante-1',
  tenantId: 'tenant-1',
  grado: 'Blanco',
  grupo: 'Precadetes',
  sedeId: 'sede-1',
  estadoPago: 'Al día',
};

test('registrarAsistenciaJornada permite AUTOMATICAMENTE a un estudiante sin inscripcion explicita cuando coincide grupo+sede y el pago no esta Vencido', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso,
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': estudianteActivo },
    }),
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.ok, true);
});

test('registrarAsistenciaJornada rechaza automaticamente si el grupo del estudiante no coincide con el de la ejecucion', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso,
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': { ...estudianteActivo, grupo: 'Cadetes' } },
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

test('registrarAsistenciaJornada rechaza automaticamente si la sede del estudiante no coincide con la de la ejecucion', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso,
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': { ...estudianteActivo, sedeId: 'otra-sede' } },
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

test('registrarAsistenciaJornada rechaza automaticamente si el pago del estudiante esta Vencido', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso,
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': { ...estudianteActivo, estadoPago: 'Vencido' } },
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

test('registrarAsistenciaJornada rechaza si el estudiante pertenece a OTRO tenant (defensa en profundidad)', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso,
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': { ...estudianteActivo, tenantId: 'otro-tenant' } },
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

test('registrarAsistenciaJornada rechaza si el grado del estudiante esta en gradosExcluidos de la jornada (clase especifica para otros grados)', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: { ...jornadaEnCurso, gradosExcluidos: ['Blanco', 'Amarillo'] },
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': estudianteActivo }, // grado: 'Blanco'
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

test('registrarAsistenciaJornada permite a un estudiante de grado NO excluido aunque la jornada excluya otros grados', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: { ...jornadaEnCurso, gradosExcluidos: ['Amarillo'] },
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': estudianteActivo }, // grado: 'Blanco', no excluido
    }),
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.ok, true);
});

test('registrarAsistenciaJornada rechaza (excepcion explicita) a un estudiante con inscripcion "retirada" aunque coincida grupo+sede', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso,
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': estudianteActivo },
      inscripciones: [
        { ejecucionProgramaId: 'ejecucion-1', estudianteId: 'estudiante-1', estado: 'retirada' },
      ],
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

test('registrarAsistenciaJornada permite (inclusion manual) a un estudiante con inscripcion "activa" aunque NO coincida grupo/sede', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso,
      ejecucion: ejecucionActiva,
      estudiantes: { 'estudiante-1': { ...estudianteActivo, grupo: 'Cadetes', sedeId: 'otra-sede' } },
      inscripciones: [
        { ejecucionProgramaId: 'ejecucion-1', estudianteId: 'estudiante-1', estado: 'activa' },
      ],
    }),
  });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.ok, true);
});

test('registrarAsistenciaJornada rechaza si el estudiante no existe en absoluto', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({ jornada: jornadaEnCurso, ejecucion: ejecucionActiva, estudiantes: {} }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

// --- Cycle C: toggle server-side check-in / check-out / 3er rechazo --------

// estado: 'activa' explicito -- con la matricula automatica (Cycle B), una
// inscripcion sin 'estado' ya no basta por si sola para pertenecer (ver
// perteneceAEjecucion en asistencia.js: solo 'activa' cuenta como inclusion
// manual). El resto de los tests de este archivo (permisos, toggle check-in/
// check-out) no les interesa la matricula automatica, asi que siguen usando
// este fixture de inclusion explicita sin tener que agregar estudiante/ejecucion.
const inscripcionEstudiante1 = { ejecucionProgramaId: 'ejecucion-1', estudianteId: 'estudiante-1', estado: 'activa' };

test('primer escaneo registra check-in (horaEntrada) y no toca horaSalida', async () => {
  const firestore = makeFirestore({ jornada: jornadaEnCurso, inscripciones: [inscripcionEstudiante1] });
  const servicio = crearServicioRegistrarAsistencia({ firestore });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.ok, true);
  assert.equal(resultado.tipo, 'entrada');
  assert.equal(typeof resultado.hora, 'string');

  const registro = firestore._state.asistencias['jornada-1/estudiante-1'];
  assert.equal(registro.estudianteId, 'estudiante-1');
  assert.equal(registro.horaEntrada, resultado.hora);
  assert.equal(registro.horaSalida, undefined);
});

test('segundo escaneo registra check-out (horaSalida) y calcula minutosAsistidos', async () => {
  const firestore = makeFirestore({
    jornada: jornadaEnCurso,
    inscripciones: [inscripcionEstudiante1],
    asistencias: {
      'jornada-1/estudiante-1': {
        estudianteId: 'estudiante-1',
        horaEntrada: '2026-07-08T15:00:00.000Z',
      },
    },
  });
  const servicio = crearServicioRegistrarAsistencia({ firestore });

  const resultado = await servicio(dataBase(), makeContext());

  assert.equal(resultado.ok, true);
  assert.equal(resultado.tipo, 'salida');
  assert.equal(typeof resultado.minutosAsistidos, 'number');

  const registro = firestore._state.asistencias['jornada-1/estudiante-1'];
  assert.equal(registro.horaEntrada, '2026-07-08T15:00:00.000Z');
  assert.equal(registro.horaSalida, resultado.hora);
  assert.equal(registro.minutosAsistidos, resultado.minutosAsistidos);
});

test('segundo escaneo calcula minutosAsistidos correctamente entre entrada y salida', async () => {
  const firestore = makeFirestore({
    jornada: jornadaEnCurso,
    inscripciones: [inscripcionEstudiante1],
    asistencias: {
      'jornada-1/estudiante-1': {
        estudianteId: 'estudiante-1',
        horaEntrada: '2026-07-08T15:00:00.000Z',
      },
    },
  });
  const servicio = crearServicioRegistrarAsistencia({ firestore });
  const relojOriginal = Date;
  global.Date = class extends relojOriginal {
    constructor(...args) {
      if (args.length === 0) return new relojOriginal('2026-07-08T15:45:00.000Z');
      return new relojOriginal(...args);
    }
    static now() {
      return new relojOriginal('2026-07-08T15:45:00.000Z').getTime();
    }
  };

  try {
    const resultado = await servicio(dataBase(), makeContext());
    assert.equal(resultado.minutosAsistidos, 45);
  } finally {
    global.Date = relojOriginal;
  }
});

test('tercer escaneo se rechaza (la asistencia ya quedo completa)', async () => {
  const firestore = makeFirestore({
    jornada: jornadaEnCurso,
    inscripciones: [inscripcionEstudiante1],
    asistencias: {
      'jornada-1/estudiante-1': {
        estudianteId: 'estudiante-1',
        horaEntrada: '2026-07-08T15:00:00.000Z',
        horaSalida: '2026-07-08T15:45:00.000Z',
        minutosAsistidos: 45,
      },
    },
  });
  const servicio = crearServicioRegistrarAsistencia({ firestore });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /ya (fue registrada|qued(o|ó) completa)/i
  );
});
