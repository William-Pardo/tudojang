import type { JornadaInstruccion } from '../../models/academico/jornada';
import { createJornada } from './jornadaService';
import {
  DIAS_SEMANA,
  obtenerLunesDeSemana,
  obtenerRangoSemana,
  sumarSemanas,
  formatearFechaIso,
  agruparJornadasPorFecha,
  calcularFilasHorarioAgenda,
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

  // Simplificado 2026-07-17, SEGUNDA vuelta (pedido explicito del usuario: la primera
  // vuelta -- un eje continuo proporcional recortado al rango real de la semana -- seguia
  // dejando huecos grandes en blanco cuando habia horas SIN clases en el medio del rango).
  // La grilla ahora es un conjunto de FILAS DISCRETAS, una por cada franja horaria exacta
  // que realmente tiene alguna jornada activa esa semana.
  describe('calcularFilasHorarioAgenda', () => {
    it('devuelve una fila por cada franja horaria EXACTA distinta, sin huecos para horas sin clase', () => {
      const clase1 = crearJornada({ id: 'j-1', horaInicio: '08:00', horaFin: '09:00' });
      const clase2 = crearJornada({ id: 'j-2', horaInicio: '18:00', horaFin: '20:45' });

      // Nada entre las 09:00 y las 18:00 -- no debe generar ninguna fila intermedia.
      expect(calcularFilasHorarioAgenda([clase1, clase2])).toEqual([
        { horaInicio: '08:00', horaFin: '09:00' },
        { horaInicio: '18:00', horaFin: '20:45' },
      ]);
    });

    it('ordena las filas cronologicamente por horaInicio, sin importar el orden de entrada', () => {
      const tarde = crearJornada({ id: 'j-tarde', horaInicio: '15:00', horaFin: '17:00' });
      const manana = crearJornada({ id: 'j-manana', fecha: '2026-07-11', horaInicio: '07:45', horaFin: '09:00' });
      const noche = crearJornada({ id: 'j-noche', horaInicio: '19:00', horaFin: '20:45' });

      expect(calcularFilasHorarioAgenda([tarde, noche, manana])).toEqual([
        { horaInicio: '07:45', horaFin: '09:00' },
        { horaInicio: '15:00', horaFin: '17:00' },
        { horaInicio: '19:00', horaFin: '20:45' },
      ]);
    });

    it('dedupe: dos jornadas de dias distintos con la MISMA franja exacta producen UNA sola fila', () => {
      const lunes = crearJornada({ id: 'j-lunes', fecha: '2026-07-06', horaInicio: '19:00', horaFin: '20:45' });
      const miercoles = crearJornada({ id: 'j-miercoles', fecha: '2026-07-08', horaInicio: '19:00', horaFin: '20:45' });

      expect(calcularFilasHorarioAgenda([lunes, miercoles])).toEqual([
        { horaInicio: '19:00', horaFin: '20:45' },
      ]);
    });

    it('NO dedupe franjas que se superponen pero no son exactamente iguales -- cada horario exacto distinto es su propia fila', () => {
      const clase1 = crearJornada({ id: 'j-1', horaInicio: '08:00', horaFin: '09:00' });
      const clase2 = crearJornada({ id: 'j-2', horaInicio: '08:30', horaFin: '09:30' });

      expect(calcularFilasHorarioAgenda([clase1, clase2])).toEqual([
        { horaInicio: '08:00', horaFin: '09:00' },
        { horaInicio: '08:30', horaFin: '09:30' },
      ]);
    });

    it('NO ignora jornadas canceladas -- una clase cancelada sigue generando su propia fila (se ve atenuada, no desaparece)', () => {
      const activa = crearJornada({ horaInicio: '18:00', horaFin: '19:00' });
      const cancelada = crearJornada({ id: 'j-cancelada', horaInicio: '06:00', horaFin: '07:00', estado: 'cancelada' });

      expect(calcularFilasHorarioAgenda([activa, cancelada])).toEqual([
        { horaInicio: '06:00', horaFin: '07:00' },
        { horaInicio: '18:00', horaFin: '19:00' },
      ]);
    });

    it('devuelve una lista vacia solo si no hay NINGUNA jornada (una semana con solo canceladas SI genera sus filas)', () => {
      expect(calcularFilasHorarioAgenda([])).toEqual([]);

      const soloCanceladas = crearJornada({ estado: 'cancelada' });
      expect(calcularFilasHorarioAgenda([soloCanceladas])).toEqual([
        { horaInicio: '08:00', horaFin: '09:00' },
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
});
