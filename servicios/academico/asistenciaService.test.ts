import type { RegistroAsistencia } from '../../models/academico/asistencia';
import { calcularMinutosAsistidos, contarCheckIns } from './asistenciaService';

function crearRegistro(overrides: Partial<RegistroAsistencia> = {}): RegistroAsistencia {
  return {
    estudianteId: 'estudiante-1',
    horaEntrada: '2026-07-08T13:00:00.000Z',
    ...overrides,
  };
}

describe('asistenciaService', () => {
  describe('contarCheckIns', () => {
    it('retorna 0 cuando no hay registros de asistencia', () => {
      expect(contarCheckIns([])).toBe(0);
    });

    it('cuenta un registro por cada check-in, con o sin check-out', () => {
      const registros = [
        crearRegistro({ estudianteId: 'estudiante-1' }),
        crearRegistro({ estudianteId: 'estudiante-2', horaSalida: '2026-07-08T13:45:00.000Z', minutosAsistidos: 45 }),
      ];

      expect(contarCheckIns(registros)).toBe(2);
    });
  });

  describe('calcularMinutosAsistidos', () => {
    it('retorna 0 cuando no hay registros', () => {
      expect(calcularMinutosAsistidos([])).toBe(0);
    });

    it('suma solo los minutos de registros que ya tienen check-out', () => {
      const registros = [
        crearRegistro({ estudianteId: 'estudiante-1', horaSalida: '2026-07-08T13:45:00.000Z', minutosAsistidos: 45 }),
        crearRegistro({ estudianteId: 'estudiante-2', horaSalida: '2026-07-08T13:30:00.000Z', minutosAsistidos: 30 }),
        // sin check-out todavia: no aporta minutos
        crearRegistro({ estudianteId: 'estudiante-3' }),
      ];

      expect(calcularMinutosAsistidos(registros)).toBe(75);
    });
  });
});
