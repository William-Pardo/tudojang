// components/academico/ProgresoEstudianteCard.test.tsx
// Tests del componente ProgresoEstudianteCard (rediseño 2026-07-17: fila limpia +
// modal "Ver asignaciones" en vez de tarjeta con expandir/colapsar inline).

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgresoEstudianteCard from './ProgresoEstudianteCard';
import type { MetricasEstudiante } from '../../models/academico/actividad';

const estadoAlDia = { texto: 'Al día', className: 'bg-green-100 text-green-700' };

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
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    expect(screen.getByText('Valentina Restrepo')).toBeInTheDocument();
  });

  it('muestra iniciado, completo y evaluación como fracción x/total', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    // 2 iniciadas / 3 totales, 1 completada / 3 totales
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    // Evaluación: 1 de las 1 asignación tipo quiz fue evaluada (vecesEvaluado: 2 > 0)
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('muestra el grado del estudiante cuando se recibe por props', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} grado="Amarillo" />);
    expect(screen.getByText('Amarillo')).toBeInTheDocument();
  });

  it('no rompe si no se recibe el grado', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    expect(screen.getByText('Valentina Restrepo')).toBeInTheDocument();
  });

  it('muestra el porcentaje de consumo global', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('muestra el pill de estado recibido por props', () => {
    render(
      <ProgresoEstudianteCard
        metricas={metricasBase}
        estado={{ texto: 'Atrasado', className: 'bg-orange-100 text-orange-700' }}
      />
    );
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
  });

  it('muestra hasta 3 iconos de asignaciones sin "..." cuando hay exactamente 3', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    expect(screen.getByRole('button', { name: /ver asignaciones \(3\)/i })).toBeInTheDocument();
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('muestra "..." cuando hay más de 3 asignaciones', () => {
    const conCuatro: MetricasEstudiante = {
      ...metricasBase,
      avancePorAsignacion: [
        ...metricasBase.avancePorAsignacion,
        {
          asignacionId: 'asig-4',
          tituloRecurso: 'Historia del Taekwondo',
          tipoRecurso: 'presentacion',
          porcentajeConsumo: 50,
        },
      ],
    };
    render(<ProgresoEstudianteCard metricas={conCuatro} estado={estadoAlDia} />);
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('al hacer click en los iconos de asignaciones abre el modal "Ver asignaciones"', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    expect(screen.queryByText('Ver asignaciones')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ver asignaciones \(3\)/i }));

    expect(screen.getByText('Ver asignaciones')).toBeInTheDocument();
    // Nombre del estudiante también aparece en el encabezado del modal
    expect(screen.getAllByText('Valentina Restrepo').length).toBeGreaterThanOrEqual(2);
  });

  it('el modal muestra nombre, fecha y % de consumo de cada asignación', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    fireEvent.click(screen.getByRole('button', { name: /ver asignaciones \(3\)/i }));

    expect(screen.getByText('Técnica de Patada Frontal.mp4')).toBeInTheDocument();
    expect(screen.getByText('Evaluación Módulo 1')).toBeInTheDocument();
    expect(screen.getByText('Reglamento TKD.pdf')).toBeInTheDocument();
    expect(screen.getByText('75% consumido')).toBeInTheDocument();
    expect(screen.getByText('20% consumido')).toBeInTheDocument();
  });

  it('el modal se puede cerrar con el botón de cerrar', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    fireEvent.click(screen.getByRole('button', { name: /ver asignaciones \(3\)/i }));
    expect(screen.getByText('Ver asignaciones')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByText('Ver asignaciones')).not.toBeInTheDocument();
  });

  it('muestra barras de progreso accesibles con aria-valuenow dentro del modal', () => {
    render(<ProgresoEstudianteCard metricas={metricasBase} estado={estadoAlDia} />);
    fireEvent.click(screen.getByRole('button', { name: /ver asignaciones \(3\)/i }));

    const barras = screen.getAllByRole('progressbar');
    expect(barras.length).toBe(3);
    expect(barras[0]).toHaveAttribute('aria-valuenow');
  });

  it('sin asignaciones, no muestra botón de ver asignaciones', () => {
    const sinAsig: MetricasEstudiante = {
      ...metricasBase,
      totalAsignaciones: 0,
      avancePorAsignacion: [],
    };
    render(<ProgresoEstudianteCard metricas={sinAsig} estado={{ texto: 'Sin asignaciones', className: 'bg-gray-100 text-gray-500' }} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('última actividad', () => {
    const AHORA_FIJO = new Date('2026-07-18T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask'] }).setSystemTime(AHORA_FIJO);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('muestra "Sin actividad" cuando el estudiante nunca interactuó', () => {
      const sinActividad: MetricasEstudiante = { ...metricasBase, ultimaActividadEn: undefined };
      render(<ProgresoEstudianteCard metricas={sinActividad} estado={estadoAlDia} />);
      expect(screen.getByText('Sin actividad')).toBeInTheDocument();
    });

    it('muestra "Ayer" cuando la última actividad fue hace 1 día', () => {
      const ayer: MetricasEstudiante = { ...metricasBase, ultimaActividadEn: '2026-07-17T10:00:00Z' };
      render(<ProgresoEstudianteCard metricas={ayer} estado={estadoAlDia} />);
      expect(screen.getByText('Ayer')).toBeInTheDocument();
    });

    it('muestra "Hace X días" para actividad reciente, sin marcar alerta', () => {
      const haceCincoDias: MetricasEstudiante = { ...metricasBase, ultimaActividadEn: '2026-07-13T12:00:00Z' };
      render(<ProgresoEstudianteCard metricas={haceCincoDias} estado={estadoAlDia} />);
      const texto = screen.getByText('Hace 5 días');
      expect(texto).toBeInTheDocument();
      expect(texto).not.toHaveClass('text-tkd-red');
    });

    it('marca en rojo (alerta) cuando pasaron 14 días o más sin actividad', () => {
      const haceTresSemanas: MetricasEstudiante = { ...metricasBase, ultimaActividadEn: '2026-06-27T12:00:00Z' };
      render(<ProgresoEstudianteCard metricas={haceTresSemanas} estado={estadoAlDia} />);
      const texto = screen.getByText('Hace 3 semanas');
      expect(texto).toBeInTheDocument();
      expect(texto).toHaveClass('text-tkd-red');
    });
  });
});
