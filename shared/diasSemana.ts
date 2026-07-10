import { HorarioRecurrente } from '../tipos';

/**
 * Mapeo estándar de índice UTC (Date.getUTCDay()) a nombre de día en español.
 * Reutilizado por jornadasApi y agendaManualApi para evitar duplicación.
 */
export const DIAS_SEMANA_MAPA: Record<number, HorarioRecurrente['diaSemana']> = {
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado'
};

/**
 * Dado un Date, retorna el nombre del día de la semana en español usando UTC.
 */
export function obtenerDiaSemanaUtc(fecha: Date): HorarioRecurrente['diaSemana'] {
    return DIAS_SEMANA_MAPA[fecha.getUTCDay()];
}
