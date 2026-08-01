'use strict';

// Recordatorios de estudio: nudges automaticos a estudiantes/tutores cuando una asignacion
// esta por vencer sin terminar, recien se publico, o el estudiante lleva mucho sin actividad.
// Mismo patron de recordatoriosPago.js: orquestador agnostico de Firebase, con los accesos a
// datos inyectados -- functions/index.js es quien conecta admin.firestore().
//
// OJO -- este archivo NO esta wireado en functions/index.js todavia (decision explicita:
// "construir sin activar" hasta confirmar en otra sesion). Falta ademas resolver, al momento
// de conectarlo, COMO se listan "todas las asignaciones vigentes de todos los tenants" en
// Firestore real -- las asignaciones viven en subcolecciones tenants/{tenantId}/asignaciones,
// asi que hace falta collectionGroup('asignaciones') o un loop por tenant (a diferencia de
// recordatoriosPago.js, que lee "estudiantes" como coleccion raiz).

const {
  determinarSituacionAsignacion,
  detectarInactividadProlongada,
  elegirComentario,
} = require('./recordatorioEstudioReglas');

// Cooldown por situacion: cuanto esperar antes de volver a recordarle la MISMA situacion al
// MISMO estudiante (para la misma asignacion, si aplica). "Por vencer" amerita insistir a
// diario mientras siga vigente; "recien disponible" es un nudge suave que no hace falta
// repetir; "inactividad" no debe ser pesado, maximo una vez por semana.
const COOLDOWN_HORAS = {
  por_vencer_sin_iniciar: 24,
  por_vencer_medio_camino: 24,
  recien_disponible_sin_iniciar: null, // null = una sola vez, nunca se repite
  inactividad_prolongada: 24 * 7,
};

function pasoElCooldown(situacion, fechaUltimoEnvio, ahora) {
  const horas = COOLDOWN_HORAS[situacion];
  if (horas === null) return !fechaUltimoEnvio;
  if (!fechaUltimoEnvio) return true;
  const horasTranscurridas = horasEntre(new Date(fechaUltimoEnvio), ahora);
  return horasTranscurridas >= horas;
}

function horasEntre(desde, hasta) {
  return (hasta.getTime() - desde.getTime()) / (1000 * 60 * 60);
}

function nombreCompleto(persona) {
  return [persona.nombres, persona.apellidos].filter(Boolean).join(' ');
}

function destinatarioNotificacion(estudiante) {
  return (estudiante.tutor && estudiante.tutor.correo) || estudiante.correo || '';
}

/**
 * @param {Object} deps
 * @param {() => Promise<Array<Object>>} deps.listarAsignacionesVigentes
 *        Asignaciones publicadas y ya abiertas de TODOS los tenants. Cada una: {id, tenantId,
 *        titulo, destinatario, fechaApertura, fechaCierre}.
 * @param {() => Promise<Array<Object>>} deps.listarEstudiantesActivos
 *        Todos los estudiantes de todos los tenants: {id, tenantId, nombres, apellidos,
 *        correo, grupo, grado, tutor, ultimaActividadEn}.
 * @param {(tenantId:string, estudianteId:string) => Promise<Array<Object>>} deps.obtenerAvancePorAsignacion
 *        MetricasEstudiante.avancePorAsignacion real (solo trae lo que el estudiante YA
 *        toco; lo que falta se interpreta como 0% -- ver recordatorioEstudioReglas).
 * @param {(estudianteId:string, asignacionId:string|null, situacion:string) => Promise<string|undefined>} deps.obtenerFechaUltimoRecordatorio
 * @param {(situacion:string, estudianteId:string, asignacionId:string|null) => Promise<string|undefined>} deps.obtenerUltimoComentario
 *        Texto del ultimo comentario mostrado para esta situacion/estudiante, para que
 *        elegirComentario no lo repita.
 * @param {(notificacion:Object) => Promise<void>} deps.crearNotificacion
 * @param {(asignacion:Object, estudiante:Object) => boolean} deps.aplicaAlEstudiante
 */
