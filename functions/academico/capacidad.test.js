const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioActualizarExtrasContratados } = require('./capacidad');
const { calcularCapacidad } = require('../facturacion');

function crearContextoAdmin(overrides = {}) {
  return {
    auth: {
      uid: 'admin-1',
      token: { tenantId: 'tenant-1', rol: 'Admin', ...overrides },
    },
  };
}

// Fake minimo de Firestore: solo `tenants`, unica coleccion que esta funcion toca. Mismo
// estilo que crearFirestoreFake en academico/estudiantes.test.js / academico/sedes.test.js.
function crearFirestoreFake({ tenants = {} } = {}) {
  const datosTenants = new Map(Object.entries(tenants).map(([id, data]) => [id, { ...data }]));

  const tenantsCollection = {
    doc: (id) => ({
      get: async () => ({
        exists: datosTenants.has(id),
        data: () => ({ ...datosTenants.get(id) }),
      }),
      set: async (data, opciones = {}) => {
        const previo = datosTenants.get(id) || {};
        datosTenants.set(id, opciones.merge ? { ...previo, ...data } : { ...data });
      },
    }),
  };

  return {
    collection: (nombre) => {
      if (nombre === 'tenants') return tenantsCollection;
      throw new Error(`Coleccion no mockeada: ${nombre}`);
    },
    _tenants: datosTenants,
  };
}

// ─── autenticacion / rol / tenant ──────────────────────────────────────────

test('actualizarExtrasContratados: rechaza si no esta autenticado', async () => {
  const servicio = crearServicioActualizarExtrasContratados({
    firestore: crearFirestoreFake({ tenants: { 'tenant-1': {} } }),
  });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', campo: 'sedesExtraContratadas', cantidad: 1 }, {}),
    /no autenticado/i,
  );
});

test('actualizarExtrasContratados: rechaza rol no autorizado (Editor/Asistente/Maestro/Estudiante no son Admin)', async () => {
  const servicio = crearServicioActualizarExtrasContratados({
    firestore: crearFirestoreFake({ tenants: { 'tenant-1': {} } }),
  });

  for (const rol of ['Editor', 'Asistente', 'Maestro', 'Estudiante', 'Tutor']) {
    await assert.rejects(
      () => servicio({ tenantId: 'tenant-1', campo: 'sedesExtraContratadas', cantidad: 1 }, crearContextoAdmin({ rol })),
      /solo un administrador/i,
      `rol ${rol} no deberia poder gestionar la capacidad contratada`,
    );
  }
});

test('actualizarExtrasContratados: rechaza tenant no autorizado (Admin de otro tenant)', async () => {
  const servicio = crearServicioActualizarExtrasContratados({
    firestore: crearFirestoreFake({ tenants: { 'tenant-1': {} } }),
  });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', campo: 'sedesExtraContratadas', cantidad: 1 }, crearContextoAdmin({ tenantId: 'tenant-2' })),
    /tenant no autorizado/i,
  );
});

test('actualizarExtrasContratados: SuperAdmin puede operar cross-tenant', async () => {
  const servicio = crearServicioActualizarExtrasContratados({
    firestore: crearFirestoreFake({ tenants: { 'tenant-1': { sedesExtraContratadas: 0 } } }),
  });

  const resultado = await servicio(
    { tenantId: 'tenant-1', campo: 'sedesExtraContratadas', cantidad: 1 },
    crearContextoAdmin({ tenantId: 'otro-tenant-del-superadmin', rol: 'SuperAdmin' }),
  );

  assert.equal(resultado.valor, 1);
});

test('actualizarExtrasContratados: rechaza si el tenant no existe', async () => {
  const servicio = crearServicioActualizarExtrasContratados({
    firestore: crearFirestoreFake({ tenants: {} }),
  });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-inexistente', campo: 'sedesExtraContratadas', cantidad: 1 }, crearContextoAdmin({ tenantId: 'tenant-inexistente' })),
    /no existe/i,
  );
});

// ─── campo / cantidad ───────────────────────────────────────────────────────

test('actualizarExtrasContratados: rechaza un campo desconocido (no es un updateDoc generico)', async () => {
  const servicio = crearServicioActualizarExtrasContratados({
    firestore: crearFirestoreFake({ tenants: { 'tenant-1': {} } }),
  });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', campo: 'sedeBonusOtorgada', cantidad: 1 }, crearContextoAdmin()),
    /campo no válido/i,
  );
  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', campo: 'plan', cantidad: 1 }, crearContextoAdmin()),
    /campo no válido/i,
  );
});

test('actualizarExtrasContratados: rechaza cantidad no entera (NaN, string, decimal)', async () => {
  const servicio = crearServicioActualizarExtrasContratados({
    firestore: crearFirestoreFake({ tenants: { 'tenant-1': {} } }),
  });

  for (const cantidadInvalida of [NaN, '1', 1.5, undefined, null]) {
    await assert.rejects(
      () => servicio({ tenantId: 'tenant-1', campo: 'sedesExtraContratadas', cantidad: cantidadInvalida }, crearContextoAdmin()),
      /número entero/i,
      `cantidad ${String(cantidadInvalida)} deberia rechazarse`,
    );
  }
});

