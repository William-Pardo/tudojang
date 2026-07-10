import { JornadaAcademica, CohorteAcademica, ProgramaAcademico } from '../tipos';
import { obtenerDiaSemanaUtc } from '../shared/diasSemana';

export async function crearClaseManual(params: any): Promise<any> {
    const { tenantId, sedeId, maestroTitularId, grupoOperativo, gradosIncluidos, fecha, horaInicio, horaFin, creadoPorUid, jornadasExistentes } = params;

    const conflicto = jornadasExistentes?.find((j: JornadaAcademica) => 
        j.fecha === fecha && j.sedeId === sedeId && j.maestroTitularId === maestroTitularId &&
        j.horaInicio === horaInicio && j.horaFin === horaFin
    );

    if (conflicto) return { exito: false, error: 'Conflicto de agenda' };

    const clase: JornadaAcademica = {
        id: `clase-manual-${Date.now()}`,
        tenantId,
        sedeId,
        maestroTitularId,
        maestroEjecutorId: maestroTitularId,
        grupoOperativo,
        gradosIncluidos,
        fecha,
        horaInicio,
        horaFin,
        estado: 'programada',
        origen: 'agenda_manual',
        creadoPorUid,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
    };

    return { exito: true, clase };
}

export async function vincularClaseACohorte(params: any): Promise<any> {
    const { clase, cohorte, actualizadoPorUid } = params;
    
    const claseVinculada: JornadaAcademica = {
        ...clase,
        programaId: cohorte.programaId,
        cohorteId: cohorte.id,
        actualizadoEn: new Date().toISOString()
    };

    return { exito: true, claseVinculada };
}

export async function editarClaseManual(params: any): Promise<any> {
    const { claseOriginal, nuevosDatos, jornadasExistentes, actualizadoPorUid } = params;
    
    // Check conflicts excluding the same class
    const conflicto = jornadasExistentes?.find((j: JornadaAcademica) => 
        j.id !== claseOriginal.id &&
        j.fecha === (nuevosDatos.fecha || claseOriginal.fecha) && 
        j.sedeId === (nuevosDatos.sedeId || claseOriginal.sedeId) && 
        j.maestroTitularId === (nuevosDatos.maestroTitularId || claseOriginal.maestroTitularId) &&
        j.horaInicio === (nuevosDatos.horaInicio || claseOriginal.horaInicio) && 
        j.horaFin === (nuevosDatos.horaFin || claseOriginal.horaFin)
    );

    if (conflicto) return { exito: false, error: 'Conflicto de agenda' };

    const claseEditada: JornadaAcademica = {
        ...claseOriginal,
        ...nuevosDatos,
        actualizadoEn: new Date().toISOString()
    };

    return { exito: true, claseEditada };
}

export async function crearProgramaDesdeAgenda(params: any): Promise<any> {
    const { claseOrigen, nombrePrograma, creadoPorUid } = params;

    const programaCreado: ProgramaAcademico = {
        id: `prog-auto-${Date.now()}`,
        tenantId: claseOrigen.tenantId,
        nombre: nombrePrograma,
        grupoObjetivo: claseOrigen.grupoOperativo,
        gradosIncluidos: claseOrigen.gradosIncluidos,
        fechaInicio: claseOrigen.fecha,
        fechaFin: claseOrigen.fecha, // Default a la misma fecha
        estado: 'activo',
        objetivos: [],
        tags: ['auto-generado'],
        creadoPorUid,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
    };

    const diaSemana = obtenerDiaSemanaUtc(new Date(claseOrigen.fecha + 'T12:00:00Z'));

    const cohorteCreada: CohorteAcademica = {
        id: `cohorte-auto-${Date.now()}`,
        tenantId: claseOrigen.tenantId,
        programaId: programaCreado.id,
        nombre: `Cohorte ${nombrePrograma}`,
        sedeId: claseOrigen.sedeId,
        maestroTitularId: claseOrigen.maestroTitularId,
        grupoOperativo: claseOrigen.grupoOperativo,
        gradosIncluidos: claseOrigen.gradosIncluidos,
        horario: [{ diaSemana, horaInicio: claseOrigen.horaInicio, horaFin: claseOrigen.horaFin }],
        fechaInicio: claseOrigen.fecha,
        fechaFin: claseOrigen.fecha,
        estado: 'agenda_generada',
        creadoPorUid,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
    };

    const claseActualizada: JornadaAcademica = {
        ...claseOrigen,
        programaId: programaCreado.id,
        cohorteId: cohorteCreada.id,
        actualizadoEn: new Date().toISOString()
    };

    return { exito: true, programaCreado, cohorteCreada, claseActualizada };
}
