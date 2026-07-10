import { ProgramaAcademico, CohorteAcademica, HorarioRecurrente } from '../tipos';

/**
 * Parámetros requeridos para crear una cohorte desde un programa existente.
 */
export interface CrearCohorteParams {
    programa: ProgramaAcademico;
    sedeId: string;
    maestroTitularId: string;
    grupoOperativo: string;
    gradosIncluidos: string[];
    horario: HorarioRecurrente[];
    creadoPorUid: string;
    cohortesExistentes: CohorteAcademica[];
}

/**
 * Resultado de la operación de creación de cohorte.
 */
export interface CrearCohorteResult {
    exito: boolean;
    cohorte?: CohorteAcademica;
    error?: string;
}

/**
 * Helper interno: Verifica si dos arrays de horarios son estructuralmente idénticos.
 * Normaliza el orden de los días de la semana para asegurar comparaciones justas.
 */
function horariosSonIguales(h1: HorarioRecurrente[], h2: HorarioRecurrente[]): boolean {
    if (h1.length !== h2.length) return false;
    const s1 = [...h1].sort((a, b) => a.diaSemana.localeCompare(b.diaSemana));
    const s2 = [...h2].sort((a, b) => a.diaSemana.localeCompare(b.diaSemana));
    return JSON.stringify(s1) === JSON.stringify(s2);
}

/**
 * Verifica si existe una duplicidad estricta entre una cohorte nueva y las existentes.
 * 
 * Regla de duplicidad: Mismo Programa + Misma Sede + Mismo Maestro + Mismo Grupo + Mismo Horario.
 */
function esCohorteDuplicada(params: CrearCohorteParams): boolean {
    const { programa, sedeId, maestroTitularId, grupoOperativo, horario, cohortesExistentes } = params;
    return cohortesExistentes.some(c => 
        c.programaId === programa.id &&
        c.sedeId === sedeId &&
        c.maestroTitularId === maestroTitularId &&
        c.grupoOperativo === grupoOperativo &&
        horariosSonIguales(c.horario, horario)
    );
}

/**
 * Crea una nueva cohorte asegurando que no rompa las reglas anti-duplicidad.
 * (TDD - Etapa 2)
 */
export async function crearCohorteDesdePrograma(params: CrearCohorteParams): Promise<CrearCohorteResult> {
    const { 
        programa, 
        sedeId, 
        maestroTitularId, 
        grupoOperativo, 
        gradosIncluidos, 
        horario, 
        creadoPorUid 
    } = params;

    // 1. Auditoría de reglas anti-duplicidad
    if (esCohorteDuplicada(params)) {
        return {
            exito: false,
            error: 'Cohorte duplicada detectada para este programa, sede, maestro, grupo y horario.'
        };
    }

    // 2. Construcción de entidad
    const nuevaCohorte: CohorteAcademica = {
        id: `cohorte-${Date.now()}`,
        tenantId: programa.tenantId,
        programaId: programa.id,
        nombre: `${programa.nombre} - ${sedeId} - ${grupoOperativo}`,
        sedeId,
        maestroTitularId,
        grupoOperativo,
        gradosIncluidos,
        horario,
        fechaInicio: programa.fechaInicio,
        fechaFin: programa.fechaFin,
        estado: 'sin_agenda',
        creadoPorUid,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
    };

    return {
        exito: true,
        cohorte: nuevaCohorte
    };
}
