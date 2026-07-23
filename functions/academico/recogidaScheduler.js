'use strict';

// WS-3b (Módulo Clase en Vivo.txt §8): cron que avisa a los acudientes de los chicos de
// RECOGIDA que la clase está por terminar (a `horaFin - NOTIFY_BEFORE_END_MINUTES`), para que
// lleguen a tiempo. Es la otra mitad de la notificación: los de RUTA DE BUS se avisan en el
// check-out (WS-3a, evento). Estos NO tienen un evento que dispare -- por eso un cron.
//
// Corre cada pocos minutos (ver index.js). Solo notifica a chicos PRESENTES (check-in y sin
// check-out) que NO son de ruta de bus. Idempotente por dos capas: un flag por jornada
// (`avisoRecogidaEnviado`) evita re-escanear, y el doc-id determinista del aviso evita
// duplicar aunque algo se reintente.

const { tieneHorario, estaEnVentanaDeAvisoRecogida } = require('./ventanaClaseEnVivo');

/**
 * @param {Object} deps
 * @param {() => Promise<Array<{id:string, data:Function, ref:{update:Function}}>>} deps.listarJornadasEnCurso
 * @param {(jornadaSnap:Object) => Promise<Array<Object>>} deps.listarAsistenciasDeJornada
 * @param {(estudianteId:string) => Promise<Object|null>} deps.obtenerEstudiante
 * @param {(notif:Object) => Promise<void>} deps.crearNotificacion  (usa un id determinista adentro)
 */
function crearServicioAvisarRecogidaProxima({
  listarJornadasEnCurso,
  listarAsistenciasDeJornada,
  obtenerEstudiante,
  crearNotificacion,
}) {
  return async function avisarRecogidaProxima(ahora = new Date()) {
    const jornadas = await listarJornadasEnCurso();
    let avisados = 0;
    let jornadasAvisadas = 0;

    for (const jSnap of jornadas) {
      const jornada = jSnap.data();
      if (jornada.avisoRecogidaEnviado) continue;
      if (!tieneHorario(jornada)) continue;
      if (!estaEnVentanaDeAvisoRecogida(jornada, ahora)) continue;

      const asistencias = await listarAsistenciasDeJornada(jSnap);
      for (const asistencia of asistencias) {
        if (!asistencia || !asistencia.estudianteId) continue;
        if (asistencia.horaSalida) continue; // ya se fue: no hay a quién avisar recogida

        const estudiante = await obtenerEstudiante(asistencia.estudianteId);
        if (!estudiante) continue;
        // Los de ruta de bus se manejan en el check-out (WS-3a); acá solo recogida/default.
        if (estudiante.modoTransporte === 'ruta_bus') continue;

        const correo = estudiante.tutor && estudiante.tutor.correo;
        if (!correo) continue;

        const nombre = [estudiante.nombres, estudiante.apellidos].filter(Boolean).join(' ') || 'Tu hijo/a';
        const clase = jornada.tema ? ` de ${jornada.tema}` : '';
        await crearNotificacion({
          id: `recogida-${jSnap.id}-${asistencia.estudianteId}`,
          estudianteId: asistencia.estudianteId,
          estudianteNombre: nombre,
          destinatario: correo,
          canal: 'WhatsApp',
          tipo: 'RecogidaProxima',
          jornadaId: jSnap.id,
          tenantId: jornada.tenantId,
          mensaje: `${nombre} está por terminar la clase${clase}. Ya podés pasar a buscarlo/a.`,
          leida: false,
          fecha: ahora.toISOString(),
        });
        avisados += 1;
      }

      await jSnap.ref.update({ avisoRecogidaEnviado: true, actualizadoEn: ahora.toISOString() });
      jornadasAvisadas += 1;
    }

    return { procesadas: jornadas.length, jornadasAvisadas, avisados };
  };
}

// Wiring contra Firestore real (Admin SDK) para index.js.
function crearDepsRecogidaFirestore(firestore) {
  return {
    listarJornadasEnCurso: async () => {
      const snap = await firestore.collectionGroup('jornadas').where('estado', '==', 'en_curso').get();
      return snap.docs;
    },
    listarAsistenciasDeJornada: async (jornadaSnap) => {
      const snap = await jornadaSnap.ref.collection('asistencias').get();
      return snap.docs.map((d) => d.data());
    },
    obtenerEstudiante: async (estudianteId) => {
      const snap = await firestore.collection('estudiantes').doc(estudianteId).get();
      return snap.exists ? snap.data() : null;
    },
    crearNotificacion: async (notif) => {
      const { id, ...data } = notif;
      // Doc-id determinista -> idempotente (no duplica).
      await firestore.collection('historialNotificaciones').doc(id).set(data);
    },
  };
}

module.exports = {
  crearServicioAvisarRecogidaProxima,
  crearDepsRecogidaFirestore,
};
