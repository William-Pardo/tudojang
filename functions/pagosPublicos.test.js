const test = require('node:test');
const assert = require('node:assert/strict');
const {
  crearServicioResolverEstudiantePublico,
  crearServicioReportarPagoPublico,
} = require('./pagosPublicos');

// Fake minimo de Firestore: solo `estudiantes` (get por id) y `reportes_pagos_estudiantes`
// (doc() + set()). Mismo estilo que crearFirestoreFake en academico/capacidad.test.js.
function crearFirestoreFake({ estudiantes = {} } = {}) {
  const datosEstudiantes = new Map(Object.entries(estudiantes));
  const reportesCreados = [];
  let contadorId = 0;

  return {
    collection: (nombre) => {
      if (nombre === 'estudiantes') {
        return {
          doc: (id) => ({
            get: async () => ({
              exists: datosEstudiantes.has(id),
              id,
              data: () => ({ ...datosEstudiantes.get(id) }),
            }),
          }),
        };
      }
      if (nombre === 'reportes_pagos_estudiantes') {
        return {
          doc: () => {
            const id = `rep-generado-${++contadorId}`;
            return {
              id,
              set: async (data) => {
                reportesCreados.push({ id, ...data });
              },
            };
          },
        };
      }
      throw new Error(`Coleccion no mockeada: ${nombre}`);
    },
    _reportesCreados: reportesCreados,
  };
}

// Fake minimo de Storage (Admin SDK): solo bucket().file(path).save(...) + bucket().name.
function crearStorageFake() {
  const archivosSubidos = [];
  return {
    bucket: () => ({
      name: 'demo-bucket',
      file: (path) => ({
        save: async (buffer, opciones) => {
          archivosSubidos.push({ path, buffer, opciones });
        },
      }),
    }),
    _archivosSubidos: archivosSubidos,
  };
}

const IMAGEN_BASE64_VALIDA = 'data:image/png;base64,iVBORw0KGgo=';

// ─── resolverEstudiantePublico ─────────────────────────────────────────────

test('resolverEstudiantePublico: devuelve solo nombres/apellidos/saldoDeudor de un estudiante existente del tenant', async () => {
  const servicio = crearServicioResolverEstudiantePublico({
    firestore: crearFirestoreFake({
      estudiantes: {
        'est-1': {
          tenantId: 'tenant-1', nombres: 'Ana', apellidos: 'García', saldoDeudor: 50000,
          // Campos NO publicos -- no deben salir nunca de esta funcion.
          tutor: { correo: 'papa@test.com', numeroIdentificacion: '123' },
          historialPagos: [{ monto: 40000 }],
          correo: 'ana@test.com',
        },
      },
    }),
  });

  const resultado = await servicio({ estudianteId: 'est-1', tenantId: 'tenant-1' });

  assert.deepEqual(resultado, { id: 'est-1', nombres: 'Ana', apellidos: 'García', saldoDeudor: 50000 });
  assert.equal('tutor' in resultado, false);
  assert.equal('historialPagos' in resultado, false);
  assert.equal('correo' in resultado, false);
});

test('resolverEstudiantePublico: devuelve null si el estudiante no existe', async () => {
  const servicio = crearServicioResolverEstudiantePublico({
    firestore: crearFirestoreFake({ estudiantes: {} }),
  });

  const resultado = await servicio({ estudianteId: 'no-existe', tenantId: 'tenant-1' });

  assert.equal(resultado, null);
});

test('resolverEstudiantePublico: devuelve null si el estudiante existe pero es de OTRO tenant (no filtra por tenant en el query, filtra en memoria)', async () => {
  const servicio = crearServicioResolverEstudiantePublico({
    firestore: crearFirestoreFake({
      estudiantes: { 'est-ajeno': { tenantId: 'tenant-2', nombres: 'Otro', apellidos: 'Ajeno', saldoDeudor: 10000 } },
    }),
  });

  const resultado = await servicio({ estudianteId: 'est-ajeno', tenantId: 'tenant-1' });

  assert.equal(resultado, null);
});

test('resolverEstudiantePublico: rechaza si falta estudianteId o tenantId', async () => {
  const servicio = crearServicioResolverEstudiantePublico({
    firestore: crearFirestoreFake({ estudiantes: {} }),
  });

  await assert.rejects(() => servicio({ tenantId: 'tenant-1' }), (error) => {
    assert.equal(error.code, 'invalid-argument');
    return true;
  });
  await assert.rejects(() => servicio({ estudianteId: 'est-1' }), (error) => {
    assert.equal(error.code, 'invalid-argument');
    return true;
  });
});

