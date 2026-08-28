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