test('actualizarExtrasContratados: rechaza si la operacion dejaria el campo en un valor negativo', async () => {
  const servicio = crearServicioActualizarExtrasContratados({
    firestore: crearFirestoreFake({ tenants: { 'tenant-1': { equipoTecnicoExtraContratado: 1 } } }),
  });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1', campo: 'equipoTecnicoExtraContratado', cantidad: -2 }, crearContextoAdmin()),
    /valor negativo/i,
  );
});

// ─── escritura correcta ─────────────────────────────────────────────────────

test('actualizarExtrasContratados: incrementa sedesExtraContratadas desde 0', async () => {
  const firestore = crearFirestoreFake({ tenants: { 'tenant-1': {} } });
  const servicio = crearServicioActualizarExtrasContratados({ firestore });

  const resultado = await servicio(
    { tenantId: 'tenant-1', campo: 'sedesExtraContratadas', cantidad: 1 },
    crearContextoAdmin(),
  );

  assert.deepEqual(resultado, { tenantId: 'tenant-1', campo: 'sedesExtraContratadas', valor: 1 });
  assert.equal(firestore._tenants.get('tenant-1').sedesExtraContratadas, 1);
});

test('actualizarExtrasContratados: incrementa equipoTecnicoExtraContratado sobre un valor ya existente', async () => {
  const firestore = crearFirestoreFake({ tenants: { 'tenant-1': { equipoTecnicoExtraContratado: 2 } } });
  const servicio = crearServicioActualizarExtrasContratados({ firestore });

  const resultado = await servicio(
    { tenantId: 'tenant-1', campo: 'equipoTecnicoExtraContratado', cantidad: 3 },
    crearContextoAdmin(),
  );

  assert.equal(resultado.valor, 5);
});

test('actualizarExtrasContratados: acepta cantidad negativa para reducir un extra ya comprado, sin bajar de 0', async () => {
  const firestore = crearFirestoreFake({ tenants: { 'tenant-1': { sedesExtraContratadas: 3 } } });
  const servicio = crearServicioActualizarExtrasContratados({ firestore });

  const resultado = await servicio(
    { tenantId: 'tenant-1', campo: 'sedesExtraContratadas', cantidad: -1 },
    crearContextoAdmin(),
  );

  assert.equal(resultado.valor, 2);
});

test('actualizarExtrasContratados: no toca ningun otro campo del tenant', async () => {
  const firestore = crearFirestoreFake({
    tenants: { 'tenant-1': { nombreClub: 'Tudojang', plan: 'starter', sedesExtraContratadas: 0 } },
  });
  const servicio = crearServicioActualizarExtrasContratados({ firestore });

  await servicio({ tenantId: 'tenant-1', campo: 'sedesExtraContratadas', cantidad: 1 }, crearContextoAdmin());

  const tenantFinal = firestore._tenants.get('tenant-1');
  assert.equal(tenantFinal.nombreClub, 'Tudojang');
  assert.equal(tenantFinal.plan, 'starter');
});

// --- D8 (owner seat accounting, capacidad-tenant) -------------------------------------
//
// Este callable solo persiste el insumo (`sedesExtraContratadas`/
// `equipoTecnicoExtraContratado`); `calcularCapacidad` (functions/facturacion.js, Bloque 2,
// no reabierto aca) sigue siendo la unica fuente de verdad del total. Este test prueba que
// la combinacion "callable + calcularCapacidad" nunca deja al dueño (uno de los 3 cupos
// incluidos) contado como si fuera un extra: `incluido.equipoTecnico=3` es un piso fijo que
// el callable jamas reemplaza, solo le suma unidades por encima.
test('D8: tras comprar equipo tecnico extra via el callable, calcularCapacidad sigue contando al dueño DENTRO de los 3 incluidos, no como extra', async () => {
  const firestore = crearFirestoreFake({ tenants: { 'tenant-1': {} } });
  const servicio = crearServicioActualizarExtrasContratados({ firestore });

  await servicio({ tenantId: 'tenant-1', campo: 'equipoTecnicoExtraContratado', cantidad: 2 }, crearContextoAdmin());

  const tenantTrasCompra = firestore._tenants.get('tenant-1');
  const capacidad = calcularCapacidad(tenantTrasCompra);

  // 3 incluidos (dueño + 2 mas, D8) + 2 extra comprados = 5. Si el dueño se contara aparte
  // (el viejo comportamiento `limitePlan + 1 + cupos` de utils/limitesSaas.ts, ya eliminado),
  // este total daria 6, no 5.
  assert.equal(capacidad.equipoTecnico, 5);
});

test('D8: sin ninguna compra, calcularCapacidad reporta los 3 cupos incluidos (dueño + 2) a costo $0, sin que el callable haya escrito nada', async () => {
  const firestore = crearFirestoreFake({ tenants: { 'tenant-1': {} } });
  // El callable NUNCA se invoca en este test -- confirma que el piso incluido no depende de
  // ninguna escritura previa de este callable (D7: campos aditivos, ausentes en un tenant
  // legacy => 0 extra, ver design.md Migracion/Rollout punto 3).
  const capacidad = calcularCapacidad(firestore._tenants.get('tenant-1'));

  assert.equal(capacidad.equipoTecnico, 3);
});
