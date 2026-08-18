const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioSolicitudCarnets, crearServicioActualizarEstadoSolicitudCarnets } = require('./carnets');

function crearContextoAdmin(overrides = {}) {
  return {
    auth: {
      uid: 'admin-1',
      token: { tenantId: 'tenant-1', rol: 'Admin', ...overrides },
    },
  };
}

function crearContextoSuperAdmin(overrides = {}) {
  return {
    auth: {
      uid: 'master-1',
      token: { tenantId: 'master', rol: 'SuperAdmin', ...overrides },
    },
  };
}

// Fake mínimo de Firestore con soporte de `runTransaction` (tx.get de doc/query + tx.set/
// update, aplicados recién al resolver el callback -- igual semántica de "todas las lecturas
// antes que cualquier escritura" que exige una transacción real). No simula reintentos por
// conflicto entre dos transacciones concurrentes (eso requeriría reimplementar el motor de
// control de concurrencia de Firestore); prueba la lógica de negocio de esta función
// asumiendo ejecución secuencial, y se apoya en el comportamiento documentado de
// `runTransaction` para la garantía de no-duplicado bajo concurrencia real.
function crearFirestoreFake({ estudiantesExistentes = [], tenantsExistentes = {}, solicitudesExistentes = [] } = {}) {
  const estudiantes = new Map(estudiantesExistentes.map((e) => [e.id, { ...e }]));
  const tenants = new Map(Object.entries(tenantsExistentes));
  const solicitudes = new Map(solicitudesExistentes.map((s) => [s.id, { ...s }]));
  let contadorSolicitudes = 0;

  const mapaDe = (coleccion) => {
    if (coleccion === 'estudiantes') return estudiantes;
    if (coleccion === 'tenants') return tenants;
    if (coleccion === 'solicitudes_carnets') return solicitudes;
    throw new Error(`Colección no mockeada: ${coleccion}`);
  };

  const crearDocRef = (coleccion, id) => ({
    id,
    _coleccion: coleccion,
    get: async () => ({ exists: mapaDe(coleccion).has(id), id, data: () => mapaDe(coleccion).get(id) }),
  });

  const crearColeccion = (nombre) => ({
    doc: (id) => {
      if (id === undefined) {
        contadorSolicitudes += 1;
        id = `solicitud-${contadorSolicitudes}`;
      }
      return crearDocRef(nombre, id);
    },
    where: (campo, _op, valor) => ({ _coleccion: nombre, _campo: campo, _valor: valor }),
  });

  const ejecutarQuery = (query) => {
    const docs = Array.from(mapaDe(query._coleccion).entries())
      .filter(([, data]) => data[query._campo] === query._valor)
      .map(([id]) => ({ id, ref: crearDocRef(query._coleccion, id), data: () => mapaDe(query._coleccion).get(id) }));
    return { empty: docs.length === 0, size: docs.length, docs };
  };

  const runTransaction = async (updateFn) => {
    const pendientesEscritura = [];
    const tx = {
      get: async (refOrQuery) => (refOrQuery._campo !== undefined ? ejecutarQuery(refOrQuery) : refOrQuery.get()),
      getAll: async (...refs) => Promise.all(refs.map((ref) => ref.get())),
      set: (ref, data) => pendientesEscritura.push({ ref, data, tipo: 'set' }),
      update: (ref, data) => pendientesEscritura.push({ ref, data, tipo: 'update' }),
    };
    const resultado = await updateFn(tx);
    pendientesEscritura.forEach(({ ref, data, tipo }) => {
      const mapa = mapaDe(ref._coleccion);
      mapa.set(ref.id, tipo === 'set' ? { ...data } : { ...mapa.get(ref.id), ...data });
    });
    return resultado;
  };

  return {
    collection: (nombre) => crearColeccion(nombre),
    runTransaction,
    _estudiantes: estudiantes,
    _solicitudes: solicitudes,
  };
}

const TENANT_1 = { nombreClub: 'Dojang Uno' };

test('solicitarFabricacionCarnets: rechaza si no está autenticado', async () => {
  const servicio = crearServicioSolicitudCarnets({ firestore: crearFirestoreFake() });

  await assert.rejects(() => servicio({ tenantId: 'tenant-1' }, {}), /no autenticado/i);
});

test('solicitarFabricacionCarnets: rechaza roles no-Admin (Editor no puede pedir producción)', async () => {
  const servicio = crearServicioSolicitudCarnets({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, crearContextoAdmin({ rol: 'Editor' })),
    /solo un admin/i,
  );
});

