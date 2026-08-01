'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const {
  crearServicioCrearFuentePagoWompi,
  crearServicioCobroAutomaticoMensual,
  crearListadoTenantsPendientesDeCobroFirestore,
  crearLectorWompiPaymentSourceIdFirestore,
  crearContadorEstudiantesFacturablesFirestore,
  crearTransaccionRecurrenteWompi,
  calcularMontoFacturableCentavos,
  construirReferenciaCobroAutomatico,
  normalizarFecha,
} = require('./wompiCobroAutomatico');

// ---------------------------------------------------------------------------
// calcularMontoFacturableCentavos
//
// SDD pricing-cupo-real (Bloque 3b, facturacion-metered): el monto YA NO se infiere de
// tenant.limite*/plan (calcularMontoMensualPesos, eliminada) -- se MIDE via
// calcularFacturacionMensual (functions/facturacion.js, Bloque 2, no reabierto aca). Esta
// funcion es el unico paso que falta: convertir `totalPesos` (el output de esa funcion pura)
// a centavos para Wompi, misma conversion que construirUrlCheckoutWompi (*100).
// ---------------------------------------------------------------------------

test('calcularMontoFacturableCentavos: convierte totalPesos (ResultadoFacturacion de calcularFacturacionMensual) a centavos (*100)', () => {
  const centavos = calcularMontoFacturableCentavos({ totalPesos: 200000 });
  assert.equal(centavos, 20000000);
});

test('calcularMontoFacturableCentavos: redondea igual que construirUrlCheckoutWompi (Math.round)', () => {
  const centavos = calcularMontoFacturableCentavos({ totalPesos: 1999.5 });
  assert.equal(centavos, 199950);
});

// ---------------------------------------------------------------------------
// crearContadorEstudiantesFacturablesFirestore
//
// Cuenta estudiantes facturables (estadoMatricula=='activo') de un tenant via una agregacion
// .count() de Firestore -- NO un .get() completo (design.md: este cron corre a diario por
// cada tenant vencido, un .get() completo seria N lecturas de documento innecesarias solo
// para saber CUANTOS hay). El predicado estadoMatricula=='activo' es tambien el mecanismo por
// el que un estudiante retirado deja de contar (Scenario "Estudiante retirado antes del corte
// no se factura", spec facturacion-metered) -- Firestore filtra server-side, no hay logica JS
// de exclusion que probar aca aparte de la forma exacta de la query.
// ---------------------------------------------------------------------------

test('crearContadorEstudiantesFacturablesFirestore: usa una agregacion .count() filtrando tenantId + estadoMatricula=="activo" (Scenario: Estudiante retirado antes del corte no se factura)', async () => {
  const wheresLlamados = [];
  let countLlamado = false;

  const firestoreFake = {
    collection: (nombre) => {
      assert.equal(nombre, 'estudiantes');
      return {
        where: (campo1, op1, valor1) => {
          wheresLlamados.push([campo1, op1, valor1]);
          return {
            where: (campo2, op2, valor2) => {
              wheresLlamados.push([campo2, op2, valor2]);
              return {
                count: () => {
                  countLlamado = true;
                  return { get: async () => ({ data: () => ({ count: 3 }) }) };
                },
                // Si el codigo real llamara .get() en vez de .count().get(), este fake debe
                // delatarlo -- es exactamente lo que design.md pide evitar.
                get: async () => { throw new Error('No debe usarse un .get() completo -- usar .count()'); },
              };
            },
          };
        },
      };
    },
  };

  const contar = crearContadorEstudiantesFacturablesFirestore(firestoreFake);
  const resultado = await contar('tnt-1');

  assert.equal(resultado, 3);
  assert.ok(countLlamado);
  assert.deepEqual(wheresLlamados, [
    ['tenantId', '==', 'tnt-1'],
    ['estadoMatricula', '==', 'activo'],
  ]);
});

// ---------------------------------------------------------------------------
// construirReferenciaCobroAutomatico
// ---------------------------------------------------------------------------

test('construirReferenciaCobroAutomatico: formato compatible con el parsing de webhookWompi', () => {
  const ref = construirReferenciaCobroAutomatico('tnt-1780000000000', 1780000005000);
  assert.equal(ref, 'SUSC_tnt-1780000000000_auto_mensual_recurrente_1780000005000');

  // Mismo regex que usa webhookWompi (index.js) para extraer el tenantId.
  const tenantIdMatch = ref.match(/tnt-\d+/);
  assert.equal(tenantIdMatch[0], 'tnt-1780000000000');

  // El split('_') debe dejar "mensual" como segmento exacto (chequeo de período en webhookWompi).
  assert.ok(ref.split('_').includes('mensual'));
  assert.ok(ref.startsWith('SUSC_'));
});

