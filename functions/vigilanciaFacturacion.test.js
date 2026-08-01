'use strict';

// functions/vigilanciaFacturacion.test.js
// SDD pricing-cupo-real (Bloque 3b, D5 "Growth guardrail placement"): factory-DI, mismo
// estilo que functions/wompiCobroAutomatico.js::crearServicioCobroAutomaticoMensual.
// capacidad-tenant: "Sin tope duro de matricula, con guardrail de crecimiento anomalo" --
// este guardrail SOLO notifica, NUNCA bloquea (Scenario "Crecimiento anomalo dispara alerta,
// no bloqueo": "el club MUST seguir operando sin restriccion").

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  crearServicioVigilarCrecimientoFacturable,
  crearListadoTenantsFirestore,
  crearContadorEstudiantesFacturablesFirestore,
  crearLectorHistorialVigilanciaFirestore,
  crearGuardadorHistorialVigilanciaFirestore,
  evaluarSenalesCrecimiento,
  fechaBogota,
} = require('./vigilanciaFacturacion');

const CONFIG_DEFAULT = {
  umbralCrecimiento: { pisoAbsoluto: 30, factorDuplicacion: 2, incrementoDiarioMaximo: 100 },
  umbralCaida: { factorCaida: 0.5, diasHastaCorte: 3 },
  dedupeHoras: 24,
  historialMaximo: 30,
};

// ---------------------------------------------------------------------------
// evaluarSenalesCrecimiento -- pura, sin Firestore. Umbrales SIEMPRE vienen del parametro
// `config`, nunca hardcodeados (capacidad-tenant: "Umbral configurable").
// ---------------------------------------------------------------------------

test('evaluarSenalesCrecimiento: S1 no dispara justo por debajo del piso absoluto (29 < 30)', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 29, nAyer: null, nHace7d: 10, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s1, false);
  assert.equal(r.disparaAlguna, false);
});

test('evaluarSenalesCrecimiento: S1 dispara exactamente en el piso absoluto (30 >= max(30, 10*2))', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 30, nAyer: null, nHace7d: 10, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s1, true);
  assert.equal(r.disparaAlguna, true);
});

test('evaluarSenalesCrecimiento: S1 dispara por duplicacion por encima del piso (100 >= max(30, 50*2))', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 100, nAyer: null, nHace7d: 50, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s1, true);
});

test('evaluarSenalesCrecimiento: S1 NO dispara si no llega a duplicar (99 < max(30, 50*2)=100)', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 99, nAyer: null, nHace7d: 50, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s1, false);
});

test('evaluarSenalesCrecimiento: S1 es inerte sin dato de hace 7 dias (historial corto es inerte)', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 500, nAyer: null, nHace7d: null, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s1, false);
  assert.equal(r.disparaAlguna, false);
});

test('evaluarSenalesCrecimiento: S2 dispara exactamente en +100 sobre ayer', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 110, nAyer: 10, nHace7d: null, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s2, true);
});

test('evaluarSenalesCrecimiento: S2 NO dispara en +99', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 109, nAyer: 10, nHace7d: null, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s2, false);
});

test('evaluarSenalesCrecimiento: S2 es inerte sin dato de ayer', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 500, nAyer: null, nHace7d: null, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s2, false);
});

test('evaluarSenalesCrecimiento: S3 dispara con caida a la mitad o mas cerca del corte (Scenario implicito: retiro-antes-del-corte)', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 50, nAyer: null, nHace7d: 100, diasHastaCorte: 3, config: CONFIG_DEFAULT });
  assert.equal(r.s3, true);
});

test('evaluarSenalesCrecimiento: S3 NO dispara si la caida es real pero el corte esta lejos', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 50, nAyer: null, nHace7d: 100, diasHastaCorte: 10, config: CONFIG_DEFAULT });
  assert.equal(r.s3, false);
});

test('evaluarSenalesCrecimiento: S3 NO dispara si no hay caida aunque el corte este cerca', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 90, nAyer: null, nHace7d: 100, diasHastaCorte: 1, config: CONFIG_DEFAULT });
  assert.equal(r.s3, false);
});

