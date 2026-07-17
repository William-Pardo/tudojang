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

// Subtarea 12.10: extraido de `estaJornadaEnVentana` (sin cambiar su comportamiento/firma) para
// que `calcularIndicadorClaseEnVivo` (abajo) reutilice el MISMO calculo de apertura/cierre en vez
// de duplicarlo -- ambas funciones deben usar exactamente el mismo par de fechas.
function calcularVentanaHoraria(input: VentanaJornadaInput): { apertura: Date; cierre: Date } {
  const apertura = combinarFechaHoraUtc(input.fecha, input.horaInicio);
  apertura.setUTCMinutes(apertura.getUTCMinutes() - LIVE_CLASS_OPEN_BEFORE_MINUTES);

  const cierre = combinarFechaHoraUtc(input.fecha, input.horaFin);
  cierre.setUTCMinutes(cierre.getUTCMinutes() + LIVE_CLASS_CLOSE_AFTER_MINUTES);

  return { apertura, cierre };
}

/**
 * Pura y reutilizable: true si `ahoraIso` cae dentro de `[horaInicio-15min, horaFin+15min]` de
 * `input`. Exportada para que consumidores que no tienen una `JornadaInstruccion` completa (p.ej.
 * `ClaseAcademicaAgenda` en `vistas/Horarios.tsx`, que expone `proximaFecha` en vez de `fecha`)
 * puedan reusar la misma logica de ventana sin duplicarla.
 */
export function estaJornadaEnVentana(input: VentanaJornadaInput, ahoraIso: string): boolean {
  const ahora = new Date(ahoraIso);
  const { apertura, cierre } = calcularVentanaHoraria(input);

  return ahora >= apertura && ahora <= cierre;
}

/**
 * Subtarea 12.10 (Agenda, `Mejora del módulo Agenda.txt` seccion 14), simplificado
 * 2026-07-16 (pedido explicito del usuario: la parrilla mostraba DOS badges por bloque --
 * este indicador de 6 valores MAS el badge de estado academico de 10 valores -- y se sentia
 * sobrecargada). Se fusiona a 4 estados pensados para un vistazo rapido, cruzando el estado
 * academico (`EstadoJornada`, `models/academico/index.ts`) con la MISMA ventana horaria
 * `[horaInicio-15min, horaFin+15min]` que ya usan `estaJornadaEnVentana`/
 * `calcularVentanaClaseEnVivo` arriba (Fase 4, `clase-en-vivo-checkin-trigger-agenda`):
 * - `'programada'` + `'proxima'` (misma vs. otro dia calendario) se fusionan en `'proxima'`
 *   -- la distincion de dia exacto no aportaba nada para un padre/estudiante mirando la
 *   Agenda, solo importaba como debug interno.
 * - `'disponible'` (ventana horaria abierta, check-in habilitado) + `'en_curso'` (marcada
 *   manualmente como iniciada) se fusionan en `'activa'` ("Clase activa") -- ambas
 *   significan, desde afuera, "esto esta pasando ahora"; la distincion fina solo le importa
 *   al instructor operando la clase, no a quien consulta la Agenda.
 */
export type IndicadorClaseEnVivo =
  | 'proxima'
  | 'activa'
  | 'finalizada'
  | 'cancelada';

interface JornadaIndicadorInput extends VentanaJornadaInput {
  estado: JornadaInstruccion['estado'];
}

/**
 * Pura y reutilizable (mismo criterio de `estaJornadaEnVentana`): deriva el indicador
 * SIMPLIFICADO de Clase en Vivo de UNA jornada puntual cruzando su estado academico con la
 * ventana horaria. El estado academico completo (`ESTILO_POR_ESTADO`/10 valores, para
 * operar la clase -- editar, cerrar, registrar asistencia) sigue viviendo en el modal de
 * edicion; este indicador es el resumen de 4 valores para la vista de un vistazo (grilla de
 * Agenda, futuro Hub Estudiantes).
 *
 * Precedencia (de mayor a menor prioridad):
 * 1. `estado === 'cancelada'` -> `'cancelada'`. Seccion 14: "si se cancela la clase, Clase en
 *    Vivo debe ocultarse o bloquearse" -- el indicador lo refleja explicitamente antes que
 *    cualquier calculo de ventana.
 * 2. `estado === 'cerrada'` -> `'finalizada'`. Cierre academico manual (ver `jornadaService.ts`,
 *    exige `asistenciaRegistrada`/`objetivosImpartidos`), independiente de si la ventana
 *    horaria ya paso o no.
 * 3. `estado === 'en_curso'` -> `'activa'`. Fuente de verdad academica manual (ver
 *    `MisClasesView.tsx`), prevalece sobre el calculo puramente horario del punto 4.
 * 4. Ventana horaria (`calcularVentanaHoraria`, MISMOS `LIVE_CLASS_OPEN_BEFORE_MINUTES`/
 *    `LIVE_CLASS_CLOSE_AFTER_MINUTES` que el resto del archivo, sin umbrales nuevos):
 *    - `ahora > cierre` -> `'finalizada'` (paso la ventana sin cierre academico manual).
 *    - `apertura <= ahora <= cierre` -> `'activa'` (check-in habilitado, sin haber pasado
 *      aun a `en_curso` segun el estado academico -- mismo indicador visible que el punto 3).
 *    - cualquier otro caso (antes de la apertura, cualquier dia) -> `'proxima'`.
 */
export function calcularIndicadorClaseEnVivo(
  input: JornadaIndicadorInput,
  ahoraIso: string
): IndicadorClaseEnVivo {
  if (input.estado === 'cancelada') return 'cancelada';
  if (input.estado === 'cerrada') return 'finalizada';
  if (input.estado === 'en_curso') return 'activa';

  const ahora = new Date(ahoraIso);
  const { apertura, cierre } = calcularVentanaHoraria(input);

  if (ahora > cierre) return 'finalizada';
  if (ahora >= apertura) return 'activa';

  return 'proxima';
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