// ---------------------------------------------------------------------------
// crearServicioCrearFuentePagoWompi
// ---------------------------------------------------------------------------

function crearFirestoreFake(tenantData) {
  const actualizaciones = [];
  // escriturasPrivado registra los `set` sobre tenants/{tenantId}/privado/facturacion --
  // fix seguridad 2026-07-18: wompiPaymentSourceId ya no se `update`ea en el doc principal
  // del tenant, se escribe en este subdocumento restringido a Admin/SuperAdmin.
  const escriturasPrivado = [];
  const facturacionDocRef = {
    set: async (datos, opciones) => escriturasPrivado.push({ datos, opciones }),
  };
  const tenantRef = {
    get: async () => ({
      exists: tenantData !== null,
      data: () => tenantData,
    }),
    update: async (datos) => actualizaciones.push(datos),
    collection: (nombre) => {
      assert.equal(nombre, 'privado');
      return { doc: (id) => { assert.equal(id, 'facturacion'); return facturacionDocRef; } };
    },
  };
  return {
    actualizaciones,
    escriturasPrivado,
    firestore: {
      collection: (nombre) => {
        assert.equal(nombre, 'tenants');
        return { doc: (id) => { assert.equal(id, 'tnt-1'); return tenantRef; } };
      },
    },
  };
}

const AUTH_ADMIN_TNT1 = { uid: 'u1', token: { rol: 'Admin', tenantId: 'tnt-1' } };

test('crearFuentePagoWompi: crea el payment_source, guarda wompiPaymentSourceId en el subdocumento privado y activa el cobro automático en el doc principal', async (t) => {
  const { actualizaciones, escriturasPrivado, firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });

  t.mock.method(axios, 'get', async (url) => {
    assert.equal(url, 'https://production.wompi.co/v1/merchants/pub_prod_2XIISLESsoU3kWMce51HMChsMdr1tzVB');
    return {
      data: {
        data: {
          presigned_acceptance: { acceptance_token: 'accept-token' },
          presigned_personal_data_auth: { acceptance_token: 'personal-auth-token' },
        },
      },
    };
  });
  t.mock.method(axios, 'post', async (url, body, config) => {
    assert.equal(url, 'https://production.wompi.co/v1/payment_sources');
    assert.equal(body.type, 'CARD');
    assert.equal(body.token, 'card-token-123');
    assert.equal(body.customer_email, 'club@test.com');
    assert.equal(body.acceptance_token, 'accept-token');
    assert.equal(body.accept_personal_auth, 'personal-auth-token');
    assert.equal(config.headers.Authorization, 'Bearer priv_test_key');
    return { data: { data: { id: 987 } } };
  });

  const servicio = crearServicioCrearFuentePagoWompi({
    firestore,
    wompiPrivateKey: () => 'priv_test_key',
  });

  const resultado = await servicio(
    { tenantId: 'tnt-1', token: 'card-token-123' },
    { auth: AUTH_ADMIN_TNT1 }
  );

  assert.deepEqual(resultado, { ok: true, wompiPaymentSourceId: 987 });
  // wompiPaymentSourceId va al subdocumento privado (merge: true porque puede no existir
  // todavía), y solo cobroAutomaticoActivo/cobroAutomaticoIntentosFallidos van al doc
  // principal -- ver firestore.rules `match /tenants/{tenantId}/privado/{docId}`.
  assert.deepEqual(escriturasPrivado, [
    { datos: { wompiPaymentSourceId: 987 }, opciones: { merge: true } },
  ]);
  assert.deepEqual(actualizaciones, [
    { cobroAutomaticoActivo: true, cobroAutomaticoIntentosFallidos: 0 },
  ]);
});

test('crearFuentePagoWompi: rechaza sin usuario autenticado', async () => {
  const { firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });
  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  await assert.rejects(
    () => servicio({ tenantId: 'tnt-1', token: 'card-token-123' }, {}),
    (error) => error.code === 'unauthenticated'
  );
});

test('crearFuentePagoWompi: rechaza tenant que no pertenece al usuario autenticado', async () => {
  const { firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });
  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  await assert.rejects(
    () =>
      servicio(
        { tenantId: 'tnt-1', token: 'card-token-123' },
        { auth: { uid: 'u2', token: { rol: 'Admin', tenantId: 'tnt-otro' } } }
      ),
    (error) => error.code === 'permission-denied'
  );
});

test('crearFuentePagoWompi: rechaza a un usuario del tenant correcto que no es Admin/SuperAdmin (ej. Editor)', async () => {
  const { firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });
  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  await assert.rejects(
    () =>
      servicio(
        { tenantId: 'tnt-1', token: 'card-token-123' },
        { auth: { uid: 'u3', token: { rol: 'Editor', tenantId: 'tnt-1' } } }
      ),
    (error) => error.code === 'permission-denied'
  );
});

