import type { JornadaInstruccion } from '../../models/academico/jornada';

/**
 * Fase 4 (clase-en-vivo-checkin-trigger-agenda, Bloque A) — ventana de tiempo dinamica.
 *
 * Ventana `[horaInicio - LIVE_CLASS_OPEN_BEFORE_MINUTES, horaFin + LIVE_CLASS_CLOSE_AFTER_MINUTES]`,
 * corregida en `design.md` (nota de cabecera) para anclar el cierre a `horaFin`, no a `horaInicio`.
 *
 * NOTA: estos valores son locales a este archivo por ahora. `design.md` (Bloque B, Decision 8)
 * los centraliza en `constantes.ts`/`functions/academico/constantesClaseEnVivo.js` en la Fase 7 --
 * fuera de alcance de esta fase, que unicamente consume el valor 15/15 ya decidido.
 */
export const LIVE_CLASS_OPEN_BEFORE_MINUTES = 15;
export const LIVE_CLASS_CLOSE_AFTER_MINUTES = 15;

interface VentanaJornadaInput {
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

// `fecha` (YYYY-MM-DD) + `horaInicio`/`horaFin` (HH:MM) se combinan en UTC, mismo patron ya usado
// en el repo para fechas de jornada (ver `servicios/academico/jornadaService.ts`, `new Date(`${fecha}T00:00:00.000Z`)`).
function combinarFechaHoraUtc(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00.000Z`);
}

/**
 * Pura y reutilizable: true si `ahoraIso` cae dentro de `[horaInicio-15min, horaFin+15min]` de
 * `input`. Exportada para que consumidores que no tienen una `JornadaInstruccion` completa (p.ej.
 * `ClaseAcademicaAgenda` en `vistas/Horarios.tsx`, que expone `proximaFecha` en vez de `fecha`)
 * puedan reusar la misma logica de ventana sin duplicarla.
 */
export function estaJornadaEnVentana(input: VentanaJornadaInput, ahoraIso: string): boolean {
  const ahora = new Date(ahoraIso);

  const apertura = combinarFechaHoraUtc(input.fecha, input.horaInicio);
  apertura.setUTCMinutes(apertura.getUTCMinutes() - LIVE_CLASS_OPEN_BEFORE_MINUTES);

  const cierre = combinarFechaHoraUtc(input.fecha, input.horaFin);
  cierre.setUTCMinutes(cierre.getUTCMinutes() + LIVE_CLASS_CLOSE_AFTER_MINUTES);

  return ahora >= apertura && ahora <= cierre;
}

function diferenciaAbsolutaMinutos(jornada: JornadaInstruccion, ahora: Date): number {
  const inicio = combinarFechaHoraUtc(jornada.fecha, jornada.horaInicio);
  return Math.abs(ahora.getTime() - inicio.getTime());
}

/**
 * NOTA: superado por Bloque B / Fase 9 (`design.md`, Decision 12) -- `calcularJornadasEnVentana`
 * retorna 0..N mas `filtrarJornadasPorPermiso`. Esta version (Fase 4 / Bloque A) retorna una sola
 * jornada: si hay 2+ jornadas activas simultaneamente (p.ej. mismo instructor con 2 grupos), elige
 * la mas proxima a `ahoraIso` de forma deterministica, sin implementar el selector completo de
 * Bloque B (fuera de alcance de esta fase, ver tasks.md Fase 4).
 */
export function calcularVentanaClaseEnVivo(
  jornadas: JornadaInstruccion[],
  ahoraIso: string
): JornadaInstruccion | null {
  const ahora = new Date(ahoraIso);
  const activas = jornadas.filter((jornada) => estaJornadaEnVentana(jornada, ahoraIso));

  if (activas.length === 0) return null;

  return activas.reduce((masCercana, actual) =>
    diferenciaAbsolutaMinutos(actual, ahora) < diferenciaAbsolutaMinutos(masCercana, ahora) ? actual : masCercana
  );
}
