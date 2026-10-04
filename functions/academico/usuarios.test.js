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

// ─── crearUsuarioStaff ───────────────────────────────────────────────────────

const { crearServicioCrearUsuarioStaff } = require('./usuarios');

// Fake de Firestore para el alta: docs por ruta (`usuarios/uid`, `tenants/uid`) + filas de
// `estudiantes`/`usuarios` consultables con where(campo,'==',valor).limit(1).get(). Soporta
// campos anidados ('tutor.correo'). `fallarSetUsuarios` simula un fallo del write del perfil.
function crearFirestoreAlta({ docs = {}, filas = {}, fallarSetUsuarios = false } = {}) {
  const documentos = new Map(Object.entries(docs));
  const leerCampo = (obj, campo) => campo.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  return {
    _docs: documentos,
    collection: (nombre) => ({
      doc: (id) => ({
        get: async () => {
          const data = documentos.get(`${nombre}/${id}`);
          return { exists: Boolean(data), data: () => data };
        },
        set: async (data) => {
          if (fallarSetUsuarios && nombre === 'usuarios') throw new Error('firestore caido');
          documentos.set(`${nombre}/${id}`, data);
        },
      }),
      where: (campo, _op, valor) => ({
        limit: () => ({
          get: async () => ({
            empty: !(filas[nombre] || []).some((fila) => leerCampo(fila, campo) === valor),
          }),
        }),
      }),
    }),
  };
}

// Fake de Admin Auth: usuarios por email; createUser falla con auth/email-already-exists si
// el email ya esta tomado. Registra cada llamada para asserts.
function crearAuthAlta({ existentes = [], fallarClaims = false } = {}) {
  const porEmail = new Map(existentes.map((u) => [u.email, { ...u }]));
  let contador = 0;
  const llamadas = { createUser: [], setCustomUserClaims: [], deleteUser: [] };
  return {
    llamadas,
    porEmail,
    createUser: async (props) => {
      llamadas.createUser.push(props);
      if (porEmail.has(props.email)) {
        throw Object.assign(new Error('exists'), { code: 'auth/email-already-exists' });
      }
      contador += 1;
      const usuario = { uid: `uid-nuevo-${contador}`, email: props.email };
      porEmail.set(props.email, usuario);
      return usuario;
    },
    getUserByEmail: async (email) => {
      const u = porEmail.get(email);
      if (!u) throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
      return u;
    },
    setCustomUserClaims: async (uid, claims) => {
      llamadas.setCustomUserClaims.push({ uid, claims });
      if (fallarClaims) throw new Error('claims caidos');
    },
    deleteUser: async (uid) => {
      llamadas.deleteUser.push(uid);
      for (const [email, u] of porEmail) if (u.uid === uid) porEmail.delete(email);
    },
  };
}

const datosAlta = (overrides = {}) => ({
  email: '  Nuevo.Maestro@Mail.COM ',
  contrasena: 'secreta1',
  nombreUsuario: 'Nuevo Maestro',
  numeroIdentificacion: '123',
  whatsapp: '3001234567',
  rol: 'Maestro',
  sedeId: 'sede-1',
  sueldoBase: 1000,
  ...overrides,
});

test('crearUsuarioStaff: rechaza si no esta autenticado', async () => {
  const auth = crearAuthAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta(), auth });
  await assert.rejects(() => servicio({ tenantId: 'tenant-1', datos: datosAlta() }, {}), /no autenticado/i);
  assert.equal(auth.llamadas.createUser.length, 0);
});

test('crearUsuarioStaff: rechaza si el que llama no es Admin ni SuperAdmin', async () => {
  const auth = crearAuthAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta(), auth });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', datos: datosAlta() }, crearContextoAdmin({ rol: 'Editor' })),
    (err) => err.code === 'permission-denied' && /solo un administrador/i.test(err.message),
  );
  assert.equal(auth.llamadas.createUser.length, 0);
});