test('crearFuentePagoWompi: permite a un SuperAdmin operar sobre cualquier tenant', async (t) => {
  const { actualizaciones, escriturasPrivado, firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });

  t.mock.method(axios, 'get', async () => ({
    data: {
      data: {
        presigned_acceptance: { acceptance_token: 'accept-token' },
        presigned_personal_data_auth: { acceptance_token: 'personal-auth-token' },
      },
    },
  }));
  t.mock.method(axios, 'post', async () => ({ data: { data: { id: 555 } } }));

  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  const resultado = await servicio(
    { tenantId: 'tnt-1', token: 'card-token-123' },
    { auth: { uid: 'super', token: { rol: 'SuperAdmin' } } }
  );

  assert.deepEqual(resultado, { ok: true, wompiPaymentSourceId: 555 });
  assert.equal(actualizaciones.length, 1);
  assert.deepEqual(escriturasPrivado, [
    { datos: { wompiPaymentSourceId: 555 }, opciones: { merge: true } },
  ]);
});

test('crearFuentePagoWompi: rechaza si falta el token de tarjeta', async () => {
  const { firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });
  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  await assert.rejects(
    () => servicio({ tenantId: 'tnt-1', token: '' }, { auth: AUTH_ADMIN_TNT1 }),
    (error) => error.code === 'invalid-argument'
  );
});

test('crearFuentePagoWompi: rechaza si la llave privada de Wompi no está configurada', async () => {
  const { firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });
  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => '' });

  await assert.rejects(
    () => servicio({ tenantId: 'tnt-1', token: 'card-token-123' }, { auth: AUTH_ADMIN_TNT1 }),
    (error) => error.code === 'failed-precondition'
  );
});

test('crearFuentePagoWompi: rechaza si el tenant no existe', async () => {
  const { firestore } = crearFirestoreFake(null);
  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  await assert.rejects(
    () => servicio({ tenantId: 'tnt-1', token: 'card-token-123' }, { auth: AUTH_ADMIN_TNT1 }),
    (error) => error.code === 'not-found'
  );
});

test('crearFuentePagoWompi: rechaza si el tenant no tiene emailClub configurado', async () => {
  const { firestore } = crearFirestoreFake({});
  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  await assert.rejects(
    () => servicio({ tenantId: 'tnt-1', token: 'card-token-123' }, { auth: AUTH_ADMIN_TNT1 }),
    (error) => error.code === 'failed-precondition'
  );
});

test('crearFuentePagoWompi: propaga como unavailable si Wompi rechaza la consulta del merchant', async (t) => {
  const { firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });
  t.mock.method(axios, 'get', async () => {
    throw Object.assign(new Error('network'), { response: { data: { error: { reason: 'MERCHANT_NOT_FOUND' } } } });
  });

  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  await assert.rejects(
    () => servicio({ tenantId: 'tnt-1', token: 'card-token-123' }, { auth: AUTH_ADMIN_TNT1 }),
    (error) => error.code === 'unavailable' && /MERCHANT_NOT_FOUND/.test(error.message)
  );
});

test('crearFuentePagoWompi: propaga como internal si Wompi rechaza la creación del payment_source', async (t) => {
  const { firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });
  t.mock.method(axios, 'get', async () => ({
    data: {
      data: {
        presigned_acceptance: { acceptance_token: 'accept-token' },
        presigned_personal_data_auth: { acceptance_token: 'personal-auth-token' },
      },
    },
  }));
  t.mock.method(axios, 'post', async () => {
    throw Object.assign(new Error('rejected'), { response: { data: { error: { reason: 'INVALID_TOKEN_CARD' } } } });
  });

  const servicio = crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey: () => 'priv_test_key' });

  await assert.rejects(
    () => servicio({ tenantId: 'tnt-1', token: 'card-token-123' }, { auth: AUTH_ADMIN_TNT1 }),
    (error) => error.code === 'internal' && /INVALID_TOKEN_CARD/.test(error.message)
  );
});

// ---------------------------------------------------------------------------
// crearTransaccionRecurrenteWompi
// ---------------------------------------------------------------------------

test('crearTransaccionRecurrenteWompi: envía el body esperado y mapea el estado APPROVED', async (t) => {
  t.mock.method(axios, 'post', async (url, body, config) => {
    assert.equal(url, 'https://production.wompi.co/v1/transactions');
    assert.deepEqual(body, {
      amount_in_cents: 20000000,
      currency: 'COP',
      customer_email: 'club@test.com',
      reference: 'SUSC_tnt-1_auto_mensual_recurrente_123',
      payment_method: { installments: 1 },
      payment_source_id: 987,
    });
    assert.equal(config.headers.Authorization, 'Bearer priv_test_key');
    return { data: { data: { id: 'txn-1', status: 'APPROVED' } } };
  });

  const resultado = await crearTransaccionRecurrenteWompi({
    amountInCents: 20000000,
    reference: 'SUSC_tnt-1_auto_mensual_recurrente_123',
    customerEmail: 'club@test.com',
    paymentSourceId: 987,
    wompiPrivateKey: 'priv_test_key',
  });

  assert.deepEqual(resultado, { estado: 'APPROVED', transactionId: 'txn-1' });
});

