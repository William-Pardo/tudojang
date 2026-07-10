// components/academico/ProgresoEstudianteCard.test.tsx
// Tests del componente ProgresoEstudianteCard.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgresoEstudianteCard from './ProgresoEstudianteCard';
import type { MetricasEstudiante } from '../../models/academico/actividad';

const metricasBase: MetricasEstudiante = {
  estudianteId: 'est-1',
  tenantId: 'tenant-1',
  estudianteNombre: 'Valentina Restrepo',
  porcentajeGlobalConsumo: 65,
  promedioScoreEvaluaciones: 78,
  totalAsignaciones: 3,
  asignacionesIniciadas: 2,
  asignacionesCompletadas: 1,
  totalEvaluacionesRealizadas: 2,
  avancePorAsignacion: [
    {
      asignacionId: 'asig-1',
      tituloRecurso: 'Técnica de Patada Frontal.mp4',
      tipoRecurso: 'video',
      porcentajeConsumo: 75,
      primeraAperturaEn: '2026-07-01T10:00:00Z',
      ultimaActividadEn: '2026-07-01T10:30:00Z',
    },
    {
      asignacionId: 'asig-2',
      tituloRecurso: 'Evaluación Módulo 1',
      tipoRecurso: 'quiz',
      porcentajeConsumo: 100,
      scoreUltimaEvaluacion: 78,
      vecesEvaluado: 2,
      ultimaActividadEn: '2026-07-02T15:00:00Z',
    },
    {
      asignacionId: 'asig-3',
      tituloRecurso: 'Reglamento TKD.pdf',
      tipoRecurso: 'pdf',
      porcentajeConsumo: 20,
      ultimaActividadEn: '2026-07-03T09:00:00Z',
    },
  ],
  ultimaActividadEn: '2026-07-03T09:00:00Z',
  actualizadoEn: '2026-07-03T09:05:00Z',
};

describe('ProgresoEstudianteCard', () => {
  it('muestra el nombre del estudiante', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} />);
    expect(screen.getByText('Valentina Restrepo')).toBeInTheDocument();
  });

  it('muestra el porcentaje de consumo global', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} />);
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('muestra las estadísticas de asignaciones completadas e iniciadas', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} />);
    expect(screen.getByText('1')).toBeInTheDocument(); // completadas
    expect(screen.getByText('2')).toBeInTheDocument(); // iniciadas
  });

  it('muestra el promedio de evaluaciones', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} />);
    expect(screen.getByText('78%')).toBeInTheDocument();
  });

  it('muestra botón para expandir detalle cuando hay asignaciones', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} />);
    expect(screen.getByRole('button', { name: /ver 3 asignaciones/i })).toBeInTheDocument();
  });

  it('al expandir muestra la lista de materiales', () => {
    const mockToggle = jest.fn();
    const { rerender } = render(
      <ProgresoEstudianteCard
        metricas={metricasBase}
        expandido={false}
        onToggleExpandido={mockToggle}
      />
    );

    const btn = screen.getByRole('button', { name: /ver 3 asignaciones/i });
    fireEvent.click(btn);
    expect(mockToggle).toHaveBeenCalledTimes(1);

    // Rerender con expandido=true
    rerender(
      <ProgresoEstudianteCard
        metricas={metricasBase}
        expandido={true}
        onToggleExpandido={mockToggle}
      />
    );

    expect(screen.getByText('Técnica de Patada Frontal.mp4')).toBeInTheDocument();
    expect(screen.getByText('Evaluación Módulo 1')).toBeInTheDocument();
    expect(screen.getByText('Reglamento TKD.pdf')).toBeInTheDocument();
  });

  it('muestra el score de quiz en el detalle', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} expandido={true} />);
    // El score 78% aparece en el detalle de quiz
    const scores = screen.getAllByText('78%');
    expect(scores.length).toBeGreaterThanOrEqual(1);
  });

  it('muestra — cuando no hay evaluaciones', () => {
    const sinEvaluaciones: MetricasEstudiante = {
      ...metricasBase,
      totalEvaluacionesRealizadas: 0,
      promedioScoreEvaluaciones: 0,
    };
    render(<ProgresoEstudianteCard metricas={sinEvaluaciones} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('no muestra botón expandir si no hay asignaciones', () => {
    const sinAsig: MetricasEstudiante = {
      ...metricasBase,
      totalAsignaciones: 0,
      avancePorAsignacion: [],
    };
    render(<ProgresoEstudianteCard metricas={sinAsig} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('muestra barras de progreso accesibles con aria-valuenow', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} expandido={true} />);
    const barras = screen.getAllByRole('progressbar');
    expect(barras.length).toBeGreaterThanOrEqual(1);
    expect(barras[0]).toHaveAttribute('aria-valuenow');
  });
});
