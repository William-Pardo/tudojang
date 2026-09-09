'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluarPatrones,
  fusionarHallazgos,
  crearServicioIndicadoresEstudiante,
  crearServicioResolverHallazgoIndicador,
} = require('./indicadoresEstudiante');

const ahoraFijo = new Date('2026-09-08T10:00:00Z');

// fecha (string 'YYYY-MM-DD') de una clase que ocurrió hace `diasAtras` días respecto a
// ahoraFijo -- mismo formato que JornadaInstruccion.fecha en producción.
function fechaHaceDias(diasAtras) {
  const ms = ahoraFijo.getTime() - diasAtras * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function clase({ diasAtras, asistio = true, tarde = false }) {
  return { fecha: fechaHaceDias(diasAtras), asistio, tarde };
}

// N clases regularmente distribuidas dentro de los últimos `dias` días, todas asistidas y
// sin tardanza -- historial "sano" de base para los tests que solo quieren mover UNA variable.
function historialSano(dias, cantidad) {
  const paso = dias / cantidad;
  return Array.from({ length: cantidad }, (_, i) => clase({ diasAtras: Math.round(i * paso) + 1 }));
}

test('evaluarPatrones: no genera ningún hallazgo con historial sano y poca antigüedad', () => {
  const estudiante = { id: 'e1', fechaIngreso: '2026-08-01' }; // ~1 mes de antigüedad
  const historialClases = historialSano(28, 10);
  const candidatos = evaluarPatrones({ estudiante, historialClases, ahora: ahoraFijo });
  assert.deepEqual(candidatos, []);
});

test('evaluarPatrones: sin clases en la ventana no dispara riesgo_desercion por "falta de datos"', () => {
  const estudiante = { id: 'e1', fechaIngreso: '2020-01-01' };
  const candidatos = evaluarPatrones({ estudiante, historialClases: [], ahora: ahoraFijo });
  assert.deepEqual(candidatos.filter((c) => c.tipo === 'riesgo_desercion'), []);
});

test('riesgo_desercion severidad "media": solo asistencia baja (sin tardanzas)', () => {
  const estudiante = { id: 'e1', fechaIngreso: '2020-01-01' };
  const historialClases = [
    ...Array.from({ length: 4 }, (_, i) => clase({ diasAtras: i + 1, asistio: true })),
    ...Array.from({ length: 6 }, (_, i) => clase({ diasAtras: i + 5, asistio: false })),
  ]; // 4/10 = 40% < 60%
  const candidatos = evaluarPatrones({ estudiante, historialClases, ahora: ahoraFijo });
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].tipo, 'riesgo_desercion');
  assert.equal(candidatos[0].severidad, 'media');
  assert.equal(candidatos[0].metricas.porcentajeAsistencia4Semanas, 0.4);
  assert.equal(candidatos[0].metricas.clasesEsperadas4Semanas, 10);
  assert.equal(candidatos[0].metricas.tardanzas2Semanas, 0);
});

test('riesgo_desercion severidad "media": solo tardanzas (asistencia OK)', () => {
  const estudiante = { id: 'e1', fechaIngreso: '2020-01-01' };
  const historialClases = [
    clase({ diasAtras: 1, tarde: true }),
    clase({ diasAtras: 3, tarde: true }),
    clase({ diasAtras: 5, tarde: true }),
    clase({ diasAtras: 7 }),
    clase({ diasAtras: 9 }),
  ]; // 5/5 asistidas (100%), 3 tardanzas dentro de los últimos 14 días
  const candidatos = evaluarPatrones({ estudiante, historialClases, ahora: ahoraFijo });
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].severidad, 'media');
  assert.equal(candidatos[0].metricas.tardanzas2Semanas, 3);
  assert.equal(candidatos[0].metricas.porcentajeAsistencia4Semanas, 1);
});

test('riesgo_desercion severidad "alta": asistencia baja Y tardanzas simultáneamente', () => {
  const estudiante = { id: 'e1', fechaIngreso: '2020-01-01' };
  const historialClases = [
    clase({ diasAtras: 1, asistio: true, tarde: true }),
    clase({ diasAtras: 3, asistio: true, tarde: true }),
    clase({ diasAtras: 5, asistio: true, tarde: true }),
    clase({ diasAtras: 10, asistio: false }),
    clase({ diasAtras: 12, asistio: false }),
    clase({ diasAtras: 14, asistio: false }),
    clase({ diasAtras: 16, asistio: false }),
  ]; // 3/7 = 43% < 60% Y 3 tardanzas en 14 días
  const candidatos = evaluarPatrones({ estudiante, historialClases, ahora: ahoraFijo });
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].severidad, 'alta');
});

