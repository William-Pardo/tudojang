import {
  calcularMetricasCentroEstudios,
  calcularUrgenciaAsignacion,
  ordenarAsignacionesPorUrgencia,
} from './centroEstudios';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';

const base: AsignacionCentroEstudios = {
  id: 'base',
  tenantId: 'tenant-1',
  recursoId: 'recurso-1',
  titulo: 'Base',
  destinatario: { tipo: 'grupo', grupo: 'Infantil' },
  uso: 'estudio',
  momento: 'preparacion',
  obligatoria: true,
  fechaApertura: '2026-06-26T00:00:00.000Z',
  estado: 'publicada',
  creadoPorUid: 'admin',
  creadoEn: '2026-06-26T00:00:00.000Z',
  actualizadoEn: '2026-06-26T00:00:00.000Z',
  estadoProgreso: 'disponible',
  porcentajeProgreso: 0,
  urgencia: 'baja',
};

describe('centroEstudios utils', () => {
  it('calcula urgencia por fecha de cierre', () => {
    const ahora = new Date('2026-06-26T00:00:00.000Z');

    expect(calcularUrgenciaAsignacion('2026-06-25T00:00:00.000Z', ahora)).toBe('vencida');
    expect(calcularUrgenciaAsignacion('2026-06-27T00:00:00.000Z', ahora)).toBe('alta');
    expect(calcularUrgenciaAsignacion('2026-07-01T00:00:00.000Z', ahora)).toBe('media');
    expect(calcularUrgenciaAsignacion('2026-07-20T00:00:00.000Z', ahora)).toBe('baja');
    expect(calcularUrgenciaAsignacion(undefined, ahora)).toBe('sin_fecha');
  });

  it('ordena por urgencia, estado y fecha de cierre', () => {
    const asignaciones: AsignacionCentroEstudios[] = [
      { ...base, id: 'sin-fecha', titulo: 'Sin fecha', urgencia: 'sin_fecha' },
      { ...base, id: 'alta', titulo: 'Alta', urgencia: 'alta', fechaCierre: '2026-06-28T00:00:00.000Z' },
      { ...base, id: 'vencida', titulo: 'Vencida', urgencia: 'vencida', estadoProgreso: 'vencido', fechaCierre: '2026-06-25T00:00:00.000Z' },
    ];

    expect(ordenarAsignacionesPorUrgencia(asignaciones).map((a) => a.id)).toEqual([
      'vencida',
      'alta',
      'sin-fecha',
    ]);
  });

  it('calcula métricas desde asignaciones enriquecidas', () => {
    const metricas = calcularMetricasCentroEstudios([
      { ...base, id: 'a1', estadoProgreso: 'completado', porcentajeProgreso: 100 },
      { ...base, id: 'a2', estadoProgreso: 'en_progreso', porcentajeProgreso: 40, urgencia: 'alta' },
      { ...base, id: 'a3', estadoProgreso: 'vencido', porcentajeProgreso: 10, urgencia: 'vencida' },
    ]);

    expect(metricas).toEqual({
      total: 3,
      completadas: 1,
      enProgreso: 1,
      vencidas: 1,
      proximasAVencer: 1,
    });
  });
});
