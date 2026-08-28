'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ERR-0017: reportarPagoEstudiante (servicios/pagosEstudiantesApi.ts) used to create the
// report with `addDoc(..., { comprobanteUrl: '' })` and only fill the real URL with a LATER
// `updateDoc`. Since this trigger fires on `onCreate` (the FIRST write, not the second), its
// guard below always saw an empty `comprobanteUrl` and silently returned -- the AI analysis
// never ran for a single real report (see servicios/pagosEstudiantesApi.test.ts for the fix:
// one `setDoc` that already carries the uploaded URL). This file locks in BOTH branches of
// the guard directly against the exported trigger (`.run()`, the same escape hatch
// firebase-functions-test uses under the hood) so the bug cannot silently come back -- no
// admin/axios/Gemini mocking needed: the guard short-circuits before any of those run, and
// the post-guard path only needs GEMINI_API_KEY absent to fail fast right after the FIRST
// `snap.ref.update`, which is exactly the call this test observes.

delete process.env.GEMINI_API_KEY;

const admin = require('firebase-admin');
const { analizarComprobanteEstudiante } = require('./index');

const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

const fakeSnap = (data) => {
  const calls = [];
  return {
    calls,
    snap: {
      data: () => data,
      ref: { update: async (patch) => { calls.push(patch); } },
    },
  };
};

// SDD notificaciones-pagos (D2 design.md): admin.firestore es un getter heredado del
// prototipo FirebaseNamespace, no una propiedad propia -- ni jest.mock ni node:test's
// mock.method lo pueden interceptar directamente ahí (`mock.method` exige una propiedad
// PROPIA). Object.defineProperty crea una propiedad propia en `admin` que ensombrece el
// getter heredado; `delete admin.firestore` restaura el getter original sin dejar estado.
const mockAdminFirestore = (impl) => {
  Object.defineProperty(admin, 'firestore', { value: impl, configurable: true, writable: true });
};
const restoreAdminFirestore = () => {
  delete admin.firestore;
};

// Ahora que el trigger escribe el aviso admin-facing con admin.firestore() ANTES del guard
// (D2/D6), CADA invocación de `.run()` -- incluidas las dos ya existentes arriba, que nunca
// necesitaron mockear nada -- toca admin.firestore(). Sin este default, un test que no
// mockea explícitamente dispara un intento de red real (falla lento, ~14s, contra la
// filosofía "zero external mocks" de este archivo). Los tests que necesitan observar/alterar
// la escritura llaman mockAdminFirestore(...) de nuevo dentro de su propio cuerpo para
// pisar este default.
test.beforeEach(() => {
  mockAdminFirestore(() => ({ collection: () => ({ add: async () => {} }) }));
});
test.afterEach(() => {
  restoreAdminFirestore();
});

test('ERR-0017 regression comment documents the guard next to comprobanteUrl in index.js', () => {
  assert.match(source, /ERR-0017[\s\S]{0,600}if \(!data\.comprobanteUrl\)/);
});

test('el guard NO analiza cuando comprobanteUrl llega vacío (forma pre-fix, nunca debe volver)', async () => {
  const { snap, calls } = fakeSnap({
    tenantId: 't1', estudianteId: 'est-1', estudianteNombre: 'Ana', montoInformado: 100, comprobanteUrl: '',
  });

  const resultado = await analizarComprobanteEstudiante.run(snap, { params: { reporteId: 'rep-empty' } });

  assert.equal(resultado, null);
  assert.deepEqual(calls, []);
});

test('el guard SÍ dispara el análisis cuando comprobanteUrl ya viene poblado desde la creación (forma post-fix)', async () => {
  const { snap, calls } = fakeSnap({
    tenantId: 't1', estudianteId: 'est-1', estudianteNombre: 'Ana', montoInformado: 100,
    comprobanteUrl: 'https://storage.example.com/tenants/t1/comprobantes/rep-1.png',
  });

  await analizarComprobanteEstudiante.run(snap, { params: { reporteId: 'rep-1' } });

  assert.deepEqual(calls[0], { estado: 'Analizando' });
});