test('candidato_fidelizacion severidad "media": cumple los 3 requisitos sin ser excepcional', () => {
  const estudiante = { id: 'e1', fechaIngreso: fechaHaceDias(200) }; // ~200 días, >= 6 meses
  const historialClases = [
    ...Array.from({ length: 19 }, (_, i) => clase({ diasAtras: i + 1, asistio: true })),
    clase({ diasAtras: 20, asistio: false }), // 19/20 = 95%
  ];
  const candidatos = evaluarPatrones({ estudiante, historialClases, ahora: ahoraFijo });
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].tipo, 'candidato_fidelizacion');
  assert.equal(candidatos[0].severidad, 'media');
  assert.equal(candidatos[0].metricas.porcentajeAsistencia3Meses, 0.95);
  assert.equal(candidatos[0].metricas.tardanzasUltimoMes, 0);
});

test('candidato_fidelizacion severidad "alta": asistencia excepcional y antigüedad >= 1 año', () => {
  const estudiante = { id: 'e1', fechaIngreso: fechaHaceDias(400) };
  const historialClases = Array.from({ length: 20 }, (_, i) => clase({ diasAtras: i + 1, asistio: true })); // 100%
  const candidatos = evaluarPatrones({ estudiante, historialClases, ahora: ahoraFijo });
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].severidad, 'alta');
});

test('candidato_fidelizacion: NO se dispara si la antigüedad es menor a 6 meses (aunque la asistencia sea perfecta)', () => {
  const estudiante = { id: 'e1', fechaIngreso: fechaHaceDias(100) };
  const historialClases = Array.from({ length: 20 }, (_, i) => clase({ diasAtras: i + 1, asistio: true }));
  const candidatos = evaluarPatrones({ estudiante, historialClases, ahora: ahoraFijo });
  assert.deepEqual(candidatos.filter((c) => c.tipo === 'candidato_fidelizacion'), []);
});

test('candidato_fidelizacion: NO se dispara con 1 sola tardanza en el último mes', () => {
  const estudiante = { id: 'e1', fechaIngreso: fechaHaceDias(300) };
  const historialClases = [
    clase({ diasAtras: 5, asistio: true, tarde: true }),
    ...Array.from({ length: 19 }, (_, i) => clase({ diasAtras: i + 10, asistio: true })),
  ];
  const candidatos = evaluarPatrones({ estudiante, historialClases, ahora: ahoraFijo });
  assert.deepEqual(candidatos.filter((c) => c.tipo === 'candidato_fidelizacion'), []);
});

// --- fusionarHallazgos (upsert idempotente de la bitácora) --------------------------------

test('fusionarHallazgos: crea un hallazgo nuevo con id determinístico y fechaDeteccion = ahora', () => {
  const candidatosDetectados = [{ tipo: 'riesgo_desercion', severidad: 'media', metricas: { x: 1 } }];
  const resultado = fusionarHallazgos({ hallazgosExistentes: [], candidatosDetectados, ahora: ahoraFijo });

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, 'riesgo_desercion-2026-09-08');
  assert.equal(resultado[0].fechaDeteccion, ahoraFijo.toISOString());
  assert.equal(resultado[0].fechaActualizacion, ahoraFijo.toISOString());
  assert.equal(resultado[0].resuelto, false);
});

test('fusionarHallazgos: si el patrón sigue vigente, actualiza métricas/severidad/fechaActualizacion pero preserva fechaDeteccion e id', () => {
  const existente = {
    id: 'riesgo_desercion-2026-08-01', tipo: 'riesgo_desercion', severidad: 'media',
    fechaDeteccion: '2026-08-01T10:00:00.000Z', fechaActualizacion: '2026-08-01T10:00:00.000Z',
    metricas: { x: 1 }, resuelto: false,
  };
  const candidatosDetectados = [{ tipo: 'riesgo_desercion', severidad: 'alta', metricas: { x: 2 } }];
  const resultado = fusionarHallazgos({ hallazgosExistentes: [existente], candidatosDetectados, ahora: ahoraFijo });

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, 'riesgo_desercion-2026-08-01'); // NUNCA se pisa
  assert.equal(resultado[0].fechaDeteccion, '2026-08-01T10:00:00.000Z'); // NUNCA se pisa
  assert.equal(resultado[0].fechaActualizacion, ahoraFijo.toISOString());
  assert.equal(resultado[0].severidad, 'alta');
  assert.deepEqual(resultado[0].metricas, { x: 2 });
});

