const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioActualizarUsuarioStaff, crearServicioRepararOCrearUsuarioStaff } = require('./usuarios');

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

// --- repararOCrearUsuarioStaff ---

function crearAuthAdminFake({ uid = 'uid-huerfano', lanzarError = false } = {}) {
  return {
    getUserByEmail: async (email) => {
      if (lanzarError) throw Object.assign(new Error('no existe'), { code: 'auth/user-not-found' });
      return { uid, email };
    },
  };
}

test('repararOCrearUsuarioStaff: rechaza si no esta autenticado', async () => {
  const servicio = crearServicioRepararOCrearUsuarioStaff({
    firestore: crearFirestoreFake(),
    authAdmin: crearAuthAdminFake(),
  });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', email: 'x@x.com', datosUsuario: { rol: 'Asistente' } }, {}),
    /no autenticado/i,
  );
});

test('repararOCrearUsuarioStaff: rechaza si el caller no es Admin', async () => {
  const servicio = crearServicioRepararOCrearUsuarioStaff({
    firestore: crearFirestoreFake(),
    authAdmin: crearAuthAdminFake(),
  });
  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-1', email: 'x@x.com', datosUsuario: { rol: 'Asistente' } },
      { auth: { uid: 'editor-1', token: { tenantId: 'tenant-1', rol: 'Editor' } } },
    ),
    /administrador/i,
  );
});

test('repararOCrearUsuarioStaff: crea el documento cuando el uid existe en Auth pero no en Firestore', async () => {
  const writes = [];
  const servicio = crearServicioRepararOCrearUsuarioStaff({
    firestore: crearFirestoreFake({ writes }),
    authAdmin: crearAuthAdminFake({ uid: 'uid-huerfano' }),
  });
  const resultado = await servicio(
    { tenantId: 'tenant-1', email: 'orphan@user.com', datosUsuario: { nombreUsuario: 'Orphan', rol: 'Asistente' } },
    crearContextoAdmin(),
  );
  assert.equal(resultado.id, 'uid-huerfano');
  assert.equal(resultado.email, 'orphan@user.com');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, 'usuarios/uid-huerfano');
  assert.equal(writes[0].data.rol, 'Asistente');
  assert.equal(writes[0].data.tenantId, 'tenant-1');
});

test('repararOCrearUsuarioStaff: lanza already-exists cuando el doc en Firestore ya existe', async () => {
  const servicio = crearServicioRepararOCrearUsuarioStaff({
    firestore: crearFirestoreFake({ usuarioExistente: { tenantId: 'tenant-1', rol: 'Asistente' } }),
    authAdmin: crearAuthAdminFake({ uid: 'uid-existente' }),
  });
  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-1', email: 'dup@user.com', datosUsuario: { rol: 'Asistente' } },
      crearContextoAdmin(),
    ),
    /already-exists|ya tiene un usuario registrado/i,
  );
});

test('repararOCrearUsuarioStaff: lanza not-found cuando el email no existe en Auth', async () => {
  const servicio = crearServicioRepararOCrearUsuarioStaff({
    firestore: crearFirestoreFake(),
    authAdmin: crearAuthAdminFake({ lanzarError: true }),
  });
  await assert.rejects(
    () => servicio(
      { tenantId: 'tenant-1', email: 'noexiste@user.com', datosUsuario: { rol: 'Asistente' } },
      crearContextoAdmin(),
    ),
    /not-found|no existe en Authentication/i,
  );
});
