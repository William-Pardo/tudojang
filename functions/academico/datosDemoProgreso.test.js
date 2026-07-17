const test = require('node:test');
const assert = require('node:assert/strict');
const {
  crearServicioGenerarDatosDemoProgreso,
  crearServicioLimpiarDatosDemoProgreso,
  PREFIJO_DEMO,
  _construirDataset,
  _agregar,
} = require('./datosDemoProgreso');

function crearContexto(overrides = {}) {
  return {
    auth: {
      uid: 'admin-1',
      token: { tenantId: 'tenant-1', rol: 'Admin', ...overrides },
    },
  };
}

// Fake Firestore mínimo: soporta collection().doc().collection().doc().set() y
// collection()...collection().get() devolviendo docs con .id y .ref.delete().
function crearFirestoreFake() {
  const docs = new Map(); // path -> data

  function crearColeccionRef(path) {
    return {
      doc: (id) => crearDocRef([...path, id]),
      get: async () => {
        const prefijo = path.join('/') + '/';
        const entradas = [...docs.entries()].filter(([key]) => {
          const resto = key.slice(prefijo.length);
          return key.startsWith(prefijo) && resto.length > 0 && !resto.includes('/');
        });
        return {
          docs: entradas.map(([key, data]) => ({
            id: key.split('/').pop(),
            data: () => data,
            ref: crearDocRef(key.split('/')),
          })),
        };
      },
    };
  }

  function crearDocRef(path) {
    const key = path.join('/');
    return {
      collection: (name) => crearColeccionRef([...path, name]),
      set: async (data) => { docs.set(key, data); },
      get: async () => ({ exists: docs.has(key), data: () => docs.get(key) }),
      delete: async () => { docs.delete(key); },
    };
  }

  return {
    collection: (name) => crearColeccionRef([name]),
    _docs: docs,
  };
}

test('_agregar calcula los totales con la misma fórmula que recalcularMetricas', () => {
  const resultado = _agregar([
    { asignacionId: 'a', tipoRecurso: 'video', porcentajeConsumo: 100 },
    { asignacionId: 'b', tipoRecurso: 'pdf', porcentajeConsumo: 40 },
    { asignacionId: 'c', tipoRecurso: 'quiz', porcentajeConsumo: 100, scoreUltimaEvaluacion: 80, vecesEvaluado: 2 },
  ]);

  assert.equal(resultado.totalAsignaciones, 3);
  assert.equal(resultado.asignacionesIniciadas, 3);
  assert.equal(resultado.asignacionesCompletadas, 2); // 100 y 100 (>=80); 40 no cuenta
  assert.equal(resultado.porcentajeGlobalConsumo, 80); // (100+40+100)/3 = 80
  assert.equal(resultado.totalEvaluacionesRealizadas, 2); // vecesEvaluado del único quiz
  assert.equal(resultado.promedioScoreEvaluaciones, 80);
});

test('_agregar NO incluye la clave ultimaActividadEn cuando no hay avancePorAsignacion (regresión: Firestore rechaza undefined explícito)', () => {
  const resultado = _agregar([]);
  assert.equal('ultimaActividadEn' in resultado, false);
});

test('generarDatosDemoProgreso escribe los 8 documentos sin ningún valor undefined (regresión del 500 en producción)', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioGenerarDatosDemoProgreso({ firestore });

  await servicio({ tenantId: 'tenant-1' }, crearContexto());

  for (const [clave, data] of firestore._docs.entries()) {
    for (const [campo, valor] of Object.entries(data)) {
      assert.notEqual(valor, undefined, `${clave} tiene el campo "${campo}" en undefined`);
    }
  }
});

