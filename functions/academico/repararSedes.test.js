const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioRepararSedesEjecucionPrograma } = require('./repararSedes');

function crearContextoAdmin(overrides = {}) {
  return {
    auth: {
      uid: 'admin-1',
      token: { tenantId: 'tenant-1', rol: 'Admin', ...overrides },
    },
  };
}

// Fake minimo de Firestore: `sedes` (con where), `tenants/{id}` (nombreClub) y
// `tenants/{id}/ejecucionesPrograma` (subcoleccion con doc.ref.set() para la reparacion).
function crearFirestoreFake({ tenantData = {}, sedes = [], ejecuciones = [] } = {}) {
  const sedesMap = new Map(sedes.map((s) => [s.id, { ...s }]));
  const ejecucionesMap = new Map(ejecuciones.map((e) => [e.id, { ...e }]));

  const sedesCollection = {
    where: (campo, _op, valor) => ({
      get: async () => ({
        docs: Array.from(sedesMap.entries())
          .filter(([, data]) => data[campo] === valor)
          .map(([id, data]) => ({ id, data: () => data })),
      }),
    }),
  };

  const ejecucionesCollection = {
    get: async () => ({
      docs: Array.from(ejecucionesMap.entries()).map(([id, data]) => ({
        id,
        data: () => data,
        ref: {
          set: async (cambios, options) => {
            const previo = ejecucionesMap.get(id) || {};
            ejecucionesMap.set(id, options?.merge ? { ...previo, ...cambios } : cambios);
          },
        },
      })),
    }),
  };

  const tenantsCollection = {
    doc: (id) => ({
      get: async () => ({
        exists: id === 'tenant-1' || id === 'tenant-ajeno',
        data: () => tenantData,
      }),
      collection: (nombre) => {
        if (nombre === 'ejecucionesPrograma') return ejecucionesCollection;
        throw new Error(`Subcoleccion no mockeada: ${nombre}`);
      },
    }),
  };

  return {
    collection: (nombre) => {
      if (nombre === 'sedes') return sedesCollection;
      if (nombre === 'tenants') return tenantsCollection;
      throw new Error(`Coleccion no mockeada: ${nombre}`);
    },
    _ejecuciones: ejecucionesMap,
  };
}

// ─── autenticacion / autorizacion ──────────────────────────────────────────

test('repararSedesEjecucionPrograma: rechaza si no esta autenticado', async () => {
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, {}),
    /no autenticado/i,
  );
});

test('repararSedesEjecucionPrograma: rechaza si el que llama no es Admin ni SuperAdmin', async () => {
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, crearContextoAdmin({ rol: 'Editor' })),
    /solo un administrador/i,
  );
});

test('repararSedesEjecucionPrograma: rechaza tenant no autorizado (Admin de otro tenant)', async () => {
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-2' }, crearContextoAdmin()),
    /tenant no autorizado/i,
  );
});