test('solicitarFabricacionCarnets: rechaza si falta el tenant (mensaje específico, no el genérico de "tenant no autorizado")', async () => {
  const servicio = crearServicioSolicitudCarnets({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: '' }, crearContextoAdmin()),
    /falta el tenant/i,
  );
});

test('solicitarFabricacionCarnets: rechaza tenant no autorizado (Admin de otro tenant)', async () => {
  const servicio = crearServicioSolicitudCarnets({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-2' }, crearContextoAdmin()),
    /tenant no autorizado/i,
  );
});

test('solicitarFabricacionCarnets: rechaza si el tenant no existe', async () => {
  const firestore = crearFirestoreFake({ tenantsExistentes: {} });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, crearContextoAdmin()),
    /no encontrado/i,
  );
});

test('solicitarFabricacionCarnets: rechaza si no hay estudiantes pendientes (evita solicitudes vacías/duplicadas)', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1 },
    estudiantesExistentes: [{ id: 'e1', tenantId: 'tenant-1', carnetGenerado: true }],
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, crearContextoAdmin()),
    /no hay estudiantes pendientes/i,
  );
});

test('solicitarFabricacionCarnets: la cantidad es la calculada server-side, NO la que mande el cliente', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1 },
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: false },
      { id: 'e2', tenantId: 'tenant-1', carnetGenerado: false },
    ],
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  // El cliente miente y manda cantidad: 999 -- debe ser ignorado por completo.
  const resultado = await servicio(
    { tenantId: 'tenant-1', cantidad: 999, sedeNombre: 'Principal' },
    crearContextoAdmin(),
  );

  assert.equal(resultado.cantidad, 2);
  const solicitud = firestore._solicitudes.get(resultado.id);
  assert.equal(solicitud.cantidad, 2);
  assert.deepEqual(solicitud.estudianteIds.sort(), ['e1', 'e2']);
});

test('solicitarFabricacionCarnets: incluye estudiantes SIN el campo carnetGenerado (legacy), igual que Carnetizacion.tsx (!e.carnetGenerado)', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1 },
    estudiantesExistentes: [
      { id: 'e-legacy', tenantId: 'tenant-1' }, // sin carnetGenerado -- Firestore no lo matchea con == false
      { id: 'e-nuevo', tenantId: 'tenant-1', carnetGenerado: false },
      { id: 'e-listo', tenantId: 'tenant-1', carnetGenerado: true },
    ],
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(resultado.cantidad, 2);
  const solicitud = firestore._solicitudes.get(resultado.id);
  assert.deepEqual(solicitud.estudianteIds.sort(), ['e-legacy', 'e-nuevo']);
});

test('solicitarFabricacionCarnets: usa el nombreClub real del tenant, no el que mande el cliente', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1 },
    estudiantesExistentes: [{ id: 'e1', tenantId: 'tenant-1', carnetGenerado: false }],
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  const resultado = await servicio(
    { tenantId: 'tenant-1', nombreClub: 'Nombre Falso' },
    crearContextoAdmin(),
  );

  const solicitud = firestore._solicitudes.get(resultado.id);
  assert.equal(solicitud.nombreClub, 'Dojang Uno');
});

test('solicitarFabricacionCarnets: marca carnetGenerado:true en los estudiantes incluidos, en la misma transacción', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1 },
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: false },
      { id: 'e2', tenantId: 'tenant-1', carnetGenerado: false },
    ],
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(firestore._estudiantes.get('e1').carnetGenerado, true);
  assert.equal(firestore._estudiantes.get('e2').carnetGenerado, true);
});

test('solicitarFabricacionCarnets: una segunda solicitud inmediata NO vuelve a incluir a los mismos estudiantes (anti-duplicado secuencial)', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1 },
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: false },
      { id: 'e2', tenantId: 'tenant-1', carnetGenerado: false },
    ],
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  // Nuevo alumno se matricula después del primer lote -- solo él debe aparecer ahora.
  firestore._estudiantes.set('e3', { id: 'e3', tenantId: 'tenant-1', carnetGenerado: false });

  const segunda = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.equal(segunda.cantidad, 1);
  const solicitud = firestore._solicitudes.get(segunda.id);
  assert.deepEqual(solicitud.estudianteIds, ['e3']);
});

test('solicitarFabricacionCarnets: rechaza si supera el límite de estudiantes por solicitud (tope de escritura de Firestore)', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1 },
    estudiantesExistentes: Array.from({ length: 401 }, (_, i) => ({
      id: `e${i}`,
      tenantId: 'tenant-1',
      carnetGenerado: false,
    })),
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }, crearContextoAdmin()),
    /máximo por solicitud/i,
  );
});

