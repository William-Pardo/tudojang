const test = require('node:test');
const assert = require('node:assert/strict');
const {
  crearServicioCreateSede,
  crearServicioUpdateSede,
  crearServicioDeleteSede,
} = require('./sedes');

function crearContextoAdmin(overrides = {}) {
  return {
    auth: {
      uid: 'admin-1',
      token: { tenantId: 'tenant-1', rol: 'Admin', ...overrides },
    },
  };
}

// Fake minimo de Firestore: sedes en memoria + doc de tenant (capacidad), suficiente
// para las dos colecciones que estas funciones tocan (`sedes`, `tenants`). SDD
// pricing-cupo-real (Bloque 3b): `tenantData` por defecto es `{}` -- calcularCapacidad({}).sedes
// = 1 (solo la sede incluida, sin bono ni extras), ya no `LIMITE_SEDES_POR_PLAN[plan]`.
function crearFirestoreFake({ sedesExistentes = [], tenantData = {} } = {}) {
  const sedes = new Map(sedesExistentes.map((s) => [s.id, { ...s }]));
  let contadorIds = 0;

  const sedeDocRef = (id) => ({
    id,
    get: async () => ({
      exists: sedes.has(id),
      data: () => sedes.get(id),
    }),
    set: async (data, options) => {
      const actual = sedes.get(id) || {};
      sedes.set(id, options?.merge ? { ...actual, ...data } : data);
    },
  });

  const sedesCollection = {
    doc: (id) => sedeDocRef(id),
    add: async (data) => {
      contadorIds += 1;
      const id = `sede-generada-${contadorIds}`;
      sedes.set(id, { ...data });
      return sedeDocRef(id);
    },
    where: (campo, _op, valor) => ({
      get: async () => ({
        docs: Array.from(sedes.entries())
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
      if (nombre === 'sedes') return sedesCollection;
      if (nombre === 'tenants') return tenantsCollection;
      throw new Error(`Coleccion no mockeada: ${nombre}`);
    },
    _sedes: sedes,
  };
}

// ─── crearServicioCreateSede ───────────────────────────────────────────────

test('createSede: rechaza si no esta autenticado', async () => {
  const servicio = crearServicioCreateSede({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombre: 'Sede Norte' }, {}),
    /no autenticado/i,
  );
});

test('createSede: rechaza si el que llama no es Admin ni SuperAdmin', async () => {
  const servicio = crearServicioCreateSede({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombre: 'Sede Norte' }, crearContextoAdmin({ rol: 'Editor' })),
    /solo un administrador/i,
  );
});

test('createSede: rechaza tenant no autorizado (Admin de otro tenant)', async () => {
  const servicio = crearServicioCreateSede({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-2', nombre: 'Sede Norte' }, crearContextoAdmin()),
    /tenant no autorizado/i,
  );
});

test('createSede: rechaza nombre vacio', async () => {
  const servicio = crearServicioCreateSede({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombre: '   ' }, crearContextoAdmin()),
    /nombre.*obligatorio/i,
  );
});

test('createSede: rechaza si ya se alcanzo la capacidad incluida (bug real: antes solo se chequeaba en el boton de la UI)', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 'principal', tenantId: 'tenant-1', nombre: 'Sede Principal' },
      { id: 'sede-2', tenantId: 'tenant-1', nombre: 'Sede 2' },
    ],
    // calcularCapacidad({}).sedes = 1 (solo la incluida, sin bono ni extras) -- 2 existentes
    // ya la superan.
    tenantData: {},
  });
  const servicio = crearServicioCreateSede({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombre: 'Sede 3' }, crearContextoAdmin()),
    /l[íi]mite de sedes alcanzado/i,
  );
});

test('createSede: permite crear si hay sedesExtraContratadas que amplian la capacidad incluida (SDD pricing-cupo-real: ya no PLANES_SAAS/cuposSedesAdicionales)', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 'principal', tenantId: 'tenant-1', nombre: 'Sede Principal' },
      { id: 'sede-2', tenantId: 'tenant-1', nombre: 'Sede 2' },
    ],
    tenantData: { sedesExtraContratadas: 2 }, // calcularCapacidad: 1 incluida + 2 extra = 3
  });
  const servicio = crearServicioCreateSede({ firestore });

  const creada = await servicio({ tenantId: 'tenant-1', nombre: 'Sede 3' }, crearContextoAdmin());

  assert.equal(creada.nombre, 'Sede 3');
});