test('crearTransaccionRecurrenteWompi: nunca lanza -- errores HTTP se devuelven como estado ERROR', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw Object.assign(new Error('boom'), { response: { data: { error: { reason: 'INSUFFICIENT_FUNDS' } } } });
  });

  const resultado = await crearTransaccionRecurrenteWompi({
    amountInCents: 100,
    reference: 'ref',
    customerEmail: 'a@a.com',
    paymentSourceId: 1,
    wompiPrivateKey: 'k',
  });

  assert.equal(resultado.estado, 'ERROR');
  assert.match(resultado.mensaje, /INSUFFICIENT_FUNDS/);
});

test('crearTransaccionRecurrenteWompi: DECLINED se devuelve tal cual (no es un error HTTP)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ data: { data: { id: 'txn-2', status: 'DECLINED' } } }));

  const resultado = await crearTransaccionRecurrenteWompi({
    amountInCents: 100,
    reference: 'ref',
    customerEmail: 'a@a.com',
    paymentSourceId: 1,
    wompiPrivateKey: 'k',
  });

  assert.equal(resultado.estado, 'DECLINED');
});

// ---------------------------------------------------------------------------
// crearServicioCobroAutomaticoMensual
// ---------------------------------------------------------------------------

function crearDepsScheduler({ tenants, resultadoCobro, wompiPaymentSourceIds }) {
  const actualizaciones = [];
  const correosEnviados = [];
  const llamadasObtenerPaymentSourceId = [];
  const docs = tenants.map((tenant) => ({
    id: tenant.id,
    data: () => tenant,
  }));

  // Fix seguridad 2026-07-18: wompiPaymentSourceId ya no vive en el doc principal del
  // tenant, así que el servicio lo obtiene vía una función inyectada aparte (simula el
  // subdocumento tenants/{tenantId}/privado/facturacion). Por defecto, estos tests siguen
  // usando `tenant.wompiPaymentSourceId` del fixture como la fuente de ese mapa -- es solo
  // el dato de prueba, no una lectura real del doc principal -- salvo que el test pase
  // `wompiPaymentSourceIds` explícito para simular un subdocumento distinto o faltante.
  const mapaPaymentSourceIds =
    wompiPaymentSourceIds ||
    Object.fromEntries(tenants.map((t) => [t.id, t.wompiPaymentSourceId ?? null]));

  // SDD pricing-cupo-real (Bloque 3b): el monto ya no depende de tenant.limite*/plan -- se
  // cuenta cuantos estudiantes facturables tiene HOY el tenant (contarEstudiantesFacturables,
  // inyectada, produccion real = .count() aggregation). Estos tests de reintento/suspension
  // no ejercitan el monto en si (solo inspeccionan actualizaciones/correos), asi que el
  // default (0, sin extras) es suficiente salvo que el test lo pase explicito via
  // `tenant.estudiantesFacturables`.
  const llamadasContarEstudiantesFacturables = [];

  const deps = {
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async (tenantId) => {
      llamadasObtenerPaymentSourceId.push(tenantId);
      return mapaPaymentSourceIds[tenantId] ?? null;
    },
    contarEstudiantesFacturables: async (tenantId) => {
      llamadasContarEstudiantesFacturables.push(tenantId);
      return tenants.find((t) => t.id === tenantId)?.estudiantesFacturables ?? 0;
    },
    crearTransaccionWompi:
      typeof resultadoCobro === 'function' ? resultadoCobro : async () => resultadoCobro,
    actualizarTenant: async (tenantId, datos) => actualizaciones.push({ tenantId, datos }),
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async (tenant) => correosEnviados.push(tenant.id),
  };

  return {
    deps,
    actualizaciones,
    correosEnviados,
    llamadasObtenerPaymentSourceId,
    llamadasContarEstudiantesFacturables,
  };
}