test('evaluarSenalesCrecimiento: S3 dispara con diasHastaCorte negativo (tenant ya vencido) -- señal de retiro justo antes/despues del corte', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 40, nAyer: null, nHace7d: 100, diasHastaCorte: -1, config: CONFIG_DEFAULT });
  assert.equal(r.s3, true);
});

test('evaluarSenalesCrecimiento: S3 es inerte sin fechaVencimiento parseable (diasHastaCorte null)', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 50, nAyer: null, nHace7d: 100, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s3, false);
});

test('evaluarSenalesCrecimiento: combina señales -- S1 y S2 pueden disparar juntas', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 200, nAyer: 50, nHace7d: 50, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.s1, true); // 200 >= max(30, 100)
  assert.equal(r.s2, true); // 200-50 = 150 >= 100
  assert.equal(r.disparaAlguna, true);
});

test('evaluarSenalesCrecimiento: ninguna señal dispara con crecimiento organico chico (3->6, ruido normal de onboarding)', () => {
  const r = evaluarSenalesCrecimiento({ nHoy: 6, nAyer: 5, nHace7d: 3, diasHastaCorte: null, config: CONFIG_DEFAULT });
  assert.equal(r.disparaAlguna, false);
});

test('evaluarSenalesCrecimiento: los umbrales SIEMPRE vienen de `config`, nunca hardcodeados (capacidad-tenant: "Umbral configurable")', () => {
  const configPersonalizado = {
    umbralCrecimiento: { pisoAbsoluto: 50, factorDuplicacion: 3, incrementoDiarioMaximo: 200 },
    umbralCaida: { factorCaida: 0.5, diasHastaCorte: 3 },
    dedupeHoras: 24,
    historialMaximo: 30,
  };

  // Con el config default, 40 dispararia S1 (>=30 y no hay nHace7d -> en realidad S1 exige
  // nHace7d; usamos nHace7d=1 para que ambos config compartan el mismo calculo de duplicacion
  // y la diferencia observable sea PURAMENTE el piso absoluto).
  const conDefault = evaluarSenalesCrecimiento({ nHoy: 40, nAyer: null, nHace7d: 1, diasHastaCorte: null, config: CONFIG_DEFAULT });
  const conPersonalizado = evaluarSenalesCrecimiento({ nHoy: 40, nAyer: null, nHace7d: 1, diasHastaCorte: null, config: configPersonalizado });

  assert.equal(conDefault.s1, true); // 40 >= max(30, 2) = 30
  assert.equal(conPersonalizado.s1, false); // 40 < max(50, 3) = 50 -- mismo input, config distinto, resultado distinto
});

// ---------------------------------------------------------------------------
// fechaBogota -- helper de fecha (America/Bogota, sin DST)
// ---------------------------------------------------------------------------

test('fechaBogota: formatea a YYYY-MM-DD en zona horaria America/Bogota', () => {
  assert.equal(fechaBogota(new Date('2026-07-31T23:30:00-05:00')), '2026-07-31');
});

// ---------------------------------------------------------------------------
// crearContadorEstudiantesFacturablesFirestore / crearListadoTenantsFirestore /
// crearLectorHistorialVigilanciaFirestore / crearGuardadorHistorialVigilanciaFirestore
// (adaptadores Firestore, independientes -- mismo patron/query que
// wompiCobroAutomatico.js::crearContadorEstudiantesFacturablesFirestore)
// ---------------------------------------------------------------------------

test('crearContadorEstudiantesFacturablesFirestore: usa una agregacion .count() filtrando tenantId + estadoMatricula=="activo"', async () => {
  const wheresLlamados = [];
  const firestoreFake = {
    collection: (nombre) => {
      assert.equal(nombre, 'estudiantes');
      return {
        where: (c1, o1, v1) => {
          wheresLlamados.push([c1, o1, v1]);
          return {
            where: (c2, o2, v2) => {
              wheresLlamados.push([c2, o2, v2]);
              return { count: () => ({ get: async () => ({ data: () => ({ count: 42 }) }) }) };
            },
          };
        },
      };
    },
  };

  const contar = crearContadorEstudiantesFacturablesFirestore(firestoreFake);
  assert.equal(await contar('tnt-1'), 42);
  assert.deepEqual(wheresLlamados, [
    ['tenantId', '==', 'tnt-1'],
    ['estadoMatricula', '==', 'activo'],
  ]);
});

