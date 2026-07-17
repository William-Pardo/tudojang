'use strict';

// Auto-transicion confirmada -> en_curso por horario (decision de arquitectura
// 2026-07-11, pedido explicito del usuario: "la clase se inicia de manera automatica
// despues de que aparezca en agenda"). `jornada.fecha`/`horaInicio`/`horaFin` son texto
// plano sin zona horaria, cargados por el usuario pensando en su horario local -- mismo
// criterio de zona horaria que ya usa `vencerAsignacionesAcademicas`
// (America/Bogota, UTC-5 sin horario de verano).
const ZONA_HORARIA = 'America/Bogota';

// Intl.DateTimeFormat con hour12:false puede devolver "24" para medianoche en algunos
// entornos ICU (quirk conocido); no afecta el rango operativo de esta funcion (7am-9pm,
// restringido en el cron trigger, ver index.js), asi que no se normaliza aca.
function fechaHoraBogota(ahora) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const partes = Object.fromEntries(formatter.formatToParts(ahora).map((p) => [p.type, p.value]));
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

// Rediseño 2026-07-12 (pedido explicito del usuario: "borrador como estado ya no deberia
// existir", clases malleables por defecto): 'borrador' se trata igual que 'confirmada' --
// de lo contrario quedaria visualmente malleable en Mis Clases (mismos iconos Reagendar/
// Cancelar/Editar) pero nunca arrancaria sola por horario.
function debeIniciar(jornada, fechaActual, horaActual) {
  if (jornada?.estado !== 'confirmada' && jornada?.estado !== 'borrador') return false;
  if (jornada.fecha !== fechaActual) return false;
  return jornada.horaInicio <= horaActual && horaActual <= jornada.horaFin;
}

function crearServicioIniciarJornadasPorHorario({ listarJornadasConfirmadas }) {
  return async function iniciarJornadasPorHorario(ahora = new Date()) {
    const { fecha, hora } = fechaHoraBogota(ahora);
    const snapshots = await listarJornadasConfirmadas();
    let iniciadas = 0;

    for (const snap of snapshots) {
      const jornada = snap.data();
      if (!debeIniciar(jornada, fecha, hora)) continue;

      await snap.ref.update({
        estado: 'en_curso',
        actualizadoEn: ahora.toISOString(),
      });
      iniciadas += 1;
    }

    return {
      procesadas: snapshots.length,
      iniciadas,
    };
  };
}

function crearListadoJornadasConfirmadasFirestore(firestore) {
  return async function listarJornadasConfirmadas() {
    // Rediseño 2026-07-12: incluye 'borrador' ademas de 'confirmada' -- ver debeIniciar()
    // arriba. El nombre de esta funcion/export se conserva (evita un rename de mas
    // superficie) aunque ahora trae ambos estados.
    const snapshot = await firestore
      .collectionGroup('jornadas')
      .where('estado', 'in', ['confirmada', 'borrador'])
      .get();

    return snapshot.docs;
  };
}

module.exports = {
  crearServicioIniciarJornadasPorHorario,
  crearListadoJornadasConfirmadasFirestore,
  debeIniciar,
  fechaHoraBogota,
};
