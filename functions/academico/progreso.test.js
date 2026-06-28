const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioConsolidateProgress } = require('./progreso');

test('consolidateProgress persiste progreso PDF completado con tenant y estudiante validos', async () => {
  const writes = [];
  const servicio = crearServicioConsolidateProgress({
    obtenerAsignacion: async () => ({
      id: 'asig-1',
      tenantId: 'tenant-1',
      estudianteId: 'est-1',
      estado: 'activa',
      tipo: 'pdf',
      totalPaginas: 5,
      permanenciaMinimaSegundos: 120,
    }),
    guardarProgreso: async (path, data) => writes.push({ path, data }),
  });

  const resultado = await servicio({
    auth: { uid: 'est-1', token: { tenantId: 'tenant-1' } },
    data: {
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'pdf',
      paginasVistas: [1, 2, 3, 4, 5],
      permanenciaSegundos: 180,
    },
  });

  assert.equal(resultado.estadoProgreso, 'completado');
  assert.equal(resultado.porcentaje, 100);
  assert.deepEqual(writes[0].path, ['tenants', 'tenant-1', 'progreso', 'est-1', 'asignaciones', 'asig-1']);
  assert.equal(writes[0].data.estadoProgreso, 'completado');
});

test('consolidateProgress rechaza tenant inconsistente', async () => {
  const servicio = crearServicioConsolidateProgress({
    obtenerAsignacion: async () => ({ tenantId: 'otro-tenant', estado: 'activa' }),
    guardarProgreso: async () => {},
  });

  await assert.rejects(
    () => servicio({
      auth: { uid: 'est-1', token: { tenantId: 'tenant-1' } },
      data: { tenantId: 'tenant-1', asignacionId: 'asig-1', tipo: 'video', segundosUnicos: [1], totalSegundos: 10 },
    }),
    /tenant no autorizado/i
  );
});

test('consolidateProgress calcula video en progreso sin completar bajo 78%', async () => {
  const writes = [];
  const servicio = crearServicioConsolidateProgress({
    obtenerAsignacion: async () => ({
      tenantId: 'tenant-1',
      estado: 'activa',
      tipo: 'video',
      totalSegundos: 100,
    }),
    guardarProgreso: async (path, data) => writes.push({ path, data }),
  });

  const resultado = await servicio({
    auth: { uid: 'est-1', token: { tenantId: 'tenant-1' } },
    data: {
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'video',
      segundosUnicos: Array.from({ length: 50 }, (_, i) => i + 1),
      totalSegundos: 100,
    },
  });

  assert.equal(resultado.estadoProgreso, 'en_progreso');
  assert.equal(resultado.porcentaje, 50);
  assert.equal(writes[0].data.estadoProgreso, 'en_progreso');
});

test('consolidateProgress actualiza asignacion cuando el progreso queda completado', async () => {
  const updates = [];
  const servicio = crearServicioConsolidateProgress({
    obtenerAsignacion: async () => ({
      id: 'asig-1',
      tenantId: 'tenant-1',
      estado: 'publicada',
      tipo: 'video',
      totalSegundos: 100,
    }),
    guardarProgreso: async () => {},
    actualizarAsignacion: async (tenantId, asignacionId, data) => updates.push({ tenantId, asignacionId, data }),
  });

  const resultado = await servicio({
    auth: { uid: 'est-1', token: { tenantId: 'tenant-1' } },
    data: {
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'video',
      segundosUnicos: Array.from({ length: 80 }, (_, i) => i + 1),
      totalSegundos: 100,
    },
  });

  assert.equal(resultado.estadoProgreso, 'completado');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].tenantId, 'tenant-1');
  assert.equal(updates[0].asignacionId, 'asig-1');
  assert.equal(updates[0].data.ultimoEstadoProgreso, 'completado');
});