test('crearListadoTenantsFirestore: lista todos los docs de tenants (cardinalidad de tenant, no de estudiante -- sin agregacion)', async () => {
  const docsFalsos = [{ id: 'tnt-1' }, { id: 'tnt-2' }];
  const firestoreFake = {
    collection: (nombre) => {
      assert.equal(nombre, 'tenants');
      return { get: async () => ({ docs: docsFalsos }) };
    },
  };

  const listar = crearListadoTenantsFirestore(firestoreFake);
  const docs = await listar();

  assert.deepEqual(docs, docsFalsos);
});

test('crearLectorHistorialVigilanciaFirestore: devuelve historial vacio + ultimaAlertaEnviada null si el doc no existe', async () => {
  const firestoreFake = {
    collection: (nombre) => {
      assert.equal(nombre, 'facturacion_vigilancia');
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
  };

  const leer = crearLectorHistorialVigilanciaFirestore(firestoreFake);
  const resultado = await leer('tnt-1');

  assert.deepEqual(resultado, { historial: [], ultimaAlertaEnviada: null });
});

test('crearLectorHistorialVigilanciaFirestore: devuelve el historial existente tal cual', async () => {
  const firestoreFake = {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({ historial: [{ fecha: '2026-07-30', facturables: 65 }], ultimaAlertaEnviada: '2026-07-30T07:00:00.000Z' }),
        }),
      }),
    }),
  };

  const leer = crearLectorHistorialVigilanciaFirestore(firestoreFake);
  const resultado = await leer('tnt-1');

  assert.deepEqual(resultado, {
    historial: [{ fecha: '2026-07-30', facturables: 65 }],
    ultimaAlertaEnviada: '2026-07-30T07:00:00.000Z',
  });
});

test('crearGuardadorHistorialVigilanciaFirestore: escribe con merge:true en facturacion_vigilancia/{tenantId}', async () => {
  const escrituras = [];
  const firestoreFake = {
    collection: (nombre) => {
      assert.equal(nombre, 'facturacion_vigilancia');
      return {
        doc: (tenantId) => ({
          set: async (datos, opciones) => escrituras.push({ tenantId, datos, opciones }),
        }),
      };
    },
  };

  const guardar = crearGuardadorHistorialVigilanciaFirestore(firestoreFake);
  await guardar('tnt-1', { historial: [{ fecha: '2026-07-31', facturables: 70 }], ultimaAlertaEnviada: null });

  assert.deepEqual(escrituras, [
    {
      tenantId: 'tnt-1',
      datos: { historial: [{ fecha: '2026-07-31', facturables: 70 }], ultimaAlertaEnviada: null },
      opciones: { merge: true },
    },
  ]);
});

// ---------------------------------------------------------------------------
// crearServicioVigilarCrecimientoFacturable -- factory-DI, mismo estilo que
// crearServicioCobroAutomaticoMensual (wompiCobroAutomatico.js).
// ---------------------------------------------------------------------------

function crearDepsVigilancia({ tenants, historiales = {}, contarPorTenant }) {
  const docs = tenants.map((t) => ({ id: t.id, data: () => t }));
  const historialesGuardados = [];
  const alertasEnviadas = [];

  const deps = {
    listarTenants: async () => docs,
    contarEstudiantesFacturables: async (tenantId) =>
      typeof contarPorTenant === 'function' ? contarPorTenant(tenantId) : contarPorTenant[tenantId],
    leerHistorialVigilancia: async (tenantId) =>
      historiales[tenantId] || { historial: [], ultimaAlertaEnviada: null },
    guardarHistorialVigilancia: async (tenantId, datos) => {
      historialesGuardados.push({ tenantId, datos });
    },
    notificarAlerta: async (payload) => {
      alertasEnviadas.push(payload);
    },
  };

  return { deps, historialesGuardados, alertasEnviadas };
}