test('solicitarFabricacionCarnets: no toca estudiantes de otro tenant', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1, 'tenant-ajeno': { nombreClub: 'Otro' } },
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: false },
      { id: 'e-ajeno', tenantId: 'tenant-ajeno', carnetGenerado: false },
    ],
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  const resultado = await servicio({ tenantId: 'tenant-1' }, crearContextoAdmin());

  assert.deepEqual(resultado.cantidad, 1);
  assert.equal(firestore._estudiantes.get('e-ajeno').carnetGenerado, false);
});

test('solicitarFabricacionCarnets: SuperAdmin puede solicitar en cualquier tenant', async () => {
  const firestore = crearFirestoreFake({
    tenantsExistentes: { 'tenant-1': TENANT_1 },
    estudiantesExistentes: [{ id: 'e1', tenantId: 'tenant-1', carnetGenerado: false }],
  });
  const servicio = crearServicioSolicitudCarnets({ firestore });

  const resultado = await servicio(
    { tenantId: 'tenant-1' },
    crearContextoAdmin({ tenantId: 'otro-tenant-del-superadmin', rol: 'SuperAdmin' }),
  );

  assert.equal(resultado.cantidad, 1);
});

// ─── actualizarEstadoSolicitudCarnets ───────────────────────────────────────────

function crearSolicitudSeed(overrides = {}) {
  return {
    id: 'sol-1',
    tenantId: 'tenant-1',
    nombreClub: 'Dojang Uno',
    sedeNombre: 'Principal',
    cantidad: 2,
    estudianteIds: ['e1', 'e2'],
    fechaSolicitud: '2026-01-01T00:00:00.000Z',
    estado: 'pendiente',
    solicitadoPorUid: 'admin-1',
    historial: [{ estado: 'pendiente', en: '2026-01-01T00:00:00.000Z', porUid: 'admin-1' }],
    ...overrides,
  };
}

test('actualizarEstadoSolicitudCarnets: rechaza si no está autenticado', async () => {
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ solicitudId: 'sol-1', nuevoEstado: 'en_produccion' }, {}),
    /no autenticado/i,
  );
});

test('actualizarEstadoSolicitudCarnets: rechaza a un Admin de club (solo Master gestiona el estado)', async () => {
  const firestore = crearFirestoreFake({ solicitudesExistentes: [crearSolicitudSeed()] });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ solicitudId: 'sol-1', nuevoEstado: 'en_produccion' }, crearContextoAdmin()),
    /solo master/i,
  );
});

test('actualizarEstadoSolicitudCarnets: rechaza un nuevoEstado inválido', async () => {
  const firestore = crearFirestoreFake({ solicitudesExistentes: [crearSolicitudSeed()] });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ solicitudId: 'sol-1', nuevoEstado: 'inventado' }, crearContextoSuperAdmin()),
    /estado inválido/i,
  );
});

test('actualizarEstadoSolicitudCarnets: rechaza si la solicitud no existe', async () => {
  const firestore = crearFirestoreFake();
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ solicitudId: 'no-existe', nuevoEstado: 'en_produccion' }, crearContextoSuperAdmin()),
    /no encontrada/i,
  );
});

test('actualizarEstadoSolicitudCarnets: rechaza saltar un paso (pendiente -> enviado directo)', async () => {
  const firestore = crearFirestoreFake({ solicitudesExistentes: [crearSolicitudSeed({ estado: 'pendiente' })] });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ solicitudId: 'sol-1', nuevoEstado: 'enviado' }, crearContextoSuperAdmin()),
    /no se puede pasar/i,
  );
});

test('actualizarEstadoSolicitudCarnets: rechaza mover un estado terminal (enviado -> cualquier cosa)', async () => {
  const firestore = crearFirestoreFake({ solicitudesExistentes: [crearSolicitudSeed({ estado: 'enviado' })] });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ solicitudId: 'sol-1', nuevoEstado: 'rechazado' }, crearContextoSuperAdmin()),
    /no se puede pasar/i,
  );
});

test('actualizarEstadoSolicitudCarnets: pendiente -> en_produccion avanza sin tocar carnetGenerado', async () => {
  const firestore = crearFirestoreFake({
    solicitudesExistentes: [crearSolicitudSeed()],
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: true },
      { id: 'e2', tenantId: 'tenant-1', carnetGenerado: true },
    ],
  });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  const resultado = await servicio({ solicitudId: 'sol-1', nuevoEstado: 'en_produccion' }, crearContextoSuperAdmin());

  assert.equal(resultado.estado, 'en_produccion');
  assert.equal(firestore._solicitudes.get('sol-1').estado, 'en_produccion');
  assert.equal(firestore._estudiantes.get('e1').carnetGenerado, true);
  assert.equal(firestore._estudiantes.get('e2').carnetGenerado, true);
});

