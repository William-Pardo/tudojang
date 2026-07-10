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

function makeFirestore({ jornada, inscripciones = [], asistencias = {}, writes = [] } = {}) {
  const state = { jornada, inscripciones, asistencias, writes };
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
        const existe = state.inscripciones.some(
          (i) => i.ejecucionProgramaId === ejecucionProgramaId && i.estudianteId === estudianteId
        );
        return makeSnap(existe ? { ejecucionProgramaId, estudianteId } : null);
      }

      const asistenciaMatch = joined.match(
        /^tenants\/([^/]+)\/jornadas\/([^/]+)\/asistencias\/([^/]+)$/
      );
      if (asistenciaMatch) {
        const [, , jornadaId, estudianteId] = asistenciaMatch;
        const registro = state.asistencias[`${jornadaId}/${estudianteId}`];
        return makeSnap(registro || null);
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

// --- Cycle B: pertenencia via roster explicito (Fase 0) ---------------------

test('registrarAsistenciaJornada rechaza estudiante sin inscripcion en la ejecucion de la jornada', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({
      jornada: jornadaEnCurso,
      // El estudiante existe matriculado, pero en OTRA ejecucion (misma materia,
      // seccion distinta) — comparte grado/grupo pero no debe pasar la validacion.
      inscripciones: [
        { ejecucionProgramaId: 'otra-ejecucion', estudianteId: 'estudiante-1' },
      ],
    }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

test('registrarAsistenciaJornada rechaza a TODOS los estudiantes cuando la ejecucion no tiene roster (fail-closed)', async () => {
  const servicio = crearServicioRegistrarAsistencia({
    firestore: makeFirestore({ jornada: jornadaEnCurso, inscripciones: [] }),
  });

  await assert.rejects(
    () => servicio(dataBase(), makeContext()),
    /no est(a|á) matriculado/i
  );
});

// --- Cycle C: toggle server-side check-in / check-out / 3er rechazo --------

const inscripcionEstudiante1 = { ejecucionProgramaId: 'ejecucion-1', estudianteId: 'estudiante-1' };

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