test('fusionarHallazgos: si el patrón ya no se cumple, NO auto-resuelve ni toca el hallazgo existente sin resolver', () => {
  const existente = {
    id: 'riesgo_desercion-2026-08-01', tipo: 'riesgo_desercion', severidad: 'media',
    fechaDeteccion: '2026-08-01T10:00:00.000Z', fechaActualizacion: '2026-08-01T10:00:00.000Z',
    metricas: { x: 1 }, resuelto: false,
  };
  const resultado = fusionarHallazgos({ hallazgosExistentes: [existente], candidatosDetectados: [], ahora: ahoraFijo });

  assert.deepEqual(resultado, [existente]);
});

test('fusionarHallazgos: un hallazgo ya RESUELTO no se reabre ni se pisa si el patrón reaparece el mismo día', () => {
  const resuelto = {
    id: 'riesgo_desercion-2026-09-08', tipo: 'riesgo_desercion', severidad: 'media',
    fechaDeteccion: ahoraFijo.toISOString(), fechaActualizacion: ahoraFijo.toISOString(),
    metricas: { x: 1 }, resuelto: true, resueltoEn: ahoraFijo.toISOString(), resueltoPor: 'admin-1',
  };
  const candidatosDetectados = [{ tipo: 'riesgo_desercion', severidad: 'alta', metricas: { x: 9 } }];
  const resultado = fusionarHallazgos({ hallazgosExistentes: [resuelto], candidatosDetectados, ahora: ahoraFijo });

  // No se crea un segundo hallazgo con el mismo id (chocaría), ni se reescribe el ya resuelto.
  assert.equal(resultado.length, 1);
  assert.deepEqual(resultado[0], resuelto);
});

test('fusionarHallazgos: si hay uno resuelto y otro tipo sigue detectándose, cada tipo se maneja independiente', () => {
  const resuelto = {
    id: 'riesgo_desercion-2026-08-01', tipo: 'riesgo_desercion', severidad: 'media',
    fechaDeteccion: '2026-08-01T10:00:00.000Z', fechaActualizacion: '2026-08-01T10:00:00.000Z',
    metricas: {}, resuelto: true, resueltoEn: '2026-08-15T10:00:00.000Z', resueltoPor: 'admin-1',
  };
  const candidatosDetectados = [{ tipo: 'candidato_fidelizacion', severidad: 'media', metricas: { y: 1 } }];
  const resultado = fusionarHallazgos({ hallazgosExistentes: [resuelto], candidatosDetectados, ahora: ahoraFijo });

  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado[0], resuelto);
  assert.equal(resultado[1].tipo, 'candidato_fidelizacion');
  assert.equal(resultado[1].id, 'candidato_fidelizacion-2026-09-08');
});

// --- crearServicioIndicadoresEstudiante (orquestación con deps inyectadas) ----------------

// Fake de `actualizarIndicadorTransaccional` que replica la MISMA lógica que la implementación
// real en functions/index.js (leer existente + fusionarHallazgos + escribir), pero en memoria --
// permite seguir probando crearServicioIndicadoresEstudiante de punta a punta sin duplicar
// Firestore real. La diferencia clave con el contrato viejo: acá el read-modify-write completo
// vive DENTRO de una sola función, tal como en producción vive dentro de una única
// firestore.runTransaction (ver también los tests de "protección transaccional" más abajo).
function crearDeps({ estudiantes, historiales = {}, indicadoresExistentes = {} }) {
  const guardados = {};
  const actualizarIndicadorTransaccional = async (tenantId, estudianteId, candidatos, ahora) => {
    const indicadorExistente = guardados[estudianteId] || indicadoresExistentes[estudianteId] || null;

    if (candidatos.length === 0 && !indicadorExistente) {
      return { actualizado: false };
    }

    const hallazgosExistentes = indicadorExistente ? indicadorExistente.hallazgos : [];
    const hallazgos = fusionarHallazgos({ hallazgosExistentes, candidatosDetectados: candidatos, ahora });

    guardados[estudianteId] = { estudianteId, tenantId, hallazgos, ultimaEvaluacion: ahora.toISOString() };
    return { actualizado: true };
  };

  return {
    guardados,
    deps: {
      listarEstudiantesActivos: async () => estudiantes,
      obtenerHistorialClases: async (tenantId, estudiante) => historiales[estudiante.id] || [],
      actualizarIndicadorTransaccional,
    },
  };
}