test('repararSedesEjecucionPrograma: SuperAdmin puede reparar cualquier tenant', async () => {
  const firestore = crearFirestoreFake({
    sedes: [{ id: 'sede-real-xyz', tenantId: 'tenant-2', nombre: 'Cocodrilos' }],
    ejecuciones: [{ id: 'ejecucion-1', sedeId: 'cocodrilos' }],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-2' }, crearContextoAdmin({ rol: 'SuperAdmin', tenantId: 'tenant-otro' }));
  assert.equal(resultado.reparadas.length, 1);
});

test('repararSedesEjecucionPrograma: rechaza si falta el tenantId', async () => {
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({}, crearContextoAdmin()),
    /tenant.*obligatorio/i,
  );
});

// ─── reparacion real (caso William Roa) ────────────────────────────────────

test('repararSedesEjecucionPrograma: repara un sedeId legado que es el slug de una sede real (caso William Roa: Precadetes/Cocodrilos)', async () => {
  const firestore = crearFirestoreFake({
    sedes: [{ id: 'sede-real-xyz789', tenantId: 'tenant-1', nombre: 'Cocodrilos' }],
    ejecuciones: [
      { id: 'ejecucion-precadetes-cocodrilos', tenantId: 'tenant-1', grupoId: 'precadetes', sedeId: 'cocodrilos' },
    ],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.revisadas, 1);
  assert.equal(resultado.reparadas.length, 1);
  assert.equal(resultado.reparadas[0].ejecucionId, 'ejecucion-precadetes-cocodrilos');
  assert.equal(resultado.reparadas[0].sedeIdAnterior, 'cocodrilos');
  assert.equal(resultado.reparadas[0].sedeIdNuevo, 'sede-real-xyz789');
  assert.equal(resultado.sinResolver.length, 0);

  // La escritura real en Firestore quedo aplicada, no solo reportada.
  assert.equal(firestore._ejecuciones.get('ejecucion-precadetes-cocodrilos').sedeId, 'sede-real-xyz789');
});

test('repararSedesEjecucionPrograma: repara un sedeId legado que es el slug de la Sede Principal sintetica (nombreClub)', async () => {
  const firestore = crearFirestoreFake({
    tenantData: { nombreClub: 'Academia Central' },
    sedes: [],
    ejecuciones: [{ id: 'ejecucion-1', sedeId: 'academia-central' }],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.reparadas.length, 1);
  assert.equal(resultado.reparadas[0].sedeIdNuevo, 'principal');
});

test('repararSedesEjecucionPrograma: NO toca una ejecucion cuyo sedeId ya es un id real', async () => {
  const firestore = crearFirestoreFake({
    sedes: [{ id: 'sede-real-xyz789', tenantId: 'tenant-1', nombre: 'Cocodrilos' }],
    ejecuciones: [{ id: 'ejecucion-1', sedeId: 'sede-real-xyz789' }],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.reparadas.length, 0);
  assert.equal(resultado.sinResolver.length, 0);
  assert.equal(firestore._ejecuciones.get('ejecucion-1').sedeId, 'sede-real-xyz789');
});

test('repararSedesEjecucionPrograma: NO toca la sede sintetica "principal" (id real fijo)', async () => {
  const firestore = crearFirestoreFake({
    tenantData: { nombreClub: 'Academia Central' },
    sedes: [],
    ejecuciones: [{ id: 'ejecucion-1', sedeId: 'principal' }],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.reparadas.length, 0);
});

test('repararSedesEjecucionPrograma: deja en sinResolver una ejecucion cuyo sedeId no corresponde a ninguna sede conocida (nunca adivina)', async () => {
  const firestore = crearFirestoreFake({
    sedes: [{ id: 'sede-real-xyz789', tenantId: 'tenant-1', nombre: 'Cocodrilos' }],
    ejecuciones: [{ id: 'ejecucion-huerfana', sedeId: 'sede-totalmente-borrada' }],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.reparadas.length, 0);
  assert.equal(resultado.sinResolver.length, 1);
  assert.equal(resultado.sinResolver[0].ejecucionId, 'ejecucion-huerfana');
  assert.equal(resultado.sinResolver[0].sedeIdActual, 'sede-totalmente-borrada');
  // No se toco el documento.
  assert.equal(firestore._ejecuciones.get('ejecucion-huerfana').sedeId, 'sede-totalmente-borrada');
});

test('repararSedesEjecucionPrograma: procesa un lote mixto (reparadas + intactas + sin resolver) y reporta el total revisado', async () => {
  const firestore = crearFirestoreFake({
    sedes: [{ id: 'sede-real-xyz789', tenantId: 'tenant-1', nombre: 'Cocodrilos' }],
    ejecuciones: [
      { id: 'rota', sedeId: 'cocodrilos' },
      { id: 'intacta', sedeId: 'sede-real-xyz789' },
      { id: 'huerfana', sedeId: 'sede-borrada' },
    ],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.revisadas, 3);
  assert.equal(resultado.reparadas.length, 1);
  assert.equal(resultado.sinResolver.length, 1);
});

test('repararSedesEjecucionPrograma: ignora sedes de OTRO tenant al construir el catalogo (no repara con una sede ajena)', async () => {
  const firestore = crearFirestoreFake({
    sedes: [
      { id: 'sede-ajena', tenantId: 'tenant-2', nombre: 'Cocodrilos' },
    ],
    ejecuciones: [{ id: 'ejecucion-1', sedeId: 'cocodrilos' }],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.reparadas.length, 0);
  assert.equal(resultado.sinResolver.length, 1);
});

test('repararSedesEjecucionPrograma: ignora sedes con deletedAt al construir el catalogo (no repara con una sede dada de baja)', async () => {
  const firestore = crearFirestoreFake({
    sedes: [
      { id: 'sede-borrada', tenantId: 'tenant-1', nombre: 'Cocodrilos', deletedAt: '2026-07-01T00:00:00.000Z' },
    ],
    ejecuciones: [{ id: 'ejecucion-1', sedeId: 'cocodrilos' }],
  });
  const servicio = crearServicioRepararSedesEjecucionPrograma({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.reparadas.length, 0);
  assert.equal(resultado.sinResolver.length, 1);
});
