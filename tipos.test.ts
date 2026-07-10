import { 
    ProgramaAcademico, 
    CohorteAcademica, 
    JornadaAcademica 
} from './tipos';

describe('Entidades Base - Etapa 1 (Agenda/Programa/Clase)', () => {
    
    it('ProgramaAcademico permite estructurar grados incluidos y estado', () => {
        const programaMock: ProgramaAcademico = {
            id: 'prog-1',
            tenantId: 'tenant-test',
            nombre: 'Programa Infantil',
            grupoObjetivo: 'Infantil',
            gradosIncluidos: ['Blanco', 'Amarillo'],
            fechaInicio: '2026-01-01',
            fechaFin: '2026-12-31',
            estado: 'activo',
            objetivos: ['Aprender base'],
            tags: ['niños'],
            creadoPorUid: 'admin-1',
            creadoEn: '2026-01-01T00:00:00Z',
            actualizadoEn: '2026-01-01T00:00:00Z'
        };

        expect(programaMock.estado).toBe('activo');
        expect(programaMock.gradosIncluidos).toContain('Blanco');
    });

    it('CohorteAcademica referencia programaId, sedeId, maestroTitularId y horario', () => {
        const cohorteMock: CohorteAcademica = {
            id: 'cohorte-1',
            tenantId: 'tenant-test',
            programaId: 'prog-1',
            nombre: 'Grupo Martes/Jueves',
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            grupoOperativo: 'Infantil Básico',
            gradosIncluidos: ['Blanco'],
            horario: [
                { diaSemana: 'martes', horaInicio: '16:00', horaFin: '17:00' },
                { diaSemana: 'jueves', horaInicio: '16:00', horaFin: '17:00' }
            ],
            fechaInicio: '2026-01-01',
            fechaFin: '2026-12-31',
            estado: 'en_curso',
            creadoPorUid: 'admin-1',
            creadoEn: '2026-01-01T00:00:00Z',
            actualizadoEn: '2026-01-01T00:00:00Z'
        };

        expect(cohorteMock.programaId).toBe('prog-1');
        expect(cohorteMock.sedeId).toBe('sede-1');
        expect(cohorteMock.horario.length).toBe(2);
    });

    it('JornadaAcademica puede tener programaId y cohorteId', () => {
        const jornadaMock: JornadaAcademica = {
            id: 'jornada-1',
            tenantId: 'tenant-test',
            programaId: 'prog-1',
            cohorteId: 'cohorte-1',
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            maestroEjecutorId: 'maestro-1',
            grupoOperativo: 'Infantil Básico',
            gradosIncluidos: ['Blanco'],
            fecha: '2026-07-03',
            horaInicio: '16:00',
            horaFin: '17:00',
            estado: 'programada',
            origen: 'programa',
            creadoPorUid: 'admin-1',
            creadoEn: '2026-01-01T00:00:00Z',
            actualizadoEn: '2026-01-01T00:00:00Z'
        };

        expect(jornadaMock.programaId).toBe('prog-1');
        expect(jornadaMock.cohorteId).toBe('cohorte-1');
        expect(jornadaMock.estado).toBe('programada');
    });
});
