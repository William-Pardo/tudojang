import { generarJornadasDesdeCohorte } from './jornadasApi';
import { CohorteAcademica, JornadaAcademica } from '../tipos';

describe('Etapa 3 - Jornadas API (RED)', () => {

    const cohorteBase: CohorteAcademica = {
        id: 'cohorte-1',
        tenantId: 'tenant-test',
        programaId: 'prog-1',
        nombre: 'Grupo Lunes/Miercoles',
        sedeId: 'sede-1',
        maestroTitularId: 'maestro-1',
        grupoOperativo: 'Infantil A',
        gradosIncluidos: ['Blanco'],
        horario: [
            { diaSemana: 'lunes', horaInicio: '16:00', horaFin: '17:00' },
            { diaSemana: 'miercoles', horaInicio: '16:00', horaFin: '17:00' }
        ],
        fechaInicio: '2026-07-06', // Lunes
        fechaFin: '2026-07-12',    // Domingo (1 semana de duración)
        estado: 'agenda_generada',
        creadoPorUid: 'admin-1',
        creadoEn: '2026-07-01T00:00:00Z',
        actualizadoEn: '2026-07-01T00:00:00Z'
    };

    it('generar jornadas por rango de fechas y horario recurrente', async () => {
        const jornadasExistentes: JornadaAcademica[] = [];

        const resultado = await generarJornadasDesdeCohorte({
            cohorte: cohorteBase,
            creadoPorUid: 'admin-1',
            jornadasExistentes
        });

        expect(resultado.exito).toBe(true);
        // Debe generar 2 jornadas: una el lunes (6) y una el miércoles (8)
        expect(resultado.jornadasGeneradas).toHaveLength(2);
        expect(resultado.jornadasGeneradas[0].fecha).toBe('2026-07-06');
        expect(resultado.jornadasGeneradas[1].fecha).toBe('2026-07-08');
        expect(resultado.jornadasGeneradas[0].estado).toBe('programada');
    });

    it('no generar duplicados por sede/hora/maestro/cohorte', async () => {
        const jornadaExistenteDuplicada: JornadaAcademica = {
            id: 'jornada-duplicada',
            tenantId: 'tenant-test',
            cohorteId: 'cohorte-otra', // Diferente cohorte, pero...
            sedeId: 'sede-1',          // Misma sede
            maestroTitularId: 'maestro-1', // Mismo maestro
            maestroEjecutorId: 'maestro-1',
            grupoOperativo: 'Adultos',
            gradosIncluidos: ['Negro'],
            fecha: '2026-07-06',
            horaInicio: '16:00',       // Misma hora
            horaFin: '17:00',
            estado: 'programada',
            origen: 'programa',
            creadoPorUid: 'admin-1',
            creadoEn: '2026-07-01T00:00:00Z',
            actualizadoEn: '2026-07-01T00:00:00Z'
        };

        const resultado = await generarJornadasDesdeCohorte({
            cohorte: cohorteBase,
            creadoPorUid: 'admin-1',
            jornadasExistentes: [jornadaExistenteDuplicada]
        });

        // La jornada del lunes choca, por tanto falla toda la transacción para evitar empalmes
        expect(resultado.exito).toBe(false);
        expect(resultado.error).toContain('Conflicto de agenda detectado en sede-1 para maestro-1');
        expect(resultado.jornadasGeneradas).toHaveLength(0);
    });

    it('detectar jornada compatible existente y vincularla', async () => {
        const jornadaHuerfanaCompatible: JornadaAcademica = {
            id: 'jornada-huerfana',
            tenantId: 'tenant-test',
            // No tiene cohorte asignada aún
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            maestroEjecutorId: 'maestro-1',
            grupoOperativo: 'Infantil A',
            gradosIncluidos: ['Blanco'],
            fecha: '2026-07-08',
            horaInicio: '16:00',
            horaFin: '17:00',
            estado: 'programada',
            origen: 'agenda_manual',
            creadoPorUid: 'admin-1',
            creadoEn: '2026-07-01T00:00:00Z',
            actualizadoEn: '2026-07-01T00:00:00Z'
        };

        const resultado = await generarJornadasDesdeCohorte({
            cohorte: cohorteBase,
            creadoPorUid: 'admin-1',
            jornadasExistentes: [jornadaHuerfanaCompatible]
        });

        expect(resultado.exito).toBe(true);
        // Debe generar la del lunes (1 nueva) y actualizar la huérfana del miércoles
        expect(resultado.jornadasGeneradas).toHaveLength(1);
        expect(resultado.jornadasVinculadas).toHaveLength(1);
        expect(resultado.jornadasVinculadas[0].cohorteId).toBe('cohorte-1');
    });

    it('permitir excepción justificada', async () => {
        const resultado = await generarJornadasDesdeCohorte({
            cohorte: cohorteBase,
            creadoPorUid: 'admin-1',
            jornadasExistentes: [],
            excepcionPermitida: true
        });

        expect(resultado.exito).toBe(true);
        expect(resultado.excepcionAplicada).toBe(true);
    });

    it('REFACTOR: generar jornadas correctamente cuando el rango cruza cambio de mes o año bisiesto', async () => {
        const cohorteSaltoMes: CohorteAcademica = {
            ...cohorteBase,
            fechaInicio: '2026-02-27', // Febrero no bisiesto 2026
            fechaFin: '2026-03-02',    // Marzo
            horario: [
                { diaSemana: 'viernes', horaInicio: '16:00', horaFin: '17:00' }, // 27 es Viernes
                { diaSemana: 'lunes', horaInicio: '16:00', horaFin: '17:00' }    // 2 es Lunes
            ]
        };

        const resultado = await generarJornadasDesdeCohorte({
            cohorte: cohorteSaltoMes,
            creadoPorUid: 'admin-1',
            jornadasExistentes: []
        });

        expect(resultado.exito).toBe(true);
        expect(resultado.jornadasGeneradas).toHaveLength(2);
        expect(resultado.jornadasGeneradas[0].fecha).toBe('2026-02-27');
        expect(resultado.jornadasGeneradas[1].fecha).toBe('2026-03-02');
    });
});
