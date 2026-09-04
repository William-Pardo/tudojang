const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioGestionarReportePago } = require('./pagosValidacion');

// Fake de Firestore con soporte de runTransaction (tx.get de doc/query, tx.set/update,
// aplicados recien al resolver el callback) y queries con MULTIPLES where() encadenados --
// mismo estilo/limitaciones documentadas que crearFirestoreFake en academico/carnets.test.js:
// no simula reintentos por conflicto entre transacciones concurrentes.
function crearFirestoreFake({ reportes = {}, estudiantes = {} } = {}) {
  const colecciones = {
    reportes_pagos_estudiantes: new Map(Object.entries(reportes).map(([id, d]) => [id, { ...d }])),
    estudiantes: new Map(Object.entries(estudiantes).map(([id, d]) => [id, { ...d }])),
    finanzas: new Map(),
    historialNotificaciones: new Map(),
  };
  let contadorAutoId = 0;

  const mapaDe = (nombre) => {
    if (!colecciones[nombre]) throw new Error(`Coleccion no mockeada: ${nombre}`);
    return colecciones[nombre];
  };

  const crearDocRef = (coleccion, id) => ({
    id,
    _coleccion: coleccion,
    get: async () => ({
      exists: mapaDe(coleccion).has(id),
      id,
      data: () => ({ ...mapaDe(coleccion).get(id) }),
    }),
    set: async (data) => { mapaDe(coleccion).set(id, { ...data }); },
    update: async (data) => { mapaDe(coleccion).set(id, { ...mapaDe(coleccion).get(id), ...data }); },
  });

  const crearQuery = (coleccion, filtros) => ({
    _coleccion: coleccion,
    _filtros: filtros,
    where: (campo, _op, valor) => crearQuery(coleccion, [...filtros, { campo, valor }]),
    get: async () => ejecutarQuery({ _coleccion: coleccion, _filtros: filtros }),
  });

  function leerCampo(obj, ruta) {
    return ruta.split('.').reduce((acc, k) => (acc === undefined || acc === null ? undefined : acc[k]), obj);
  }

  const ejecutarQuery = (query) => {
    const docs = Array.from(mapaDe(query._coleccion).entries())
      .filter(([, data]) => query._filtros.every((f) => leerCampo(data, f.campo) === f.valor))
      .map(([id]) => ({ id, ref: crearDocRef(query._coleccion, id), data: () => ({ ...mapaDe(query._coleccion).get(id) }) }));
    return { empty: docs.length === 0, size: docs.length, docs };
  };

  // Memoizada por nombre: un test puede sobreescribir un metodo del objeto devuelto (p.ej.
  // `.add`) y que esa sobreescritura se respete en llamadas posteriores del servicio real a
  // `firestore.collection(ese-mismo-nombre)`, en vez de perderse porque cada llamada crea un
  // objeto nuevo.
  const coleccionesCache = new Map();
  const crearColeccion = (nombre) => {
    if (coleccionesCache.has(nombre)) return coleccionesCache.get(nombre);
    const coleccion = {
      doc: (id) => {
        if (id === undefined) {
          contadorAutoId += 1;
          id = `auto-${contadorAutoId}`;
        }
        return crearDocRef(nombre, id);
      },
      where: (campo, _op, valor) => crearQuery(nombre, [{ campo, valor }]),
      add: async (data) => {
        contadorAutoId += 1;
        const id = `auto-${contadorAutoId}`;
        mapaDe(nombre).set(id, { ...data });
        return { id };
      },
    };
    coleccionesCache.set(nombre, coleccion);
    return coleccion;
  };

  const runTransaction = async (updateFn) => {
    const pendientesEscritura = [];
    const tx = {
      get: async (refOrQuery) => (refOrQuery._filtros !== undefined ? ejecutarQuery(refOrQuery) : refOrQuery.get()),
      set: (ref, data) => pendientesEscritura.push({ ref, data, tipo: 'set' }),
      update: (ref, data) => pendientesEscritura.push({ ref, data, tipo: 'update' }),
    };
    const resultado = await updateFn(tx);
    // Todas las escrituras se aplican recien al final -- mismo "todo o nada" que una
    // transaccion real (si updateFn lanza antes, ninguna llega aca).
    pendientesEscritura.forEach(({ ref, data, tipo }) => {
      const mapa = mapaDe(ref._coleccion);
      mapa.set(ref.id, tipo === 'set' ? { ...data } : { ...mapa.get(ref.id), ...data });
    });
    return resultado;
  };

  return {
    collection: (nombre) => crearColeccion(nombre),
    runTransaction,
    _reportes: colecciones.reportes_pagos_estudiantes,
    _estudiantes: colecciones.estudiantes,
    _finanzas: colecciones.finanzas,
    _historialNotificaciones: colecciones.historialNotificaciones,
  };
}

