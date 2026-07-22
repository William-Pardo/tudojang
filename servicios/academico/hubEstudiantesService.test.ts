jest.mock('./asignacionService', () => ({
  listarAsignacionesPorTenant: jest.fn(),
}));

import { obtenerClasesFuturasSemanaHubEstudiantes } from './hubEstudiantesService';
import { listarAsignacionesPorTenant } from './asignacionService';
import { GradoTKD } from '../../tipos';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { JornadaRepository } from './jornadaRepository';

// Subtarea 12.11 (Exposicion minima para Hub Estudiantes, seccion 15 del documento de
// mejora del modulo Agenda). DECISION DEL USUARIO (ya tomada, no se vuelve a preguntar):
// solo se construye el SERVICIO DE LECTURA, sin pantalla nueva -- ver "Registro de cierre"
// de 12.11 en CIERRE CENTRO DE ESTUDIOS.md para el detalle completo de la decision.

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
    // Viernes de la semana de referencia (ver FECHA_REFERENCIA_ISO/AHORA_ISO abajo): a
    // proposito un dia DISTINTO del dia de AHORA_ISO (miercoles) para que el fixture por
    // defecto nunca caiga en 'finalizada' quando un test no pisa fecha/horaInicio/horaFin
    // explicitamente (evita acoplar tests que no les importa la ventana horaria a ese calculo).
    fecha: '2026-07-10',
    horaInicio: '10:00',
    horaFin: '11:00',
    estado: 'confirmada',
    objetivosPlaneados: [],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearAsignacion(overrides: Partial<AsignacionAcademica> = {}): AsignacionAcademica {
  const ahora = '2026-06-01T00:00:00.000Z';
  return {
    id: 'asignacion-1',
    tenantId: 'tenant-1',
    recursoId: 'recurso-1',
    titulo: 'Material tecnico',
    destinatario: { tipo: 'grupo', grupo: 'Infantil' },
    uso: 'estudio',
    momento: 'preparacion',
    obligatoria: true,
    fechaApertura: ahora,
    estado: 'publicada',
    creadoPorUid: 'maestro-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearRepository(jornadas: JornadaInstruccion[]): Pick<JornadaRepository, 'listarJornadasPorRangoFechas'> {
  return {
    listarJornadasPorRangoFechas: jest.fn().mockResolvedValue(jornadas),
  };
}

// Miercoles de la semana Lunes 2026-07-06 a Domingo 2026-07-12 (misma semana usada en el
// registro de cierre de 12.10, ver CIERRE CENTRO DE ESTUDIOS.md).
const FECHA_REFERENCIA_ISO = '2026-07-08';
const AHORA_ISO = '2026-07-08T12:00:00.000Z';

describe('hubEstudiantesService', () => {
  beforeEach(() => {
    (listarAsignacionesPorTenant as jest.Mock).mockReset().mockResolvedValue([]);
  });

  describe('obtenerClasesFuturasSemanaHubEstudiantes', () => {
    it('devuelve vacio sin tenantId', async () => {
      const repository = crearRepository([]);
      const resultado = await obtenerClasesFuturasSemanaHubEstudiantes(
        '',
        {},
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );
      expect(resultado).toEqual([]);
      expect(repository.listarJornadasPorRangoFechas).not.toHaveBeenCalled();
    });

    it('consulta el rango Lunes-Domingo de la semana que contiene fechaReferenciaIso', async () => {
      const repository = crearRepository([]);
      await obtenerClasesFuturasSemanaHubEstudiantes(
        'tenant-1',
        {},
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledWith('tenant-1', '2026-07-06', '2026-07-12');
    });

    it('filtra por grupoId cuando se pasa en el filtro', async () => {
      const jornadas = [
        crearJornada({ id: 'jornada-infantil', grupoId: 'grupo-infantil' }),
        crearJornada({ id: 'jornada-cadetes', grupoId: 'grupo-cadetes' }),
      ];
      const repository = crearRepository(jornadas);

      const resultado = await obtenerClasesFuturasSemanaHubEstudiantes(
        'tenant-1',
        { grupoId: 'grupo-infantil' },
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );

      expect(resultado.map((clase) => clase.jornadaId)).toEqual(['jornada-infantil']);
    });

    it('filtra por grado: excluye la jornada si el grado esta en gradosExcluidos, lo incluye si no', async () => {
      const jornadas = [
        crearJornada({ id: 'jornada-sin-avanzados', gradosExcluidos: [GradoTKD.Negro1Dan] }),
        crearJornada({ id: 'jornada-todos-los-grados' }),
      ];
      const repository = crearRepository(jornadas);

      const resultado = await obtenerClasesFuturasSemanaHubEstudiantes(
        'tenant-1',
        { grado: GradoTKD.Negro1Dan },
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );

      expect(resultado.map((clase) => clase.jornadaId)).toEqual(['jornada-todos-los-grados']);
    });

    it("excluye del listado una jornada cuyo indicador de Clase en Vivo ya es 'finalizada' (clase pasada de la semana)", async () => {
      const jornadas = [
        // Lunes 2026-07-06, 08:00-09:00 -- ya finalizada respecto de AHORA_ISO (miercoles).
        crearJornada({ id: 'jornada-pasada', fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00' }),
        // Viernes 2026-07-10, todavia no llega -- debe permanecer en el listado.
        crearJornada({ id: 'jornada-futura', fecha: '2026-07-10', horaInicio: '08:00', horaFin: '09:00' }),
      ];
      const repository = crearRepository(jornadas);

      const resultado = await obtenerClasesFuturasSemanaHubEstudiantes(
        'tenant-1',
        {},
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );

      expect(resultado.map((clase) => clase.jornadaId)).toEqual(['jornada-futura']);
    });

    it("no descarta una jornada cancelada del listado, pero su indicadorClaseEnVivo es 'cancelada' (no 'disponible') -- seccion 15: 'no mostrar clases canceladas como disponibles'", async () => {
      const jornadas = [
        crearJornada({ id: 'jornada-cancelada', fecha: '2026-07-10', estado: 'cancelada' }),
      ];
      const repository = crearRepository(jornadas);

      const resultado = await obtenerClasesFuturasSemanaHubEstudiantes(
        'tenant-1',
        {},
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );

      expect(resultado).toHaveLength(1);
      expect(resultado[0].indicadorClaseEnVivo).toBe('cancelada');
    });

    it('adjunta el material asignado (titulos) de la jornada, mismo criterio que agruparClasesAcademicas', async () => {
      const jornadas = [crearJornada({ id: 'jornada-1', fecha: '2026-07-10' })];
      const repository = crearRepository(jornadas);
      (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([
        crearAsignacion({ id: 'asig-1', jornadaId: 'jornada-1', titulo: 'Fundamentos tecnicos' }),
        crearAsignacion({ id: 'asig-2', jornadaId: 'otra-jornada', titulo: 'No deberia aparecer' }),
      ]);

      const resultado = await obtenerClasesFuturasSemanaHubEstudiantes(
        'tenant-1',
        {},
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );

      expect(resultado[0].materialAsignado).toEqual(['Fundamentos tecnicos']);
      expect(listarAsignacionesPorTenant).toHaveBeenCalledWith('tenant-1');
    });

    it('ordena el resultado por fecha y luego por horaInicio ascendente', async () => {
      const jornadas = [
        crearJornada({ id: 'jornada-viernes-tarde', fecha: '2026-07-10', horaInicio: '18:00', horaFin: '19:00' }),
        // Miercoles, mas tarde en el dia que AHORA_ISO (12:00) para que la ventana
        // [horaInicio-15, horaFin+15] todavia no haya cerrado y no quede excluida como 'finalizada'.
        crearJornada({ id: 'jornada-miercoles', fecha: '2026-07-08', horaInicio: '13:00', horaFin: '14:00' }),
        crearJornada({ id: 'jornada-viernes-manana', fecha: '2026-07-10', horaInicio: '08:00', horaFin: '09:00' }),
      ];
      const repository = crearRepository(jornadas);

      const resultado = await obtenerClasesFuturasSemanaHubEstudiantes(
        'tenant-1',
        {},
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );

      expect(resultado.map((clase) => clase.jornadaId)).toEqual([
        'jornada-miercoles',
        'jornada-viernes-manana',
        'jornada-viernes-tarde',
      ]);
    });

    it('expone el shape completo requerido por la seccion 15 del documento de mejora (dia/hora, clase, maestro, sede/modalidad, material, disponibilidad)', async () => {
      const jornadas = [crearJornada({ id: 'jornada-1', fecha: '2026-07-10' })];
      const repository = crearRepository(jornadas);

      const resultado = await obtenerClasesFuturasSemanaHubEstudiantes(
        'tenant-1',
        {},
        FECHA_REFERENCIA_ISO,
        AHORA_ISO,
        repository as JornadaRepository,
      );

      expect(resultado[0]).toEqual({
        jornadaId: 'jornada-1',
        fecha: '2026-07-10',
        horaInicio: '10:00',
        horaFin: '11:00',
        programaId: 'programa-1',
        instructorId: 'maestro-1',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        grupoId: 'grupo-infantil',
        materialAsignado: [],
        // Viernes 2026-07-10 vs. AHORA_ISO miercoles 2026-07-08: todavia lejos de la
        // apertura -> 'proxima' (simplificacion 2026-07-16: 'programada' y 'proxima' se
        // fusionaron en un unico valor, ver calcularIndicadorClaseEnVivo).
        indicadorClaseEnVivo: 'proxima',
      });
    });
  });
});