test('crearServicioIndicadoresEstudiante: no guarda nada para un estudiante sano sin indicador previo (evita ruido)', async () => {
  const estudiante = { id: 'e1', tenantId: 't1', fechaIngreso: '2026-08-01' };
  const { guardados, deps } = crearDeps({
    estudiantes: [estudiante],
    historiales: { e1: historialSano(28, 10) },
  });
  const servicio = crearServicioIndicadoresEstudiante(deps);

  const resultado = await servicio(ahoraFijo);

  assert.deepEqual(guardados, {});
  assert.equal(resultado.evaluados, 1);
  assert.equal(resultado.actualizados, 0);
});

test('crearServicioIndicadoresEstudiante: crea el indicador cuando detecta un hallazgo nuevo', async () => {
  const estudiante = { id: 'e1', tenantId: 't1', fechaIngreso: '2020-01-01' };
  const historialRiesgo = [
    ...Array.from({ length: 2 }, (_, i) => clase({ diasAtras: i + 1, asistio: true })),
    ...Array.from({ length: 8 }, (_, i) => clase({ diasAtras: i + 5, asistio: false })),
  ];
  const { guardados, deps } = crearDeps({
    estudiantes: [estudiante],
    historiales: { e1: historialRiesgo },
  });
  const servicio = crearServicioIndicadoresEstudiante(deps);

  await servicio(ahoraFijo);

  assert.ok(guardados.e1);
  assert.equal(guardados.e1.estudianteId, 'e1');
  assert.equal(guardados.e1.tenantId, 't1');
  assert.equal(guardados.e1.hallazgos.length, 1);
  assert.equal(guardados.e1.hallazgos[0].tipo, 'riesgo_desercion');
  assert.equal(guardados.e1.ultimaEvaluacion, ahoraFijo.toISOString());
});

test('crearServicioIndicadoresEstudiante: actualiza ultimaEvaluacion aunque hoy no haya candidatos, si ya existía un indicador', async () => {
  const estudiante = { id: 'e1', tenantId: 't1', fechaIngreso: '2026-08-01' };
  const indicadorPrevio = {
    estudianteId: 'e1', tenantId: 't1',
    hallazgos: [{
      id: 'riesgo_desercion-2026-08-01', tipo: 'riesgo_desercion', severidad: 'media',
      fechaDeteccion: '2026-08-01T10:00:00.000Z', fechaActualizacion: '2026-08-01T10:00:00.000Z',
      metricas: {}, resuelto: false,
    }],
    ultimaEvaluacion: '2026-08-01T10:00:00.000Z',
  };
  const { guardados, deps } = crearDeps({
    estudiantes: [estudiante],
    historiales: { e1: historialSano(28, 10) }, // hoy ya está sano
    indicadoresExistentes: { e1: indicadorPrevio },
  });
  const servicio = crearServicioIndicadoresEstudiante(deps);

  await servicio(ahoraFijo);

  assert.ok(guardados.e1);
  assert.equal(guardados.e1.ultimaEvaluacion, ahoraFijo.toISOString());
  // El hallazgo sin resolver sigue intacto (nadie lo auto-resolvió).
  assert.equal(guardados.e1.hallazgos[0].resuelto, false);
  assert.equal(guardados.e1.hallazgos[0].fechaActualizacion, '2026-08-01T10:00:00.000Z');
});

test('crearServicioIndicadoresEstudiante: procesa varios estudiantes de forma independiente', async () => {
  const estudiantes = [
    { id: 'e1', tenantId: 't1', fechaIngreso: '2026-08-01' },
    { id: 'e2', tenantId: 't2', fechaIngreso: '2020-01-01' },
  ];
  const historialRiesgo = [
    ...Array.from({ length: 2 }, (_, i) => clase({ diasAtras: i + 1, asistio: true })),
    ...Array.from({ length: 8 }, (_, i) => clase({ diasAtras: i + 5, asistio: false })),
  ];
  const { guardados, deps } = crearDeps({
    estudiantes,
    historiales: { e1: historialSano(28, 10), e2: historialRiesgo },
  });
  const servicio = crearServicioIndicadoresEstudiante(deps);

  const resultado = await servicio(ahoraFijo);

  assert.equal(resultado.evaluados, 2);
  assert.equal(resultado.actualizados, 1);
  assert.equal(guardados.e1, undefined);
  assert.ok(guardados.e2);
});