// SDD notificaciones-pagos (D2/D6 design.md): el aviso admin-facing se escribe ANTES del
// guard de comprobanteUrl -- el staff debe enterarse de TODO reporte creado, incluso uno
// que el guard descarte por falta de URL (rama que ya casi no ocurre tras ERR-0017, pero el
// trigger no puede asumirlo).
test('escribe la notificación admin-facing en historialNotificaciones ANTES del guard, aunque este bloquee el análisis', async (t) => {
  const addCalls = [];
  mockAdminFirestore(() => ({
    collection: (name) => {
      assert.equal(name, 'historialNotificaciones');
      return { add: async (doc) => { addCalls.push(doc); } };
    },
  }));

  const { snap } = fakeSnap({
    tenantId: 't1', estudianteId: 'est-1', estudianteNombre: 'Ana Pérez', montoInformado: 150000,
    comprobanteUrl: '',
  });

  const resultado = await analizarComprobanteEstudiante.run(snap, { params: { reporteId: 'rep-empty' } });

  assert.equal(resultado, null);
  assert.equal(addCalls.length, 1);
  assert.deepEqual(addCalls[0], {
    tenantId: 't1',
    estudianteId: '__admin__',
    estudianteNombre: 'Ana Pérez',
    tutorNombre: '',
    destinatario: '',
    canal: 'InApp',
    tipo: 'ComprobantePagoAdmin',
    mensaje: addCalls[0].mensaje,
    leida: false,
    fecha: addCalls[0].fecha,
  });
  assert.match(addCalls[0].mensaje, /Ana Pérez/);
  assert.match(addCalls[0].mensaje, /150.000|150000/);
});

test('la notificación admin-facing también se escribe cuando el guard SÍ deja pasar el análisis', async (t) => {
  const addCalls = [];
  mockAdminFirestore(() => ({
    collection: () => ({ add: async (doc) => { addCalls.push(doc); } }),
  }));

  const { snap } = fakeSnap({
    tenantId: 't1', estudianteId: 'est-1', estudianteNombre: 'Ana', montoInformado: 100,
    comprobanteUrl: 'https://storage.example.com/tenants/t1/comprobantes/rep-1.png',
  });

  await analizarComprobanteEstudiante.run(snap, { params: { reporteId: 'rep-1' } });

  assert.equal(addCalls.length, 1);
  assert.equal(addCalls[0].tipo, 'ComprobantePagoAdmin');
  assert.equal(addCalls[0].estudianteId, '__admin__');
});

// D4 (fault tolerance, mismo criterio que notificarAvance en index.js): un fallo al escribir
// el aviso admin-facing no debe tumbar el resto del trigger (el guard/análisis IA sigue
// corriendo con normalidad).
test('un fallo al escribir la notificación admin-facing no interrumpe el resto del trigger', async (t) => {
  mockAdminFirestore(() => ({
    collection: () => ({ add: async () => { throw new Error('permission-denied'); } }),
  }));

  const { snap, calls } = fakeSnap({
    tenantId: 't1', estudianteId: 'est-1', estudianteNombre: 'Ana', montoInformado: 100,
    comprobanteUrl: '',
  });

  const resultado = await analizarComprobanteEstudiante.run(snap, { params: { reporteId: 'rep-empty' } });

  assert.equal(resultado, null);
  assert.deepEqual(calls, []);
});

test('ERR-0017/D2 regression comment documents the sentinel write above the guard', () => {
  const posSentinel = source.indexOf("'__admin__'");
  const posGuard = source.indexOf('if (!data.comprobanteUrl)');
  assert.notEqual(posSentinel, -1, "sentinel '__admin__' literal not found in index.js");
  assert.notEqual(posGuard, -1, 'comprobanteUrl guard not found in index.js');
  assert.ok(posSentinel < posGuard, 'the admin-facing sentinel write must be placed ABOVE the comprobanteUrl guard');
});