test('cobroAutomaticoMensual: un cobro APPROVED no toca Firestore (lo reconcilia el webhook)', async () => {
  const { deps, actualizaciones } = crearDepsScheduler({
    tenants: [{ id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com' }],
    resultadoCobro: { estado: 'APPROVED', transactionId: 'txn-1' },
  });

  const servicio = crearServicioCobroAutomaticoMensual(deps);
  const resultado = await servicio(new Date('2026-07-15T00:00:00Z'));

  assert.deepEqual(resultado, { procesados: 1, exitosos: 1, fallidos: 0, suspendidos: 0 });
  assert.deepEqual(actualizaciones, []);
});

test('cobroAutomaticoMensual: DECLINED en el primer intento solo incrementa el contador (no suspende)', async () => {
  const { deps, actualizaciones, correosEnviados } = crearDepsScheduler({
    tenants: [{ id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 }],
    resultadoCobro: { estado: 'DECLINED', mensaje: 'fondos insuficientes' },
  });

  const servicio = crearServicioCobroAutomaticoMensual(deps);
  const resultado = await servicio(new Date());

  assert.deepEqual(resultado, { procesados: 1, exitosos: 0, fallidos: 1, suspendidos: 0 });
  assert.deepEqual(actualizaciones, [
    { tenantId: 'tnt-1', datos: { cobroAutomaticoIntentosFallidos: '__INCREMENT__' } },
  ]);
  assert.deepEqual(correosEnviados, []);
});

test('cobroAutomaticoMensual: al tercer fallo consecutivo suspende la suscripción y envía el email', async () => {
  const { deps, actualizaciones, correosEnviados } = crearDepsScheduler({
    tenants: [{ id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 2 }],
    resultadoCobro: { estado: 'DECLINED', mensaje: 'fondos insuficientes' },
  });

  const servicio = crearServicioCobroAutomaticoMensual(deps);
  const resultado = await servicio(new Date());

  assert.deepEqual(resultado, { procesados: 1, exitosos: 0, fallidos: 1, suspendidos: 1 });
  assert.deepEqual(actualizaciones, [
    {
      tenantId: 'tnt-1',
      datos: {
        cobroAutomaticoIntentosFallidos: '__INCREMENT__',
        estadoSuscripcion: 'suspendido',
        // La suspensión también apaga cobroAutomaticoActivo: si no, fechaVencimiento sigue
        // vencida y este mismo tenant volvería a aparecer en la corrida de mañana,
        // reintentando contra la misma tarjeta rechazada para siempre (con un email de
        // suspensión nuevo cada día). Reactivar requiere tokenizar una tarjeta nueva.
        cobroAutomaticoActivo: false,
      },
    },
  ]);
  assert.deepEqual(correosEnviados, ['tnt-1']);
});

test('cobroAutomaticoMensual: un error de red se trata igual que un DECLINED', async () => {
  const { deps, actualizaciones } = crearDepsScheduler({
    tenants: [{ id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 }],
    resultadoCobro: { estado: 'ERROR', mensaje: 'timeout' },
  });

  const servicio = crearServicioCobroAutomaticoMensual(deps);
  const resultado = await servicio(new Date());

  assert.equal(resultado.fallidos, 1);
  assert.equal(actualizaciones.length, 1);
});

test('cobroAutomaticoMensual: omite tenants sin wompiPaymentSourceId sin llamar a Wompi', async () => {
  let llamadas = 0;
  const { deps, actualizaciones } = crearDepsScheduler({
    tenants: [{ id: 'tnt-1', emailClub: 'a@a.com' }], // sin wompiPaymentSourceId
    resultadoCobro: async () => { llamadas += 1; return { estado: 'APPROVED' }; },
  });

  const servicio = crearServicioCobroAutomaticoMensual(deps);
  const resultado = await servicio(new Date());

  assert.equal(llamadas, 0);
  assert.deepEqual(resultado, { procesados: 1, exitosos: 0, fallidos: 0, suspendidos: 0 });
  assert.deepEqual(actualizaciones, []);
});

test('cobroAutomaticoMensual: si crearTransaccionWompi lanza en vez de resolver, se trata como ERROR y no aborta el batch', async () => {
  const tenants = [
    { id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 },
    { id: 'tnt-2', wompiPaymentSourceId: 2, emailClub: 'b@b.com', cobroAutomaticoIntentosFallidos: 0 },
  ];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  const actualizaciones = [];

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async (tenantId) =>
      tenants.find((t) => t.id === tenantId)?.wompiPaymentSourceId ?? null,
    contarEstudiantesFacturables: async () => 10,
    crearTransaccionWompi: async ({ paymentSourceId }) => {
      if (paymentSourceId === 1) throw new Error('fallo inesperado de red');
      return { estado: 'DECLINED', mensaje: 'fondos insuficientes' };
    },
    actualizarTenant: async (tenantId, datos) => actualizaciones.push({ tenantId, datos }),
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async () => {},
  });

  const resultado = await servicio(new Date());

  // tnt-1 lanzó dentro de crearTransaccionWompi -- se atrapa y se cuenta como fallido
  // igual (tratado como ERROR), y tnt-2 sí se procesa normalmente.
  assert.equal(resultado.procesados, 2);
  assert.equal(resultado.fallidos, 2);
  assert.deepEqual(actualizaciones.map((a) => a.tenantId).sort(), ['tnt-1', 'tnt-2']);
});

