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

// --- estadoMatricula (SDD pricing-cupo-real, Bloque 1 -- matricula-estado-estudiante) ----
//
// `facturacion-metered` (bloque posterior, no implementado aca) necesita un campo
// persistido para decidir que estudiante es facturable. `crearEstudiante` es el UNICO
// punto de alta (ver comentario de cabecera del archivo), asi que es el lugar donde se
// estampa el valor inicial. Scenario "Estudiante nuevo nace activo" (spec
// matricula-estado-estudiante).
test('crearEstudiante: estampa estadoMatricula:"activo" en el estudiante nuevo (Scenario: Estudiante nuevo nace activo)', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    { tenantId: 'tenant-1', nombres: 'Juan' },
    crearContextoInstructor(),
  );

  assert.equal(creado.estadoMatricula, 'activo');
});

test('crearEstudiante: ignora cualquier estadoMatricula que venga en el payload del cliente (estampado incondicional, D3)', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    { tenantId: 'tenant-1', nombres: 'Juan', estadoMatricula: 'retirado' },
    crearContextoInstructor(),
  );

  assert.equal(creado.estadoMatricula, 'activo');
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

// --- Normalizacion de correos (fix identidad del acudiente, 2026-07-22) -----------------
//
// `resolveLinkedStudent` resuelve los hijos de un acudiente con
// `where('tutor.correo', '==', <email de Auth, ya en minusculas>)`. Firestore compara por
// igualdad EXACTA y SENSIBLE A MAYUSCULAS, asi que un doc guardado con "Papa@Gajog.com"
// no matchea nunca y el padre entra a una pantalla vacia, sin error.
//
// La importacion masiva guardaba el correo del acudiente tal cual venia de la planilla
// (normalizaba el del alumno, en el mismo objeto, pero no el del tutor). Esta funcion es el
// unico punto por el que pasan TODAS las altas, asi que la normalizacion vive aca.

test('crearEstudiante: normaliza a minusculas el correo del ACUDIENTE', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    {
      tenantId: 'tenant-1',
      nombres: 'Juan',
      tutor: { nombres: 'MARIA', correo: '  Papa@Gajog.COM  ' },
    },
    crearContextoInstructor(),
  );

  assert.equal(creado.tutor.correo, 'papa@gajog.com');
  // El resto de los campos del tutor no se toca.
  assert.equal(creado.tutor.nombres, 'MARIA');
});

test('crearEstudiante: normaliza a minusculas el correo del ALUMNO', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    { tenantId: 'tenant-1', nombres: 'Juan', correo: 'Juan@Gajog.com ' },
    crearContextoInstructor(),
  );

  assert.equal(creado.correo, 'juan@gajog.com');
});

test('crearEstudiante: sin tutor ni correo no rompe ni inventa campos', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    { tenantId: 'tenant-1', nombres: 'Juan' },
    crearContextoInstructor(),
  );

  assert.equal(creado.nombres, 'Juan');
  assert.equal(creado.correo, undefined);
  assert.equal(creado.tutor, undefined);
});

test('crearEstudiante: un tutor sin correo conserva sus demas datos', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio(
    { tenantId: 'tenant-1', nombres: 'Juan', tutor: { nombres: 'MARIA', telefono: '300' } },
    crearContextoInstructor(),
  );

  assert.equal(creado.tutor.nombres, 'MARIA');
  assert.equal(creado.tutor.telefono, '300');
  assert.equal(creado.tutor.correo, undefined);
});