function crearContexto(rol, overrides = {}) {
  return { auth: { uid: 'staff-1', token: { tenantId: 'tenant-1', rol, ...overrides } } };
}

const REPORTE_BASE = {
  tenantId: 'tenant-1', estudianteId: 'est-1', estudianteNombre: 'Alejandro Tester',
  montoInformado: 40000, fechaReporte: '2026-09-01T00:00:00.000Z',
  comprobanteUrl: 'https://storage.example/rep.png', estado: 'Pendiente',
};

const ESTUDIANTE_BASE = {
  tenantId: 'tenant-1', saldoDeudor: 100000, estadoPago: 'Pendiente', historialPagos: [],
  sedeId: 's1', tutor: { nombres: 'Papa', apellidos: 'Tester', correo: 'papa@test.com' },
};

// ─── autenticacion / rol / tenant ──────────────────────────────────────────

test('gestionarReportePago: rechaza si no esta autenticado', async () => {
  const servicio = crearServicioGestionarReportePago({ firestore: crearFirestoreFake() });
  await assert.rejects(() => servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, {}), /no autenticado/i);
});

test('gestionarReportePago: rechaza rol no autorizado (Estudiante/Tutor)', async () => {
  const servicio = crearServicioGestionarReportePago({ firestore: crearFirestoreFake() });
  for (const rol of ['Estudiante', 'Tutor']) {
    await assert.rejects(
      () => servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto(rol)),
      /no tienes permiso/i,
      `rol ${rol} no deberia poder gestionar reportes de pago`
    );
  }
});

// Bug real (2026-09-03): antes Editor/Asistente SI pasaban la regla de estudiantes/
// reportes_pagos_estudiantes, pero finanzas (isAdmin()) los rechazaba a mitad de camino.
// Este es el test que prueba directamente el fix: Editor debe poder completar el ciclo entero.
test('gestionarReportePago: Editor y Asistente (no solo Admin) pueden aprobar un pago completo -- fix del bug real', async () => {
  for (const rol of ['Editor', 'Asistente', 'Maestro', 'Admin']) {
    const firestore = crearFirestoreFake({
      reportes: { r1: REPORTE_BASE },
      estudiantes: { 'est-1': ESTUDIANTE_BASE },
    });
    const servicio = crearServicioGestionarReportePago({ firestore });

    await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto(rol));

    assert.equal(firestore._reportes.get('r1').estado, 'Aprobado', `rol ${rol} deberia dejar el reporte Aprobado`);
    assert.equal(firestore._estudiantes.get('est-1').saldoDeudor, 60000, `rol ${rol} deberia actualizar el saldo`);
    assert.equal(firestore._finanzas.size, 1, `rol ${rol} deberia poder crear el movimiento financiero`);
  }
});

test('gestionarReportePago: rechaza tenant no autorizado (Admin de otro tenant)', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: { 'est-1': ESTUDIANTE_BASE } });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await assert.rejects(
    () => servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin', { tenantId: 'tenant-2' })),
    /tenant no autorizado/i
  );
});

test('gestionarReportePago: SuperAdmin puede operar cross-tenant', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: { 'est-1': ESTUDIANTE_BASE } });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('SuperAdmin', { tenantId: 'otro-tenant' }));

  assert.equal(firestore._reportes.get('r1').estado, 'Aprobado');
});

// ─── validacion de entrada ──────────────────────────────────────────────────

test('gestionarReportePago: rechaza si falta reporteId', async () => {
  const servicio = crearServicioGestionarReportePago({ firestore: crearFirestoreFake() });
  await assert.rejects(() => servicio({ nuevoEstado: 'Aprobado' }, crearContexto('Admin')), /falta reporteid/i);
});

test('gestionarReportePago: rechaza un nuevoEstado invalido', async () => {
  const servicio = crearServicioGestionarReportePago({ firestore: crearFirestoreFake() });
  await assert.rejects(
    () => servicio({ reporteId: 'r1', nuevoEstado: 'Pendiente' }, crearContexto('Admin')),
    /aprobado.*rechazado/i
  );
});

test('gestionarReportePago: rechaza si el reporte no existe', async () => {
  const servicio = crearServicioGestionarReportePago({ firestore: crearFirestoreFake() });
  await assert.rejects(
    () => servicio({ reporteId: 'no-existe', nuevoEstado: 'Aprobado' }, crearContexto('Admin')),
    /no se encontró el reporte/i
  );
});

// ─── no se puede procesar dos veces (reintento del MISMO reporte) ─────────

