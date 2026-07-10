import { calcularVentanaClaseEnVivo, estaJornadaEnVentana } from './ventanaClaseEnVivoService';
import type { JornadaInstruccion } from '../../models/academico/jornada';

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  const ahora = '2026-06-01T00:00:00.000Z';
  return {
    id: 'jornada-1',
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-06-06',
    horaInicio: '10:00',
    horaFin: '11:00',
    estado: 'en_curso',
    objetivosPlaneados: [],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

describe('ventanaClaseEnVivoService', () => {
  describe('calcularVentanaClaseEnVivo', () => {
    it('devuelve la jornada cuando ahora sigue dentro de la ventana hasta horaFin+15 (spec: Ventana abierta hasta horaFin+15)', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T11:14:00.000Z');
      expect(resultado).toEqual(jornada);
    });

    it('devuelve null cuando ya paso horaFin+15 (spec: Ventana cerrada tras horaFin+15)', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T11:16:00.000Z');
      expect(resultado).toBeNull();
    });

    it('abre la ventana exactamente 15 minutos antes de horaInicio (borde inclusivo)', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T09:45:00.000Z');
      expect(resultado).toEqual(jornada);
    });

    it('no esta disponible 16 minutos antes de horaInicio', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T09:44:00.000Z');
      expect(resultado).toBeNull();
    });

    it('devuelve null sin jornadas', () => {
      expect(calcularVentanaClaseEnVivo([], '2026-06-06T10:00:00.000Z')).toBeNull();
    });

    it('devuelve null cuando ninguna jornada esta en su ventana (spec: Sin jornada activa)', () => {
      const jornada = crearJornada({ fecha: '2026-06-07', horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T10:30:00.000Z');
      expect(resultado).toBeNull();
    });

    it('con 2+ jornadas activas simultaneas, elige la mas proxima a la hora actual (no rompe con 2+, Fase 4 sin selector completo)', () => {
      const lejana = crearJornada({ id: 'jornada-lejana', horaInicio: '09:50', horaFin: '10:50' });
      const cercana = crearJornada({ id: 'jornada-cercana', horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([lejana, cercana], '2026-06-06T10:01:00.000Z');
      expect(resultado?.id).toBe('jornada-cercana');
    });
  });

  describe('estaJornadaEnVentana', () => {
    it('es true dentro de la ventana', () => {
      expect(
        estaJornadaEnVentana({ fecha: '2026-06-06', horaInicio: '10:00', horaFin: '11:00' }, '2026-06-06T10:30:00.000Z')
      ).toBe(true);
    });

    it('es false fuera de la ventana', () => {
      expect(
        estaJornadaEnVentana({ fecha: '2026-06-06', horaInicio: '10:00', horaFin: '11:00' }, '2026-06-06T08:00:00.000Z')
      ).toBe(false);
    });
  });
});
