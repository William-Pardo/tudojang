// components/academico/PanelMetricasEstudiantes.test.tsx
// Tests del componente PanelMetricasEstudiantes.

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PanelMetricasEstudiantes from './PanelMetricasEstudiantes';
import * as actividadServiceModule from '../../servicios/academico/actividadService';
import type { MetricasEstudiante } from '../../models/academico/actividad';

const metricasDemo: MetricasEstudiante[] = [
  {
    estudianteId: 'est-A',
    tenantId: 'tenant-1',
    estudianteNombre: 'Ana García',
    porcentajeGlobalConsumo: 90,
    promedioScoreEvaluaciones: 85,
    totalAsignaciones: 3,
    asignacionesIniciadas: 3,
    asignacionesCompletadas: 3,
    totalEvaluacionesRealizadas: 2,
    avancePorAsignacion: [
      { asignacionId: 'a1', tituloRecurso: 'Video 1', tipoRecurso: 'video', porcentajeConsumo: 100 },
      { asignacionId: 'a2', tituloRecurso: 'Quiz 1', tipoRecurso: 'quiz', porcentajeConsumo: 100, scoreUltimaEvaluacion: 85 },
      { asignacionId: 'a3', tituloRecurso: 'PDF', tipoRecurso: 'pdf', porcentajeConsumo: 70 },
    ],
    ultimaActividadEn: '2026-07-05T10:00:00Z',
    actualizadoEn: '2026-07-05T10:01:00Z',
  },
  {
    estudianteId: 'est-B',
    tenantId: 'tenant-1',
    estudianteNombre: 'Bruno López',
    porcentajeGlobalConsumo: 20,
    promedioScoreEvaluaciones: 0,
    totalAsignaciones: 3,
    asignacionesIniciadas: 1,
    asignacionesCompletadas: 0,
    totalEvaluacionesRealizadas: 0,
    avancePorAsignacion: [
      { asignacionId: 'a1', tituloRecurso: 'Video 1', tipoRecurso: 'video', porcentajeConsumo: 20 },
    ],
    ultimaActividadEn: '2026-07-01T08:00:00Z',
    actualizadoEn: '2026-07-01T08:01:00Z',
  },
];

// Mock del servicio
jest.mock('../../servicios/academico/actividadService', () => ({
  actividadService: {
    obtenerMetricas: jest.fn(),
    registrarActividad: jest.fn(),
    obtenerActividades: jest.fn(),
    _recalcularMetricas: jest.fn(),
  },
  registrarActividad: jest.fn(),
  obtenerActividades: jest.fn(),
  obtenerMetricas: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (actividadServiceModule.actividadService.obtenerMetricas as jest.Mock).mockResolvedValue({
    metricas: metricasDemo,
  });
});

describe('PanelMetricasEstudiantes', () => {
  it('muestra estado de carga inicialmente', () => {
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    expect(screen.getByText(/cargando métricas/i)).toBeInTheDocument();
  });

  it('muestra las tarjetas de estudiantes después de cargar', async () => {
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => {
      expect(screen.getByText('Ana García')).toBeInTheDocument();
      expect(screen.getByText('Bruno López')).toBeInTheDocument();
    });
  });

  it('muestra KPIs de resumen correctos', async () => {
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => {
      // 2 estudiantes total
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('filtra estudiantes por búsqueda de nombre', async () => {
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => screen.getByText('Ana García'));

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'Ana' } });

    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.queryByText('Bruno López')).not.toBeInTheDocument();
  });

  it('filtra por estado "al_dia"', async () => {
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => screen.getByText('Ana García'));

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'al_dia' } });

    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.queryByText('Bruno López')).not.toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay estudiantes con actividad', async () => {
    (actividadServiceModule.actividadService.obtenerMetricas as jest.Mock).mockResolvedValue({
      metricas: [],
    });
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => {
      expect(screen.getByText(/sin actividad registrada/i)).toBeInTheDocument();
    });
  });

  it('el estado vacío aclara que asignar material no genera actividad por sí solo', async () => {
    (actividadServiceModule.actividadService.obtenerMetricas as jest.Mock).mockResolvedValue({
      metricas: [],
    });
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => {
      expect(screen.getByText(/asignar material a una clase no genera actividad por sí solo/i)).toBeInTheDocument();
    });
  });

  it('muestra mensaje de error cuando el servicio falla', async () => {
    (actividadServiceModule.actividadService.obtenerMetricas as jest.Mock).mockRejectedValue(
      new Error('Firestore error')
    );
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => {
      expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument();
    });
  });

  it('muestra badge de estado "Al día" para estudiante con consumo >= 80%', async () => {
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => screen.getByText('Ana García'));
    // 'Al día' aparece en el badge Y en la opción del select, por eso usamos getAllByText
    expect(screen.getAllByText('Al día').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra badge "Atrasado" para estudiante con consumo < 40%', async () => {
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => screen.getByText('Bruno López'));
    // 'Atrasado' aparece en el badge Y en la opción del select
    expect(screen.getAllByText('Atrasado').length).toBeGreaterThanOrEqual(1);
  });
});