test('createSede: el bono de sede (sedeBonusOtorgada) tambien amplia la capacidad -- obtenerLimiteSedes delega en calcularCapacidad, no en un campo propio', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 's1', tenantId: 'tenant-1', nombre: 'Sede 1' },
      { id: 's2', tenantId: 'tenant-1', nombre: 'Sede 2' },
      { id: 's3', tenantId: 'tenant-1', nombre: 'Sede 3' },
    ],
    // calcularCapacidad: 1 incluida + 1 bono (70 estudiantes, D4) + 2 extra = 4
    tenantData: { sedeBonusOtorgada: true, sedesExtraContratadas: 2 },
  });
  const servicio = crearServicioCreateSede({ firestore });

  const creada = await servicio({ tenantId: 'tenant-1', nombre: 'Sede 4' }, crearContextoAdmin());

  assert.equal(creada.nombre, 'Sede 4');
});

test('createSede: rechaza al superar la capacidad (incluida + bono + extras), no un limite de plan', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 's1', tenantId: 'tenant-1', nombre: 'Sede 1' },
      { id: 's2', tenantId: 'tenant-1', nombre: 'Sede 2' },
      { id: 's3', tenantId: 'tenant-1', nombre: 'Sede 3' },
      { id: 's4', tenantId: 'tenant-1', nombre: 'Sede 4' },
    ],
    tenantData: { sedeBonusOtorgada: true, sedesExtraContratadas: 2 }, // capacidad = 4
  });
  const servicio = crearServicioCreateSede({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombre: 'Sede 5' }, crearContextoAdmin()),
    /l[íi]mite de sedes alcanzado/i,
  );
});

test('createSede: no cuenta sedes con deletedAt contra la capacidad', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 'principal', tenantId: 'tenant-1', nombre: 'Sede Principal' },
      { id: 'sede-vieja', tenantId: 'tenant-1', nombre: 'Sede Vieja', deletedAt: '2026-01-01T00:00:00.000Z' },
    ],
    // 1 incluida + 1 extra = 2 -- solo 1 sede ACTIVA existente ("Sede Principal"), asi que
    // esto aisla el comportamiento de deletedAt (no la aritmetica de capacidad en si).
    tenantData: { sedesExtraContratadas: 1 },
  });
  const servicio = crearServicioCreateSede({ firestore });

  const creada = await servicio({ tenantId: 'tenant-1', nombre: 'Sede 2' }, crearContextoAdmin());

  assert.equal(creada.nombre, 'Sede 2');
});

test('createSede: rechaza nombre duplicado (insensible a mayusculas/espacios) -- bug real: "Sede B" x2, "Nueva Sede" x2', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 'sede-b', tenantId: 'tenant-1', nombre: 'Sede B' },
    ],
    tenantData: { sedesExtraContratadas: 2 }, // capacidad de sobra (1+2=3): no es el limite lo que bloquea aca
  });
  const servicio = crearServicioCreateSede({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', nombre: '  sede   b  ' }, crearContextoAdmin()),
    /ya existe una sede llamada/i,
  );
});

test('createSede: crea correctamente dentro de la capacidad con nombre unico', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [{ id: 'principal', tenantId: 'tenant-1', nombre: 'Sede Principal' }],
    tenantData: { sedesExtraContratadas: 2 }, // 1 incluida + 2 extra = 3
  });
  const servicio = crearServicioCreateSede({ firestore });

  const creada = await servicio(
    { tenantId: 'tenant-1', nombre: 'Sede Norte', ciudad: 'Bogotá', telefono: '3000000000' },
    crearContextoAdmin(),
  );

  assert.equal(creada.nombre, 'Sede Norte');
  assert.equal(creada.tenantId, 'tenant-1');
  assert.equal(creada.ciudad, 'Bogotá');
});

test('createSede: ignora cualquier deletedAt/id/tenantId que venga en el payload del cliente', async () => {
  const firestore = crearFirestoreFake({ sedesExistentes: [] });
  const servicio = crearServicioCreateSede({ firestore });

  const creada = await servicio(
    { tenantId: 'tenant-1', nombre: 'Sede Norte', deletedAt: '2020-01-01T00:00:00.000Z', id: 'id-forzado' },
    crearContextoAdmin(),
  );

  assert.equal(creada.deletedAt, undefined);
  assert.notEqual(creada.id, 'id-forzado');
});

// ─── crearServicioUpdateSede ───────────────────────────────────────────────

test('updateSede: rechaza si la sede no existe', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioUpdateSede({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', sedeId: 'no-existe', cambios: { nombre: 'X' } }, crearContextoAdmin()),
    /no existe/i,
  );
});

test('updateSede: rechaza si la sede pertenece a otro tenant', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [{ id: 'sede-1', tenantId: 'tenant-ajeno', nombre: 'Sede Ajena' }],
  });
  const servicio = crearServicioUpdateSede({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', sedeId: 'sede-1', cambios: { nombre: 'X' } }, crearContextoAdmin()),
    /no pertenece a este tenant/i,
  );
});

