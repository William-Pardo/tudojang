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

    // WS-2 (§7/§11): acumular horas reales por estudiante. Se hace SOLO en el check-out (cuando
    // ya se conoce la duracion) y una unica vez por clase (un 3er escaneo se rechazo arriba).
    // Read-modify-write en vez de increment() para no depender de FieldValue en los fakes.
    await acumularMetricasAsistencia({ tenant, tenantId, estudianteId, minutosAsistidos, ahora: ahoraIso });

    // WS-3a (§8): si el estudiante se va en RUTA DE BUS, el check-out ES el "salio en el bus"
    // -> avisar al acudiente. Los de modo `recogida` NO se notifican aca (se les avisa antes
    // de terminar la clase, cron horaFin-15, WS-3b). Mejor esfuerzo: si el aviso falla, el
    // check-out NO falla (el aviso se puede reintentar); se deja el estado en la asistencia.
    const notificationStatus = await notificarSalidaRutaBus({
      firestore, tenant, tenantId, jornada, jornadaId, estudianteId, ahora: ahoraIso,
    });
    if (notificationStatus) {
      await asistenciaRef.set({ notificationStatus }, { merge: true });
    }

    return { ok: true, tipo: 'salida', hora: ahoraIso, minutosAsistidos, notificationStatus };
  };
}

function calcularMinutosAsistidos(horaEntradaIso, horaSalidaIso) {
  const inicio = new Date(horaEntradaIso).getTime();
  const fin = new Date(horaSalidaIso).getTime();
  return Math.max(0, Math.round((fin - inicio) / 60000));
}

const ZONA_HORARIA_CLUB = 'America/Bogota';

// Hora local del club (HH:MM) a partir de un ISO, para el mensaje al acudiente.
function horaLocalClub(iso) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA_HORARIA_CLUB, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

/**
 * Notifica al acudiente que el estudiante de RUTA DE BUS salio (el check-out = subio al bus).
 * Devuelve el `notificationStatus` a guardar en la asistencia, o `null` si no aplica (modo
 * `recogida` / default). NO lanza: un fallo de aviso no debe voltear el check-out (§8).
 */
async function notificarSalidaRutaBus({ firestore, tenant, tenantId, jornada, jornadaId, estudianteId, ahora }) {
  try {
    const estSnap = await firestore.collection('estudiantes').doc(estudianteId).get();
    const estudiante = estSnap.exists ? estSnap.data() : null;
    if (!estudiante || estudiante.modoTransporte !== 'ruta_bus') {
      return null; // recogida / default: no se avisa en el check-out.
    }

    const correoAcudiente = estudiante.tutor && estudiante.tutor.correo;
    if (!correoAcudiente) return 'sin_acudiente';

    const nombreAlumno = [estudiante.nombres, estudiante.apellidos].filter(Boolean).join(' ') || 'Tu hijo/a';
    const clase = jornada.tema ? ` de ${jornada.tema}` : '';
    const mensaje = `${nombreAlumno} terminó la clase${clase} y salió en la ruta de bus a las ${horaLocalClub(ahora)}.`;

    // Doc-id DETERMINISTA -> idempotente (no duplica aunque se reintente): un aviso por
    // check-out de esta jornada+estudiante.
    const notifId = `salida-bus-${jornadaId}-${estudianteId}`;
    await firestore.collection('historialNotificaciones').doc(notifId).set({
      estudianteId,
      estudianteNombre: nombreAlumno,
      destinatario: correoAcudiente,
      canal: 'WhatsApp',
      tipo: 'SalidaRutaBus',
      jornadaId,
      tenantId,
      mensaje,
      leida: false,
      fecha: ahora,
    });

    return 'ruta_bus';
  } catch (err) {
    console.error('[registrarAsistenciaJornada] fallo al notificar salida en ruta de bus', err);
    return 'error';
  }
}

// Acumulado derivado en `tenants/{tenantId}/metricasAsistencia/{estudianteId}` (ver
// models/academico/metricasAsistencia.ts). Read-modify-write: lee el total actual, suma la
// clase recien cerrada, reescribe.
async function acumularMetricasAsistencia({ tenant, tenantId, estudianteId, minutosAsistidos, ahora }) {
  const ref = tenant.collection('metricasAsistencia').doc(estudianteId);
  const snap = await ref.get();
  const previo = snap.exists ? snap.data() : { minutosTotales: 0, clasesAsistidas: 0 };

  await ref.set({
    estudianteId,
    tenantId,
    minutosTotales: (previo.minutosTotales || 0) + minutosAsistidos,
    clasesAsistidas: (previo.clasesAsistidas || 0) + 1,
    actualizadoEn: ahora,
  });
}

// Debug: validacion de pertenencia detallada
async function debugPerteneceAEjecucion({ firestore, tenant, tenantId, jornadaId, estudianteId }) {
  const jornada = await tenant.collection('jornadas').doc(jornadaId).get();
  if (!jornada.exists) return { error: 'Jornada no encontrada' };

  const resultado = { estudiante: {}, jornada: {}, validaciones: {} };

  const estudianteSnap = await firestore.collection('estudiantes').doc(estudianteId).get();
  if (!estudianteSnap.exists) return { error: 'Estudiante no encontrado' };

  const estudiante = estudianteSnap.data();
  resultado.estudiante = {
    tenantId: estudiante.tenantId,
    grupo: estudiante.grupo,
    sedeId: estudiante.sedeId,
    grado: estudiante.grado,
    estadoPago: estudiante.estadoPago,
  };

  resultado.validaciones.tenantMatch = estudiante.tenantId === tenantId;
  resultado.validaciones.pagoAlDia = estudiante.estadoPago !== 'Vencido';
  resultado.validaciones.noEnGradosExcluidos = !jornada.data().gradosExcluidos?.includes(estudiante.grado);

  const ejecucionSnap = await tenant.collection('ejecucionesPrograma').doc(jornada.data().ejecucionProgramaId).get();
  if (!ejecucionSnap.exists) return { ...resultado, error: 'EjecucionPrograma no encontrada' };

  const ejecucion = ejecucionSnap.data();
  resultado.ejecucion = {
    grupoId: ejecucion.grupoId,
    sedeId: ejecucion.sedeId,
    id: ejecucion.id,
  };

  const grupoEstudianteSlug = grupoASlug(estudiante.grupo);
  resultado.validaciones.grupoMatch = grupoEstudianteSlug === ejecucion.grupoId;
  resultado.validaciones.grupoMatch_detail = {
    grupoEstudiante: estudiante.grupo,
    grupoEstudianteSlug,
    grupoEjecucion: ejecucion.grupoId,
  };

  resultado.validaciones.sedeMatch = estudiante.sedeId === ejecucion.sedeId;

  const inscripcionSnap = await tenant
    .collection('ejecucionesPrograma')
    .doc(jornada.data().ejecucionProgramaId)
    .collection('inscripciones')
    .doc(estudianteId)
    .get();

  resultado.validaciones.inscripcionExplicita = inscripcionSnap.exists
    ? inscripcionSnap.data().estado === 'activa'
    : false;

  resultado.pertenece =
    resultado.validaciones.tenantMatch &&
    resultado.validaciones.pagoAlDia &&
    resultado.validaciones.noEnGradosExcluidos &&
    (resultado.validaciones.inscripcionExplicita ||
      (resultado.validaciones.grupoMatch && resultado.validaciones.sedeMatch));

  return resultado;
}

module.exports = {
  crearServicioRegistrarAsistencia,
  debugPerteneceAEjecucion,
};
