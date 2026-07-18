// servicios/academico/patronHorarioService.ts
// Agregacion de dia/hora de consulta a partir de ActividadLog.registradoEn (timestamp real
// por evento, ver models/academico/actividad.ts). Logica pura: no toca Firestore, recibe los
// logs ya cargados (actividadService.obtenerActividades) y calcula el patron.

import type { ActividadLog } from '../../models/academico/actividad';
import type { ProgramaDeAsignacion } from './analisisProgresoService';

const ZONA_HORARIA = 'America/Bogota';

const FORMATTER_DIA = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA_HORARIA, weekday: 'long' });
const FORMATTER_HORA = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA, hour: 'numeric', hourCycle: 'h23' });

// Orden de exhibicion (semana empieza en lunes, no en domingo como el default de JS).
const ORDEN_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function nombreDiaBogota(iso: string): string {
  return capitalizar(FORMATTER_DIA.format(new Date(iso)));
}

function horaBogota(iso: string): number {
  const formateada = FORMATTER_HORA.format(new Date(iso));
  // hourCycle h23 devuelve "0".."23", salvo el caso limite "24" que representa medianoche.
  const hora = Number(formateada);
  return hora === 24 ? 0 : hora;
}

export interface DistribucionDia {
  dia: string;
  cantidad: number;
}

export interface PatronHorario {
  totalEventos: number;
  porDia: DistribucionDia[]; // ordenado Lunes -> Domingo
  porHora: number[]; // length 24, index = hora (0-23)
  diaPico: string;
  horaPico: number;
  pctFinDeSemana: number;
}

/**
 * Filtra los logs por programa si se pasa un mapa asignacion->programa y un filtro distinto
 * de 'todos'. Un log cuya asignacion no tiene programa resuelto se excluye cuando hay filtro
 * activo (mismo criterio que escalarMetricasAPrograma/calcularMetricasPorMaterial).
 */
function filtrarPorPrograma(
  logs: ActividadLog[],
  mapaAsignacionPrograma: Map<string, ProgramaDeAsignacion> | undefined,
  filtroPrograma: string | undefined
): ActividadLog[] {
  if (!filtroPrograma || filtroPrograma === 'todos' || !mapaAsignacionPrograma) return logs;
  return logs.filter((log) => mapaAsignacionPrograma.get(log.asignacionId)?.programaId === filtroPrograma);
}

/** null cuando no hay ningun evento (nada que graficar todavia). */
export function calcularPatronHorario(
  logs: ActividadLog[],
  mapaAsignacionPrograma?: Map<string, ProgramaDeAsignacion>,
  filtroPrograma?: string
): PatronHorario | null {
  const filtrados = filtrarPorPrograma(logs, mapaAsignacionPrograma, filtroPrograma);
  if (filtrados.length === 0) return null;

  const conteoDias = new Map<string, number>(ORDEN_DIAS.map((d) => [d, 0]));
  const conteoHoras = new Array(24).fill(0);

  for (const log of filtrados) {
    const dia = nombreDiaBogota(log.registradoEn);
    const hora = horaBogota(log.registradoEn);
    conteoDias.set(dia, (conteoDias.get(dia) ?? 0) + 1);
    conteoHoras[hora] += 1;
  }

  const porDia = ORDEN_DIAS.map((dia) => ({ dia, cantidad: conteoDias.get(dia) ?? 0 }));
  const diaPico = porDia.reduce((max, actual) => (actual.cantidad > max.cantidad ? actual : max)).dia;
  const horaPico = conteoHoras.reduce(
    (iMax, valor, i, arr) => (valor > arr[iMax] ? i : iMax),
    0
  );
  const finDeSemana = (conteoDias.get('Sábado') ?? 0) + (conteoDias.get('Domingo') ?? 0);
  const pctFinDeSemana = Math.round((finDeSemana / filtrados.length) * 100);

  return {
    totalEventos: filtrados.length,
    porDia,
    porHora: conteoHoras,
    diaPico,
    horaPico,
    pctFinDeSemana,
  };
}

/** "19:00 h" a partir de una hora 0-23. */
export function formatearHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00 h`;
}