test('cobroAutomaticoMensual: si actualizarTenant rechaza inesperadamente para un tenant, el resto del batch se sigue procesando', async () => {
  const tenants = [
    { id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 },
    { id: 'tnt-2', wompiPaymentSourceId: 2, emailClub: 'b@b.com', cobroAutomaticoIntentosFallidos: 0 },
  ];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  const actualizaciones = [];

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async (tenantId) =>
      tenants.find((t) => t.id === tenantId)?.wompiPaymentSourceId ?? null,
    contarEstudiantesFacturables: async () => 10,
    crearTransaccionWompi: async () => ({ estado: 'DECLINED', mensaje: 'fondos insuficientes' }),
    actualizarTenant: async (tenantId, datos) => {
      if (tenantId === 'tnt-1') throw new Error('Firestore no disponible');
      actualizaciones.push({ tenantId, datos });
    },
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async () => {},
  });

  const resultado = await servicio(new Date());

  assert.equal(resultado.procesados, 2);
  // Ambos se cuentan como "fallidos" (el DECLINED se contó antes del throw), pero solo
  // tnt-2 llegó a escribir en Firestore -- tnt-1 se reintenta mañana sin que el proceso truene.
  assert.equal(resultado.fallidos, 2);
  assert.deepEqual(actualizaciones.map((a) => a.tenantId), ['tnt-2']);
});

test('cobroAutomaticoMensual: lee wompiPaymentSourceId del subdocumento privado inyectado, no del doc principal del tenant', async () => {
  // El fixture del tenant deliberadamente NO trae wompiPaymentSourceId -- si el servicio
  // intentara leerlo de `tenant.wompiPaymentSourceId` (doc principal, como hacía antes del
  // fix de seguridad 2026-07-18), fallaría con undefined y el tenant se omitiría. Este test
  // prueba que en cambio se usa exclusivamente `obtenerWompiPaymentSourceId`.
  const tenants = [
    { id: 'tnt-1', emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 },
  ];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  const llamadasPaymentSourceId = [];
  let paymentSourceIdUsado = null;

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async (tenantId) => {
      llamadasPaymentSourceId.push(tenantId);
      return 42; // simula tenants/{tenantId}/privado/facturacion.wompiPaymentSourceId
    },
    contarEstudiantesFacturables: async () => 10,
    crearTransaccionWompi: async ({ paymentSourceId }) => {
      paymentSourceIdUsado = paymentSourceId;
      return { estado: 'APPROVED', transactionId: 'txn-1' };
    },
    actualizarTenant: async () => {},
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async () => {},
  });

  const resultado = await servicio(new Date());

  assert.deepEqual(llamadasPaymentSourceId, ['tnt-1']);
  assert.equal(paymentSourceIdUsado, 42);
  assert.deepEqual(resultado, { procesados: 1, exitosos: 1, fallidos: 0, suspendidos: 0 });
});

test('cobroAutomaticoMensual: si el subdocumento privado no existe o no tiene wompiPaymentSourceId, se omite igual que un tenant sin fuente de pago', async () => {
  let llamadas = 0;
  const tenants = [{ id: 'tnt-1', emailClub: 'a@a.com' }];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async () => null, // subdocumento inexistente o sin el campo
    crearTransaccionWompi: async () => { llamadas += 1; return { estado: 'APPROVED' }; },
    actualizarTenant: async () => {},
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async () => {},
  });

  const resultado = await servicio(new Date());

  assert.equal(llamadas, 0);
  assert.deepEqual(resultado, { procesados: 1, exitosos: 0, fallidos: 0, suspendidos: 0 });
});

// ---------------------------------------------------------------------------
// SDD pricing-cupo-real (Bloque 3b, facturacion-metered): el monto ya NO se infiere de
// tenant.limite*/plan (calcularMontoMensualPesos, eliminada) -- se MIDE con
// calcularFacturacionMensual (functions/facturacion.js, Bloque 2, pura, no reabierta aca),
// alimentada por el conteo facturable inyectado (contarEstudiantesFacturables) + los extras
// ya persistidos en el propio doc del tenant (sedesExtraContratadas/
// equipoTecnicoExtraContratado, D7/D8 -- Bloque 3a).
// ---------------------------------------------------------------------------

