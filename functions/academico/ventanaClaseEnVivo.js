// functions/academico/ventanaClaseEnVivo.js
// Ventana horaria de Clase en Vivo, del lado del backend (Cloud Functions).
//
// Espejo EXACTO de servicios/academico/ventanaClaseEnVivoService.ts::estaJornadaEnVentana
// (misma ventana [horaInicio-15, horaFin+15], mismo offset fijo UTC-5 de America/Bogota, que
// no tiene horario de verano). Se replica en JS porque las Functions no importan el TS del
// frontend; los valores 15/15 y el offset son los mismos ya decididos y probados alla.
//
// POR QUE EXISTE (brecha 4-bis-C, 2026-07-22): el callable `registrarAsistenciaJornada` solo
// validaba `estado === 'en_curso'`. Como nada saca una jornada de `en_curso` automaticamente
// (el scheduler solo la mete; la salida es el cierre manual), una jornada que el maestro nunca
// cerro quedaba escaneable por URL directa DIAS despues. Esta ventana es el limite real que
// faltaba, aplicado server-side (la vista es cosmetica y se saltea por URL).

'use strict';

const LIVE_CLASS_OPEN_BEFORE_MINUTES = 15;
const LIVE_CLASS_CLOSE_AFTER_MINUTES = 15;

// WS-3b: cuántos minutos ANTES de `horaFin` se le avisa al acudiente de un chico de RECOGIDA
// para que llegue a tiempo. Centralizado acá (no quemado en varios lados, §3).
const NOTIFY_BEFORE_END_MINUTES = 15;

const OFFSET_ZONA_CLUB = '-05:00';

function combinarFechaHoraEnZonaDelClub(fecha, hora) {
  return new Date(`${fecha}T${hora}:00.000${OFFSET_ZONA_CLUB}`);
}

function calcularVentanaHoraria({ fecha, horaInicio, horaFin }) {
  const apertura = combinarFechaHoraEnZonaDelClub(fecha, horaInicio);
  apertura.setUTCMinutes(apertura.getUTCMinutes() - LIVE_CLASS_OPEN_BEFORE_MINUTES);

  const cierre = combinarFechaHoraEnZonaDelClub(fecha, horaFin);
  cierre.setUTCMinutes(cierre.getUTCMinutes() + LIVE_CLASS_CLOSE_AFTER_MINUTES);

  return { apertura, cierre };
}

/**
 * ¿La jornada tiene los tres campos de horario para poder evaluar la ventana? Una jornada real
 * (JornadaInstruccion) SIEMPRE los tiene; esto cubre docs malformados / fixtures viejos.
 */
function tieneHorario(jornada) {
  return Boolean(jornada && jornada.fecha && jornada.horaInicio && jornada.horaFin);
}

/**
 * True si `ahora` (Date) cae dentro de [horaInicio-15, horaFin+15] de la jornada.
 * Devuelve las fechas de la ventana para poder construir un mensaje de error util.
 */
function estaEnVentana(jornada, ahora) {
  const { apertura, cierre } = calcularVentanaHoraria(jornada);
  const dentro = ahora >= apertura && ahora <= cierre;
  return { dentro, apertura, cierre };
}

/**
 * Puntualidad del check-in (Modulo Clase en Vivo.txt §6): tarde = despues de `horaInicio` (la
 * hora nominal de inicio, NO la apertura de la ventana en -15). Llegar dentro de [inicio-15,
 * inicio] es normal. `minutesLate` = 0 si llego a tiempo o antes.
 */
function calcularRetraso(jornada, ahora) {
  const inicio = combinarFechaHoraEnZonaDelClub(jornada.fecha, jornada.horaInicio);
  const minutesLate = Math.max(0, Math.round((ahora.getTime() - inicio.getTime()) / 60000));
  return { isLate: minutesLate > 0, minutesLate };
}

/**
 * ¿Es momento de avisar a los acudientes de RECOGIDA que la clase esta por terminar? (WS-3b)
 * True si `ahora` cae en [horaFin - NOTIFY_BEFORE_END_MINUTES, horaFin]. Antes de esa ventana
 * es muy temprano; despues de `horaFin` el aviso "vení a buscarlo antes de que termine" ya no
 * tiene sentido (la clase termino).
 */
function estaEnVentanaDeAvisoRecogida(jornada, ahora) {
  const fin = combinarFechaHoraEnZonaDelClub(jornada.fecha, jornada.horaFin);
  const desde = new Date(fin);
  desde.setUTCMinutes(desde.getUTCMinutes() - NOTIFY_BEFORE_END_MINUTES);
  return ahora >= desde && ahora <= fin;
}

module.exports = {
  LIVE_CLASS_OPEN_BEFORE_MINUTES,
  LIVE_CLASS_CLOSE_AFTER_MINUTES,
  NOTIFY_BEFORE_END_MINUTES,
  tieneHorario,
  estaEnVentana,
  calcularRetraso,
  estaEnVentanaDeAvisoRecogida,
};