test('vigilarCrecimientoFacturable: revisa todos los tenants y agrega la entrada de HOY al historial', async () => {
  const { deps, historialesGuardados } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1' }],
    contarPorTenant: { 'tnt-1': 10 },
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  const ahora = new Date('2026-07-31T12:00:00-05:00');
  const resultado = await servicio(ahora);

  assert.equal(resultado.tenants, 1);
  assert.equal(resultado.revisados, 1);
  assert.deepEqual(historialesGuardados, [
    {
      tenantId: 'tnt-1',
      datos: { historial: [{ fecha: '2026-07-31', facturables: 10 }], ultimaAlertaEnviada: null },
    },
  ]);
});

test('vigilarCrecimientoFacturable: NO dispara alerta cuando ninguna señal se cumple, pero igual actualiza el historial', async () => {
  const { deps, historialesGuardados, alertasEnviadas } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1' }],
    historiales: {
      'tnt-1': { historial: [{ fecha: '2026-07-30', facturables: 9 }], ultimaAlertaEnviada: null },
    },
    contarPorTenant: { 'tnt-1': 10 }, // +1 sobre ayer -- muy por debajo de cualquier umbral
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  await servicio(new Date('2026-07-31T12:00:00-05:00'));

  assert.deepEqual(alertasEnviadas, []);
  assert.equal(historialesGuardados[0].datos.historial.length, 2);
});

test('vigilarCrecimientoFacturable: dispara notificarAlerta cuando S2 se cumple (+100 sobre ayer)', async () => {
  const { deps, alertasEnviadas, historialesGuardados } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1', nombreClub: 'Club Uno' }],
    historiales: {
      'tnt-1': { historial: [{ fecha: '2026-07-30', facturables: 10 }], ultimaAlertaEnviada: null },
    },
    contarPorTenant: { 'tnt-1': 120 }, // +110 sobre ayer
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  const ahora = new Date('2026-07-31T07:00:00-05:00');
  const resultado = await servicio(ahora);

  assert.equal(alertasEnviadas.length, 1);
  assert.equal(alertasEnviadas[0].tenantId, 'tnt-1');
  assert.equal(alertasEnviadas[0].senales.s2, true);
  assert.equal(resultado.alertados, 1);
  // ultimaAlertaEnviada se actualiza a `ahora` en el historial guardado.
  assert.equal(historialesGuardados[0].datos.ultimaAlertaEnviada, ahora.toISOString());
});

test('vigilarCrecimientoFacturable: dedupe -- no reenvia si ultimaAlertaEnviada fue hace menos de 24h, pero igual actualiza el historial', async () => {
  const ahora = new Date('2026-07-31T07:00:00.000Z');
  const hace10Horas = new Date(ahora.getTime() - 10 * 60 * 60 * 1000).toISOString();

  const { deps, alertasEnviadas, historialesGuardados } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1' }],
    historiales: {
      'tnt-1': { historial: [{ fecha: '2026-07-30', facturables: 10 }], ultimaAlertaEnviada: hace10Horas },
    },
    contarPorTenant: { 'tnt-1': 120 },
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  const resultado = await servicio(ahora);

  assert.deepEqual(alertasEnviadas, []);
  assert.equal(resultado.deduped, 1);
  assert.equal(resultado.alertados, 0);
  // ultimaAlertaEnviada NO cambia -- sigue siendo la de hace 10h, no `ahora`.
  assert.equal(historialesGuardados[0].datos.ultimaAlertaEnviada, hace10Horas);
});

test('vigilarCrecimientoFacturable: reenvia si ultimaAlertaEnviada fue hace 24h o mas', async () => {
  const ahora = new Date('2026-07-31T07:00:00.000Z');
  const hace25Horas = new Date(ahora.getTime() - 25 * 60 * 60 * 1000).toISOString();

  const { deps, alertasEnviadas } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1' }],
    historiales: {
      'tnt-1': { historial: [{ fecha: '2026-07-30', facturables: 10 }], ultimaAlertaEnviada: hace25Horas },
    },
    contarPorTenant: { 'tnt-1': 120 },
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  await servicio(ahora);

  assert.equal(alertasEnviadas.length, 1);
});

