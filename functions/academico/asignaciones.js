'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Estados terminales del modelo EstadoAsignacionAcademica (ver models/academico/asignacion.ts).
// Una vez alcanzados, publishAsignacion no debe revertirlos a 'publicada'.
const ESTADOS_TERMINALES = new Set(['cerrada', 'vencida']);

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

// Mismo criterio que puedeEditarJornada (MisClasesView.tsx) y que isAdmin() en
// firestore.rules: Admin/SuperAdmin operan cualquier jornada del tenant. Antes esta
// funcion no tenia ningun bypass de rol -- un Admin quedaba rechazado con el mismo
// mensaje que un maestro no asignado (bug real reportado, ver DT en bitacora.json).
function validarJornada({ tenantId, jornada, uid, rol }) {
  if (jornada.tenantId !== tenantId) {
    throw crearError('permission-denied', 'Tenant de jornada no autorizado');
  }
  const esAdmin = rol === 'Admin' || rol === 'SuperAdmin';
  if (!esAdmin && jornada.instructorId !== uid) {
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
    validarJornada({ tenantId, jornada, uid: auth.uid, rol: auth.token?.rol });

    const ahora = new Date().toISOString();
    const asignacionId = asignacion.id || `asignacion-${Date.now()}`;
    const asignacionRef = tenant.collection('asignaciones').doc(asignacionId);
    const asignacionExistente = await asignacionRef.get();
    const estadoExistente = asignacionExistente.exists ? asignacionExistente.data()?.estado : undefined;
    const estadoEsTerminal = ESTADOS_TERMINALES.has(estadoExistente);
    const payload = {
      ...asignacion,
      id: asignacionId,
      tenantId,
      jornadaId,
      recursoId: recurso.id || asignacion.recursoId,
      estado: estadoEsTerminal ? estadoExistente : 'publicada',
      creadoPorUid: auth.uid,
      creadoEn: asignacion.creadoEn || ahora,
      actualizadoEn: ahora,
    };

    await asignacionRef.set(payload);

    return {
      ok: true,
      asignacionId,
    };
  };
}

function crearServicioPublishAsignacionesBatch({ firestore }) {
  return async function publishAsignacionesBatch(data, context) {
    const auth = requireAuth(context);
    const tenantId = String(data?.tenantId || '').trim();
    const recursoIds = Array.isArray(data?.recursoIds) ? data.recursoIds : [];
    const jornadaIds = Array.isArray(data?.jornadaIds) ? data.jornadaIds : [];
    const asignacionBase = data?.asignacionBase || {};

    assertTenantAutorizado(tenantId, auth);

    if (!recursoIds.length || !jornadaIds.length) {
      throw crearError('invalid-argument', 'Se requiere al menos un recurso y una jornada');
    }

    const tenant = tenantRef(firestore, tenantId);
    const ahora = new Date().toISOString();
    const batch = firestore.batch();
    const created = [];
    const skipped = [];

    for (const recursoId of recursoIds) {
      for (const jornadaId of jornadaIds) {
        const asignacionId = `asignacion-${recursoId}-${jornadaId}`;

        let recurso;
        try {
          recurso = await obtenerDocumento(
            tenant.collection('recursos').doc(recursoId),
            'Recurso no encontrado'
          );
          validarAsignacionBase({ tenantId, asignacion: { ...asignacionBase, recursoId }, recurso });
        } catch {
          skipped.push({ recursoId, jornadaId, reason: 'recurso_no_aprobado' });
          continue;
        }

        let jornada;
        try {
          jornada = await obtenerDocumento(
            tenant.collection('jornadas').doc(jornadaId),
            'Jornada no encontrada'
          );
          validarJornada({ tenantId, jornada, uid: auth.uid, rol: auth.token?.rol });
        } catch {
          skipped.push({ recursoId, jornadaId, reason: 'jornada_no_encontrada' });
          continue;
        }

        const ref = tenant.collection('asignaciones').doc(asignacionId);
        const existente = await ref.get();
        if (existente.exists) {
          skipped.push({ recursoId, jornadaId, reason: 'duplicado' });
          continue;
        }

        batch.set(ref, {
          ...asignacionBase,
          id: asignacionId,
          tenantId,
          jornadaId,
          recursoId: recurso.id || recursoId,
          titulo: asignacionBase.titulo || recurso.tituloVisible || recurso.nombre,
          estado: 'publicada',
          creadoPorUid: auth.uid,
          creadoEn: ahora,
          actualizadoEn: ahora,
        });
        created.push(asignacionId);
      }
    }

    if (created.length) {
      await batch.commit();
    }

    return { ok: true, created, skipped };
  };
}

module.exports = {
  crearServicioPublishAsignacion,
  crearServicioPublishAsignacionesBatch,
};
