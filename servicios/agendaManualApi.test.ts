import { 
    crearClaseManual, 
    vincularClaseACohorte, 
    editarClaseManual, 
    crearProgramaDesdeAgenda 
} from './agendaManualApi';
import { JornadaAcademica, CohorteAcademica, ProgramaAcademico } from '../tipos';

describe('Etapa 4 - Agenda Manual API (RED)', () => {

    const claseBase: JornadaAcademica = {
        id: 'clase-manual-1',
        tenantId: 'tenant-test',
        sedeId: 'sede-1',
        maestroTitularId: 'maestro-1',
        maestroEjecutorId: 'maestro-1',
        grupoOperativo: 'Adultos',
        gradosIncluidos: ['Blanco'],
        fecha: '2026-08-10',
        horaInicio: '18:00',
        horaFin: '19:00',
        estado: 'programada',
        origen: 'agenda_manual', // Debería ser esto por defecto
        creadoPorUid: 'admin-1',
        creadoEn: '2026-08-01T00:00:00Z',
        actualizadoEn: '2026-08-01T00:00:00Z'
    };

    it('crear clase manual sin programa marca origen: agenda_manual y sin IDs académicos', async () => {
        const resultado = await crearClaseManual({
            tenantId: 'tenant-test',
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            grupoOperativo: 'Adultos',
            gradosIncluidos: ['Blanco'],
            fecha: '2026-08-10',
            horaInicio: '18:00',
            horaFin: '19:00',
            creadoPorUid: 'admin-1',
            jornadasExistentes: []
        });

        expect(resultado.exito).toBe(true);
        expect(resultado.clase?.origen).toBe('agenda_manual');
        expect(resultado.clase?.programaId).toBeUndefined();
        expect(resultado.clase?.cohorteId).toBeUndefined();
    });

    it('vincular clase manual a cohorte actualiza programaId y cohorteId', async () => {
        const cohorteDestino: CohorteAcademica = {
            id: 'cohorte-1',
            tenantId: 'tenant-test',
            programaId: 'prog-1',
            nombre: 'Grupo Adultos',
            sedeId: 'sede-1',
            maestroTitularId: 'maestro-1',
            grupoOperativo: 'Adultos',
            gradosIncluidos: ['Blanco'],
            horario: [{ diaSemana: 'lunes', horaInicio: '18:00', horaFin: '19:00' }],
            fechaInicio: '2026-08-01',
            fechaFin: '2026-12-31',
            estado: 'agenda_generada',
            creadoPorUid: 'admin-1',
            creadoEn: '2026-08-01T00:00:00Z',
            actualizadoEn: '2026-08-01T00:00:00Z'
        };

        const resultado = await vincularClaseACohorte({
            clase: claseBase,
            cohorte: cohorteDestino,
            actualizadoPorUid: 'admin-1'
        });

        expect(resultado.exito).toBe(true);
        expect(resultado.claseVinculada?.programaId).toBe('prog-1');
        expect(resultado.claseVinculada?.cohorteId).toBe('cohorte-1');
    });

    it('editar clase manual mantiene reglas anti-duplicidad', async () => {
        const claseExistente: JornadaAcademica = {
            ...claseBase,
            id: 'clase-existente-2',
            horaInicio: '20:00',
            horaFin: '21:00'
        };

        const resultado = await editarClaseManual({
            claseOriginal: claseBase,
            nuevosDatos: {
                horaInicio: '20:00',
                horaFin: '21:00'
            },
            jornadasExistentes: [claseExistente],
            actualizadoPorUid: 'admin-1'
        });

        // Falla porque ya hay una clase a las 20:00 ese mismo día, misma sede, mismo maestro
        expect(resultado.exito).toBe(false);
        expect(resultado.error).toContain('Conflicto');
    });

    it('crear programa desde agenda hereda sede, maestro, grupo y horario', async () => {
        const resultado = await crearProgramaDesdeAgenda({
            claseOrigen: claseBase,
            nombrePrograma: 'Programa Auto-Generado',
            creadoPorUid: 'admin-1'
        });

        expect(resultado.exito).toBe(true);
        expect(resultado.programaCreado?.nombre).toBe('Programa Auto-Generado');
        expect(resultado.cohorteCreada?.sedeId).toBe(claseBase.sedeId);
        expect(resultado.cohorteCreada?.maestroTitularId).toBe(claseBase.maestroTitularId);
        expect(resultado.cohorteCreada?.horario[0].horaInicio).toBe(claseBase.horaInicio);
        // Debe haber vinculado la clase original al nuevo programa
        expect(resultado.claseActualizada?.programaId).toBe(resultado.programaCreado?.id);
    });
});
