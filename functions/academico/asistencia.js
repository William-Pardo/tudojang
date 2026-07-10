// functions/academico/asistencia.js
// Callable `registrarAsistenciaJornada`: toggle server-side de check-in/check-out
// por estudiante sobre una JornadaInstruccion en curso (ver design.md, Decisión 1-4).

'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Mismo conjunto de roles que `isInstructor()` en firestore.rules (Admin, Editor,
// Asistente, SuperAdmin) — Estudiante/Tutor MUST NOT escanear (spec: "Validación
// de rol autorizado").
const ROLES_AUTORIZADOS = new Set(['Admin', 'Editor', 'Asistente', 'SuperAdmin']);

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

function assertRolAutorizado(auth) {
  const rol = auth.token?.rol;
  if (!ROLES_AUTORIZADOS.has(rol)) {
    throw crearError('permission-denied', 'Rol no autorizado para registrar asistencia');
  }
}

function assertTenantAutorizado(tenantId, auth) {
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

// "Un maestro solo puede operar clases donde esté asignado" (Módulo Clase en
// Vivo.txt §12). `Editor` es el rol que cumple la función de "maestro" en
// este dominio (design.md, Bloque B, "Roles y permisos"; no existe un valor
// de enum `Maestro` separado). Admin/Asistente/SuperAdmin sí pueden operar
// cualquier jornada del tenant — mismo alcance que ya les da `isInstructor()`
// para roster/asistencias en firestore.rules. Mismo patrón ya establecido en
// `validarJornada` de asignaciones.js:50-57 ("Solo el maestro asignado a la
// jornada puede publicar la asignacion").
function assertInstructorAsignado(jornada, auth) {
  if (auth.token?.rol === 'Editor' && jornada.instructorId !== auth.uid) {
    throw crearError(
      'permission-denied',
      'Solo el maestro asignado a la jornada puede registrar asistencia'
    );
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

function crearServicioRegistrarAsistencia({ firestore }) {
  return async function registrarAsistenciaJornada(data, context) {
    const auth = requireAuth(context);
    assertRolAutorizado(auth);

    const tenantId = String(data?.tenantId || '').trim();
    const jornadaId = String(data?.jornadaId || '').trim();
    const estudianteId = String(data?.estudianteId || '').trim();

    assertTenantAutorizado(tenantId, auth);

    if (!jornadaId || !estudianteId) {
      throw crearError('invalid-argument', 'jornadaId y estudianteId son obligatorios');
    }

    const tenant = tenantRef(firestore, tenantId);
    const jornada = await obtenerDocumento(
      tenant.collection('jornadas').doc(jornadaId),
      'Jornada no encontrada'
    );

    if (jornada.tenantId !== tenantId) {
      throw crearError('permission-denied', 'Tenant de jornada no autorizado');
    }

    if (jornada.estado !== 'en_curso') {
      throw crearError('failed-precondition', 'La jornada no esta en curso');
    }

    assertInstructorAsignado(jornada, auth);

    // Pertenencia via roster explicito (design.md, Decision 4): exists() sobre
    // la inscripcion, nunca inferencia por grado/grupo. Fail-closed: una
    // ejecucion sin roster matriculado rechaza a todos los estudiantes.
    const inscripcionSnap = await tenant
      .collection('ejecucionesPrograma')
      .doc(jornada.ejecucionProgramaId)
      .collection('inscripciones')
      .doc(estudianteId)
      .get();

    if (!inscripcionSnap.exists) {
      throw crearError(
        'permission-denied',
        'El estudiante no esta matriculado en la ejecucion de esta jornada'
      );
    }

    // Toggle server-side (design.md, Decision 2): 1er escaneo = check-in,
    // 2do = check-out, 3ro se rechaza (ya quedo completa la asistencia).
    const asistenciaRef = tenant
      .collection('jornadas')
      .doc(jornadaId)
      .collection('asistencias')
      .doc(estudianteId);

    const asistenciaSnap = await asistenciaRef.get();
    const ahora = new Date().toISOString();

    if (!asistenciaSnap.exists) {
      const registro = { estudianteId, horaEntrada: ahora };
      await asistenciaRef.set(registro);
      return { ok: true, tipo: 'entrada', hora: ahora };
    }

    const registroExistente = asistenciaSnap.data();

    if (registroExistente.horaSalida) {
      throw crearError(
        'failed-precondition',
        'La asistencia de este estudiante ya quedo completa (entrada y salida registradas)'
      );
    }

    const minutosAsistidos = calcularMinutosAsistidos(registroExistente.horaEntrada, ahora);

    await asistenciaRef.set({ horaSalida: ahora, minutosAsistidos }, { merge: true });

    return { ok: true, tipo: 'salida', hora: ahora, minutosAsistidos };
  };
}

function calcularMinutosAsistidos(horaEntradaIso, horaSalidaIso) {
  const inicio = new Date(horaEntradaIso).getTime();
  const fin = new Date(horaSalidaIso).getTime();
  return Math.max(0, Math.round((fin - inicio) / 60000));
}

module.exports = {
  crearServicioRegistrarAsistencia,
};