test('vigilarCrecimientoFacturable: historial vacio o corto es inerte -- la primera corrida de un tenant nuevo nunca dispara', async () => {
  const { deps, alertasEnviadas } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1' }],
    contarPorTenant: { 'tnt-1': 5000 }, // un numero enorme, pero SIN historial previo para comparar
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  await servicio(new Date('2026-07-31T07:00:00-05:00'));

  assert.deepEqual(alertasEnviadas, []);
});

test('vigilarCrecimientoFacturable: el historial queda recortado a los ultimos historialMaximo (30) registros', async () => {
  const historialLargo = Array.from({ length: 30 }, (_, i) => ({
    fecha: `2026-07-${String(i + 1).padStart(2, '0')}`,
    facturables: 10 + i,
  }));

  const { deps, historialesGuardados } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1' }],
    historiales: { 'tnt-1': { historial: historialLargo, ultimaAlertaEnviada: null } },
    contarPorTenant: { 'tnt-1': 40 },
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  await servicio(new Date('2026-07-31T07:00:00-05:00'));

  const nuevoHistorial = historialesGuardados[0].datos.historial;
  assert.equal(nuevoHistorial.length, 30);
  // El mas antiguo (2026-07-01) se cae; el mas nuevo (hoy, 2026-07-31) entra.
  assert.ok(!nuevoHistorial.some((h) => h.fecha === '2026-07-01'));
  assert.ok(nuevoHistorial.some((h) => h.fecha === '2026-07-31'));
});

test('vigilarCrecimientoFacturable: una corrida repetida el MISMO dia reemplaza la entrada de hoy, no la duplica', async () => {
  const { deps, historialesGuardados } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1' }],
    historiales: {
      'tnt-1': { historial: [{ fecha: '2026-07-31', facturables: 10 }], ultimaAlertaEnviada: null },
    },
    contarPorTenant: { 'tnt-1': 15 }, // recorrida el mismo dia, conteo distinto
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  await servicio(new Date('2026-07-31T18:00:00-05:00'));

  const nuevoHistorial = historialesGuardados[0].datos.historial;
  assert.deepEqual(nuevoHistorial, [{ fecha: '2026-07-31', facturables: 15 }]);
});

test('vigilarCrecimientoFacturable: nunca lanza -- un tenant que falla (ej. contarEstudiantesFacturables lanza) no aborta el resto del batch', async () => {
  const docs = [{ id: 'tnt-1' }, { id: 'tnt-2' }].map((t) => ({ id: t.id, data: () => t }));
  const historialesGuardados = [];

  const servicio = crearServicioVigilarCrecimientoFacturable({
    listarTenants: async () => docs,
    contarEstudiantesFacturables: async (tenantId) => {
      if (tenantId === 'tnt-1') throw new Error('Firestore no disponible');
      return 10;
    },
    leerHistorialVigilancia: async () => ({ historial: [], ultimaAlertaEnviada: null }),
    guardarHistorialVigilancia: async (tenantId, datos) => historialesGuardados.push({ tenantId, datos }),
    notificarAlerta: async () => {},
  });

  const resultado = await servicio(new Date());

  assert.equal(resultado.tenants, 2);
  assert.equal(resultado.revisados, 1);
  assert.deepEqual(historialesGuardados.map((h) => h.tenantId), ['tnt-2']);
});

test('vigilarCrecimientoFacturable: diasHastaCorte se resuelve desde fechaVencimiento del tenant (Timestamp o string) y es null si falta -- nunca lanza por eso', async () => {
  const { deps, alertasEnviadas } = crearDepsVigilancia({
    tenants: [{ id: 'tnt-1' }], // sin fechaVencimiento
    historiales: {
      'tnt-1': { historial: [{ fecha: '2026-07-30', facturables: 100 }], ultimaAlertaEnviada: null },
    },
    contarPorTenant: { 'tnt-1': 40 }, // caida a la mitad, pero diasHastaCorte es null -> S3 inerte
  });

  const servicio = crearServicioVigilarCrecimientoFacturable(deps);
  const resultado = await servicio(new Date('2026-07-31T07:00:00-05:00'));

  assert.equal(resultado.revisados, 1);
  assert.deepEqual(alertasEnviadas, []);
});
