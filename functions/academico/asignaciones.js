'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }

  return context.auth;
}

function assertTenantAutorizado(tenantId, auth) {
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

function tenantRef(firestore, tenantId) {
  return firestore.collection('tenants').doc(tenantId);
}

async function obtenerDocumento(ref, mensaje) {
  const snap = await ref.get();
  if (!snap.exists) {
    throw crearError('not-found', mensaje);
  }
  return snap.data();
}

function validarAsignacionBase({ tenantId, asignacion, recurso }) {
  if (!asignacion?.recursoId) {
    throw crearError('invalid-argument', 'La asignacion debe incluir recursoId');
  }
  if (asignacion.tenantId && asignacion.tenantId !== tenantId) {
    throw crearError('permission-denied', 'Tenant de asignacion no autorizado');
  }
  if (recurso.tenantId !== tenantId) {
    throw crearError('permission-denied', 'Tenant del recurso no autorizado');
  }
  if (recurso.estado !== 'aprobado') {
    throw crearError('failed-precondition', 'La asignacion requiere un recurso aprobado');
  }
}

function validarJornada({ tenantId, jornada, uid }) {
  if (jornada.tenantId !== tenantId) {
    throw crearError('permission-denied', 'Tenant de jornada no autorizado');
  }
  if (jornada.instructorId !== uid) {
    throw crearError('permission-denied', 'Solo el maestro asignado a la jornada puede publicar la asignacion');
  }
}

function crearServicioPublishAsignacion({ firestore }) {
  return async function publishAsignacion(data, context) {
    const auth = requireAuth(context);
    const tenantId = String(data?.tenantId || '').trim();
    const jornadaId = String(data?.jornadaId || '').trim();
    const asignacion = data?.asignacion || {};

    assertTenantAutorizado(tenantId, auth);

    if (!jornadaId) {
      throw crearError('invalid-argument', 'La jornada es obligatoria');
    }

    const tenant = tenantRef(firestore, tenantId);
    const recurso = await obtenerDocumento(
      tenant.collection('recursos').doc(asignacion.recursoId),
      'Recurso no encontrado'
    );
    const jornada = await obtenerDocumento(
      tenant.collection('jornadas').doc(jornadaId),
      'Jornada no encontrada'
    );

    validarAsignacionBase({ tenantId, asignacion, recurso });
    validarJornada({ tenantId, jornada, uid: auth.uid });

    const ahora = new Date().toISOString();
    const asignacionId = asignacion.id || `asignacion-${Date.now()}`;
    const payload = {
      ...asignacion,
      id: asignacionId,
      tenantId,
      jornadaId,
      recursoId: recurso.id || asignacion.recursoId,
      estado: 'publicada',
      creadoPorUid: auth.uid,
      creadoEn: asignacion.creadoEn || ahora,
      actualizadoEn: ahora,
    };

    await tenant.collection('asignaciones').doc(asignacionId).set(payload);

    return {
      ok: true,
      asignacionId,
    };
  };
}

module.exports = {
  crearServicioPublishAsignacion,
};