test('_construirDataset cubre los 5 estados del badge (incluye sin iniciar y sin asignaciones)', () => {
  const dataset = _construirDataset();
  const estados = dataset.map((e) => {
    const m = _agregar(e.avancePorAsignacion);
    if (m.totalAsignaciones === 0) return 'sin_asignaciones';
    if (m.porcentajeGlobalConsumo >= 80) return 'al_dia';
    if (m.porcentajeGlobalConsumo >= 40) return 'en_progreso';
    if (m.asignacionesIniciadas === 0) return 'sin_iniciar';
    return 'atrasado';
  });

  assert.ok(estados.includes('al_dia'));
  assert.ok(estados.includes('en_progreso'));
  assert.ok(estados.includes('atrasado'));
  assert.ok(estados.includes('sin_iniciar'));
  assert.ok(estados.includes('sin_asignaciones'));
  assert.equal(dataset.length, 8);
  assert.ok(dataset.every((e) => e.id.startsWith(PREFIJO_DEMO)));
});

test('generarDatosDemoProgreso rechaza si no está autenticado', async () => {
  const servicio = crearServicioGenerarDatosDemoProgreso({ firestore: crearFirestoreFake() });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, {}),
    /no autenticado/i,
  );
});

test('generarDatosDemoProgreso rechaza roles sin permiso (Maestro, Tutor, Estudiante)', async () => {
  const servicio = crearServicioGenerarDatosDemoProgreso({ firestore: crearFirestoreFake() });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, crearContexto({ rol: 'Maestro' })),
    /no autorizado/i,
  );
});

test('generarDatosDemoProgreso rechaza tenant ajeno (Admin no-SuperAdmin)', async () => {
  const servicio = crearServicioGenerarDatosDemoProgreso({ firestore: crearFirestoreFake() });
  await assert.rejects(
    () => servicio({ tenantId: 'otro-tenant' }, crearContexto()),
    /tenant no autorizado/i,
  );
});

test('generarDatosDemoProgreso escribe 8 documentos con prefijo demo- bajo el tenant correcto', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioGenerarDatosDemoProgreso({ firestore });

  const res = await servicio({ tenantId: 'tenant-1' }, crearContexto());

  assert.equal(res.ok, true);
  assert.equal(res.generados, 8);

  const claves = [...firestore._docs.keys()];
  assert.equal(claves.length, 8);
  for (const clave of claves) {
    assert.ok(clave.startsWith('tenants/tenant-1/metricasEstudiante/demo-progreso-'));
  }

  const sofia = firestore._docs.get('tenants/tenant-1/metricasEstudiante/demo-progreso-01');
  assert.equal(sofia.estudianteNombre, 'Sofía Ramírez Ortiz');
  assert.equal(sofia.tenantId, 'tenant-1');
  assert.equal(sofia.porcentajeGlobalConsumo, 100);
});

test('generarDatosDemoProgreso permite SuperAdmin sembrar en cualquier tenant', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioGenerarDatosDemoProgreso({ firestore });

  const res = await servicio(
    { tenantId: 'tenant-de-otro-club' },
    crearContexto({ tenantId: 'tenant-superadmin', rol: 'SuperAdmin' }),
  );

  assert.equal(res.ok, true);
  assert.ok([...firestore._docs.keys()][0].startsWith('tenants/tenant-de-otro-club/'));
});

test('limpiarDatosDemoProgreso borra solo los documentos con prefijo demo- y deja el resto', async () => {
  const firestore = crearFirestoreFake();
  await firestore.collection('tenants').doc('tenant-1').collection('metricasEstudiante')
    .doc('demo-progreso-01').set({ estudianteNombre: 'Demo' });
  await firestore.collection('tenants').doc('tenant-1').collection('metricasEstudiante')
    .doc('uid-real-de-un-estudiante').set({ estudianteNombre: 'Real' });

  const servicio = crearServicioLimpiarDatosDemoProgreso({ firestore });
  const res = await servicio({ tenantId: 'tenant-1' }, crearContexto());

  assert.equal(res.ok, true);
  assert.equal(res.eliminados, 1);
  assert.equal(firestore._docs.has('tenants/tenant-1/metricasEstudiante/demo-progreso-01'), false);
  assert.equal(firestore._docs.has('tenants/tenant-1/metricasEstudiante/uid-real-de-un-estudiante'), true);
});

test('limpiarDatosDemoProgreso rechaza roles sin permiso', async () => {
  const servicio = crearServicioLimpiarDatosDemoProgreso({ firestore: crearFirestoreFake() });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, crearContexto({ rol: 'Tutor' })),
    /no autorizado/i,
  );
});