// --- protección transaccional (fix de la race condition cron vs. resolverHallazgoIndicador) ---
//
// WHY: antes, crearServicioIndicadoresEstudiante dependía de 2 funciones separadas
// (obtenerIndicadorExistente + guardarIndicador) -- un read-then-write SIN transacción sobre el
// MISMO documento que resolverHallazgoIndicador sí actualiza vía firestore.runTransaction. Si el
// callable resolvía un hallazgo justo entre el .get() y el .set() del cron, el .set() pisaba la
// resolución en silencio (ver bitácora: hallazgo CRITICAL confirmado por review-resilience y
// review-reliability). El fix colapsa el contrato a UNA sola dependencia
// (actualizarIndicadorTransaccional) que hace TODO el read-modify-write dentro de una única
// transacción -- estos tests prueban ese contrato: crearServicioIndicadoresEstudiante ya no hace
// NINGUNA lectura propia del documento de indicador, todo vive dentro de la función inyectada.

test('crearServicioIndicadoresEstudiante: delega el read-modify-write completo del indicador a UNA sola llamada transaccional', async () => {
  const estudiante = { id: 'e1', tenantId: 't1', fechaIngreso: '2020-01-01' };
  const historialRiesgo = [
    ...Array.from({ length: 2 }, (_, i) => clase({ diasAtras: i + 1, asistio: true })),
    ...Array.from({ length: 8 }, (_, i) => clase({ diasAtras: i + 5, asistio: false })),
  ];
  const llamadas = [];
  const deps = {
    listarEstudiantesActivos: async () => [estudiante],
    obtenerHistorialClases: async () => historialRiesgo,
    // Única dependencia relacionada con el doc de indicador: si el contrato tuviera alguna
    // lectura propia por fuera de acá (el bug original), este test no tendría forma de
    // detectarlo -- pero tampoco haría falta, porque ya no existe ningún otro parámetro al que
    // engancharse (ver la firma de crearServicioIndicadoresEstudiante).
    actualizarIndicadorTransaccional: async (tenantId, estudianteId, candidatos, ahora) => {
      llamadas.push({ tenantId, estudianteId, candidatos, ahora });
      return { actualizado: true };
    },
  };
  const servicio = crearServicioIndicadoresEstudiante(deps);

  const resultado = await servicio(ahoraFijo);

  // Exactamente UNA llamada por estudiante (ni una lectura ni una escritura aparte).
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].tenantId, 't1');
  assert.equal(llamadas[0].estudianteId, 'e1');
  assert.equal(llamadas[0].ahora, ahoraFijo);
  // Recibe los candidatos YA calculados por evaluarPatrones (puro, sin Firestore) -- suficiente
  // para que la función inyectada haga la fusión completa ella sola, sin que
  // crearServicioIndicadoresEstudiante necesite pasarle (ni haber leído) el indicador existente.
  assert.equal(llamadas[0].candidatos.length, 1);
  assert.equal(llamadas[0].candidatos[0].tipo, 'riesgo_desercion');
  assert.equal(resultado.actualizados, 1);
});

test('crearServicioIndicadoresEstudiante: cuenta "actualizados" según el {actualizado} que devuelve la función transaccional, no por lógica propia', async () => {
  const estudiantes = [
    { id: 'e1', tenantId: 't1', fechaIngreso: '2026-08-01' },
    { id: 'e2', tenantId: 't1', fechaIngreso: '2026-08-01' },
  ];
  const deps = {
    listarEstudiantesActivos: async () => estudiantes,
    obtenerHistorialClases: async () => [],
    // La función inyectada es quien decide adentro (con su propia lectura transaccional) si
    // hubo escritura -- crearServicioIndicadoresEstudiante confía ciegamente en ese resultado,
    // no re-decide nada con datos que ya no tiene (porque ya no lee el doc).
    actualizarIndicadorTransaccional: async (tenantId, estudianteId) => ({ actualizado: estudianteId === 'e2' }),
  };
  const servicio = crearServicioIndicadoresEstudiante(deps);

  const resultado = await servicio(ahoraFijo);

  assert.equal(resultado.evaluados, 2);
  assert.equal(resultado.actualizados, 1);
});

