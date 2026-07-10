import { procesarProgresoYRefuerzo } from './progresoClaseApi';
import { AsistenciaJornada } from '../tipos';

describe('Etapa 7 - Progreso y Refuerzo API (RED)', () => {

    it('estudiante presente acumula minutos y no levanta alerta de refuerzo', async () => {
        const asistencias: AsistenciaJornada[] = [
            {
                id: 'asis-1',
                tenantId: 'tenant-test',
                jornadaId: 'jornada-1',
                estudianteId: 'alumno-1',
                estado: 'presente',
                minutosAsistidos: 60,
                actualizadoEn: '2026-11-01T10:00:00Z'
            }
        ];

        const resultado = await procesarProgresoYRefuerzo({
            asistenciasFinales: asistencias,
            claseDuracionMinutos: 60
        });

        expect(resultado.exito).toBe(true);
        const progresoAlumno = resultado.progresosActualizados.find((p: any) => p.estudianteId === 'alumno-1');
        expect(progresoAlumno.minutosSumados).toBe(60);
        expect(progresoAlumno.alertaRefuerzo).toBe(false);
    });

    it('estudiante ausente levanta alerta de recuperación/refuerzo', async () => {
        const asistencias: AsistenciaJornada[] = [
            {
                id: 'asis-2',
                tenantId: 'tenant-test',
                jornadaId: 'jornada-1',
                estudianteId: 'alumno-ausente',
                estado: 'ausente',
                minutosAsistidos: 0,
                actualizadoEn: '2026-11-01T10:00:00Z'
            }
        ];

        const resultado = await procesarProgresoYRefuerzo({
            asistenciasFinales: asistencias,
            claseDuracionMinutos: 60
        });

        expect(resultado.exito).toBe(true);
        const progresoAlumno = resultado.progresosActualizados.find((p: any) => p.estudianteId === 'alumno-ausente');
        expect(progresoAlumno.minutosSumados).toBe(0);
        expect(progresoAlumno.alertaRefuerzo).toBe(true);
        expect(progresoAlumno.motivoRefuerzo).toBe('Ausencia total');
    });

    it('estudiante con menos del 50% de asistencia levanta alerta de refuerzo por asistencia parcial', async () => {
        const asistencias: AsistenciaJornada[] = [
            {
                id: 'asis-3',
                tenantId: 'tenant-test',
                jornadaId: 'jornada-1',
                estudianteId: 'alumno-tarde',
                estado: 'presente',
                minutosAsistidos: 20, // 20/60 = 33%
                actualizadoEn: '2026-11-01T10:00:00Z'
            }
        ];

        const resultado = await procesarProgresoYRefuerzo({
            asistenciasFinales: asistencias,
            claseDuracionMinutos: 60
        });

        expect(resultado.exito).toBe(true);
        const progresoAlumno = resultado.progresosActualizados.find((p: any) => p.estudianteId === 'alumno-tarde');
        expect(progresoAlumno.minutosSumados).toBe(20);
        expect(progresoAlumno.alertaRefuerzo).toBe(true);
        expect(progresoAlumno.motivoRefuerzo).toBe('Asistencia menor al 50%');
    });

    it('los recursos de la jornada se asocian al progreso de la clase', async () => {
        const resultado = await procesarProgresoYRefuerzo({
            asistenciasFinales: [],
            claseDuracionMinutos: 60,
            recursosJornada: ['video-patada-basica', 'pdf-reglamento']
        });

        expect(resultado.exito).toBe(true);
        expect(resultado.recursosVinculados).toContain('video-patada-basica');
        expect(resultado.recursosVinculados).toContain('pdf-reglamento');
    });
});