test('gestionarReportePago: rechaza si el reporte ya fue Aprobado -- protege contra doble click / dos pestañas', async () => {
  const firestore = crearFirestoreFake({
    reportes: { r1: { ...REPORTE_BASE, estado: 'Aprobado' } },
    estudiantes: { 'est-1': ESTUDIANTE_BASE },
  });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await assert.rejects(
    () => servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin')),
    /ya fue aprobado/i
  );
  // No se toca el saldo una segunda vez.
  assert.equal(firestore._estudiantes.get('est-1').saldoDeudor, 100000);
});

test('gestionarReportePago: rechaza si el reporte ya fue Rechazado', async () => {
  const firestore = crearFirestoreFake({
    reportes: { r1: { ...REPORTE_BASE, estado: 'Rechazado' } },
    estudiantes: { 'est-1': ESTUDIANTE_BASE },
  });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await assert.rejects(
    () => servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin')),
    /ya fue rechazado/i
  );
});

// ─── aprobacion: saldo, finanzas, reporte ───────────────────────────────────

test('gestionarReportePago: aprobar triangula el nuevo saldo y estadoPago correctamente', async () => {
  const casos = [[100000, 100000, 0, 'Al día'], [100000, 40000, 60000, 'Pendiente'], [100000, 120000, -20000, 'Al día']];
  for (const [saldo, pago, esperado, estadoEsperado] of casos) {
    const firestore = crearFirestoreFake({
      reportes: { r1: { ...REPORTE_BASE, montoInformado: pago } },
      estudiantes: { 'est-1': { ...ESTUDIANTE_BASE, saldoDeudor: saldo } },
    });
    const servicio = crearServicioGestionarReportePago({ firestore });

    await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin'));

    assert.equal(firestore._estudiantes.get('est-1').saldoDeudor, esperado, `saldo ${saldo} - pago ${pago}`);
    assert.equal(firestore._estudiantes.get('est-1').estadoPago, estadoEsperado);
  }
});

test('gestionarReportePago: aprobar preserva el historial de pagos previo y usa la referencia IA cuando existe', async () => {
  const firestore = crearFirestoreFake({
    reportes: { r1: { ...REPORTE_BASE, datosIA: { referencia: 'REF-IA-1' } } },
    estudiantes: { 'est-1': { ...ESTUDIANTE_BASE, historialPagos: [{ id: 'viejo' }] } },
  });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin'));

  const historial = firestore._estudiantes.get('est-1').historialPagos;
  assert.equal(historial.length, 2);
  assert.equal(historial[0].referencia, 'REF-IA-1');
  assert.equal(historial[0].reporteId, 'r1');
  assert.deepEqual(historial[1], { id: 'viejo' });
});

test('gestionarReportePago: aprobar sin referencia IA usa REPORTE-APP como referencia por defecto', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: { 'est-1': ESTUDIANTE_BASE } });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin'));

  assert.equal(firestore._estudiantes.get('est-1').historialPagos[0].referencia, 'REPORTE-APP');
});

test('gestionarReportePago: aprobar crea el movimiento en finanzas con los campos correctos y sedeId por defecto', async () => {
  const firestore = crearFirestoreFake({
    reportes: { r1: REPORTE_BASE },
    estudiantes: { 'est-1': { ...ESTUDIANTE_BASE, sedeId: undefined } },
  });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin'));

  const movimiento = Array.from(firestore._finanzas.values())[0];
  assert.equal(movimiento.tenantId, 'tenant-1');
  assert.equal(movimiento.tipo, 'Ingreso');
  assert.equal(movimiento.categoria, 'Mensualidad');
  assert.equal(movimiento.monto, 40000);
  assert.equal(movimiento.descripcion, 'PAGO REPORTADO APP: Alejandro Tester');
  assert.equal(movimiento.sedeId, '1');
});

// Bug real (2026-09-04): un pago que supera la deuda deja saldoDeudor negativo (saldo a
// favor) sin ninguna nota en el libro de tesorería -- quien lo auditara no podía saber por
// qué el ingreso era mayor a lo que el estudiante debía.
test('gestionarReportePago: si el pago genera saldo a favor, lo anota en la descripción del movimiento en finanzas', async () => {
  const firestore = crearFirestoreFake({
    reportes: { r1: REPORTE_BASE }, // montoInformado 40000
    estudiantes: { 'est-1': { ...ESTUDIANTE_BASE, saldoDeudor: 10000 } },
  });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin'));

  assert.equal(firestore._estudiantes.get('est-1').saldoDeudor, -30000);
  const movimiento = Array.from(firestore._finanzas.values())[0];
  assert.equal(movimiento.descripcion, 'PAGO REPORTADO APP: Alejandro Tester [Genera saldo a favor de $30000]');
});