// --- crearServicioResolverHallazgoIndicador (callable) ------------------------------------

// Fake mínimo de Firestore: solo lo que este callable necesita -- doc anidado
// tenants/{tenantId}/indicadoresEstudiante/{estudianteId} + runTransaction (get/update
// diferido). Mismo estilo/limitaciones que crearFirestoreFake de pagosValidacion.test.js
// (no simula reintentos por conflicto entre transacciones concurrentes).
function crearFirestoreFake(indicadores = {}) {
  const datos = new Map(Object.entries(indicadores).map(([key, doc]) => [key, { ...doc, hallazgos: doc.hallazgos.map((h) => ({ ...h })) }]));

  function crearDocRef(tenantId, estudianteId) {
    const key = `${tenantId}/${estudianteId}`;
    return {
      _key: key,
      get: async () => ({ exists: datos.has(key), data: () => ({ ...datos.get(key) }) }),
      update: async (data) => { datos.set(key, { ...datos.get(key), ...data }); },
    };
  }

  const runTransaction = async (updateFn) => {
    const pendientes = [];
    const tx = {
      get: async (ref) => ref.get(),
      update: (ref, data) => pendientes.push({ ref, data }),
    };
    const resultado = await updateFn(tx);
    pendientes.forEach(({ ref, data }) => { datos.set(ref._key, { ...datos.get(ref._key), ...data }); });
    return resultado;
  };

  return {
    collection: (nombreTop) => {
      if (nombreTop !== 'tenants') throw new Error(`Colección no mockeada: ${nombreTop}`);
      return {
        doc: (tenantId) => ({
          collection: (nombreSub) => {
            if (nombreSub !== 'indicadoresEstudiante') throw new Error(`Subcolección no mockeada: ${nombreSub}`);
            return { doc: (estudianteId) => crearDocRef(tenantId, estudianteId) };
          },
        }),
      };
    },
    runTransaction,
    _datos: datos,
  };
}

function crearContexto(rol, overrides = {}) {
  return { auth: { uid: 'admin-1', token: { tenantId: 'tenant-1', rol, ...overrides } } };
}

const HALLAZGO_BASE = {
  id: 'riesgo_desercion-2026-08-01', tipo: 'riesgo_desercion', severidad: 'media',
  fechaDeteccion: '2026-08-01T10:00:00.000Z', fechaActualizacion: '2026-08-01T10:00:00.000Z',
  metricas: { x: 1 }, resuelto: false,
};

test('resolverHallazgoIndicador: rechaza si no está autenticado', async () => {
  const servicio = crearServicioResolverHallazgoIndicador({ firestore: crearFirestoreFake() });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', estudianteId: 'e1', hallazgoId: 'h1' }, {}),
    /no autenticado/i
  );
});

test('resolverHallazgoIndicador: rechaza rol no autorizado (Estudiante/Tutor)', async () => {
  const servicio = crearServicioResolverHallazgoIndicador({ firestore: crearFirestoreFake() });
  for (const rol of ['Estudiante', 'Tutor']) {
    await assert.rejects(
      () => servicio({ tenantId: 'tenant-1', estudianteId: 'e1', hallazgoId: 'h1' }, crearContexto(rol)),
      /no tienes permiso/i
    );
  }
});

test('resolverHallazgoIndicador: rechaza tenant ajeno', async () => {
  const firestore = crearFirestoreFake({
    'tenant-1/e1': { estudianteId: 'e1', tenantId: 'tenant-1', hallazgos: [HALLAZGO_BASE] },
  });
  const servicio = crearServicioResolverHallazgoIndicador({ firestore });
  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-OTRO', estudianteId: 'e1', hallazgoId: HALLAZGO_BASE.id },
      crearContexto('Admin')
    ),
    /tenant no autorizado/i
  );
});

