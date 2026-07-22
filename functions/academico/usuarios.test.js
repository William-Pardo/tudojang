const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioActualizarUsuarioStaff } = require('./usuarios');

function crearContextoAdmin(overrides = {}) {
  return {
    auth: {
      uid: 'admin-1',
      token: { tenantId: 'tenant-1', rol: 'Admin', ...overrides },
    },
  };
}

function crearFirestoreFake({ usuarioExistente, writes = [] } = {}) {
  const state = {
    docActual: usuarioExistente ? { ...usuarioExistente } : null,
    writes,
  };
  return {
    collection: (name) => crearRef([name], state),
  };
}

function crearRef(path, state) {
  return {
    doc: (id) => crearRef([...path, id], state),
    collection: (name) => crearRef([...path, name], state),
    get: async () => crearSnap(state.docActual),
    set: async (data, options) => {
      state.writes.push({ path: path.join('/'), data, options });
      state.docActual = options?.merge ? { ...(state.docActual || {}), ...data } : data;
    },
  };
}

function crearSnap(data) {
  return {
    exists: Boolean(data),
    data: () => data,
  };
}

test('rechaza si no esta autenticado', async () => {
  const servicio = crearServicioActualizarUsuarioStaff({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', usuarioId: 'u1', cambios: { rol: 'Maestro' } }, {}),
    /no autenticado/i,
  );
});

test('rechaza si el que llama no es Admin ni SuperAdmin', async () => {
  const servicio = crearServicioActualizarUsuarioStaff({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-1', usuarioId: 'u1', cambios: { rol: 'Maestro' } },
      crearContextoAdmin({ rol: 'Editor' }),
    ),
    /solo un administrador/i,
  );
});

test('rechaza tenant no autorizado (Admin de otro tenant)', async () => {
  const servicio = crearServicioActualizarUsuarioStaff({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-2', usuarioId: 'u1', cambios: { rol: 'Maestro' } },
      crearContextoAdmin(),
    ),
    /tenant no autorizado/i,
  );
});

test('rechaza si el usuario objetivo pertenece a otro tenant', async () => {
  const servicio = crearServicioActualizarUsuarioStaff({
    firestore: crearFirestoreFake({
      usuarioExistente: { id: 'u1', tenantId: 'tenant-ajeno', rol: 'Editor' },
    }),
  });

  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-1', usuarioId: 'u1', cambios: { rol: 'Maestro' } },
      crearContextoAdmin(),
    ),
    /no pertenece a este tenant/i,
  );
});

test('Admin puede cambiar el rol de Editor a Maestro dentro de su tenant', async () => {
  const writes = [];
  const servicio = crearServicioActualizarUsuarioStaff({
    firestore: crearFirestoreFake({
      usuarioExistente: { id: 'u1', tenantId: 'tenant-1', rol: 'Editor', nombreUsuario: 'Adonai' },
      writes,
    }),
  });

  const resultado = await servicio(
    { tenantId: 'tenant-1', usuarioId: 'u1', cambios: { rol: 'Maestro', sedeId: 'sede-1' } },
    crearContextoAdmin(),
  );

  assert.equal(resultado.rol, 'Maestro');
  assert.equal(writes[0].path, 'usuarios/u1');
  assert.equal(writes[0].data.rol, 'Maestro');
  assert.equal(writes[0].data.sedeId, 'sede-1');
  assert.equal(writes[0].data.tenantId, 'tenant-1');
  assert.equal(writes[0].options.merge, true);
});

test('permite crear un usuario nuevo (doc todavia no existe)', async () => {
  const writes = [];
  const servicio = crearServicioActualizarUsuarioStaff({
    firestore: crearFirestoreFake({ writes }),
  });

  const resultado = await servicio(
    { tenantId: 'tenant-1', usuarioId: 'u-nuevo', cambios: { nombreUsuario: 'Nuevo Maestro', rol: 'Maestro' } },
    crearContextoAdmin(),
  );

  assert.equal(resultado.rol, 'Maestro');
  assert.equal(writes[0].data.tenantId, 'tenant-1');
});

test('rechaza rol invalido', async () => {
  const servicio = crearServicioActualizarUsuarioStaff({
    firestore: crearFirestoreFake({
      usuarioExistente: { id: 'u1', tenantId: 'tenant-1', rol: 'Editor' },
    }),
  });

  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-1', usuarioId: 'u1', cambios: { rol: 'Superheroe' } },
      crearContextoAdmin(),
    ),
    /rol invalido/i,
  );
});

test('rechaza que un Admin (no SuperAdmin) asigne el rol SuperAdmin', async () => {
  const servicio = crearServicioActualizarUsuarioStaff({
    firestore: crearFirestoreFake({
      usuarioExistente: { id: 'u1', tenantId: 'tenant-1', rol: 'Editor' },
    }),
  });

  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-1', usuarioId: 'u1', cambios: { rol: 'SuperAdmin' } },
      crearContextoAdmin(),
    ),
    /solo un superadmin/i,
  );
});

test('no permite sobrescribir tenantId a traves de cambios (fuerza el tenantId validado)', async () => {
  const writes = [];
  const servicio = crearServicioActualizarUsuarioStaff({
    firestore: crearFirestoreFake({
      usuarioExistente: { id: 'u1', tenantId: 'tenant-1', rol: 'Editor' },
      writes,
    }),
  });

  await servicio(
    { tenantId: 'tenant-1', usuarioId: 'u1', cambios: { tenantId: 'tenant-otro', nombreUsuario: 'X' } },
    crearContextoAdmin(),
  );

  assert.equal(writes[0].data.tenantId, 'tenant-1');
});

test('mapea campos de contrato (duracionContratoMeses -> contrato.duracionMeses)', async () => {
  const writes = [];
  const servicio = crearServicioActualizarUsuarioStaff({
    firestore: crearFirestoreFake({
      usuarioExistente: { id: 'u1', tenantId: 'tenant-1', rol: 'Maestro' },
      writes,
    }),
  });

  await servicio(
    {
      tenantId: 'tenant-1',
      usuarioId: 'u1',
      cambios: { sueldoBase: 1500000, duracionContratoMeses: 12, tipoVinculacion: 'Prestacion de servicios' },
    },
    crearContextoAdmin(),
  );

  assert.deepEqual(writes[0].data.contrato, {
    sueldoBase: 1500000,
    duracionMeses: 12,
    tipoVinculacion: 'Prestacion de servicios',
  });
});

test('SuperAdmin puede gestionar usuarios de cualquier tenant', async () => {
  const writes = [];
  const servicio = crearServicioActualizarUsuarioStaff({
    firestore: crearFirestoreFake({
      usuarioExistente: { id: 'u1', tenantId: 'tenant-ajeno', rol: 'Editor' },
      writes,
    }),
  });

  const resultado = await servicio(
    { tenantId: 'tenant-ajeno', usuarioId: 'u1', cambios: { rol: 'Maestro' } },
    { auth: { uid: 'master-1', token: { tenantId: 'aliant-global', rol: 'SuperAdmin' } } },
  );

  assert.equal(resultado.rol, 'Maestro');
});