test('actualizarEstadoSolicitudCarnets: en_produccion -> enviado avanza sin tocar carnetGenerado (cierre exitoso)', async () => {
  const firestore = crearFirestoreFake({
    solicitudesExistentes: [crearSolicitudSeed({ estado: 'en_produccion' })],
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: true },
      { id: 'e2', tenantId: 'tenant-1', carnetGenerado: true },
    ],
  });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await servicio({ solicitudId: 'sol-1', nuevoEstado: 'enviado' }, crearContextoSuperAdmin());

  assert.equal(firestore._solicitudes.get('sol-1').estado, 'enviado');
  assert.equal(firestore._estudiantes.get('e1').carnetGenerado, true);
  assert.equal(firestore._estudiantes.get('e2').carnetGenerado, true);
});

test('actualizarEstadoSolicitudCarnets: pendiente -> rechazado revierte carnetGenerado:false en todo el lote', async () => {
  const firestore = crearFirestoreFake({
    solicitudesExistentes: [crearSolicitudSeed({ estado: 'pendiente' })],
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: true },
      { id: 'e2', tenantId: 'tenant-1', carnetGenerado: true },
    ],
  });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  const resultado = await servicio({ solicitudId: 'sol-1', nuevoEstado: 'rechazado' }, crearContextoSuperAdmin());

  assert.equal(resultado.estado, 'rechazado');
  assert.equal(firestore._solicitudes.get('sol-1').estado, 'rechazado');
  assert.equal(firestore._estudiantes.get('e1').carnetGenerado, false);
  assert.equal(firestore._estudiantes.get('e2').carnetGenerado, false);
});

test('actualizarEstadoSolicitudCarnets: en_produccion -> rechazado también revierte carnetGenerado (se puede caer después de aceptar)', async () => {
  const firestore = crearFirestoreFake({
    solicitudesExistentes: [crearSolicitudSeed({ estado: 'en_produccion' })],
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: true },
      { id: 'e2', tenantId: 'tenant-1', carnetGenerado: true },
    ],
  });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await servicio({ solicitudId: 'sol-1', nuevoEstado: 'rechazado' }, crearContextoSuperAdmin());

  assert.equal(firestore._estudiantes.get('e1').carnetGenerado, false);
  assert.equal(firestore._estudiantes.get('e2').carnetGenerado, false);
});

test('actualizarEstadoSolicitudCarnets: rechazado es terminal (no se puede volver a mover)', async () => {
  const firestore = crearFirestoreFake({ solicitudesExistentes: [crearSolicitudSeed({ estado: 'rechazado' })] });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await assert.rejects(
    () => servicio({ solicitudId: 'sol-1', nuevoEstado: 'en_produccion' }, crearContextoSuperAdmin()),
    /no se puede pasar/i,
  );
});

test('actualizarEstadoSolicitudCarnets: no revienta si un estudiante del lote ya no existe (fue borrado después)', async () => {
  const firestore = crearFirestoreFake({
    solicitudesExistentes: [crearSolicitudSeed({ estudianteIds: ['e1', 'e-borrado'] })],
    estudiantesExistentes: [{ id: 'e1', tenantId: 'tenant-1', carnetGenerado: true }],
  });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  const resultado = await servicio({ solicitudId: 'sol-1', nuevoEstado: 'rechazado' }, crearContextoSuperAdmin());

  assert.equal(resultado.estado, 'rechazado');
  assert.equal(firestore._estudiantes.get('e1').carnetGenerado, false);
});

test('actualizarEstadoSolicitudCarnets: acumula el historial en vez de reemplazarlo (nunca se pierde el rastro)', async () => {
  const firestore = crearFirestoreFake({
    solicitudesExistentes: [crearSolicitudSeed()],
    estudiantesExistentes: [
      { id: 'e1', tenantId: 'tenant-1', carnetGenerado: true },
      { id: 'e2', tenantId: 'tenant-1', carnetGenerado: true },
    ],
  });
  const servicio = crearServicioActualizarEstadoSolicitudCarnets({ firestore });

  await servicio({ solicitudId: 'sol-1', nuevoEstado: 'en_produccion' }, crearContextoSuperAdmin());

  const historial = firestore._solicitudes.get('sol-1').historial;
  assert.equal(historial.length, 2);
  assert.equal(historial[0].estado, 'pendiente');
  assert.equal(historial[1].estado, 'en_produccion');
});