function crearServicioRecordatoriosEstudio({
  listarAsignacionesVigentes,
  listarEstudiantesActivos,
  obtenerAvancePorAsignacion,
  obtenerFechaUltimoRecordatorio,
  obtenerUltimoComentario,
  crearNotificacion,
  aplicaAlEstudiante,
}) {
  async function enviarRecordatorio({ estudiante, situacion, asignacionId, tituloMaterial }) {
    const ultimoComentario = await obtenerUltimoComentario(situacion, estudiante.id, asignacionId);
    const mensaje = elegirComentario(situacion, tituloMaterial, ultimoComentario);

    await crearNotificacion({
      // ERR-0011: tenantId requerido por firestore.rules para aislar historialNotificaciones por tenant.
      tenantId: estudiante.tenantId,
      estudianteId: estudiante.id,
      estudianteNombre: nombreCompleto(estudiante),
      tutorNombre: estudiante.tutor ? nombreCompleto(estudiante.tutor) : '',
      destinatario: destinatarioNotificacion(estudiante),
      canal: 'Email',
      tipo: 'RecordatorioEstudio',
      situacion,
      ...(asignacionId ? { asignacionId } : {}),
      mensaje,
      leida: false,
      fecha: new Date().toISOString(),
    });
  }

  return async function recordatoriosEstudio(ahora = new Date()) {
    const [asignaciones, estudiantes] = await Promise.all([
      listarAsignacionesVigentes(),
      listarEstudiantesActivos(),
    ]);

    let creadas = 0;

    for (const estudiante of estudiantes) {
      const avancePorAsignacion = await obtenerAvancePorAsignacion(estudiante.tenantId, estudiante.id);
      const avanceMap = new Map(avancePorAsignacion.map((a) => [a.asignacionId, a]));

      const asignacionesDelEstudiante = asignaciones.filter(
        (a) => a.tenantId === estudiante.tenantId && aplicaAlEstudiante(a, estudiante)
      );

      let seEnvioAlgo = false;

      for (const asignacion of asignacionesDelEstudiante) {
        const avance = avanceMap.get(asignacion.id);
        const situacion = determinarSituacionAsignacion(
          {
            fechaApertura: asignacion.fechaApertura,
            fechaCierre: asignacion.fechaCierre,
            porcentajeConsumo: avance ? avance.porcentajeConsumo : 0,
          },
          ahora
        );
        if (!situacion) continue;

        const fechaUltimo = await obtenerFechaUltimoRecordatorio(estudiante.id, asignacion.id, situacion);
        if (!pasoElCooldown(situacion, fechaUltimo, ahora)) continue;

        await enviarRecordatorio({
          estudiante,
          situacion,
          asignacionId: asignacion.id,
          tituloMaterial: asignacion.titulo,
        });
        creadas += 1;
        seEnvioAlgo = true;
      }

      // Inactividad prolongada: chequeo GLOBAL del estudiante, independiente de una
      // asignacion puntual. Solo se evalua si no se le mando ya otro recordatorio en esta
      // misma corrida -- no tiene sentido apilarle un aviso generico sobre uno especifico.
      if (!seEnvioAlgo && detectarInactividadProlongada(estudiante.ultimaActividadEn, ahora)) {
        const fechaUltimo = await obtenerFechaUltimoRecordatorio(estudiante.id, null, 'inactividad_prolongada');
        if (pasoElCooldown('inactividad_prolongada', fechaUltimo, ahora)) {
          await enviarRecordatorio({
            estudiante,
            situacion: 'inactividad_prolongada',
            asignacionId: null,
            tituloMaterial: undefined,
          });
          creadas += 1;
        }
      }
    }

    return { creadas, revisados: estudiantes.length };
  };
}

module.exports = {
  crearServicioRecordatoriosEstudio,
  COOLDOWN_HORAS,
  pasoElCooldown,
};
