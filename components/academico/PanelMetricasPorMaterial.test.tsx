// components/academico/PanelMetricasPorMaterial.test.tsx

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import PanelMetricasPorMaterial from './PanelMetricasPorMaterial';
import type { MetricasEstudiante } from '../../models/academico/actividad';

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

const fechaApertura = new Map([
  ['asig-funciona', '2026-07-01T08:00:00Z'],
  ['asig-no-funciona', '2026-07-01T08:00:00Z'],
]);

describe('PanelMetricasPorMaterial', () => {
  it('muestra el estado vacío cuando ningún material tiene actividad', () => {
    render(
      <PanelMetricasPorMaterial
        metricas={[]}
        fechaAperturaPorAsignacion={new Map()}
        mapaAsignacionPrograma={new Map()}
        filtroPrograma="todos"
      />
    );
    expect(screen.getByText(/ningún material tiene actividad todavía/i)).toBeInTheDocument();
  });

  it('agrupa un material en "Funciona" cuando reacciona rápido y finaliza alto', () => {
    const metricas = [
      crearMetricas({
        avancePorAsignacion: [{
          asignacionId: 'asig-funciona',
          tituloRecurso: 'Poomsae Taegeuk Il Jang.mp4',
          tipoRecurso: 'video',
          porcentajeConsumo: 97,
          primeraAperturaEn: '2026-07-01T08:45:00Z',
        }],
      }),
    ];

    render(
      <PanelMetricasPorMaterial
        metricas={metricas}
        fechaAperturaPorAsignacion={fechaApertura}
        mapaAsignacionPrograma={new Map()}
        filtroPrograma="todos"
      />
    );

    expect(screen.getByText('Funciona')).toBeInTheDocument();
    expect(screen.getByText('Poomsae Taegeuk Il Jang.mp4')).toBeInTheDocument();
  });

  it('agrupa un material en "No está funcionando" cuando reacciona lento y finaliza bajo', () => {
    const metricas = [
      crearMetricas({
        avancePorAsignacion: [{
          asignacionId: 'asig-no-funciona',
          tituloRecurso: 'Historia del Taekwondo.pdf',
          tipoRecurso: 'pdf',
          porcentajeConsumo: 20,
          primeraAperturaEn: '2026-07-05T08:00:00Z',
        }],
      }),
    ];

    render(
      <PanelMetricasPorMaterial
        metricas={metricas}
        fechaAperturaPorAsignacion={fechaApertura}
        mapaAsignacionPrograma={new Map()}
        filtroPrograma="todos"
      />
    );

    expect(screen.getByText('No está funcionando')).toBeInTheDocument();
    expect(screen.getByText('Historia del Taekwondo.pdf')).toBeInTheDocument();
  });

  it('muestra el KPI de resumen con el total de materiales activos', () => {
    const metricas = [
      crearMetricas({
        avancePorAsignacion: [{
          asignacionId: 'asig-funciona',
          tituloRecurso: 'Material A',
          tipoRecurso: 'video',
          porcentajeConsumo: 100,
          primeraAperturaEn: '2026-07-01T08:30:00Z',
        }],
      }),
    ];

    render(
      <PanelMetricasPorMaterial
        metricas={metricas}
        fechaAperturaPorAsignacion={fechaApertura}
        mapaAsignacionPrograma={new Map()}
        filtroPrograma="todos"
      />
    );

    const resumen = screen.getByLabelText('Resumen de métricas por material');
    expect(within(resumen).getByText('1')).toBeInTheDocument();
  });

  it('filtra los materiales por programa cuando se pasa un filtroPrograma distinto de "todos"', () => {
    const metricas = [
      crearMetricas({
        avancePorAsignacion: [
          { asignacionId: 'asig-funciona', tituloRecurso: 'Material Infantil', tipoRecurso: 'video', porcentajeConsumo: 100, primeraAperturaEn: '2026-07-01T08:30:00Z' },
          { asignacionId: 'asig-no-funciona', tituloRecurso: 'Material Competencia', tipoRecurso: 'pdf', porcentajeConsumo: 100, primeraAperturaEn: '2026-07-01T08:30:00Z' },
        ],
      }),
    ];
    const mapaPrograma = new Map([
      ['asig-funciona', { programaId: 'prog-infantil', programaNombre: 'Infantil' }],
      ['asig-no-funciona', { programaId: 'prog-competencia', programaNombre: 'Competencia' }],
    ]);

    render(
      <PanelMetricasPorMaterial
        metricas={metricas}
        fechaAperturaPorAsignacion={fechaApertura}
        mapaAsignacionPrograma={mapaPrograma}
        filtroPrograma="prog-infantil"
      />
    );

    expect(screen.getByText('Material Infantil')).toBeInTheDocument();
    expect(screen.queryByText('Material Competencia')).not.toBeInTheDocument();
  });
});
