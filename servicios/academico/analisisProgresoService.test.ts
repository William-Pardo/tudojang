// servicios/academico/analisisProgresoService.test.ts

import type { MetricasEstudiante, AvanceAsignacion } from '../../models/academico/actividad';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { ProgramaAcademico } from '../../models/academico/programa';
import {
  construirMapaAsignacionPrograma,
  listarProgramasConAsignaciones,
  escalarMetricasAPrograma,
  calcularMetricasPorMaterial,
  formatearTiempoReaccion,
} from './analisisProgresoService';

function crearAsignacion(overrides: Partial<AsignacionAcademica> = {}): AsignacionAcademica {
  return {
    id: 'asig-1',
    tenantId: 'tenant-1',
    recursoId: 'recurso-1',
    titulo: 'Material de prueba',
    destinatario: { tipo: 'grupo', grupo: 'Todos' },
    uso: 'estudio' as any,
    momento: 'durante' as any,
    obligatoria: true,
    fechaApertura: '2026-07-01T08:00:00Z',
    estado: 'publicada',
    creadoPorUid: 'admin-1',
    creadoEn: '2026-07-01T08:00:00Z',
    actualizadoEn: '2026-07-01T08:00:00Z',
    ...overrides,
  };
}

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  return {
    id: 'jornada-1',
    tenantId: 'tenant-1',
    programaId: 'prog-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'infantil',
    sedeId: 'sede-1',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-07-01',
    horaInicio: '18:00',
    horaFin: '19:00',
    estado: 'confirmada',
    objetivosPlaneados: [],
    ...overrides,
  } as JornadaInstruccion;
}