test('resolverEstudiantePublico: no requiere auth -- funciona sin `context`', async () => {
  const servicio = crearServicioResolverEstudiantePublico({
    firestore: crearFirestoreFake({
      estudiantes: { 'est-1': { tenantId: 'tenant-1', nombres: 'Ana', apellidos: 'García', saldoDeudor: 0 } },
    }),
  });

  const resultado = await servicio({ estudianteId: 'est-1', tenantId: 'tenant-1' }, undefined);

  assert.equal(resultado.id, 'est-1');
});

// ─── reportarPagoPublico ────────────────────────────────────────────────────

test('reportarPagoPublico: sube el comprobante a Storage y crea el reporte Pendiente', async () => {
  const firestore = crearFirestoreFake({
    estudiantes: { 'est-1': { tenantId: 'tenant-1', nombres: 'Ana', apellidos: 'García', saldoDeudor: 50000 } },
  });
  const storage = crearStorageFake();
  const servicio = crearServicioReportarPagoPublico({ firestore, storage });

  const resultado = await servicio({
    estudianteId: 'est-1', tenantId: 'tenant-1', monto: 50000, imagenBase64: IMAGEN_BASE64_VALIDA,
  });

  assert.equal(storage._archivosSubidos.length, 1);
  assert.match(storage._archivosSubidos[0].path, /^tenants\/tenant-1\/comprobantes\//);
  assert.equal(storage._archivosSubidos[0].opciones.metadata.contentType, 'image/png');

  assert.equal(firestore._reportesCreados.length, 1);
  const reporte = firestore._reportesCreados[0];
  assert.equal(reporte.id, resultado.reporteId);
  assert.equal(reporte.tenantId, 'tenant-1');
  assert.equal(reporte.estudianteId, 'est-1');
  assert.equal(reporte.estudianteNombre, 'Ana García');
  assert.equal(reporte.montoInformado, 50000);
  assert.equal(reporte.estado, 'Pendiente');
  assert.match(reporte.comprobanteUrl, /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/demo-bucket\/o\//);
  assert.match(reporte.comprobanteUrl, /token=/);
});

test('reportarPagoPublico: rechaza si el estudiante no existe o no pertenece al tenant', async () => {
  const servicio = crearServicioReportarPagoPublico({
    firestore: crearFirestoreFake({ estudiantes: {} }),
    storage: crearStorageFake(),
  });

  await assert.rejects(
    () => servicio({ estudianteId: 'no-existe', tenantId: 'tenant-1', monto: 100, imagenBase64: IMAGEN_BASE64_VALIDA }),
    (error) => { assert.equal(error.code, 'not-found'); return true; }
  );
});

test('reportarPagoPublico: rechaza un monto invalido (cero, negativo, no numerico) sin tocar Storage ni Firestore', async () => {
  const storage = crearStorageFake();
  const firestore = crearFirestoreFake({
    estudiantes: { 'est-1': { tenantId: 'tenant-1', nombres: 'Ana', apellidos: 'García' } },
  });
  const servicio = crearServicioReportarPagoPublico({ firestore, storage });

  for (const montoInvalido of [0, -100, NaN, '100', undefined]) {
    await assert.rejects(
      () => servicio({ estudianteId: 'est-1', tenantId: 'tenant-1', monto: montoInvalido, imagenBase64: IMAGEN_BASE64_VALIDA }),
      (error) => { assert.equal(error.code, 'invalid-argument'); return true; },
      `monto ${String(montoInvalido)} deberia rechazarse`
    );
  }
  assert.equal(storage._archivosSubidos.length, 0);
  assert.equal(firestore._reportesCreados.length, 0);
});

test('reportarPagoPublico: rechaza un comprobante que no es una data URL de imagen válida', async () => {
  const servicio = crearServicioReportarPagoPublico({
    firestore: crearFirestoreFake({
      estudiantes: { 'est-1': { tenantId: 'tenant-1', nombres: 'Ana', apellidos: 'García' } },
    }),
    storage: crearStorageFake(),
  });

  for (const imagenInvalida of [undefined, '', 'no-es-una-data-url', 'data:text/plain;base64,abc']) {
    await assert.rejects(
      () => servicio({ estudianteId: 'est-1', tenantId: 'tenant-1', monto: 100, imagenBase64: imagenInvalida }),
      (error) => { assert.equal(error.code, 'invalid-argument'); return true; }
    );
  }
});

test('reportarPagoPublico: no requiere auth -- funciona sin `context`', async () => {
  const servicio = crearServicioReportarPagoPublico({
    firestore: crearFirestoreFake({
      estudiantes: { 'est-1': { tenantId: 'tenant-1', nombres: 'Ana', apellidos: 'García' } },
    }),
    storage: crearStorageFake(),
  });

  const resultado = await servicio(
    { estudianteId: 'est-1', tenantId: 'tenant-1', monto: 100, imagenBase64: IMAGEN_BASE64_VALIDA },
    undefined
  );

  assert.ok(resultado.reporteId);
});