test('crearUsuarioStaff: rechaza Admin de otro tenant (cross-tenant)', async () => {
  const auth = crearAuthAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta(), auth });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-2', datos: datosAlta() }, crearContextoAdmin()),
    (err) => err.code === 'permission-denied' && /tenant no autorizado/i.test(err.message),
  );
  assert.equal(auth.llamadas.createUser.length, 0);
});

for (const rol of ['Estudiante', 'Tutor', 'SuperAdmin', 'Inventado', undefined]) {
  test(`crearUsuarioStaff: rechaza rol no permitido para el equipo (${rol})`, async () => {
    const auth = crearAuthAlta();
    const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta(), auth });
    await assert.rejects(
      () => servicio({ tenantId: 'tenant-1', datos: datosAlta({ rol }) }, crearContextoAdmin()),
      (err) => err.code === 'invalid-argument' && /rol invalido/i.test(err.message),
    );
    assert.equal(auth.llamadas.createUser.length, 0);
  });
}

test('crearUsuarioStaff: rechaza contrasena de menos de 6 caracteres y correo invalido', async () => {
  const auth = crearAuthAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta(), auth });
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', datos: datosAlta({ contrasena: '12345' }) }, crearContextoAdmin()),
    (err) => err.code === 'invalid-argument',
  );
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', datos: datosAlta({ email: 'no-es-correo' }) }, crearContextoAdmin()),
    (err) => err.code === 'invalid-argument',
  );
  assert.equal(auth.llamadas.createUser.length, 0);
});

test('crearUsuarioStaff: happy path -- crea cuenta, claims {rol, tenantId} y perfil con email normalizado', async () => {
  const auth = crearAuthAlta();
  const firestore = crearFirestoreAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore, auth });

  const resultado = await servicio(
    // tenantId dentro de `datos` se ignora: manda el tenantId autorizado.
    { tenantId: 'tenant-1', datos: datosAlta({ tenantId: 'tenant-ajeno' }) },
    crearContextoAdmin(),
  );

  assert.deepEqual(auth.llamadas.createUser, [
    { email: 'nuevo.maestro@mail.com', password: 'secreta1', displayName: 'Nuevo Maestro' },
  ]);
  assert.deepEqual(auth.llamadas.setCustomUserClaims, [
    { uid: 'uid-nuevo-1', claims: { rol: 'Maestro', tenantId: 'tenant-1' } },
  ]);
  const perfil = firestore._docs.get('usuarios/uid-nuevo-1');
  assert.deepEqual(perfil, {
    nombreUsuario: 'Nuevo Maestro',
    email: 'nuevo.maestro@mail.com',
    numeroIdentificacion: '123',
    whatsapp: '3001234567',
    rol: 'Maestro',
    tenantId: 'tenant-1',
    sedeId: 'sede-1',
    contrato: {
      sueldoBase: 1000, duracionMeses: 0, tipoVinculacion: '', fechaInicio: '', lugarEjecucion: '', firmado: false,
    },
    fcmTokens: [],
  });
  assert.deepEqual(resultado, { id: 'uid-nuevo-1', ...perfil });
  assert.deepEqual(auth.llamadas.deleteUser, []);
});

test('crearUsuarioStaff: SuperAdmin puede dar de alta en cualquier tenant', async () => {
  const auth = crearAuthAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta(), auth });
  const resultado = await servicio(
    { tenantId: 'tenant-9', datos: datosAlta({ rol: 'Admin' }) },
    crearContextoAdmin({ rol: 'SuperAdmin', tenantId: 'aliant-global' }),
  );
  assert.equal(resultado.tenantId, 'tenant-9');
  assert.deepEqual(auth.llamadas.setCustomUserClaims[0].claims, { rol: 'Admin', tenantId: 'tenant-9' });
});

test('crearUsuarioStaff: rollback -- si falla el write del perfil, borra la cuenta Auth recien creada y relanza', async () => {
  const auth = crearAuthAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta({ fallarSetUsuarios: true }), auth });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', datos: datosAlta() }, crearContextoAdmin()),
    /firestore caido/,
  );
  assert.deepEqual(auth.llamadas.deleteUser, ['uid-nuevo-1']);
  assert.equal(auth.porEmail.has('nuevo.maestro@mail.com'), false);
});

