'use strict';

// Plan B #1 (fix tutor-role-end-to-end): generación automática de notificaciones de PAGO
// pendiente al buzón del consultor. En el modelo actual, "pago pendiente/vencido" = estudiante
// con `saldoDeudor > 0` (utils/finanzas.ts: estadoPagoPorSaldo). Un cron diario recorre esos
// estudiantes y crea UNA notificación por estudiante por mes (dedup por periodo YYYY-MM), que
// el tutor/estudiante ve en su buzón (`historialNotificaciones`, scoped por estudianteId).

const ZONA_HORARIA = 'America/Bogota';

// Periodo YYYY-MM en hora Bogota (mismo criterio de zona que el resto de schedulers).
function periodoBogota(ahora) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
  });
  const partes = Object.fromEntries(formatter.formatToParts(ahora).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}`;
}

function formatearMonto(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('es-CO');
}

function construirMensaje(estudiante) {
  const nombre = estudiante.nombres || 'el estudiante';
  return `Recordatorio de pago: la mensualidad de ${nombre} tiene un saldo pendiente de $${formatearMonto(estudiante.saldoDeudor)}. Podés ponerte al día desde el portal.`;
}

/**
 * @param {Object} deps
 * @param {() => Promise<Array<{id:string} & Object>>} deps.listarEstudiantesConSaldo
 *        Estudiantes con saldoDeudor > 0 (cada uno incluye su id de doc).
 * @param {(periodo:string) => Promise<Set<string>>} deps.estudiantesYaNotificadosEnPeriodo
 *        Set de estudianteId que ya tienen un RecordatorioPago en el periodo (dedup mensual).
 * @param {(notificacion:Object) => Promise<void>} deps.crearNotificacion
 *        Escribe un doc en historialNotificaciones.
 */
function crearServicioRecordatoriosPago({
  listarEstudiantesConSaldo,
  estudiantesYaNotificadosEnPeriodo,
  crearNotificacion,
}) {
  return async function recordatoriosPago(ahora = new Date()) {
    const periodo = periodoBogota(ahora);
    const estudiantes = await listarEstudiantesConSaldo();
    const yaNotificados = await estudiantesYaNotificadosEnPeriodo(periodo);

    let creadas = 0;
    for (const estudiante of estudiantes) {
      if (!estudiante || !estudiante.id) continue;
      if (!(Number(estudiante.saldoDeudor) > 0)) continue; // guarda defensiva
      if (yaNotificados.has(estudiante.id)) continue; // dedup mensual

      const tutor = estudiante.tutor || {};
      const destinatario = tutor.correo || estudiante.correo || '';
      const tutorNombre = [tutor.nombres, tutor.apellidos].filter(Boolean).join(' ');
      const estudianteNombre = [estudiante.nombres, estudiante.apellidos].filter(Boolean).join(' ');

      await crearNotificacion({
        // ERR-0011: tenantId requerido por firestore.rules para aislar historialNotificaciones por tenant.
        tenantId: estudiante.tenantId,
        estudianteId: estudiante.id,
        estudianteNombre,
        tutorNombre,
        destinatario,
        canal: 'Email',
        tipo: 'RecordatorioPago',
        mensaje: construirMensaje(estudiante),
        leida: false,
        fecha: ahora.toISOString(),
        periodo, // campo extra para dedup/consulta (no rompe el modelo existente)
      });
      creadas += 1;
    }

    return { creadas, periodo, revisados: estudiantes.length };
  };
}

module.exports = {
  crearServicioRecordatoriosPago,
  periodoBogota,
  construirMensaje,
};
