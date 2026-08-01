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

// Fake minimo de Firestore: estudiantes en memoria + doc de tenant (mutable, para el flag
// sedeBonusOtorgada -- D4), suficiente para las dos colecciones que esta funcion toca
// (`estudiantes`, `tenants`). SDD pricing-cupo-real (Bloque 3b): ya no hay `limiteEstudiantes`
// -- `tenantData` por defecto es `{}` (sin bono, sin extras). El `.where().where().count().get()`
// encadenado replica la agregacion real que usa `contarEstudiantesFacturablesDelTenant`
// (estadoMatricula=='activo'), NO un `.get()` completo -- si el codigo real llamara `.get()`
// en la rama de conteo, este fake lo delataria.
function crearFirestoreFake({ estudiantesExistentes = [], tenantData = {} } = {}) {
  const estudiantes = new Map(estudiantesExistentes.map((e) => [e.id, { ...e }]));
  const tenants = new Map([
    ['tenant-1', { ...tenantData }],
    ['tenant-ajeno', { ...tenantData }],
  ]);
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
    where: (campo1, _op1, valor1) => ({
      where: (campo2, _op2, valor2) => ({
        count: () => ({
          get: async () => ({
            data: () => ({
              count: Array.from(estudiantes.values()).filter(
                (data) => data[campo1] === valor1 && data[campo2] === valor2
              ).length,
            }),
          }),
        }),
      }),
    }),
  };

  const tenantDocRef = (id) => ({
    get: async () => ({ exists: tenants.has(id), data: () => tenants.get(id) }),
    set: async (data, options) => {
      const actual = tenants.get(id) || {};
      tenants.set(id, options?.merge ? { ...actual, ...data } : data);
    },
  });

  const tenantsCollection = { doc: (id) => tenantDocRef(id) };

  return {
    collection: (nombre) => {
      if (nombre === 'estudiantes') return estudiantesCollection;
      if (nombre === 'tenants') return tenantsCollection;
      throw new Error(`Coleccion no mockeada: ${nombre}`);
    },
    _estudiantes: estudiantes,
    _tenants: tenants,
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

// --- sin tope duro + bono de sede (SDD pricing-cupo-real, Bloque 3b -- capacidad-tenant) ----
//
// El tope duro (`resource-exhausted` cuando se superaba `tenant.limiteEstudiantes`) se
// elimina: ya no hay planes fijos, capacidad-tenant exige "Alta nunca se bloquea". En su
// lugar, `crearEstudiante` evalua DESPUES de escribir el doc nuevo (D4: el estudiante 70 debe
// contarse a si mismo) si el tenant acaba de cruzar 70 estudiantes ACTIVOS por primera vez, y
// si es asi otorga +1 sede incluida de forma permanente (`sedeBonusOtorgada`), guardado por
// `sedeBonusOtorgada !== true` para que la carrera concurrente 69->70 sea idempotente.

test('crearEstudiante: ya NO rechaza por limite de capacidad sin importar cuantos estudiantes activos existan (capacidad-tenant: "Alta nunca se bloquea")', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: Array.from({ length: 500 }, (_, i) => ({
      id: `e${i}`,
      tenantId: 'tenant-1',
      estadoMatricula: 'activo',
    })),
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  const creado = await servicio({ tenantId: 'tenant-1', nombres: 'Quinientos Uno' }, crearContextoInstructor());

  assert.equal(creado.nombres, 'Quinientos Uno');
});

test('crearEstudiante: no otorga el bono de sede por debajo del umbral (69 estudiantes activos tras el alta)', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: Array.from({ length: 68 }, (_, i) => ({
      id: `e${i}`,
      tenantId: 'tenant-1',
      estadoMatricula: 'activo',
    })),
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  await servicio({ tenantId: 'tenant-1', nombres: 'Sesenta y Nueve' }, crearContextoInstructor());

  const tenant = firestore._tenants.get('tenant-1');
  assert.notEqual(tenant.sedeBonusOtorgada, true);
});

