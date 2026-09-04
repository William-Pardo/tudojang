// functions/pagosPublicos.js
// Callables publicos (SIN auth) para el flujo de reporte de pago via link de WhatsApp
// (vistas/ReportarPagoPublico.tsx, generado por servicios/geminiService.ts). El tutor que
// recibe el recordatorio de pago puede NO tener cuenta -- crearEstudiante nunca crea una
// cuenta de Usuario para el tutor, eso requiere una invitacion aparte que el Admin debe
// enviar y el tutor aceptar (functions/academico/invitaciones.js).
//
// Bug real (2026-09-02): el flujo publico estaba roto en 2 lugares. (1)
// obtenerEstudiantePorNumIdentificacion (servicios/estudiantesApi.ts) hacia un
// where('numeroIdentificacion', '==', X) SIN auth sobre TODA la coleccion `estudiantes` --
// firestore.rules siempre exige authenticated() para leer esa coleccion (confirmado contra
// el emulador real, ver los tests INVESTIGACION en
// functions/test/firestore-rules.behavior.test.js), asi que la query SIEMPRE fallaba con
// permission-denied, tanto sin login como logueado como el propio tutor (el query no
// filtraba por tutor.correo, asi que Firestore no podia probar la regla contra el resultado
// potencial). (2) subir el comprobante a Storage (servicios/pagosEstudiantesApi.ts,
// storage.rules) exige el mismo `perteneceAlTenant` (custom claim de tenant), que tambien
// requiere auth. Nunca se detecto porque los 2 tests de UI existentes
// (vistas/ReportarPagoPublico.test.tsx) mockean ambas llamadas directamente, sin ejercitar
// las reglas reales.
//
// Fix: mismo criterio ya usado en academico/tenantPublico.js (resolverTenantPublico) --
// Admin SDK (bypasea las reglas) + proyeccion explicita de SOLO los campos que la pagina
// publica necesita mostrar, nunca el documento completo de `estudiantes` (que trae datos del
// tutor, historial de pagos, progreso academico). El link de WhatsApp ahora usa el ID REAL
// del documento de Firestore (opaco, no enumerable) en vez del numero de identificacion del
// estudiante (dato no secreto) -- mismo patron "link como capability" que ya usa Mision KICHO
// en este repo (ver firestore.rules, match /misiones_kicho/{misionId}).

'use strict';

const { randomUUID } = require('node:crypto');

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Campos que ReportarPagoPublico.tsx realmente muestra (nombre + saldo a pagar). Cualquier
// campo no listado aca (tutor, historialPagos, progreso, etc.) nunca sale de esta funcion.
const CAMPOS_PUBLICOS_ESTUDIANTE = ['nombres', 'apellidos', 'saldoDeudor'];

function proyectarCamposPublicos(id, data) {
  const proyeccion = { id };
  for (const campo of CAMPOS_PUBLICOS_ESTUDIANTE) {
    if (data[campo] !== undefined) {
      proyeccion[campo] = data[campo];
    }
  }
  return proyeccion;
}

async function obtenerEstudianteDelTenant(firestore, estudianteId, tenantId) {
  const snap = await firestore.collection('estudiantes').doc(estudianteId).get();
  if (!snap.exists || snap.data().tenantId !== tenantId) return null;
  return snap;
}

/**
 * Resuelve un estudiante por su ID de documento (opaco) para la pagina publica de reporte de
 * pago, sin autenticacion. Retorna `null` si no existe o no pertenece al tenant -- mismo
 * contrato "no distingue not-found de invalido" que resolverTenantPublico, para que el
 * cliente no necesite manejar un caso de error aparte.
 */
function crearServicioResolverEstudiantePublico({ firestore }) {
  return async function resolverEstudiantePublico(data) {
    const estudianteId = String(data?.estudianteId || '').trim();
    const tenantId = String(data?.tenantId || '').trim();
    if (!estudianteId || !tenantId) {
      throw crearError('invalid-argument', 'Falta estudianteId o tenantId');
    }

    const snap = await obtenerEstudianteDelTenant(firestore, estudianteId, tenantId);
    if (!snap) return null;

    return proyectarCamposPublicos(snap.id, snap.data());
  };
}

/**
 * Reporta un pago desde el link publico (sin autenticacion): sube el comprobante a Storage y
 * crea el reporte en `reportes_pagos_estudiantes` con estado Pendiente -- mismo resultado que
 * el camino autenticado (servicios/pagosEstudiantesApi.ts::reportarPagoEstudiante), pero
 * corrido server-side porque ni Storage ni Firestore permiten esta escritura sin login. El
 * link de descarga se arma con el mismo mecanismo de "download token" que usa el SDK cliente
 * (getDownloadURL) -- no requiere abrir storage.rules a lectura publica.
 */
function crearServicioReportarPagoPublico({ firestore, storage }) {
  return async function reportarPagoPublico(data) {
    const estudianteId = String(data?.estudianteId || '').trim();
    const tenantId = String(data?.tenantId || '').trim();
    const monto = data?.monto;
    const imagenBase64 = data?.imagenBase64;

    if (!estudianteId || !tenantId) {
      throw crearError('invalid-argument', 'Falta estudianteId o tenantId');
    }
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0) {
      throw crearError('invalid-argument', 'El monto informado no es válido');
    }
    const match = typeof imagenBase64 === 'string'
      ? /^data:(image\/[^;]+);base64,(.+)$/.exec(imagenBase64)
      : null;
    if (!match) {
      throw crearError('invalid-argument', 'Falta un comprobante de imagen válido');
    }

    const estudianteSnap = await obtenerEstudianteDelTenant(firestore, estudianteId, tenantId);
    if (!estudianteSnap) {
      throw crearError('not-found', 'No se encontró el estudiante');
    }
    const estudianteData = estudianteSnap.data();

    const docRef = firestore.collection('reportes_pagos_estudiantes').doc();

    const [, contentType, base64Data] = match;
    const filePath = `tenants/${tenantId}/comprobantes/${docRef.id}_${Date.now()}`;
    const downloadToken = randomUUID();
    const bucket = storage.bucket();
    await bucket.file(filePath).save(Buffer.from(base64Data, 'base64'), {
      metadata: {
        contentType,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });
    const comprobanteUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/`
      + `${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

    await docRef.set({
      tenantId,
      estudianteId,
      estudianteNombre: `${estudianteData.nombres} ${estudianteData.apellidos}`,
      montoInformado: monto,
      fechaReporte: new Date().toISOString(),
      comprobanteUrl,
      estado: 'Pendiente',
    });

    return { reporteId: docRef.id };
  };
}

module.exports = {
  crearServicioResolverEstudiantePublico,
  crearServicioReportarPagoPublico,
};
