/**
 * NOTA (2026-07-22): todos los instantes `ahoraIso` de esta suite estan expresados en UTC
 * pero representan hora de pared de AMERICA/BOGOTA (UTC-5), que es como el usuario carga
 * `fecha`/`horaInicio`/`horaFin` y como los interpreta `ventanaClaseEnVivoService`.
 *
 * Antes del fix del desfase horario (ver `claseEnVivo.integracion.test.ts`) el servicio
 * combinaba esos campos como si fueran UTC, y esta suite codificaba ese comportamiento: una
 * clase de 10:00 daba ventana [09:45Z, 11:15Z]. Los instantes se corrieron +5h para seguir
 * describiendo LOS MISMOS minutos de pared (09:45 Bogota = 14:45Z, etc.). Los limites que
 * cada caso verifica no cambiaron.
 */
import {
  calcularVentanaClaseEnVivo,
  calcularJornadasEnVentana,
  estaJornadaEnVentana,
  calcularIndicadorClaseEnVivo,
  minutosRestantesDeVentana,
} from './ventanaClaseEnVivoService';
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
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T16:14:00.000Z');
      expect(resultado).toEqual(jornada);
    });

    it('devuelve null cuando ya paso horaFin+15 (spec: Ventana cerrada tras horaFin+15)', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T16:16:00.000Z');
      expect(resultado).toBeNull();
    });

    it('abre la ventana exactamente 15 minutos antes de horaInicio (borde inclusivo)', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T14:45:00.000Z');
      expect(resultado).toEqual(jornada);
    });

    it('no esta disponible 16 minutos antes de horaInicio', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T14:44:00.000Z');
      expect(resultado).toBeNull();
    });

    it('devuelve null sin jornadas', () => {
      expect(calcularVentanaClaseEnVivo([], '2026-06-06T15:00:00.000Z')).toBeNull();
    });

    it('devuelve null cuando ninguna jornada esta en su ventana (spec: Sin jornada activa)', () => {
      const jornada = crearJornada({ fecha: '2026-06-07', horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([jornada], '2026-06-06T15:30:00.000Z');
      expect(resultado).toBeNull();
    });

    it('con 2+ jornadas activas simultaneas, elige la mas proxima a la hora actual (no rompe con 2+, Fase 4 sin selector completo)', () => {
      const lejana = crearJornada({ id: 'jornada-lejana', horaInicio: '09:50', horaFin: '10:50' });
      const cercana = crearJornada({ id: 'jornada-cercana', horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularVentanaClaseEnVivo([lejana, cercana], '2026-06-06T15:01:00.000Z');
      expect(resultado?.id).toBe('jornada-cercana');
    });
  });

  // WS-6 (§4, selector multi-clase): a diferencia de calcularVentanaClaseEnVivo (una sola
  // jornada, la mas cercana), esta version retorna TODAS las candidatas para que la UI ofrezca
  // un selector cuando un instructor tiene 2+ grupos activos a la vez.
  describe('calcularJornadasEnVentana', () => {
    it('devuelve un arreglo vacio sin jornadas', () => {
      expect(calcularJornadasEnVentana([], '2026-06-06T15:00:00.000Z')).toEqual([]);
    });

    it('devuelve vacio cuando ninguna jornada esta en su ventana', () => {
      const jornada = crearJornada({ fecha: '2026-06-07', horaInicio: '10:00', horaFin: '11:00' });
      expect(calcularJornadasEnVentana([jornada], '2026-06-06T15:30:00.000Z')).toEqual([]);
    });

    it('devuelve la unica jornada activa cuando solo una esta en ventana', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      const resultado = calcularJornadasEnVentana([jornada], '2026-06-06T15:01:00.000Z');
      expect(resultado).toEqual([jornada]);
    });

    it('con 2+ jornadas activas simultaneas, devuelve TODAS ordenadas por horaInicio ascendente', () => {
      const tarde = crearJornada({ id: 'jornada-tarde', horaInicio: '10:00', horaFin: '11:00' });
      const temprano = crearJornada({ id: 'jornada-temprano', horaInicio: '09:50', horaFin: '10:50' });
      // Se pasan en orden inverso a proposito para verificar que el orden lo impone la funcion.
      const resultado = calcularJornadasEnVentana([tarde, temprano], '2026-06-06T15:01:00.000Z');
      expect(resultado.map((j) => j.id)).toEqual(['jornada-temprano', 'jornada-tarde']);
    });

    it('no incluye una jornada cuya ventana ya cerro, aunque otra siga activa', () => {
      const activa = crearJornada({ id: 'jornada-activa', horaInicio: '10:00', horaFin: '11:00' });
      const cerrada = crearJornada({ id: 'jornada-cerrada', horaInicio: '08:00', horaFin: '09:00' });
      const resultado = calcularJornadasEnVentana([activa, cerrada], '2026-06-06T15:01:00.000Z');
      expect(resultado.map((j) => j.id)).toEqual(['jornada-activa']);
    });
  });

  // WS-6 (§15.A, header completo): "tiempo restante de ventana".
  describe('minutosRestantesDeVentana', () => {
    it('devuelve los minutos que faltan para el cierre (horaFin+15)', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      // Cierre = 11:00 Bogota + 15min = 16:15Z. A las 16:00Z faltan 15 minutos.
      expect(minutosRestantesDeVentana(jornada, '2026-06-06T16:00:00.000Z')).toBe(15);
    });

    it('devuelve la duracion completa de la ventana justo en la apertura', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      // Apertura 14:45Z, cierre 16:15Z -> 90 minutos de ventana.
      expect(minutosRestantesDeVentana(jornada, '2026-06-06T14:45:00.000Z')).toBe(90);
    });

    it('devuelve 0 exactamente en el cierre', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      expect(minutosRestantesDeVentana(jornada, '2026-06-06T16:15:00.000Z')).toBe(0);
    });

    it('devuelve 0 (no negativo) cuando ya paso el cierre', () => {
      const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
      expect(minutosRestantesDeVentana(jornada, '2026-06-06T16:30:00.000Z')).toBe(0);
    });
  });

  describe('estaJornadaEnVentana', () => {
    it('es true dentro de la ventana', () => {
      expect(
        estaJornadaEnVentana({ fecha: '2026-06-06', horaInicio: '10:00', horaFin: '11:00' }, '2026-06-06T15:30:00.000Z')
      ).toBe(true);
    });

    it('es false fuera de la ventana', () => {
      expect(
        estaJornadaEnVentana({ fecha: '2026-06-06', horaInicio: '10:00', horaFin: '11:00' }, '2026-06-06T13:00:00.000Z')
      ).toBe(false);
    });
  });

  // Subtarea 12.10 (Agenda, seccion 14 del documento de mejora), simplificado 2026-07-16
  // a 4 estados (pedido explicito del usuario -- ver comentario extenso en
  // ventanaClaseEnVivoService.ts): indicador de estado de Clase en Vivo que cruza `estado`
  // academico con la ventana horaria ya existente.
  describe('calcularIndicadorClaseEnVivo', () => {
    const base = { fecha: '2026-06-06', horaInicio: '10:00', horaFin: '11:00' };

    it("devuelve 'cancelada' si la jornada esta cancelada, sin importar la hora", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'cancelada' }, '2026-06-06T15:30:00.000Z')
      ).toBe('cancelada');
    });

    it("devuelve 'finalizada' si la jornada ya esta cerrada academicamente, aunque siga en la ventana horaria", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'cerrada' }, '2026-06-06T15:30:00.000Z')
      ).toBe('finalizada');
    });

    it("devuelve 'activa' si el estado academico es 'en_curso', sin importar la ventana horaria", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'en_curso' }, '2026-06-07T04:00:00.000Z')
      ).toBe('activa');
    });

    it("devuelve 'activa' cuando esta dentro de la ventana [horaInicio-15, horaFin+15] y no esta en_curso/cerrada/cancelada (fusion de la vieja 'disponible')", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'confirmada' }, '2026-06-06T14:50:00.000Z')
      ).toBe('activa');
    });

    it("devuelve 'finalizada' cuando ya paso horaFin+15 y el estado academico no se cerro manualmente", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'confirmada' }, '2026-06-06T16:20:00.000Z')
      ).toBe('finalizada');
    });

    it("devuelve 'proxima' cuando falta para la ventana y es el MISMO dia calendario", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'confirmada' }, '2026-06-06T12:00:00.000Z')
      ).toBe('proxima');
    });

    it("devuelve 'proxima' cuando la jornada es de OTRO dia calendario (fusion de la vieja 'programada' -- ya no se distingue de 'proxima')", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'confirmada' }, '2026-06-05T12:00:00.000Z')
      ).toBe('proxima');
    });
  });
});