test('gestionarReportePago: aprobar marca el reporte con validadoPor/fechaValidacion/observaciones', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: { 'est-1': ESTUDIANTE_BASE } });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado', observaciones: 'todo ok' }, crearContexto('Admin'));

  const reporte = firestore._reportes.get('r1');
  assert.equal(reporte.estado, 'Aprobado');
  assert.equal(reporte.validadoPor, 'staff-1');
  assert.equal(reporte.observaciones, 'todo ok');
  assert.ok(reporte.fechaValidacion);
});

test('gestionarReportePago: rechaza si el estudiante no existe', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: {} });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await assert.rejects(
    () => servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin')),
    /no se encontró el estudiante/i
  );
});

// ─── doble acreditacion (bug real 2026-09-02) -- ahora dentro de la transaccion ────────────

test('gestionarReportePago: rechaza aprobar si otro reporte con la MISMA referencia ya fue Aprobado -- y no toca ni saldo ni finanzas', async () => {
  const firestore = crearFirestoreFake({
    reportes: {
      'r-viejo': { ...REPORTE_BASE, estado: 'Aprobado', datosIA: { referencia: 'REF-DUP' } },
      r1: { ...REPORTE_BASE, datosIA: { referencia: 'REF-DUP' } },
    },
    estudiantes: { 'est-1': ESTUDIANTE_BASE },
  });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await assert.rejects(
    () => servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin')),
    /referencia duplicada.*r-viejo/i
  );

  assert.equal(firestore._estudiantes.get('est-1').saldoDeudor, 100000);
  assert.equal(firestore._finanzas.size, 0);
  assert.equal(firestore._reportes.get('r1').estado, 'Pendiente');
});

test('gestionarReportePago: la misma referencia en un reporte PENDIENTE (no Aprobado todavia) NO bloquea -- solo Aprobados cuentan', async () => {
  const firestore = crearFirestoreFake({
    reportes: {
      'r-pendiente': { ...REPORTE_BASE, estado: 'Pendiente', datosIA: { referencia: 'REF-X' } },
      r1: { ...REPORTE_BASE, datosIA: { referencia: 'REF-X' } },
    },
    estudiantes: { 'est-1': ESTUDIANTE_BASE },
  });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin'));

  assert.equal(firestore._reportes.get('r1').estado, 'Aprobado');
});

// ─── rechazo ────────────────────────────────────────────────────────────────

test('gestionarReportePago: rechazar NO toca estudiante ni finanzas, solo marca el reporte', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: { 'est-1': ESTUDIANTE_BASE } });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Rechazado', observaciones: 'foto ilegible' }, crearContexto('Admin'));

  assert.equal(firestore._estudiantes.get('est-1').saldoDeudor, 100000);
  assert.equal(firestore._finanzas.size, 0);
  assert.equal(firestore._reportes.get('r1').estado, 'Rechazado');
  assert.equal(firestore._reportes.get('r1').observaciones, 'foto ilegible');
});

// ─── notificacion al tutor ──────────────────────────────────────────────────

test('gestionarReportePago: al aprobar, escribe PagoAprobado con destinatario/tutorNombre desde Estudiante.tutor', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: { 'est-1': ESTUDIANTE_BASE } });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin'));

  const notif = Array.from(firestore._historialNotificaciones.values())[0];
  assert.equal(notif.tipo, 'PagoAprobado');
  assert.equal(notif.canal, 'InApp');
  assert.equal(notif.tutorNombre, 'Papa Tester');
  assert.equal(notif.destinatario, 'papa@test.com');
  assert.match(notif.mensaje, /40.000/);
});

test('gestionarReportePago: al rechazar, escribe PagoRechazado con el mensaje neutro fijo -- NUNCA usa observaciones', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: { 'est-1': ESTUDIANTE_BASE } });
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Rechazado', observaciones: 'foto ilegible, rechazado' }, crearContexto('Admin'));

  const notif = Array.from(firestore._historialNotificaciones.values())[0];
  assert.equal(notif.tipo, 'PagoRechazado');
  assert.equal(notif.mensaje, 'Tu comprobante no pudo validarse. Contactá a la academia para más información.');
  assert.doesNotMatch(notif.mensaje, /foto ilegible/);
});

test('gestionarReportePago: un fallo al escribir la notificacion NO tumba la operacion -- el pago ya quedo aplicado', async () => {
  const firestore = crearFirestoreFake({ reportes: { r1: REPORTE_BASE }, estudiantes: { 'est-1': ESTUDIANTE_BASE } });
  firestore.collection('historialNotificaciones').add = async () => { throw new Error('permission-denied'); };
  const servicio = crearServicioGestionarReportePago({ firestore });

  await servicio({ reporteId: 'r1', nuevoEstado: 'Aprobado' }, crearContexto('Admin'));

  assert.equal(firestore._reportes.get('r1').estado, 'Aprobado');
  assert.equal(firestore._estudiantes.get('est-1').saldoDeudor, 60000);
});
