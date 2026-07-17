'use strict';

// Plan B #3 (fix tutor-role-end-to-end): al CREARSE un evento con inscripción abierta, avisar
// al buzón de los estudiantes del tenant (y por ende a sus tutores). En el modelo actual los
// eventos no tienen segmentación por grupo/grado (tipos.ts, interface Evento) — "estudiantes
// que aplican" = todos los del tenant. Dedup por (eventoId + estudianteId).

const ZONA_HORARIA = 'America/Bogota';

function fechaBogota(ahora) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const p = Object.fromEntries(formatter.formatToParts(ahora).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function construirMensaje(evento) {
  const nombre = evento.nombre || 'un nuevo evento';
  const cuando = evento.fechaEvento ? ` (${evento.fechaEvento})` : '';
  const hastaCuando = evento.fechaFinInscripcion ? ` Inscripciones abiertas hasta ${evento.fechaFinInscripcion}.` : '';
  return `Nuevo evento: "${nombre}"${cuando}.${hastaCuando}`;
}

/**
 * @param {Object} deps
 * @param {(tenantId:string) => Promise<Array<{id:string} & Object>>} deps.listarEstudiantesDelTenant
 * @param {(eventoId:string) => Promise<Set<string>>} deps.estudiantesYaNotificadosDelEvento
 * @param {(notificacion:Object) => Promise<void>} deps.crearNotificacion
 */
function crearServicioNotificarEventoNuevo({
  listarEstudiantesDelTenant,
  estudiantesYaNotificadosDelEvento,
  crearNotificacion,
}) {
  return async function notificarEventoNuevo(evento, eventoId, ahora = new Date()) {
    if (!evento || !evento.tenantId || !eventoId) return { creadas: 0, motivo: 'evento-invalido' };

    // Solo avisar si la inscripción sigue abierta (evita imports/históricos ya cerrados).
    const hoy = fechaBogota(ahora);
    if (evento.fechaFinInscripcion && evento.fechaFinInscripcion < hoy) {
      return { creadas: 0, motivo: 'inscripcion-cerrada' };
    }

    const estudiantes = await listarEstudiantesDelTenant(evento.tenantId);
    const yaNotificados = await estudiantesYaNotificadosDelEvento(eventoId);
    const mensaje = construirMensaje(evento);

    let creadas = 0;
    for (const est of estudiantes) {
      if (!est || !est.id) continue;
      if (yaNotificados.has(est.id)) continue;

      const tutor = est.tutor || {};
      await crearNotificacion({
        estudianteId: est.id,
        estudianteNombre: [est.nombres, est.apellidos].filter(Boolean).join(' '),
        tutorNombre: [tutor.nombres, tutor.apellidos].filter(Boolean).join(' '),
        destinatario: tutor.correo || est.correo || '',
        canal: 'Email',
        tipo: 'EventoNuevo',
        eventoId,
        mensaje,
        leida: false,
        fecha: ahora.toISOString(),
      });
      creadas += 1;
    }

    return { creadas, revisados: estudiantes.length };
  };
}

module.exports = {
  crearServicioNotificarEventoNuevo,
  construirMensaje,
  fechaBogota,
};
