const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioCrearEstudiante } = require('./estudiantes');

function crearContextoInstructor(overrides = {}) {
  return {
    auth: {
      uid: 'admin-1',
      token: { tenantId: 'tenant-1', rol: 'Admin', ...overrides },
    },
  };
}

// Fake minimo de Firestore: estudiantes en memoria + doc de tenant (limiteEstudiantes),
// suficiente para las dos colecciones que esta funcion toca (`estudiantes`, `tenants`).
function crearFirestoreFake({ estudiantesExistentes = [], tenantData = { plan: 'starter', limiteEstudiantes: 50 } } = {}) {
  const estudiantes = new Map(estudiantesExistentes.map((e) => [e.id, { ...e }]));
  let contadorIds = 0;

  const estudiantesCollection = {
    add: async (data) => {
      contadorIds += 1;
      const id = `estudiante-generado-${contadorIds}`;
      estudiantes.set(id, { ...data });
      return {
        id,
        get: async () => ({ exists: true, data: () => estudiantes.get(id) }),
      };
    },
    where: (campo, _op, valor) => ({
      get: async () => ({
        docs: Array.from(estudiantes.entries())
          .filter(([, data]) => data[campo] === valor)
          .map(([id, data]) => ({ id, data: () => data })),
      }),
    }),
  };

  const tenantsCollection = {
    doc: (id) => ({
      get: async () => ({
        exists: id === 'tenant-1' || id === 'tenant-ajeno',
        data: () => tenantData,
      }),
    }),
  };

  return {
    collection: (nombre) => {
      if (nombre === 'estudiantes') return estudiantesCollection;
      if (nombre === 'tenants') return tenantsCollection;
      throw new Error(`Coleccion no mockeada: ${nombre}`);
    },
    _estudiantes: estudiantes,
  };
}

// ─── autenticacion / rol / tenant ──────────────────────────────────────────

test('crearEstudiante: rechaza si no esta autenticado', async () => {
  const servicio = crearServicioCrearEstudiante({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombres: 'Juan' }, {}),
    /no autenticado/i,
  );
});

test('crearEstudiante: rechaza rol no autorizado (Estudiante/Tutor no son instructor)', async () => {
  const servicio = crearServicioCrearEstudiante({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombres: 'Juan' }, crearContextoInstructor({ rol: 'Estudiante' })),
    /solo un instructor/i,
  );
});

test('crearEstudiante: permite Editor/Asistente/Maestro (no solo Admin) -- mismo alcance que isInstructor()', async () => {
  const firestore = crearFirestoreFake();

  for (const rol of ['Editor', 'Asistente', 'Maestro', 'SuperAdmin']) {
    const servicio = crearServicioCrearEstudiante({ firestore: crearFirestoreFake() });
    const contexto = rol === 'SuperAdmin'
      ? crearContextoInstructor({ tenantId: 'otro-tenant-del-superadmin', rol })
      : crearContextoInstructor({ rol });
    const creado = await servicio({ tenantId: 'tenant-1', nombres: `Estudiante-${rol}` }, contexto);
    assert.equal(creado.nombres, `Estudiante-${rol}`);
  }
});

test('crearEstudiante: rechaza tenant no autorizado (Admin de otro tenant)', async () => {
  const servicio = crearServicioCrearEstudiante({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-2', nombres: 'Juan' }, crearContextoInstructor()),
    /tenant no autorizado/i,
  );
});

// ─── limite del plan ────────────────────────────────────────────────────────

test('crearEstudiante: rechaza si ya se alcanzo el limite del plan (bug real: antes solo se chequeaba en el boton de la UI)', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', nombres: 'Uno' },
      { id: 'e2', tenantId: 'tenant-1', nombres: 'Dos' },
    ],
    tenantData: { plan: 'starter', limiteEstudiantes: 2 },
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombres: 'Tres' }, crearContextoInstructor()),
    /l[íi]mite del plan superado/i,
  );
});

test('crearEstudiante: usa tenant.limiteEstudiantes ya consolidado (plan + addons), no recalcula addons', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', nombres: 'Uno' },
      { id: 'e2', tenantId: 'tenant-1', nombres: 'Dos' },
    ],
    // Plan starter (limite base 50) + addon "+10 Alumnos" ya sumado por
    // actualizarCapacidadClub -- el campo consolidado es lo unico que se lee.
    tenantData: { plan: 'starter', limiteEstudiantes: 3 },
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio({ tenantId: 'tenant-1', nombres: 'Tres' }, crearContextoInstructor());

  assert.equal(creado.nombres, 'Tres');
});

test('crearEstudiante: cae al limite fijo del plan (fallback) si el tenant no tiene limiteEstudiantes seteado', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: Array.from({ length: 50 }, (_, i) => ({ id: `e${i}`, tenantId: 'tenant-1', nombres: `E${i}` })),
    tenantData: { plan: 'starter' }, // sin limiteEstudiantes -> fallback LIMITE_ESTUDIANTES_POR_PLAN.starter = 50
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombres: 'Extra' }, crearContextoInstructor()),
    /l[íi]mite del plan superado/i,
  );
});

// ─── creacion exitosa / payload ─────────────────────────────────────────────

test('crearEstudiante: crea correctamente dentro del limite y devuelve id + datos', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: [{ id: 'e1', tenantId: 'tenant-1', nombres: 'Uno' }],
    tenantData: { plan: 'growth', limiteEstudiantes: 150 },
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    { tenantId: 'tenant-1', nombres: 'Juan', apellidos: 'Perez', numeroIdentificacion: '123' },
    crearContextoInstructor(),
  );

  assert.equal(creado.nombres, 'Juan');
  assert.equal(creado.apellidos, 'Perez');
  assert.equal(creado.tenantId, 'tenant-1');
  assert.ok(creado.id);
  assert.deepEqual(creado.historialPagos, []);
  assert.equal(creado.carnetGenerado, false);
});

test('crearEstudiante: ignora cualquier id/tenantId que venga en el payload del cliente', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: [],
    tenantData: { plan: 'starter', limiteEstudiantes: 50 },
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    { tenantId: 'tenant-1', nombres: 'Juan', id: 'id-forzado' },
    crearContextoInstructor(),
  );

  assert.notEqual(creado.id, 'id-forzado');
  assert.equal(creado.tenantId, 'tenant-1');
});

test('crearEstudiante: SuperAdmin puede crear estudiantes en cualquier tenant', async () => {
  const firestore = crearFirestoreFake({ tenantData: { plan: 'pro', limiteEstudiantes: 350 } });
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    { tenantId: 'tenant-1', nombres: 'Juan' },
    crearContextoInstructor({ tenantId: 'otro-tenant-del-superadmin', rol: 'SuperAdmin' }),
  );

  assert.equal(creado.nombres, 'Juan');
  assert.equal(creado.tenantId, 'tenant-1');
});
