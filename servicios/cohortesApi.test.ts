import { crearCohorteDesdePrograma } from './cohortesApi';
import { ProgramaAcademico, CohorteAcademica, HorarioRecurrente } from '../tipos';

describe('Etapa 2 - Cohortes API (RED)', () => {

    const programaBase: ProgramaAcademico = {
        id: 'prog-1',
        tenantId: 'tenant-test',
        nombre: 'Programa Test',
        grupoObjetivo: 'Infantil',
        gradosIncluidos: ['Blanco', 'Amarillo'],
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        estado: 'activo',
        objetivos: [],
        tags: [],
        creadoPorUid: 'admin-1',
        creadoEn: '2026-01-01T00:00:00Z',
        actualizadoEn: '2026-01-01T00:00:00Z'
    };

    const horarioBase: HorarioRecurrente[] = [
        { diaSemana: 'lunes', horaInicio: '16:00', horaFin: '17:00' }
    ];

    it('crear cohorte desde programa conserva programaId, sedeId, maestroTitularId, grupoOperativo, gradosIncluidos', async () => {
        const cohortesExistentes: CohorteAcademica[] = [];
        
        const resultado = await crearCohorteDesdePrograma({
            programa: programaBase,
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            grupoOperativo: 'Infantil A',
            gradosIncluidos: ['Blanco'],
            horario: horarioBase,
            creadoPorUid: 'admin-1',
            cohortesExistentes
        });

        expect(resultado.exito).toBe(true);
        expect(resultado.cohorte?.programaId).toBe('prog-1');
        expect(resultado.cohorte?.sedeId).toBe('sede-1');
        expect(resultado.cohorte?.maestroTitularId).toBe('maestro-1');
        expect(resultado.cohorte?.grupoOperativo).toBe('Infantil A');
        expect(resultado.cohorte?.gradosIncluidos).toEqual(['Blanco']);
        expect(resultado.cohorte?.estado).toBe('sin_agenda');
    });

    it('una cohorte puede contener múltiples grados del mismo grupo', async () => {
        const cohortesExistentes: CohorteAcademica[] = [];
        
        const resultado = await crearCohorteDesdePrograma({
            programa: programaBase,
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            grupoOperativo: 'Infantil Completo',
            gradosIncluidos: ['Blanco', 'Amarillo'],
            horario: horarioBase,
            creadoPorUid: 'admin-1',
            cohortesExistentes
        });

        expect(resultado.exito).toBe(true);
        expect(resultado.cohorte?.gradosIncluidos).toContain('Blanco');
        expect(resultado.cohorte?.gradosIncluidos).toContain('Amarillo');
    });

    it('no se duplica una cohorte con mismo programa, sede, maestro, grupo y horario', async () => {
        const cohorteExistente: CohorteAcademica = {
            id: 'cohorte-existente',
            tenantId: 'tenant-test',
            programaId: 'prog-1',
            nombre: 'Grupo Test',
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            grupoOperativo: 'Infantil A',
            gradosIncluidos: ['Blanco'],
            horario: horarioBase,
            fechaInicio: '2026-01-01',
            fechaFin: '2026-12-31',
            estado: 'sin_agenda',
            creadoPorUid: 'admin-1',
            creadoEn: '2026-01-01T00:00:00Z',
            actualizadoEn: '2026-01-01T00:00:00Z'
        };

        const resultado = await crearCohorteDesdePrograma({
            programa: programaBase,
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            grupoOperativo: 'Infantil A',
            gradosIncluidos: ['Blanco'],
            horario: horarioBase,
            creadoPorUid: 'admin-2',
            cohortesExistentes: [cohorteExistente]
        });

        expect(resultado.exito).toBe(false);
        expect(resultado.error).toBe('Cohorte duplicada detectada para este programa, sede, maestro, grupo y horario.');
        expect(resultado.cohorte).toBeUndefined();
    });
});