test('resolverHallazgoIndicador: marca resuelto/resueltoEn/resueltoPor/notaAdmin sin tocar el resto del documento', async () => {
  const otroHallazgo = { ...HALLAZGO_BASE, id: 'candidato_fidelizacion-2026-07-01', tipo: 'candidato_fidelizacion' };
  const firestore = crearFirestoreFake({
    'tenant-1/e1': { estudianteId: 'e1', tenantId: 'tenant-1', hallazgos: [HALLAZGO_BASE, otroHallazgo], ultimaEvaluacion: '2026-09-08T06:00:00.000Z' },
  });
  const servicio = crearServicioResolverHallazgoIndicador({ firestore });

  const resultado = await servicio(
    { tenantId: 'tenant-1', estudianteId: 'e1', hallazgoId: HALLAZGO_BASE.id, nota: 'Hablé con la mamá, va a mejorar' },
    crearContexto('Admin')
  );

  assert.deepEqual(resultado, { ok: true });
  const doc = firestore._datos.get('tenant-1/e1');
  assert.equal(doc.hallazgos[0].resuelto, true);
  assert.equal(doc.hallazgos[0].resueltoPor, 'admin-1');
  assert.equal(doc.hallazgos[0].notaAdmin, 'Hablé con la mamá, va a mejorar');
  assert.ok(doc.hallazgos[0].resueltoEn);
  // Los demás campos de ESE hallazgo quedan intactos (fechaDeteccion nunca se toca)
  assert.equal(doc.hallazgos[0].fechaDeteccion, HALLAZGO_BASE.fechaDeteccion);
  assert.equal(doc.hallazgos[0].metricas.x, 1);
  // El OTRO hallazgo del mismo documento no se modificó en absoluto.
  assert.deepEqual(doc.hallazgos[1], otroHallazgo);
  assert.equal(doc.ultimaEvaluacion, '2026-09-08T06:00:00.000Z');
});

test('resolverHallazgoIndicador: rechaza si el hallazgo no existe', async () => {
  const firestore = crearFirestoreFake({
    'tenant-1/e1': { estudianteId: 'e1', tenantId: 'tenant-1', hallazgos: [HALLAZGO_BASE] },
  });
  const servicio = crearServicioResolverHallazgoIndicador({ firestore });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', estudianteId: 'e1', hallazgoId: 'no-existe' }, crearContexto('Admin')),
    /no se encontr[oó] ese hallazgo/i
  );
});

test('resolverHallazgoIndicador: rechaza si el hallazgo ya estaba resuelto (no se puede resolver dos veces)', async () => {
  const yaResuelto = { ...HALLAZGO_BASE, resuelto: true, resueltoEn: '2026-08-10T00:00:00.000Z', resueltoPor: 'admin-0' };
  const firestore = crearFirestoreFake({
    'tenant-1/e1': { estudianteId: 'e1', tenantId: 'tenant-1', hallazgos: [yaResuelto] },
  });
  const servicio = crearServicioResolverHallazgoIndicador({ firestore });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', estudianteId: 'e1', hallazgoId: yaResuelto.id }, crearContexto('Admin')),
    /ya estaba resuelto/i
  );
});

test('resolverHallazgoIndicador: rechaza si el indicador del estudiante no existe', async () => {
  const servicio = crearServicioResolverHallazgoIndicador({ firestore: crearFirestoreFake() });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', estudianteId: 'no-existe', hallazgoId: 'h1' }, crearContexto('Admin')),
    /no se encontr[oó] el indicador/i
  );
});

test('resolverHallazgoIndicador: SuperAdmin puede resolver hallazgos de cualquier tenant', async () => {
  const firestore = crearFirestoreFake({
    'tenant-ajeno/e1': { estudianteId: 'e1', tenantId: 'tenant-ajeno', hallazgos: [HALLAZGO_BASE] },
  });
  const servicio = crearServicioResolverHallazgoIndicador({ firestore });
  const resultado = await servicio(
    { tenantId: 'tenant-ajeno', estudianteId: 'e1', hallazgoId: HALLAZGO_BASE.id },
    crearContexto('SuperAdmin', { tenantId: 'otro-tenant-del-superadmin' })
  );
  assert.deepEqual(resultado, { ok: true });
});

test('resolverHallazgoIndicador: notaAdmin es opcional', async () => {
  const firestore = crearFirestoreFake({
    'tenant-1/e1': { estudianteId: 'e1', tenantId: 'tenant-1', hallazgos: [HALLAZGO_BASE] },
  });
  const servicio = crearServicioResolverHallazgoIndicador({ firestore });
  await servicio({ tenantId: 'tenant-1', estudianteId: 'e1', hallazgoId: HALLAZGO_BASE.id }, crearContexto('Admin'));
  const doc = firestore._datos.get('tenant-1/e1');
  assert.equal(doc.hallazgos[0].notaAdmin, undefined);
});