function crearPrograma(overrides: Partial<ProgramaAcademico> = {}): ProgramaAcademico {
  return {
    id: 'prog-1',
    tenantId: 'tenant-1',
    nombre: 'Programa Infantil',
    grupoObjetivo: 'Infantil',
    gradosIncluidos: [],
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    estado: 'publicado' as any,
    objetivos: [],
    tags: [],
    creadoPorUid: 'admin-1',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ProgramaAcademico;
}

function crearAvance(overrides: Partial<AvanceAsignacion> = {}): AvanceAsignacion {
  return {
    asignacionId: 'asig-1',
    tituloRecurso: 'Material de prueba',
    tipoRecurso: 'video',
    porcentajeConsumo: 100,
    ...overrides,
  };
}

function crearMetricas(overrides: Partial<MetricasEstudiante> = {}): MetricasEstudiante {
  return {
    estudianteId: 'est-1',
    tenantId: 'tenant-1',
    estudianteNombre: 'Estudiante Uno',
    porcentajeGlobalConsumo: 0,
    promedioScoreEvaluaciones: 0,
    totalAsignaciones: 0,
    asignacionesIniciadas: 0,
    asignacionesCompletadas: 0,
    avancePorAsignacion: [],
    totalEvaluacionesRealizadas: 0,
    actualizadoEn: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('construirMapaAsignacionPrograma', () => {
  it('resuelve el programa de una asignación siguiendo asignacion -> jornada -> programa', () => {
    const asignaciones = [crearAsignacion({ id: 'asig-1', jornadaId: 'jornada-1' })];
    const jornadas = [crearJornada({ id: 'jornada-1', programaId: 'prog-1' })];
    const programas = [crearPrograma({ id: 'prog-1', nombre: 'Programa Infantil' })];

    const mapa = construirMapaAsignacionPrograma(asignaciones, jornadas, programas);

    expect(mapa.get('asig-1')).toEqual({ programaId: 'prog-1', programaNombre: 'Programa Infantil' });
  });

  it('ignora asignaciones sin jornadaId (material asignado directo, sin pasar por Agenda)', () => {
    const asignaciones = [crearAsignacion({ id: 'asig-2', jornadaId: undefined })];
    const mapa = construirMapaAsignacionPrograma(asignaciones, [], []);
    expect(mapa.has('asig-2')).toBe(false);
  });

  it('ignora asignaciones cuya jornada no tiene programa resoluble (jornada o programa borrados)', () => {
    const asignaciones = [crearAsignacion({ id: 'asig-3', jornadaId: 'jornada-fantasma' })];
    const mapa = construirMapaAsignacionPrograma(asignaciones, [], []);
    expect(mapa.has('asig-3')).toBe(false);
  });
});

describe('listarProgramasConAsignaciones', () => {
  it('devuelve programas únicos ordenados alfabéticamente', () => {
    const mapa = new Map([
      ['asig-1', { programaId: 'prog-b', programaNombre: 'Preparación Competencia' }],
      ['asig-2', { programaId: 'prog-a', programaNombre: 'Infantil Básico' }],
      ['asig-3', { programaId: 'prog-b', programaNombre: 'Preparación Competencia' }],
    ]);

    const lista = listarProgramasConAsignaciones(mapa);

    expect(lista).toEqual([
      { programaId: 'prog-a', programaNombre: 'Infantil Básico' },
      { programaId: 'prog-b', programaNombre: 'Preparación Competencia' },
    ]);
  });
});

describe('escalarMetricasAPrograma', () => {
  const mapaPrograma = new Map([
    ['asig-1', { programaId: 'prog-a', programaNombre: 'Infantil Básico' }],
    ['asig-2', { programaId: 'prog-a', programaNombre: 'Infantil Básico' }],
    ['asig-3', { programaId: 'prog-b', programaNombre: 'Competencia' }],
  ]);

  it('recalcula iniciado/completo/global usando solo las asignaciones del programa filtrado', () => {
    const metricas = crearMetricas({
      totalAsignaciones: 3,
      asignacionesIniciadas: 3,
      asignacionesCompletadas: 1,
      porcentajeGlobalConsumo: 60,
      avancePorAsignacion: [
        crearAvance({ asignacionId: 'asig-1', porcentajeConsumo: 100 }),
        crearAvance({ asignacionId: 'asig-2', porcentajeConsumo: 20 }),
        crearAvance({ asignacionId: 'asig-3', porcentajeConsumo: 100 }),
      ],
    });

    const escalado = escalarMetricasAPrograma(metricas, mapaPrograma, 'prog-a');

    expect(escalado).not.toBeNull();
    expect(escalado!.totalAsignaciones).toBe(2);
    expect(escalado!.asignacionesIniciadas).toBe(2);
    expect(escalado!.asignacionesCompletadas).toBe(1);
    expect(escalado!.porcentajeGlobalConsumo).toBe(60); // (100+20)/2
    expect(escalado!.avancePorAsignacion).toHaveLength(2);
  });

  it('devuelve null si el estudiante no tiene ninguna asignación de ese programa', () => {
    const metricas = crearMetricas({
      avancePorAsignacion: [crearAvance({ asignacionId: 'asig-3', porcentajeConsumo: 100 })],
    });

    expect(escalarMetricasAPrograma(metricas, mapaPrograma, 'prog-a')).toBeNull();
  });

  it('recalcula el promedio de evaluaciones solo con los quizzes del programa filtrado', () => {
    const metricas = crearMetricas({
      avancePorAsignacion: [
        crearAvance({ asignacionId: 'asig-1', tipoRecurso: 'quiz', porcentajeConsumo: 100, scoreUltimaEvaluacion: 90, vecesEvaluado: 1 }),
        crearAvance({ asignacionId: 'asig-3', tipoRecurso: 'quiz', porcentajeConsumo: 100, scoreUltimaEvaluacion: 50, vecesEvaluado: 1 }),
      ],
    });

    const escalado = escalarMetricasAPrograma(metricas, mapaPrograma, 'prog-a');

    expect(escalado!.promedioScoreEvaluaciones).toBe(90);
    expect(escalado!.totalEvaluacionesRealizadas).toBe(1);
  });
});

describe('calcularMetricasPorMaterial', () => {
  const fechaApertura = new Map([['asig-1', '2026-07-01T08:00:00Z']]);

  it('categoriza "funciona": reacción rápida (<24h) y finalización alta (>=80%)', () => {
    const metricas = [
      crearMetricas({
        estudianteId: 'e1',
        avancePorAsignacion: [crearAvance({ primeraAperturaEn: '2026-07-01T10:00:00Z', porcentajeConsumo: 100 })],
      }),
      crearMetricas({
        estudianteId: 'e2',
        avancePorAsignacion: [crearAvance({ primeraAperturaEn: '2026-07-01T09:00:00Z', porcentajeConsumo: 90 })],
      }),
    ];

    const resultado = calcularMetricasPorMaterial(metricas, fechaApertura);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].categoria).toBe('funciona');
    expect(resultado[0].porcentajeFinalizacion).toBe(100);
    expect(resultado[0].totalEstudiantesIniciaron).toBe(2);
  });

  it('categoriza "engancha_decepciona": reacción rápida pero finalización baja', () => {
    const metricas = [
      crearMetricas({ avancePorAsignacion: [crearAvance({ primeraAperturaEn: '2026-07-01T09:00:00Z', porcentajeConsumo: 30 })] }),
      crearMetricas({ avancePorAsignacion: [crearAvance({ primeraAperturaEn: '2026-07-01T09:30:00Z', porcentajeConsumo: 20 })] }),
    ];

    const resultado = calcularMetricasPorMaterial(metricas, fechaApertura);
    expect(resultado[0].categoria).toBe('engancha_decepciona');
  });

  it('categoriza "cuesta_arrancar": reacción lenta pero finalización alta', () => {
    const metricas = [
      crearMetricas({ avancePorAsignacion: [crearAvance({ primeraAperturaEn: '2026-07-03T08:00:00Z', porcentajeConsumo: 100 })] }),
    ];

    const resultado = calcularMetricasPorMaterial(metricas, fechaApertura);
    expect(resultado[0].categoria).toBe('cuesta_arrancar');
  });

  it('categoriza "no_funciona": reacción lenta y finalización baja', () => {
    const metricas = [
      crearMetricas({ avancePorAsignacion: [crearAvance({ primeraAperturaEn: '2026-07-04T08:00:00Z', porcentajeConsumo: 10 })] }),
    ];

    const resultado = calcularMetricasPorMaterial(metricas, fechaApertura);
    expect(resultado[0].categoria).toBe('no_funciona');
  });

  it('excluye asignaciones sin fecha de apertura conocida (huérfanas)', () => {
    const metricas = [
      crearMetricas({
        avancePorAsignacion: [crearAvance({ asignacionId: 'asig-huerfana', primeraAperturaEn: '2026-07-01T09:00:00Z', porcentajeConsumo: 100 })],
      }),
    ];
    const resultado = calcularMetricasPorMaterial(metricas, fechaApertura);
    expect(resultado).toHaveLength(0);
  });

  it('excluye asignaciones que nadie ha iniciado todavía', () => {
    const metricas = [
      crearMetricas({ avancePorAsignacion: [crearAvance({ porcentajeConsumo: 0, primeraAperturaEn: undefined })] }),
    ];
    const resultado = calcularMetricasPorMaterial(metricas, fechaApertura);
    expect(resultado).toHaveLength(0);
  });

  it('agrega el programa cuando se pasa el mapa asignacion->programa', () => {
    const metricas = [
      crearMetricas({ avancePorAsignacion: [crearAvance({ primeraAperturaEn: '2026-07-01T09:00:00Z', porcentajeConsumo: 100 })] }),
    ];
    const mapaPrograma = new Map([['asig-1', { programaId: 'prog-1', programaNombre: 'Programa Infantil' }]]);

    const resultado = calcularMetricasPorMaterial(metricas, fechaApertura, mapaPrograma);
    expect(resultado[0].programaId).toBe('prog-1');
    expect(resultado[0].programaNombre).toBe('Programa Infantil');
  });
});

describe('formatearTiempoReaccion', () => {
  it('formatea minutos cuando es menos de una hora', () => {
    expect(formatearTiempoReaccion(0.75)).toBe('45min');
  });

  it('formatea horas cuando es menos de un día', () => {
    expect(formatearTiempoReaccion(3)).toBe('3h');
  });

  it('formatea días y horas cuando es un día o más', () => {
    expect(formatearTiempoReaccion(30)).toBe('1d 6h');
  });

  it('omite las horas cuando el resto es exactamente 0', () => {
    expect(formatearTiempoReaccion(48)).toBe('2d');
  });
});