test('cobroAutomaticoMensual: cobra el monto MEDIDO segun el conteo facturable inyectado + extras del tenant (ya no infiere addons por diferencia de limites)', async () => {
  const tenants = [
    {
      id: 'tnt-1',
      wompiPaymentSourceId: 1,
      emailClub: 'a@a.com',
      sedesExtraContratadas: 1,
      equipoTecnicoExtraContratado: 0,
    },
  ];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  let amountRecibido = null;
  let tenantIdContado = null;

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async () => 1,
    contarEstudiantesFacturables: async (tenantId) => {
      tenantIdContado = tenantId;
      return 60; // cruza el primer tramo: 50@3800 + 10@3400
    },
    crearTransaccionWompi: async ({ amountInCents }) => {
      amountRecibido = amountInCents;
      return { estado: 'APPROVED', transactionId: 'txn-1' };
    },
    actualizarTenant: async () => {},
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async () => {},
  });

  await servicio(new Date());

  // 60 facturables: (50*3800) + (10*3400) = 190000 + 34000 = 224000; + 1 sede extra
  // ($89.900) = 313900 pesos = 31390000 centavos (calcularFacturacionMensual, facturacion.js).
  assert.equal(tenantIdContado, 'tnt-1');
  assert.equal(amountRecibido, 31390000);
});

test('cobroAutomaticoMensual: un tenant sin extras contratados ni bono cobra solo el tramo de estudiantes', async () => {
  const tenants = [{ id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com' }];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  let amountRecibido = null;

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async () => 1,
    contarEstudiantesFacturables: async () => 30,
    crearTransaccionWompi: async ({ amountInCents }) => {
      amountRecibido = amountInCents;
      return { estado: 'APPROVED', transactionId: 'txn-1' };
    },
    actualizarTenant: async () => {},
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async () => {},
  });

  await servicio(new Date());

  // 30 facturables, todos en el primer tramo: 30*3800 = 114000 pesos = 11400000 centavos.
  assert.equal(amountRecibido, 11400000);
});

test('cobroAutomaticoMensual: 0 estudiantes facturables cobra $0 (Scenario facturacion-metered: fin de la prueba sin estudiantes matriculados)', async () => {
  const tenants = [{ id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com' }];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  let amountRecibido = null;

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async () => 1,
    contarEstudiantesFacturables: async () => 0,
    crearTransaccionWompi: async ({ amountInCents }) => {
      amountRecibido = amountInCents;
      return { estado: 'APPROVED', transactionId: 'txn-1' };
    },
    actualizarTenant: async () => {},
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async () => {},
  });

  await servicio(new Date());

  assert.equal(amountRecibido, 0);
});

test('cobroAutomaticoMensual: si contarEstudiantesFacturables lanza (ej. .count() no disponible), el tenant se omite sin cobrar un monto adivinado y el resto del batch se sigue procesando', async () => {
  const tenants = [
    { id: 'tnt-1', wompiPaymentSourceId: 1, emailClub: 'a@a.com' },
    { id: 'tnt-2', wompiPaymentSourceId: 2, emailClub: 'b@b.com' },
  ];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  let llamadasCobro = 0;

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
    obtenerWompiPaymentSourceId: async (tenantId) =>
      tenants.find((t) => t.id === tenantId)?.wompiPaymentSourceId ?? null,
    contarEstudiantesFacturables: async (tenantId) => {
      if (tenantId === 'tnt-1') throw new Error('Firestore no disponible');
      return 10;
    },
    crearTransaccionWompi: async () => { llamadasCobro += 1; return { estado: 'APPROVED', transactionId: 'txn-1' }; },
    actualizarTenant: async () => {},
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async () => {},
  });

  const resultado = await servicio(new Date());

  // tnt-1 nunca llega a cobrar -- ningun monto se adivina cuando no se puede saber cuantos
  // estudiantes hay. El error cae en el mismo catch por-tenant que ya usa este archivo para
  // "actualizarTenant rechaza inesperadamente" (ver test arriba): se loguea, se reintenta
  // mañana, y tnt-2 se procesa con total normalidad en la MISMA corrida.
  assert.equal(llamadasCobro, 1);
  assert.equal(resultado.procesados, 2);
});

// ---------------------------------------------------------------------------
// normalizarFecha / crearListadoTenantsPendientesDeCobroFirestore
//
// fechaVencimiento convive en dos tipos según quién la escribió: Firestore Timestamp
// (webhookWompi, vía admin.firestore.Timestamp.fromDate) o string 'YYYY-MM-DD'
// (registrarNuevaEscuela en servicios/configuracionApi.ts, desde el frontend). Un
// where('fechaVencimiento', '<=', valor) de Firestore solo compara contra el tipo que se
// le pasa y excluye en silencio los documentos con el otro tipo, así que el filtro se
// hace en memoria con normalizarFecha() sobre un único where de igualdad
// (cobroAutomaticoActivo == true, auto-indexado, sin índice compuesto).
// ---------------------------------------------------------------------------

