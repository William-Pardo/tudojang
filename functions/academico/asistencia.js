// functions/academico/asistencia.js
// Callable `registrarAsistenciaJornada`: toggle server-side de check-in/check-out
// por estudiante sobre una JornadaInstruccion en curso (ver design.md, Decisión 1-4).

'use strict';

const { tieneHorario, estaEnVentana, calcularRetraso } = require('./ventanaClaseEnVivo');

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Mismo conjunto de roles que `isInstructor()` en firestore.rules (Admin, Editor,
// Asistente, Maestro, SuperAdmin) — Estudiante/Tutor MUST NOT escanear (spec:
// "Validación de rol autorizado"). 'Maestro' agregado: es el rol docente real
// (14.9), este set nunca se actualizo cuando se separo de 'Editor' y bloqueaba a
// un maestro real de registrar asistencia de su propia jornada.
const ROLES_AUTORIZADOS = new Set(['Admin', 'Editor', 'Asistente', 'Maestro', 'SuperAdmin']);

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
// Vivo.txt §12). `Editor` y `Maestro` son los roles docentes en este dominio
// (14.9: 'Maestro' es el rol docente real, 'Editor' quedo como "Editor/Secretaria"
// pero conserva acceso operativo legacy) — a ambos se les exige ser el instructor
// asignado. Admin/Asistente/SuperAdmin sí pueden operar cualquier jornada del
// tenant — mismo alcance que ya les da `isInstructor()` para roster/asistencias en
// firestore.rules. Mismo patrón ya establecido en `validarJornada` de
// asignaciones.js:50-62 ("Solo el maestro asignado a la jornada puede publicar la
// asignacion").
const ROLES_RESTRINGIDOS_A_JORNADA_PROPIA = new Set(['Editor', 'Maestro']);

function assertInstructorAsignado(jornada, auth) {
  if (ROLES_RESTRINGIDOS_A_JORNADA_PROPIA.has(auth.token?.rol) && jornada.instructorId !== auth.uid) {
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

// Misma slugificacion que produce EjecucionPrograma.grupoId en produccion
// (vistas/admin/AsignacionesView.tsx: slugificar = valor => valor.toLowerCase()
// .replace(/[^a-z0-9]+/g, '-')). NO es la misma funcion que grupoId() de
// jornadaContextService.ts (esa antepone "grupo-" y es solo para armar options
// de un <select>, sin relacion con EjecucionPrograma.grupoId real).
const grupoASlug = (grupo) => String(grupo).toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Matricula automatica (decision de arquitectura 2026-07-11, reemplaza el
// roster 100% manual/fail-closed de Fase 0 — ver engram
// centro-estudios/matricula-automatica). Un registro EXPLICITO de inscripcion
// siempre manda: 'retirada' es una excepcion (excluye aunque coincida todo),
// 'activa' es una inclusion manual (incluye aunque NO coincida nada, ej. clase
// de prueba). Sin registro explicito, pertenece automaticamente si el
// estudiante esta en el mismo grupo+sede que la ejecucion, su pago no esta
// Vencido, y su grado no esta en gradosExcluidos de ESTA jornada puntual
// (permite armar clases especificas para ciertos grados).
async function perteneceAEjecucion({ firestore, tenant, tenantId, jornada, estudianteId }) {
  const inscripcionSnap = await tenant
    .collection('ejecucionesPrograma')
    .doc(jornada.ejecucionProgramaId)
    .collection('inscripciones')
    .doc(estudianteId)
    .get();

  if (inscripcionSnap.exists) {
    return inscripcionSnap.data().estado === 'activa';
  }

  const estudianteSnap = await firestore.collection('estudiantes').doc(estudianteId).get();
  if (!estudianteSnap.exists) return false;
  const estudiante = estudianteSnap.data();

  if (estudiante.tenantId !== tenantId) return false;
  if (estudiante.estadoPago === 'Vencido') return false;
  if (jornada.gradosExcluidos?.includes(estudiante.grado)) return false;

  const ejecucionSnap = await tenant.collection('ejecucionesPrograma').doc(jornada.ejecucionProgramaId).get();
  if (!ejecucionSnap.exists) return false;
  const ejecucion = ejecucionSnap.data();

  return grupoASlug(estudiante.grupo) === ejecucion.grupoId && estudiante.sedeId === ejecucion.sedeId;
}

// `ahora` inyectable (default: reloj real) para poder probar la ventana horaria de forma
// determinista sin depender de la hora en que corre el test.
function crearServicioRegistrarAsistencia({ firestore, ahora = () => new Date() }) {
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

    const pertenece = await perteneceAEjecucion({ firestore, tenant, tenantId, jornada, estudianteId });
    if (!pertenece) {
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
    const ahoraDate = ahora();
    const ahoraIso = ahoraDate.toISOString();

    if (!asistenciaSnap.exists) {
      // Guarda de ventana horaria (brecha 4-bis-C) — SOLO en la ENTRADA (primer escaneo).
      // La brecha es EMPEZAR asistencia fuera de la clase (una jornada que quedo en_curso sin
      // cerrar es escaneable por URL directa dias despues). No se guarda la SALIDA: ya requiere
      // una entrada previa valida, y un check-out un poco tarde no debe perder el dato.
      // Si la jornada no tiene horario (doc malformado / fixture viejo) no se evalua ventana:
      // una JornadaInstruccion real siempre lo tiene.
      if (tieneHorario(jornada) && !estaEnVentana(jornada, ahoraDate).dentro) {
        throw crearError(
          'failed-precondition',
          'Fuera de la ventana horaria de la clase: solo se puede registrar la entrada durante el horario de la jornada (±15 min)'
        );
      }

      // Puntualidad (WS-1, §6) + auditoria de quien escaneo (§12). Sin horario no hay contra
      // que medir el retraso -> se asume a tiempo.
      const { isLate, minutesLate } = tieneHorario(jornada)
        ? calcularRetraso(jornada, ahoraDate)
        : { isLate: false, minutesLate: 0 };

      const registro = {
        estudianteId,
        horaEntrada: ahoraIso,
        checkedInBy: auth.uid,
        isLate,
        minutesLate,
      };
      await asistenciaRef.set(registro);
      return { ok: true, tipo: 'entrada', hora: ahoraIso, isLate, minutesLate };
    }

    const registroExistente = asistenciaSnap.data();

    if (registroExistente.horaSalida) {
      throw crearError(
        'failed-precondition',
        'La asistencia de este estudiante ya quedo completa (entrada y salida registradas)'
      );
    }

    const minutosAsistidos = calcularMinutosAsistidos(registroExistente.horaEntrada, ahoraIso);

    await asistenciaRef.set(
      { horaSalida: ahoraIso, minutosAsistidos, checkedOutBy: auth.uid },
      { merge: true }
    );

    return { ok: true, tipo: 'salida', hora: ahoraIso, minutosAsistidos };
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
