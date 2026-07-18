'use strict';

// Gemelo en CommonJS de servicios/academico/recordatorioEstudioService.ts -- las Functions
// corren en Node plano (sin paso de compilacion TS), asi que la logica de reglas + libreria
// de comentarios se porta aca en vez de importarse del frontend. Si cambian los umbrales o
// la libreria de mensajes en un lado, replicar el cambio en el otro.

const HORAS_URGENCIA_CIERRE = 48;
const HORAS_NOVEDAD_APERTURA = 48;
const PORCENTAJE_MEDIO_CAMINO = 50;
// Mismo umbral que ProgresoEstudianteCard.tsx (columna "Ult. actividad").
const DIAS_INACTIVIDAD_PROLONGADA = 14;

function horasEntre(desde, hasta) {
  return (hasta.getTime() - desde.getTime()) / (1000 * 60 * 60);
}

/**
 * Situacion de UNA asignacion puntual para un estudiante. null = no amerita recordatorio.
 * @param {{fechaApertura:string, fechaCierre?:string, porcentajeConsumo:number}} datos
 * @param {Date} ahora
 * @returns {'por_vencer_sin_iniciar'|'por_vencer_medio_camino'|'recien_disponible_sin_iniciar'|null}
 */
function determinarSituacionAsignacion(datos, ahora) {
  if (datos.porcentajeConsumo >= 100) return null;

  const apertura = new Date(datos.fechaApertura);
  if (apertura > ahora) return null;

  if (datos.fechaCierre) {
    const cierre = new Date(datos.fechaCierre);
    const horasParaCierre = horasEntre(ahora, cierre);
    if (horasParaCierre <= 0) return null;
    if (horasParaCierre <= HORAS_URGENCIA_CIERRE) {
      if (datos.porcentajeConsumo === 0) return 'por_vencer_sin_iniciar';
      if (datos.porcentajeConsumo < PORCENTAJE_MEDIO_CAMINO) return 'por_vencer_medio_camino';
      return null;
    }
  }

  const horasDesdeApertura = horasEntre(apertura, ahora);
  if (datos.porcentajeConsumo === 0 && horasDesdeApertura <= HORAS_NOVEDAD_APERTURA) {
    return 'recien_disponible_sin_iniciar';
  }

  return null;
}

/** Situacion GLOBAL del estudiante (no de una asignacion puntual): no toca nada hace rato. */
function detectarInactividadProlongada(ultimaActividadEn, ahora) {
  if (!ultimaActividadEn) return false;
  const dias = horasEntre(new Date(ultimaActividadEn), ahora) / 24;
  return dias >= DIAS_INACTIVIDAD_PROLONGADA;
}

const LIBRERIA_COMENTARIOS = {
  por_vencer_sin_iniciar: [
    '¡Quiubo! {material} cierra en menos de 2 días y todavía no lo ha abierto. Métale, que no se le vaya a pasar.',
    'Ojo con esto: {material} se cierra prontico y usted ni lo ha mirado. ¡No dé papaya, póngase al día ya!',
    'Le recordamos que quedan menos de 48 horas para ver {material}. Hágale antes de que se cierre.',
    'Pilas con {material}: está por cerrarse y no lo ha empezado. Sáquele un ratico hoy mismo.',
    '¡Última llamada para {material}! Se cierra prontico, dele una repasadita antes de que sea tarde.',
  ],
  por_vencer_medio_camino: [
    'Vamos bien con {material}, pero se cierra pronto y todavía le falta. ¡Métale para terminarlo!',
    'Ya arrancó con {material}, ¡no lo deje a medias! Cierra en poquito y le falta un buen tramo.',
    'Quiubo, le recordamos que {material} se cierra prontico. Ya llevaba avance, ¡termínelo que ya casi!',
    'Pilas: a {material} le queda poco tiempo y usted va apenas por la mitad. Un esfuercito más.',
    'No lo deje botado: {material} cierra pronto y ya había empezado. ¡Dele que se puede!',
  ],
  recien_disponible_sin_iniciar: [
    '¡Quiubo! Ya está disponible {material}. Cuando tenga un ratico, dele una mirada.',
    'Le llegó material nuevo: {material}. Está fresquito, ¡anímese a verlo!',
    'Recién publicamos {material}. No hay afán, pero no se le vaya a olvidar.',
    'Tiene pendiente por ver {material}, recién lo subimos. ¡Cuando pueda, hágale!',
    'Novedad en su Centro de Estudios: {material} ya está listo para que lo vea.',
  ],
  inactividad_prolongada: [
    '¡Quiubo! Hace ratico no lo vemos por el Centro de Estudios. ¿Todo bien? Lo esperamos pronto.',
    'Hace más de dos semanas no entra a ver material. ¡No se nos pierda, hágale una revisadita!',
    'Extrañamos verlo activo. Métale aunque sea un ratico al Centro de Estudios esta semana.',
    'Pilas, que hace tiempo no revisa nada por acá. ¡De una, dele una repasada a lo pendiente!',
    'Cuánto tiempo sin saber de usted por el Centro de Estudios. ¡Vuelva cuando pueda!',
  ],
};

/**
 * Elige un comentario de la libreria para la situacion dada, sustituyendo {material}. Si se
 * pasa ultimoMostrado, nunca devuelve exactamente ese mismo texto (mientras haya mas de una
 * variante disponible).
 * @param {string} situacion
 * @param {string|undefined} tituloMaterial
 * @param {string|undefined} ultimoMostrado
 */
function elegirComentario(situacion, tituloMaterial, ultimoMostrado) {
  const variantes = LIBRERIA_COMENTARIOS[situacion];
  const candidatos =
    ultimoMostrado && variantes.length > 1
      ? variantes.filter((v) => v !== ultimoMostrado)
      : variantes;
  const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
  return tituloMaterial ? elegido.replace('{material}', tituloMaterial) : elegido;
}

module.exports = {
  determinarSituacionAsignacion,
  detectarInactividadProlongada,
  elegirComentario,
  LIBRERIA_COMENTARIOS,
};
