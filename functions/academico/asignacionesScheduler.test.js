const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioVencerAsignaciones } = require('./asignacionesScheduler');

test('vencerAsignaciones marca como vencidas las asignaciones publicadas con fecha cierre pasada', async () => {
  const updates = [];
  const servicio = crearServicioVencerAsignaciones({
    listarAsignacionesPublicadas: async () => [
      {
        ref: { update: async (data) => updates.push({ id: 'a1', data }) },
        data: () => ({
          id: 'a1',
          tenantId: 'tenant-1',
          estado: 'publicada',
          fechaCierre: '2026-06-10T23:59:59.000Z',
        }),
      },
      {
        ref: { update: async (data) => updates.push({ id: 'a2', data }) },
        data: () => ({
          id: 'a2',
          tenantId: 'tenant-1',
          estado: 'publicada',
          fechaCierre: '2026-06-30T23:59:59.000Z',
        }),
      },
    ],
  });

  const resultado = await servicio(new Date('2026-06-11T00:00:00.000Z'));

  assert.equal(resultado.procesadas, 2);
  assert.equal(resultado.vencidas, 1);
  assert.deepEqual(updates, [
    {
      id: 'a1',
      data: {
        estado: 'vencida',
        actualizadoEn: '2026-06-11T00:00:00.000Z',
      },
    },
  ]);
});

test('vencerAsignaciones ignora asignaciones sin fecha de cierre', async () => {
  const updates = [];
  const servicio = crearServicioVencerAsignaciones({
    listarAsignacionesPublicadas: async () => [
      {
        ref: { update: async (data) => updates.push(data) },
        data: () => ({
          id: 'a1',
          tenantId: 'tenant-1',
          estado: 'publicada',
        }),
      },
    ],
  });

  const resultado = await servicio(new Date('2026-06-11T00:00:00.000Z'));

  assert.equal(resultado.procesadas, 1);
  assert.equal(resultado.vencidas, 0);
  assert.deepEqual(updates, []);
});
