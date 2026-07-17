'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const {
  crearServicioCrearFuentePagoWompi,
  crearServicioCobroAutomaticoMensual,
  crearListadoTenantsPendientesDeCobroFirestore,
  crearTransaccionRecurrenteWompi,
  calcularMontoMensualPesos,
  calcularMontoMensualCentavos,
  construirReferenciaCobroAutomatico,
  normalizarFecha,
} = require('./wompiCobroAutomatico');

// ---------------------------------------------------------------------------
// calcularMontoMensualPesos / calcularMontoMensualCentavos
// ---------------------------------------------------------------------------

test('calcularMontoMensualPesos: plan starter sin addons cobra solo el precio base', () => {
  const monto = calcularMontoMensualPesos({
    plan: 'starter',
    limiteEstudiantes: 50,
    limiteUsuarios: 2,
    limiteSedes: 2,
  });
  assert.equal(monto, 200000);
});

test('calcularMontoMensualPesos: suma addons de estudiantes, usuarios y sedes inferidos por diferencia de límites', () => {
  const monto = calcularMontoMensualPesos({
    plan: 'growth',
    limiteEstudiantes: 160, // 150 base + 1 bloque de 10
    limiteUsuarios: 6, // 5 base + 1
    limiteSedes: 4, // 3 base + 1
  });
  // 540000 (growth) + 36000 (addon estudiantes) + 36000 (addon usuario) + 89900 (addon sede)
  assert.equal(monto, 540000 + 36000 + 36000 + 89900);
});

test('calcularMontoMensualPesos: plan desconocido cae a starter', () => {
  const monto = calcularMontoMensualPesos({ plan: 'inexistente', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2 });
  assert.equal(monto, 200000);
});

test('calcularMontoMensualPesos: límites por debajo del plan base no generan addon negativo', () => {
  const monto = calcularMontoMensualPesos({
    plan: 'pro',
    limiteEstudiantes: 100, // menos que el base (350) -- no debe restar
    limiteUsuarios: 1,
    limiteSedes: 1,
  });
  assert.equal(monto, 1000000);
});

test('calcularMontoMensualCentavos: convierte pesos a centavos igual que construirUrlCheckoutWompi (*100)', () => {
  const centavos = calcularMontoMensualCentavos({
    plan: 'starter',
    limiteEstudiantes: 50,
    limiteUsuarios: 2,
    limiteSedes: 2,
  });
  assert.equal(centavos, 20000000);
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
  const tenantRef = {
    get: async () => ({
      exists: tenantData !== null,
      data: () => tenantData,
    }),
    update: async (datos) => actualizaciones.push(datos),
  };
  return {
    actualizaciones,
    firestore: {
      collection: (nombre) => {
        assert.equal(nombre, 'tenants');
        return { doc: (id) => { assert.equal(id, 'tnt-1'); return tenantRef; } };
      },
    },
  };
}

const AUTH_ADMIN_TNT1 = { uid: 'u1', token: { rol: 'Admin', tenantId: 'tnt-1' } };

test('crearFuentePagoWompi: crea el payment_source y activa el cobro automático del tenant', async (t) => {
  const { actualizaciones, firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });

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
  assert.deepEqual(actualizaciones, [
    { wompiPaymentSourceId: 987, cobroAutomaticoActivo: true, cobroAutomaticoIntentosFallidos: 0 },
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
  const { actualizaciones, firestore } = crearFirestoreFake({ emailClub: 'club@test.com' });

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

function crearDepsScheduler({ tenants, resultadoCobro }) {
  const actualizaciones = [];
  const correosEnviados = [];
  const docs = tenants.map((tenant) => ({
    id: tenant.id,
    data: () => tenant,
  }));

  const deps = {
    listarTenantsPendientesDeCobro: async () => docs,
    crearTransaccionWompi:
      typeof resultadoCobro === 'function' ? resultadoCobro : async () => resultadoCobro,
    actualizarTenant: async (tenantId, datos) => actualizaciones.push({ tenantId, datos }),
    incrementarUno: () => '__INCREMENT__',
    enviarCorreoFalloPago: async (tenant) => correosEnviados.push(tenant.id),
  };

  return { deps, actualizaciones, correosEnviados };
}

test('cobroAutomaticoMensual: un cobro APPROVED no toca Firestore (lo reconcilia el webhook)', async () => {
  const { deps, actualizaciones } = crearDepsScheduler({
    tenants: [{ id: 'tnt-1', plan: 'starter', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2, wompiPaymentSourceId: 1, emailClub: 'a@a.com' }],
    resultadoCobro: { estado: 'APPROVED', transactionId: 'txn-1' },
  });

  const servicio = crearServicioCobroAutomaticoMensual(deps);
  const resultado = await servicio(new Date('2026-07-15T00:00:00Z'));

  assert.deepEqual(resultado, { procesados: 1, exitosos: 1, fallidos: 0, suspendidos: 0 });
  assert.deepEqual(actualizaciones, []);
});

test('cobroAutomaticoMensual: DECLINED en el primer intento solo incrementa el contador (no suspende)', async () => {
  const { deps, actualizaciones, correosEnviados } = crearDepsScheduler({
    tenants: [{ id: 'tnt-1', plan: 'starter', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2, wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 }],
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
    tenants: [{ id: 'tnt-1', plan: 'starter', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2, wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 2 }],
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
    tenants: [{ id: 'tnt-1', plan: 'starter', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2, wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 }],
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
    tenants: [{ id: 'tnt-1', plan: 'starter', emailClub: 'a@a.com' }], // sin wompiPaymentSourceId
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
    { id: 'tnt-1', plan: 'starter', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2, wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 },
    { id: 'tnt-2', plan: 'starter', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2, wompiPaymentSourceId: 2, emailClub: 'b@b.com', cobroAutomaticoIntentosFallidos: 0 },
  ];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  const actualizaciones = [];

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
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
    { id: 'tnt-1', plan: 'starter', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2, wompiPaymentSourceId: 1, emailClub: 'a@a.com', cobroAutomaticoIntentosFallidos: 0 },
    { id: 'tnt-2', plan: 'starter', limiteEstudiantes: 50, limiteUsuarios: 2, limiteSedes: 2, wompiPaymentSourceId: 2, emailClub: 'b@b.com', cobroAutomaticoIntentosFallidos: 0 },
  ];
  const docs = tenants.map((tenant) => ({ id: tenant.id, data: () => tenant }));
  const actualizaciones = [];

  const servicio = crearServicioCobroAutomaticoMensual({
    listarTenantsPendientesDeCobro: async () => docs,
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