test('crearUsuarioStaff: rollback -- si fallan los claims, borra la cuenta Auth y no escribe perfil', async () => {
  const auth = crearAuthAlta({ fallarClaims: true });
  const firestore = crearFirestoreAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore, auth });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', datos: datosAlta() }, crearContextoAdmin()),
    /claims caidos/,
  );
  assert.deepEqual(auth.llamadas.deleteUser, ['uid-nuevo-1']);
  assert.equal(firestore._docs.has('usuarios/uid-nuevo-1'), false);
});

test('crearUsuarioStaff: recupera una cuenta huerfana real (sin claims, perfil ni estudiante) -- la borra y reintenta una vez', async () => {
  const auth = crearAuthAlta({ existentes: [{ uid: 'uid-huerfano', email: 'nuevo.maestro@mail.com' }] });
  const firestore = crearFirestoreAlta();
  const servicio = crearServicioCrearUsuarioStaff({ firestore, auth });

  const resultado = await servicio({ tenantId: 'tenant-1', datos: datosAlta() }, crearContextoAdmin());

  assert.deepEqual(auth.llamadas.deleteUser, ['uid-huerfano']);
  assert.equal(auth.llamadas.createUser.length, 2);
  assert.equal(resultado.id, 'uid-nuevo-1');
  assert.ok(firestore._docs.has('usuarios/uid-nuevo-1'));
});

test('crearUsuarioStaff: un customClaims vacio ({}) cuenta como sin claims (huerfana)', async () => {
  const auth = crearAuthAlta({
    existentes: [{ uid: 'uid-huerfano', email: 'nuevo.maestro@mail.com', customClaims: {} }],
  });
  const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta(), auth });
  await servicio({ tenantId: 'tenant-1', datos: datosAlta() }, crearContextoAdmin());
  assert.deepEqual(auth.llamadas.deleteUser, ['uid-huerfano']);
});

const casosNoHuerfana = [
  ['tiene custom claims', { existente: { customClaims: { rol: 'Admin', tenantId: 'tenant-x' } } }],
  ['tiene perfil usuarios/{uid}', { docs: { 'usuarios/uid-existente': { rol: 'Admin' } } }],
  ['es duena de un tenant (onboarding, uid == tenantId)', { docs: { 'tenants/uid-existente': { nombre: 'Club' } } }],
  ['comparte email con otro perfil de usuarios', { filas: { usuarios: [{ email: 'nuevo.maestro@mail.com' }] } }],
  ['esta vinculada como alumno (estudiantes.correo)', { filas: { estudiantes: [{ correo: 'nuevo.maestro@mail.com' }] } }],
  ['esta vinculada como acudiente (estudiantes.tutor.correo)', { filas: { estudiantes: [{ tutor: { correo: 'nuevo.maestro@mail.com' } }] } }],
];

for (const [descripcion, { existente = {}, docs, filas }] of casosNoHuerfana) {
  test(`crearUsuarioStaff: NO reusa ni borra una cuenta existente que ${descripcion} -- already-exists`, async () => {
    const auth = crearAuthAlta({
      existentes: [{ uid: 'uid-existente', email: 'nuevo.maestro@mail.com', ...existente }],
    });
    const servicio = crearServicioCrearUsuarioStaff({ firestore: crearFirestoreAlta({ docs, filas }), auth });

    await assert.rejects(
      () => servicio({ tenantId: 'tenant-1', datos: datosAlta() }, crearContextoAdmin()),
      (err) => err.code === 'already-exists' && /ya est. registrado en TuDojang/i.test(err.message),
    );
    assert.deepEqual(auth.llamadas.deleteUser, []);
    assert.deepEqual(auth.llamadas.setCustomUserClaims, []);
    assert.equal(auth.llamadas.createUser.length, 1);
  });
}
