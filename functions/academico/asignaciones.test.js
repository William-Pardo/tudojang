const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioPublishAsignacion, crearServicioPublishAsignacionesBatch } = require('./asignaciones');

test('publishAsignacion rechaza recurso pendiente', async () => {
  const servicio = crearServicioPublishAsignacion({
    firestore: crearFirestoreFake({
      recurso: { id: 'recurso-1', tenantId: 'tenant-1', estado: 'pendiente' },
      jornada: { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
    }),
  });

  await assert.rejects(
    () => servicio(
      crearDataBase(),
      crearContextoBase()
    ),
    /recurso aprobado/i
  );
});

test('publishAsignacion rechaza maestro no asignado a la jornada', async () => {
  const servicio = crearServicioPublishAsignacion({
    firestore: crearFirestoreFake({
      recurso: { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' },
      jornada: { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'otro-maestro' },
    }),
  });

  await assert.rejects(
    () => servicio(
      crearDataBase(),
      crearContextoBase()
    ),
    /maestro asignado/i
  );
});

// Bug reportado por el usuario (verificacion manual 2026-07-11): un Admin no podia
// publicar material en una jornada de OTRO instructor -- "Solo el maestro asignado a
// la jornada puede publicar la asignacion", el mismo mensaje que ve un maestro no
// asignado. validarJornada no tenia ningun bypass de rol (a diferencia del gating de
// CLIENTE en MisClasesView.tsx::puedeEditarJornada, que si deja pasar a Admin/SuperAdmin).
test('Admin puede publicar material en una jornada de OTRO instructor', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacion({
    firestore: crearFirestoreFake({
      recurso: { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' },
      jornada: { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'otro-maestro' },
      writes,
    }),
  });

  const resultado = await servicio(
    crearDataBase(),
    { auth: { uid: 'admin-1', token: { tenantId: 'tenant-1', rol: 'Admin' } } }
  );

  assert.equal(resultado.ok, true);
  assert.equal(writes[0].data.creadoPorUid, 'admin-1');
});

test('SuperAdmin puede publicar material en una jornada de OTRO instructor', async () => {
  const servicio = crearServicioPublishAsignacion({
    firestore: crearFirestoreFake({
      recurso: { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' },
      jornada: { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'otro-maestro' },
    }),
  });

  const resultado = await servicio(
    crearDataBase(),
    { auth: { uid: 'super-1', token: { tenantId: 'tenant-1', rol: 'SuperAdmin' } } }
  );

  assert.equal(resultado.ok, true);
});

test('Editor NO admin sigue rechazado si no es el maestro asignado (sin regresion)', async () => {
  const servicio = crearServicioPublishAsignacion({
    firestore: crearFirestoreFake({
      recurso: { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' },
      jornada: { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'otro-maestro' },
    }),
  });

  await assert.rejects(
    () => servicio(
      crearDataBase(),
      { auth: { uid: 'editor-1', token: { tenantId: 'tenant-1', rol: 'Editor' } } }
    ),
    /maestro asignado/i
  );
});

test('publishAsignacion crea asignacion con tenant y maestro validos', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacion({
    firestore: crearFirestoreFake({
      recurso: { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' },
      jornada: { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
      writes,
    }),
  });

  const resultado = await servicio(
    crearDataBase(),
    crearContextoBase()
  );

  assert.equal(resultado.ok, true);
  assert.equal(resultado.asignacionId, 'asignacion-1');
  assert.equal(writes[0].path, 'tenants/tenant-1/asignaciones/asignacion-1');
  assert.equal(writes[0].data.estado, 'publicada');
  assert.equal(writes[0].data.creadoPorUid, 'maestro-1');
  assert.equal(writes[0].data.jornadaId, 'jornada-1');
});

test('publishAsignacion no revierte una asignacion en estado terminal cerrada', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacion({
    firestore: crearFirestoreFake({
      recurso: { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' },
      jornada: { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
      asignacionExistente: { id: 'asignacion-1', estado: 'cerrada' },
      writes,
    }),
  });

  const resultado = await servicio(
    crearDataBase(),
    crearContextoBase()
  );

  assert.equal(resultado.ok, true);
  assert.equal(writes[0].data.estado, 'cerrada');
});

test('publishAsignacion no revierte una asignacion en estado terminal vencida', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacion({
    firestore: crearFirestoreFake({
      recurso: { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' },
      jornada: { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
      asignacionExistente: { id: 'asignacion-1', estado: 'vencida' },
      writes,
    }),
  });

  const resultado = await servicio(
    crearDataBase(),
    crearContextoBase()
  );

  assert.equal(resultado.ok, true);
  assert.equal(writes[0].data.estado, 'vencida');
});

function crearDataBase() {
  return {
    tenantId: 'tenant-1',
    jornadaId: 'jornada-1',
    asignacion: {
      id: 'asignacion-1',
      tenantId: 'tenant-1',
      recursoId: 'recurso-1',
      titulo: 'Material tecnico',
      destinatario: { tipo: 'grupo', grupo: 'Infantil' },
      uso: 'estudio',
      momento: 'preparacion',
      obligatoria: true,
      fechaApertura: '2026-06-27T00:00:00.000Z',
    },
  };
}

function crearContextoBase() {
  return {
    auth: {
      uid: 'maestro-1',
      token: {
        tenantId: 'tenant-1',
        rol: 'Tutor',
      },
    },
  };
}

function crearFirestoreFake({ recurso, jornada, asignacionExistente, writes = [] }) {
  return {
    collection: (name) => crearRef([name], { recurso, jornada, asignacionExistente, writes }),
  };
}

function crearRef(path, state) {
  return {
    doc: (id) => crearRef([...path, id], state),
    collection: (name) => crearRef([...path, name], state),
    get: async () => {
      const joined = path.join('/');
      if (joined.endsWith(`/recursos/${state.recurso?.id}`)) {
        return crearSnap(state.recurso);
      }
      if (joined.endsWith(`/jornadas/${state.jornada?.id}`)) {
        return crearSnap(state.jornada);
      }
      if (
        state.asignacionExistente &&
        joined.endsWith(`/asignaciones/${state.asignacionExistente.id}`)
      ) {
        return crearSnap(state.asignacionExistente);
      }
      return crearSnap(null);
    },
    set: async (data) => {
      state.writes.push({ path: path.join('/'), data });
    },
  };
}

function crearSnap(data) {
  return {
    exists: Boolean(data),
    data: () => data,
  };
}

test('publishAsignacionesBatch crea una asignacion por cada combinacion recurso x jornada', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacionesBatch({
    firestore: crearFirestoreFakeBatch({
      recursos: {
        'recurso-1': { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' },
        'recurso-2': { id: 'recurso-2', tenantId: 'tenant-1', estado: 'aprobado' },
      },
      jornadas: {
        'jornada-1': { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
        'jornada-2': { id: 'jornada-2', tenantId: 'tenant-1', instructorId: 'maestro-1' },
      },
      writes,
    }),
  });

  const resultado = await servicio(
    crearDataBatchBase({ recursoIds: ['recurso-1', 'recurso-2'], jornadaIds: ['jornada-1', 'jornada-2'] }),
    crearContextoBase()
  );

  assert.equal(resultado.ok, true);
  assert.equal(resultado.created.length, 4);
  assert.deepEqual(resultado.skipped, []);
  assert.equal(writes.length, 4);
});

test('publishAsignacionesBatch usa el nombre de cada recurso como titulo cuando asignacionBase no trae uno propio', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacionesBatch({
    firestore: crearFirestoreFakeBatch({
      recursos: {
        'recurso-1': { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado', nombre: 'Fundamentos tecnicos' },
        'recurso-2': { id: 'recurso-2', tenantId: 'tenant-1', estado: 'aprobado', nombre: 'Refuerzo patada frontal' },
      },
      jornadas: {
        'jornada-1': { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
      },
      writes,
    }),
  });

  const dataSinTitulo = crearDataBatchBase({ recursoIds: ['recurso-1', 'recurso-2'], jornadaIds: ['jornada-1'] });
  delete dataSinTitulo.asignacionBase.titulo;

  await servicio(dataSinTitulo, crearContextoBase());

  const titulos = writes.map((write) => write.data.titulo).sort();
  assert.deepEqual(titulos, ['Fundamentos tecnicos', 'Refuerzo patada frontal']);
});

test('publishAsignacionesBatch usa tituloVisible del recurso, priorizado sobre nombre, cuando asignacionBase no trae titulo propio', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacionesBatch({
    firestore: crearFirestoreFakeBatch({
      recursos: {
        'recurso-1': {
          id: 'recurso-1',
          tenantId: 'tenant-1',
          estado: 'aprobado',
          nombre: 'archivo_original_drive.pdf',
          tituloVisible: 'Fundamentos tecnicos curados',
        },
        'recurso-2': {
          id: 'recurso-2',
          tenantId: 'tenant-1',
          estado: 'aprobado',
          nombre: 'Refuerzo patada frontal',
        },
      },
      jornadas: {
        'jornada-1': { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
      },
      writes,
    }),
  });

  const dataSinTitulo = crearDataBatchBase({ recursoIds: ['recurso-1', 'recurso-2'], jornadaIds: ['jornada-1'] });
  delete dataSinTitulo.asignacionBase.titulo;

  await servicio(dataSinTitulo, crearContextoBase());

  const titulos = writes.map((write) => write.data.titulo).sort();
  assert.deepEqual(titulos, ['Fundamentos tecnicos curados', 'Refuerzo patada frontal']);
});

test('publishAsignacionesBatch saltea combinaciones duplicadas sin abortar el resto', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacionesBatch({
    firestore: crearFirestoreFakeBatch({
      recursos: { 'recurso-1': { id: 'recurso-1', tenantId: 'tenant-1', estado: 'aprobado' } },
      jornadas: {
        'jornada-1': { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
        'jornada-2': { id: 'jornada-2', tenantId: 'tenant-1', instructorId: 'maestro-1' },
      },
      existentes: ['asignacion-recurso-1-jornada-1'],
      writes,
    }),
  });

  const resultado = await servicio(
    crearDataBatchBase({ recursoIds: ['recurso-1'], jornadaIds: ['jornada-1', 'jornada-2'] }),
    crearContextoBase()
  );

  assert.equal(resultado.created.length, 1);
  assert.equal(resultado.created[0], 'asignacion-recurso-1-jornada-2');
  assert.deepEqual(resultado.skipped, [
    { recursoId: 'recurso-1', jornadaId: 'jornada-1', reason: 'duplicado' },
  ]);
  assert.equal(writes.length, 1);
});

test('publishAsignacionesBatch saltea recurso no aprobado y jornada inexistente sin abortar el resto', async () => {
  const writes = [];
  const servicio = crearServicioPublishAsignacionesBatch({
    firestore: crearFirestoreFakeBatch({
      recursos: {
        'recurso-ok': { id: 'recurso-ok', tenantId: 'tenant-1', estado: 'aprobado' },
        'recurso-pendiente': { id: 'recurso-pendiente', tenantId: 'tenant-1', estado: 'pendiente' },
      },
      jornadas: {
        'jornada-1': { id: 'jornada-1', tenantId: 'tenant-1', instructorId: 'maestro-1' },
      },
      writes,
    }),
  });

  const resultado = await servicio(
    crearDataBatchBase({
      recursoIds: ['recurso-ok', 'recurso-pendiente'],
      jornadaIds: ['jornada-1', 'jornada-inexistente'],
    }),
    crearContextoBase()
  );

  assert.deepEqual(resultado.created, ['asignacion-recurso-ok-jornada-1']);
  assert.deepEqual(resultado.skipped, [
    { recursoId: 'recurso-ok', jornadaId: 'jornada-inexistente', reason: 'jornada_no_encontrada' },
    { recursoId: 'recurso-pendiente', jornadaId: 'jornada-1', reason: 'recurso_no_aprobado' },
    { recursoId: 'recurso-pendiente', jornadaId: 'jornada-inexistente', reason: 'recurso_no_aprobado' },
  ]);
});

function crearDataBatchBase({ recursoIds, jornadaIds } = {}) {
  return {
    tenantId: 'tenant-1',
    recursoIds: recursoIds || ['recurso-1'],
    jornadaIds: jornadaIds || ['jornada-1'],
    asignacionBase: {
      tenantId: 'tenant-1',
      titulo: 'Material tecnico',
      destinatario: { tipo: 'grupo', grupo: 'Infantil' },
      uso: 'estudio',
      momento: 'preparacion',
      obligatoria: true,
      fechaApertura: '2026-06-27T00:00:00.000Z',
    },
  };
}

function crearFirestoreFakeBatch({ recursos = {}, jornadas = {}, existentes = [], writes = [] }) {
  const state = { recursos, jornadas, existentes, writes };
  return {
    collection: (name) => crearRefBatch([name], state),
    batch: () => crearBatchFake(state),
  };
}

function crearRefBatch(path, state) {
  const id = path[path.length - 1];
  const joined = path.join('/');
  return {
    doc: (docId) => crearRefBatch([...path, docId], state),
    collection: (name) => crearRefBatch([...path, name], state),
    get: async () => {
      if (joined.includes('/recursos/')) return crearSnap(state.recursos[id] || null);
      if (joined.includes('/jornadas/')) return crearSnap(state.jornadas[id] || null);
      if (joined.includes('/asignaciones/')) {
        return crearSnap(state.existentes.includes(id) ? { id } : null);
      }
      return crearSnap(null);
    },
    set: async (data) => {
      state.writes.push({ path: joined, data });
    },
  };
}

function crearBatchFake(state) {
  const pendientes = [];
  return {
    set: (ref, data) => {
      pendientes.push({ ref, data });
    },
    commit: async () => {
      for (const { ref, data } of pendientes) {
        await ref.set(data);
      }
    },
  };
}
