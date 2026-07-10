import { CohorteAcademica, JornadaAcademica } from '../tipos';
import { obtenerDiaSemanaUtc } from '../shared/diasSemana';

/**
 * Parámetros requeridos para el algoritmo de generación masiva de jornadas.
 */
export interface GenerarJornadasParams {
    cohorte: CohorteAcademica;
    creadoPorUid: string;
    jornadasExistentes: JornadaAcademica[];
    excepcionPermitida?: boolean;
}

/**
 * Resultado detallado de la operación, separando creadas nuevas de asimiladas.
 */
export interface GenerarJornadasResult {
    exito: boolean;
    jornadasGeneradas: JornadaAcademica[];
    jornadasVinculadas: JornadaAcademica[];
    error?: string;
    excepcionAplicada?: boolean;
}

/**
 * Genera un calendario de jornadas recurrentes basado en la fecha de inicio, fin y horario de una cohorte.
 * Contiene reglas estrictas anti-empalme temporal por Sede y Maestro.
 * 
 * @param params Parámetros de la cohorte e historial de jornadas
 * @returns Arrays de jornadas listas para inyección en DB
 */

export async function generarJornadasDesdeCohorte(params: GenerarJornadasParams): Promise<GenerarJornadasResult> {
    const { cohorte, creadoPorUid, jornadasExistentes, excepcionPermitida } = params;
    const { fechaInicio, fechaFin, horario, sedeId, maestroTitularId } = cohorte;

    const generadas: JornadaAcademica[] = [];
    const vinculadas: JornadaAcademica[] = [];

    const inicio = new Date(fechaInicio + 'T12:00:00Z');
    const fin = new Date(fechaFin + 'T12:00:00Z');

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || inicio > fin) {
        return { exito: false, jornadasGeneradas: [], jornadasVinculadas: [], error: 'Rango de fechas inválido' };
    }

    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
        const diaSemana = obtenerDiaSemanaUtc(d);
        
        // Buscar si el día de la semana está en el horario de la cohorte
        const bloquesHorario = horario.filter(h => h.diaSemana === diaSemana);
        
        for (const bloque of bloquesHorario) {
            const fechaStr = d.toISOString().split('T')[0];

            // Revisar conflictos con jornadas existentes
            const conflicto = jornadasExistentes.find(j => 
                j.fecha === fechaStr && 
                j.sedeId === sedeId &&
                j.maestroTitularId === maestroTitularId &&
                j.horaInicio === bloque.horaInicio &&
                j.horaFin === bloque.horaFin
            );

            if (conflicto) {
                if (conflicto.cohorteId === cohorte.id || conflicto.cohorteId === undefined || conflicto.cohorteId === null) {
                    // Es compatible y huérfana (o de la misma cohorte), la vinculamos
                    const vinculada = { ...conflicto, cohorteId: cohorte.id, programaId: cohorte.programaId };
                    vinculadas.push(vinculada);
                } else if (!excepcionPermitida) {
                    // Hay un conflicto real con otra cohorte
                    return {
                        exito: false,
                        jornadasGeneradas: [],
                        jornadasVinculadas: [],
                        error: `Conflicto de agenda detectado en ${sedeId} para ${maestroTitularId} el ${fechaStr}`
                    };
                }
            } else {
                // No hay conflicto, la creamos
                generadas.push({
                    id: `jornada-${fechaStr}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                    tenantId: cohorte.tenantId,
                    programaId: cohorte.programaId,
                    cohorteId: cohorte.id,
                    sedeId: cohorte.sedeId,
                    maestroTitularId: cohorte.maestroTitularId,
                    maestroEjecutorId: cohorte.maestroTitularId, // por defecto es el mismo
                    grupoOperativo: cohorte.grupoOperativo,
                    gradosIncluidos: cohorte.gradosIncluidos,
                    fecha: fechaStr,
                    horaInicio: bloque.horaInicio,
                    horaFin: bloque.horaFin,
                    estado: 'programada',
                    origen: 'programa',
                    creadoPorUid,
                    creadoEn: new Date().toISOString(),
                    actualizadoEn: new Date().toISOString()
                });
            }
        }
    }

    return {
        exito: true,
        jornadasGeneradas: generadas,
        jornadasVinculadas: vinculadas,
        excepcionAplicada: excepcionPermitida
    };
}