test('updateSede: rechaza renombrar a un nombre que ya usa otra sede activa del mismo tenant', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 'sede-1', tenantId: 'tenant-1', nombre: 'Sede Norte' },
      { id: 'sede-2', tenantId: 'tenant-1', nombre: 'Sede Sur' },
    ],
  });
  const servicio = crearServicioUpdateSede({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', sedeId: 'sede-1', cambios: { nombre: 'Sede Sur' } }, crearContextoAdmin()),
    /ya existe una sede llamada/i,
  );
});

test('updateSede: permite renombrar a su propio nombre actual (no colisiona consigo misma)', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [{ id: 'sede-1', tenantId: 'tenant-1', nombre: 'Sede Norte' }],
  });
  const servicio = crearServicioUpdateSede({ firestore });

  const actualizada = await servicio(
    { tenantId: 'tenant-1', sedeId: 'sede-1', cambios: { nombre: 'Sede Norte', telefono: '3001112222' } },
    crearContextoAdmin(),
  );

  assert.equal(actualizada.nombre, 'Sede Norte');
  assert.equal(actualizada.telefono, '3001112222');
});

test('updateSede: permite actualizar campos sin tocar el nombre sin exigir unicidad', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 'sede-1', tenantId: 'tenant-1', nombre: 'Sede Norte' },
      { id: 'sede-2', tenantId: 'tenant-1', nombre: 'Sede Sur' },
    ],
  });
  const servicio = crearServicioUpdateSede({ firestore });

  const actualizada = await servicio(
    { tenantId: 'tenant-1', sedeId: 'sede-1', cambios: { ciudad: 'Medellín' } },
    crearContextoAdmin(),
  );

  assert.equal(actualizada.ciudad, 'Medellín');
  assert.equal(actualizada.nombre, 'Sede Norte');
});

test('updateSede: ignora intentos de mover la sede de tenant o de tocar deletedAt via cambios', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [{ id: 'sede-1', tenantId: 'tenant-1', nombre: 'Sede Norte' }],
  });
  const servicio = crearServicioUpdateSede({ firestore });

  const actualizada = await servicio(
    { tenantId: 'tenant-1', sedeId: 'sede-1', cambios: { tenantId: 'tenant-2', deletedAt: '2020-01-01', ciudad: 'Cali' } },
    crearContextoAdmin(),
  );

  assert.equal(actualizada.tenantId, 'tenant-1');
  assert.equal(actualizada.deletedAt, undefined);
  assert.equal(actualizada.ciudad, 'Cali');
});

// ─── crearServicioDeleteSede ────────────────────────────────────────────────

test('deleteSede: rechaza si la sede pertenece a otro tenant (tenantId se deriva del propio documento, no de lo que mande el cliente)', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [{ id: 'sede-1', tenantId: 'tenant-ajeno', nombre: 'Sede Ajena' }],
  });
  const servicio = crearServicioDeleteSede({ firestore });

  await assert.rejects(
    () => servicio({ sedeId: 'sede-1' }, crearContextoAdmin()),
    /tenant no autorizado/i,
  );
});

test('deleteSede: marca deletedAt (soft delete) sin borrar el documento', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [{ id: 'sede-1', tenantId: 'tenant-1', nombre: 'Sede Norte' }],
  });
  const servicio = crearServicioDeleteSede({ firestore });

  const resultado = await servicio({ sedeId: 'sede-1' }, crearContextoAdmin());

  assert.equal(resultado.ok, true);
  const sedeGuardada = firestore._sedes.get('sede-1');
  assert.ok(sedeGuardada.deletedAt);
  assert.equal(sedeGuardada.nombre, 'Sede Norte');
});

test('deleteSede: una sede eliminada deja de contar contra la capacidad para un create posterior', async () => {
  const firestore = crearFirestoreFake({
    sedesExistentes: [
      { id: 'principal', tenantId: 'tenant-1', nombre: 'Sede Principal' },
      { id: 'sede-2', tenantId: 'tenant-1', nombre: 'Sede 2' },
    ],
    tenantData: { sedesExtraContratadas: 1 }, // 1 incluida + 1 extra = 2
  });
  const eliminar = crearServicioDeleteSede({ firestore });
  const crear = crearServicioCreateSede({ firestore });

  await eliminar({ sedeId: 'sede-2' }, crearContextoAdmin());
  const creada = await crear({ tenantId: 'tenant-1', nombre: 'Sede Reemplazo' }, crearContextoAdmin());

  assert.equal(creada.nombre, 'Sede Reemplazo');
});

// ─── SuperAdmin cross-tenant ────────────────────────────────────────────────

test('createSede: SuperAdmin puede crear sedes en cualquier tenant', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioCreateSede({ firestore });

  const creada = await servicio(
    { tenantId: 'tenant-1', nombre: 'Sede Norte' },
    crearContextoAdmin({ tenantId: 'otro-tenant-del-superadmin', rol: 'SuperAdmin' }),
  );

  assert.equal(creada.nombre, 'Sede Norte');
});
