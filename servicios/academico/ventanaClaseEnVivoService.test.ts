import {
  calcularVentanaClaseEnVivo,
  estaJornadaEnVentana,
  calcularIndicadorClaseEnVivo,
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

  // Subtarea 12.10 (Agenda, seccion 14 del documento de mejora), simplificado 2026-07-16
  // a 4 estados (pedido explicito del usuario -- ver comentario extenso en
  // ventanaClaseEnVivoService.ts): indicador de estado de Clase en Vivo que cruza `estado`
  // academico con la ventana horaria ya existente.
  describe('calcularIndicadorClaseEnVivo', () => {
    const base = { fecha: '2026-06-06', horaInicio: '10:00', horaFin: '11:00' };

    it("devuelve 'cancelada' si la jornada esta cancelada, sin importar la hora", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'cancelada' }, '2026-06-06T10:30:00.000Z')
      ).toBe('cancelada');
    });

    it("devuelve 'finalizada' si la jornada ya esta cerrada academicamente, aunque siga en la ventana horaria", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'cerrada' }, '2026-06-06T10:30:00.000Z')
      ).toBe('finalizada');
    });

    it("devuelve 'activa' si el estado academico es 'en_curso', sin importar la ventana horaria", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'en_curso' }, '2026-06-06T23:00:00.000Z')
      ).toBe('activa');
    });

    it("devuelve 'activa' cuando esta dentro de la ventana [horaInicio-15, horaFin+15] y no esta en_curso/cerrada/cancelada (fusion de la vieja 'disponible')", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'confirmada' }, '2026-06-06T09:50:00.000Z')
      ).toBe('activa');
    });

    it("devuelve 'finalizada' cuando ya paso horaFin+15 y el estado academico no se cerro manualmente", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'confirmada' }, '2026-06-06T11:20:00.000Z')
      ).toBe('finalizada');
    });

    it("devuelve 'proxima' cuando falta para la ventana y es el MISMO dia calendario", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'confirmada' }, '2026-06-06T07:00:00.000Z')
      ).toBe('proxima');
    });

    it("devuelve 'proxima' cuando la jornada es de OTRO dia calendario (fusion de la vieja 'programada' -- ya no se distingue de 'proxima')", () => {
      expect(
        calcularIndicadorClaseEnVivo({ ...base, estado: 'confirmada' }, '2026-06-05T07:00:00.000Z')
      ).toBe('proxima');
    });
  });
});
