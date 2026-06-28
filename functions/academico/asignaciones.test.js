const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioPublishAsignacion } = require('./asignaciones');

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

function crearFirestoreFake({ recurso, jornada, writes = [] }) {
  return {
    collection: (name) => crearRef([name], { recurso, jornada, writes }),
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