test('normalizarFecha: soporta un Firestore Timestamp (objeto con toDate())', () => {
  const timestampFake = { toDate: () => new Date('2026-07-01T00:00:00Z') };
  assert.equal(normalizarFecha(timestampFake).toISOString(), '2026-07-01T00:00:00.000Z');
});

test('normalizarFecha: soporta un string YYYY-MM-DD', () => {
  const fecha = normalizarFecha('2026-07-01');
  assert.equal(fecha.getUTCFullYear(), 2026);
  assert.equal(fecha.getUTCMonth(), 6);
  assert.equal(fecha.getUTCDate(), 1);
});

test('normalizarFecha: devuelve null para valores vacíos o inválidos', () => {
  assert.equal(normalizarFecha(null), null);
  assert.equal(normalizarFecha(undefined), null);
  assert.equal(normalizarFecha(''), null);
  assert.equal(normalizarFecha('no-es-una-fecha'), null);
});

test('crearListadoTenantsPendientesDeCobroFirestore: filtra por cobroAutomaticoActivo con un único where de igualdad', async () => {
  let whereLlamados = [];
  const docsFalsos = [];
  const firestoreFake = {
    collection: (nombre) => {
      assert.equal(nombre, 'tenants');
      return {
        where: (campo, op, valor) => {
          whereLlamados.push([campo, op, valor]);
          return {
            get: async () => ({ docs: docsFalsos }),
          };
        },
      };
    },
  };

  const listar = crearListadoTenantsPendientesDeCobroFirestore(firestoreFake);
  await listar(new Date());

  assert.deepEqual(whereLlamados, [['cobroAutomaticoActivo', '==', true]]);
});

test('crearListadoTenantsPendientesDeCobroFirestore: incluye tenants vencidos con fechaVencimiento como Timestamp o como string, y excluye los no vencidos', async () => {
  const ahora = new Date('2026-07-15T00:00:00Z');
  const docs = [
    { id: 'vencido-timestamp', data: () => ({ fechaVencimiento: { toDate: () => new Date('2026-07-01T00:00:00Z') } }) },
    { id: 'vencido-string', data: () => ({ fechaVencimiento: '2026-07-10' }) },
    { id: 'no-vencido', data: () => ({ fechaVencimiento: '2026-08-01' }) },
    { id: 'sin-fecha', data: () => ({}) },
  ];
  const firestoreFake = {
    collection: () => ({
      where: () => ({ get: async () => ({ docs }) }),
    }),
  };

  const listar = crearListadoTenantsPendientesDeCobroFirestore(firestoreFake);
  const resultado = await listar(ahora);

  assert.deepEqual(resultado.map((d) => d.id).sort(), ['vencido-string', 'vencido-timestamp']);
});

// ---------------------------------------------------------------------------
// crearLectorWompiPaymentSourceIdFirestore
//
// Fix seguridad 2026-07-18: wompiPaymentSourceId se movió de tenants/{tenantId} raíz a
// tenants/{tenantId}/privado/facturacion (ver firestore.rules), porque el doc principal es
// legible por `allow get` para cualquier usuario autenticado del tenant.
// ---------------------------------------------------------------------------

test('crearLectorWompiPaymentSourceIdFirestore: lee wompiPaymentSourceId de tenants/{tenantId}/privado/facturacion', async () => {
  const rutasConsultadas = [];
  const firestoreFake = {
    collection: (nombre) => {
      assert.equal(nombre, 'tenants');
      return {
        doc: (tenantId) => ({
          collection: (sub) => {
            assert.equal(sub, 'privado');
            return {
              doc: (docId) => {
                assert.equal(docId, 'facturacion');
                rutasConsultadas.push(`${tenantId}/privado/${docId}`);
                return { get: async () => ({ exists: true, data: () => ({ wompiPaymentSourceId: 987 }) }) };
              },
            };
          },
        }),
      };
    },
  };

  const obtener = crearLectorWompiPaymentSourceIdFirestore(firestoreFake);
  const resultado = await obtener('tnt-1');

  assert.equal(resultado, 987);
  assert.deepEqual(rutasConsultadas, ['tnt-1/privado/facturacion']);
});

test('crearLectorWompiPaymentSourceIdFirestore: devuelve null si el subdocumento no existe', async () => {
  const firestoreFake = {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }),
        }),
      }),
    }),
  };

  const obtener = crearLectorWompiPaymentSourceIdFirestore(firestoreFake);
  assert.equal(await obtener('tnt-1'), null);
});

test('crearLectorWompiPaymentSourceIdFirestore: devuelve null si el subdocumento existe pero no tiene el campo', async () => {
  const firestoreFake = {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({ get: async () => ({ exists: true, data: () => ({}) }) }),
        }),
      }),
    }),
  };

  const obtener = crearLectorWompiPaymentSourceIdFirestore(firestoreFake);
  assert.equal(await obtener('tnt-1'), null);
});
