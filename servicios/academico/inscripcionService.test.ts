import { GradoTKD, GrupoEdad, type Estudiante } from '../../tipos';
import type { EjecucionPrograma } from '../../models/academico/programa';
import type { InscripcionEjecucionPrograma } from '../../models/academico/inscripcion';
import { estaInscrito, sugerirEstudiantesPorAtributo } from './inscripcionService';

function crearEjecucion(overrides: Partial<EjecucionPrograma> = {}): EjecucionPrograma {
  return {
    id: 'ejecucion-1',
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    grupoId: 'cadetes',
    sedeId: 'sede-principal',
    estado: 'activo',
    fechaInicio: '2026-07-01',
    unidadActualId: null,
    objetivoActualId: null,
    objetivosCompletados: [],
    creadoEn: '2026-07-01T00:00:00.000Z',
    actualizadoEn: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function crearEstudiante(overrides: Partial<Estudiante> = {}): Estudiante {
  return {
    id: 'estudiante-1',
    tenantId: 'tenant-1',
    nombres: 'Ana',
    apellidos: 'Gomez',
    numeroIdentificacion: '123',
    fechaNacimiento: '2015-01-01',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.Cadetes,
    horasAcumuladasGrado: 0,
    sedeId: 'sede-principal',
    telefono: '',
    correo: '',
    fechaIngreso: '2026-01-01',
    estadoPago: 'Al día' as any,
    saldoDeudor: 0,
    historialPagos: [],
    consentimientoInformado: true,
    contratoServiciosFirmado: true,
    consentimientoImagenFirmado: true,
    consentimientoFotosVideos: true,
    carnetGenerado: true,
    ...overrides,
  } as Estudiante;
}

describe('inscripcionService', () => {
  describe('estaInscrito', () => {
    it('retorna true cuando el estudiante tiene inscripcion activa en esa ejecucion', () => {
      const inscripciones: InscripcionEjecucionPrograma[] = [{
        estudianteId: 'estudiante-1',
        ejecucionProgramaId: 'ejecucion-1',
        tenantId: 'tenant-1',
        estado: 'activa',
        fechaInscripcion: '2026-07-01T00:00:00.000Z',
        inscritoPorUid: 'instructor-1',
      }];

      expect(estaInscrito('ejecucion-1', 'estudiante-1', inscripciones)).toBe(true);
    });

    it('retorna false cuando el estudiante esta inscrito en OTRA ejecucion del mismo grado', () => {
      const inscripciones: InscripcionEjecucionPrograma[] = [{
        estudianteId: 'estudiante-1',
        ejecucionProgramaId: 'ejecucion-2',
        tenantId: 'tenant-1',
        estado: 'activa',
        fechaInscripcion: '2026-07-01T00:00:00.000Z',
        inscritoPorUid: 'instructor-1',
      }];

      expect(estaInscrito('ejecucion-1', 'estudiante-1', inscripciones)).toBe(false);
    });

    it('retorna false con lista vacia', () => {
      expect(estaInscrito('ejecucion-1', 'estudiante-1', [])).toBe(false);
    });
  });

  describe('sugerirEstudiantesPorAtributo', () => {
    it('sugiere solo estudiantes cuyo grupo etario coincide con el grupoId de la ejecucion', () => {
      const ejecucion = crearEjecucion({ grupoId: 'cadetes' });
      const estudiantes = [
        crearEstudiante({ id: 'est-cadete', grupo: GrupoEdad.Cadetes }),
        crearEstudiante({ id: 'est-infantil', grupo: GrupoEdad.Infantil }),
      ];

      const sugeridos = sugerirEstudiantesPorAtributo(ejecucion, estudiantes);

      expect(sugeridos.map((e) => e.id)).toEqual(['est-cadete']);
    });

    it('no sugiere ningun estudiante cuando ninguno coincide de grupo', () => {
      const ejecucion = crearEjecucion({ grupoId: 'adultos' });
      const estudiantes = [crearEstudiante({ id: 'est-infantil', grupo: GrupoEdad.Infantil })];

      expect(sugerirEstudiantesPorAtributo(ejecucion, estudiantes)).toEqual([]);
    });

    it('no distingue dos ejecuciones del mismo grado: la sugerencia es solo un punto de partida, no una validacion de pertenencia', () => {
      const ejecucionSeccionA = crearEjecucion({ id: 'ejecucion-a', grupoId: 'cadetes' });
      const ejecucionSeccionB = crearEjecucion({ id: 'ejecucion-b', grupoId: 'cadetes' });
      const estudiante = crearEstudiante({ id: 'est-cadete', grupo: GrupoEdad.Cadetes });

      expect(sugerirEstudiantesPorAtributo(ejecucionSeccionA, [estudiante]).map((e) => e.id)).toEqual(['est-cadete']);
      expect(sugerirEstudiantesPorAtributo(ejecucionSeccionB, [estudiante]).map((e) => e.id)).toEqual(['est-cadete']);
    });
  });
});