test('crearEstudiante: otorga el bono de sede la PRIMERA vez que el tenant cruza 70 estudiantes activos (Scenario: Cruce del umbral otorga el bono de inmediato)', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: Array.from({ length: 69 }, (_, i) => ({
      id: `e${i}`,
      tenantId: 'tenant-1',
      estadoMatricula: 'activo',
    })),
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  await servicio({ tenantId: 'tenant-1', nombres: 'Setenta' }, crearContextoInstructor());

  const tenant = firestore._tenants.get('tenant-1');
  assert.equal(tenant.sedeBonusOtorgada, true);
  assert.equal(typeof tenant.sedeBonusOtorgadaEn, 'string');
  assert.ok(!Number.isNaN(Date.parse(tenant.sedeBonusOtorgadaEn)));
});

test('crearEstudiante: NO revoca ni recalcula el bono si el conteo actual ya esta por debajo de 70 (D4: nunca se recalcula en vivo)', async () => {
  // El estudiante 71 nace 'activo' -- el conteo tras el alta es 1, muy por debajo de 70 --
  // pero el tenant YA tenia el bono otorgado de antes (por ejemplo, tras haber bajado de 70
  // por retiros). evaluarBonoSedePorCrecimiento debe dejarlo intacto, nunca revocarlo.
  const firestore = crearFirestoreFake({
    tenantData: { sedeBonusOtorgada: true, sedeBonusOtorgadaEn: '2026-01-01T00:00:00.000Z' },
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  await servicio({ tenantId: 'tenant-1', nombres: 'Setenta y Uno' }, crearContextoInstructor());

  const tenant = firestore._tenants.get('tenant-1');
  assert.equal(tenant.sedeBonusOtorgada, true);
  assert.equal(tenant.sedeBonusOtorgadaEn, '2026-01-01T00:00:00.000Z');
});

test('crearEstudiante: el bono se otorga una sola vez -- volver a cruzar 70 tras haber bajado y vuelto a subir NO re-otorga (Scenario: El bono se otorga una sola vez)', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: Array.from({ length: 69 }, (_, i) => ({
      id: `e${i}`,
      tenantId: 'tenant-1',
      estadoMatricula: 'activo',
    })),
    tenantData: { sedeBonusOtorgada: true, sedeBonusOtorgadaEn: '2026-01-01T00:00:00.000Z' },
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  await servicio({ tenantId: 'tenant-1', nombres: 'Setenta Otra Vez' }, crearContextoInstructor());

  const tenant = firestore._tenants.get('tenant-1');
  // La fecha de otorgamiento original no cambia -- no hay un segundo otorgamiento.
  assert.equal(tenant.sedeBonusOtorgadaEn, '2026-01-01T00:00:00.000Z');
});

test('crearEstudiante: el bono de sede es idempotente ante una carrera concurrente -- dos altas simultaneas del estudiante 70 convergen al mismo valor sin corromper el estado', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: Array.from({ length: 69 }, (_, i) => ({
      id: `e${i}`,
      tenantId: 'tenant-1',
      estadoMatricula: 'activo',
    })),
  });
  const servicio = crearServicioCrearEstudiante({ firestore });

  // Ninguna de las dos llamadas espera a la otra antes de decidir si otorga el bono --
  // evaluarBonoSedePorCrecimiento no usa una transaccion Firestore (D4: el boolean hace que
  // esto sea seguro por construccion, dos escrituras racing convergen al mismo valor `true`).
  await Promise.all([
    servicio({ tenantId: 'tenant-1', nombres: 'Setenta-A' }, crearContextoInstructor()),
    servicio({ tenantId: 'tenant-1', nombres: 'Setenta-B' }, crearContextoInstructor()),
  ]);

  const tenant = firestore._tenants.get('tenant-1');
  assert.equal(tenant.sedeBonusOtorgada, true);
  assert.equal(typeof tenant.sedeBonusOtorgadaEn, 'string');
});

// ─── creacion exitosa / payload ─────────────────────────────────────────────

test('crearEstudiante: crea correctamente y devuelve id + datos', async () => {
  const firestore = crearFirestoreFake({
    estudiantesExistentes: [{ id: 'e1', tenantId: 'tenant-1', nombres: 'Uno' }],
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
  const firestore = crearFirestoreFake({ estudiantesExistentes: [] });
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
  const firestore = crearFirestoreFake();
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
