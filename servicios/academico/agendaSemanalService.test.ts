import type { JornadaInstruccion } from '../../models/academico/jornada';
import { createJornada } from './jornadaService';
import {
  DIAS_SEMANA,
  HORA_INICIO_GRILLA_MINUTOS,
  HORA_FIN_GRILLA_MINUTOS,
  obtenerHorasGrilla,
  obtenerLunesDeSemana,
  obtenerRangoSemana,
  sumarSemanas,
  formatearFechaIso,
  agruparJornadasPorFecha,
  calcularPosicionBloque,
} from './agendaSemanalService';

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  // createJornada() siempre genera su propio id (crearId('jornada')) y lo ignora si se
  // pasa por input -- por eso los overrides (incluido `id`) se aplican DESPUES de crear
  // la jornada base, no como parte del input de createJornada.
  const base = createJornada({
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-07-06',
    horaInicio: '08:00',
    horaFin: '09:00',
    objetivosPlaneados: ['obj-1'],
  });
  return { ...base, ...overrides };
}

describe('agendaSemanalService', () => {
  describe('DIAS_SEMANA', () => {
    it('define exactamente 7 dias, Lunes a Domingo por defecto (subtarea 12.8: fijo, no configurable por tenant todavia)', () => {
      expect(DIAS_SEMANA).toHaveLength(7);
      expect(DIAS_SEMANA.map((dia) => dia.etiqueta)).toEqual([
        'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
      ]);
    });
  });

  describe('obtenerHorasGrilla', () => {
    it('cubre el rango 7:00 a 22:00 (subtarea 12.8: intervalo fijo de 60 min, no configurable todavia)', () => {
      const horas = obtenerHorasGrilla();
      expect(horas[0]).toBe('07:00');
      expect(horas[horas.length - 1]).toBe('22:00');
      expect(HORA_INICIO_GRILLA_MINUTOS).toBe(7 * 60);
      expect(HORA_FIN_GRILLA_MINUTOS).toBe(22 * 60);
    });

    it('genera una marca por cada hora entre 7:00 y 22:00 inclusive', () => {
      const horas = obtenerHorasGrilla();
      expect(horas).toEqual([
        '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
        '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
      ]);
    });
  });

  describe('obtenerLunesDeSemana / obtenerRangoSemana', () => {
    it('devuelve el mismo lunes para cualquier dia de esa semana', () => {
      // 2026-07-06 es lunes; 2026-07-12 es domingo de la misma semana.
      expect(formatearFechaIso(obtenerLunesDeSemana('2026-07-06'))).toBe('2026-07-06');
      expect(formatearFechaIso(obtenerLunesDeSemana('2026-07-08'))).toBe('2026-07-06');
      expect(formatearFechaIso(obtenerLunesDeSemana('2026-07-12'))).toBe('2026-07-06');
    });

    it('arma un rango de 7 dias Lunes-Domingo con inicio y fin correctos', () => {
      const rango = obtenerRangoSemana('2026-07-08');
      expect(rango.inicioIso).toBe('2026-07-06');
      expect(rango.finIso).toBe('2026-07-12');
      expect(rango.diasIso).toEqual([
        '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09',
        '2026-07-10', '2026-07-11', '2026-07-12',
      ]);
    });
  });

  describe('sumarSemanas', () => {
    it('avanza y retrocede semanas completas (7 dias) sin salirse del lunes de referencia', () => {
      expect(sumarSemanas('2026-07-06', 1)).toBe('2026-07-13');
      expect(sumarSemanas('2026-07-06', -1)).toBe('2026-06-29');
    });
  });

  describe('agruparJornadasPorFecha', () => {
    it('agrupa TODAS las ocurrencias por fecha exacta, a diferencia de agruparClasesAcademicas (que solo guarda la proxima por bloqueRecurrenteId)', () => {
      const martes = crearJornada({ id: 'j-martes', fecha: '2026-07-07', bloqueRecurrenteId: 'bloque-1' });
      const jueves = crearJornada({ id: 'j-jueves', fecha: '2026-07-09', bloqueRecurrenteId: 'bloque-1' });
      const otraDelMismoDia = crearJornada({ id: 'j-martes-2', fecha: '2026-07-07' });

      const grupos = agruparJornadasPorFecha([martes, jueves, otraDelMismoDia]);

      expect(grupos['2026-07-07']).toHaveLength(2);
      expect(grupos['2026-07-09']).toHaveLength(1);
      expect(grupos['2026-07-09'][0].id).toBe('j-jueves');
    });
  });

  describe('calcularPosicionBloque', () => {
    it('posiciona un bloque de 08:00-09:00 dentro de la franja 7:00-22:00', () => {
      const posicion = calcularPosicionBloque('08:00', '09:00');
      // (8:00-7:00)/(22:00-7:00) = 60/900 = 6.66%; duracion 60/900 = 6.66%
      expect(posicion.topPercent).toBeCloseTo((60 / 900) * 100, 1);
      expect(posicion.heightPercent).toBeCloseTo((60 / 900) * 100, 1);
    });

    it('recorta (clamp) una clase que empieza antes de las 7:00 al borde superior', () => {
      const posicion = calcularPosicionBloque('06:00', '08:00');
      expect(posicion.topPercent).toBe(0);
    });

    it('recorta (clamp) una clase que termina despues de las 22:00 al borde inferior', () => {
      const posicion = calcularPosicionBloque('21:00', '23:00');
      expect(posicion.topPercent + posicion.heightPercent).toBeCloseTo(100, 1);
    });
  });
});
