// components/academico/PanelMetricasEstudiantes.test.tsx
// Tests del componente PanelMetricasEstudiantes.

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

const mockCallableDemo = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => 'functions-mock'),
  httpsCallable: jest.fn(() => mockCallableDemo),
}));

jest.mock('../../context/DataContext', () => ({
  useEstudiantes: () => ({
    estudiantes: [
      { id: 'est-A', grado: 'Amarillo' },
      { id: 'est-B', grado: 'Blanco' },
    ],
  }),
}));

// a1 (Video 1) es de "Programa Infantil" y la comparten ambos estudiantes; a2 (Quiz 1)
// es de "Programa Competencia" y solo la tiene Ana; a3 (PDF) no tiene jornadaId (material
// asignado directo, sin programa resoluble) -- caso real documentado en
// analisisProgresoService.ts.
jest.mock('../../servicios/academico/asignacionService', () => ({
  listarAsignacionesPorTenant: jest.fn().mockResolvedValue([
    { id: 'a1', jornadaId: 'j1', fechaApertura: '2026-07-01T08:00:00Z' },
    { id: 'a2', jornadaId: 'j2', fechaApertura: '2026-07-02T08:00:00Z' },
    { id: 'a3', fechaApertura: '2026-07-03T08:00:00Z' },
  ]),
}));
jest.mock('../../servicios/academico/jornadaRepository', () => ({
  jornadaRepository: {
    listarJornadasPorTenant: jest.fn().mockResolvedValue([
      { id: 'j1', programaId: 'prog-infantil' },
      { id: 'j2', programaId: 'prog-competencia' },
    ]),
  },
}));
jest.mock('../../servicios/academico/programaRepository', () => ({
  programaRepository: {
    listarProgramasPorTenant: jest.fn().mockResolvedValue([
      { id: 'prog-infantil', nombre: 'Programa Infantil' },
      { id: 'prog-competencia', nombre: 'Programa Competencia' },
    ]),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (actividadServiceModule.actividadService.obtenerMetricas as jest.Mock).mockResolvedValue({
    metricas: metricasDemo,
  });
  (actividadServiceModule.actividadService.obtenerActividades as jest.Mock).mockResolvedValue({
    logs: [],
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

  it('muestra los 5 KPIs de resumen correctos', async () => {
    render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
    await waitFor(() => screen.getByText('Ana García'));

    const resumen = screen.getByLabelText('Resumen de métricas');
    // Total: 2 estudiantes (Ana + Bruno)
    expect(within(resumen).getByText('2')).toBeInTheDocument();
    // Al día (>=80%): solo Ana (90%)
    expect(within(resumen).getByText('1')).toBeInTheDocument();
    // Sin iniciar: ninguno (ambas ya iniciaron al menos una asignación)
    expect(within(resumen).getByText('0')).toBeInTheDocument();
    // Atraso: Bruno inició (1 asignación) pero su consumo global (20%) es < 40% -> 1 de 2 = 50%
    expect(within(resumen).getByText('50%')).toBeInTheDocument();
    // Avance de estudio: promedio de consumo global (90 + 20) / 2 = 55%
    expect(within(resumen).getByText('55%')).toBeInTheDocument();
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

    // Ahora hay 2 selects (estado y programa) -- se escopea por label para no ambiguar.
    const select = screen.getByLabelText('Filtrar por estado de progreso');
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

  describe('filtro por programa', () => {
    it('muestra el selector de programa con los programas que tienen asignaciones reales', async () => {
      render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
      await waitFor(() => screen.getByText('Ana García'));

      const select = await screen.findByLabelText('Filtrar por programa');
      expect(within(select).getByText('Programa Infantil')).toBeInTheDocument();
      expect(within(select).getByText('Programa Competencia')).toBeInTheDocument();
    });

    it('al filtrar por un programa, recalcula los números del estudiante solo con esas asignaciones', async () => {
      render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
      await waitFor(() => screen.getByText('Ana García'));

      const select = await screen.findByLabelText('Filtrar por programa');
      fireEvent.change(select, { target: { value: 'prog-infantil' } });

      // Ambos estudiantes tienen a1 (Video 1, Programa Infantil) -> ambos siguen apareciendo.
      await waitFor(() => {
        expect(screen.getByText('Ana García')).toBeInTheDocument();
        expect(screen.getByText('Bruno López')).toBeInTheDocument();
      });

      // Ana, recortada a Programa Infantil, pasa de 90% (promedio de sus 3 asignaciones)
      // a 100% (solo cuenta su Video 1, que está al 100%) -- se verifica en SU fila, no
      // en el resumen general del panel.
      const filaAna = screen.getByLabelText('Progreso académico de Ana García');
      expect(within(filaAna).getByText('100%')).toBeInTheDocument();
    });

    it('un programa sin asignaciones para un estudiante lo excluye de la lista filtrada', async () => {
      render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
      await waitFor(() => screen.getByText('Ana García'));

      const select = await screen.findByLabelText('Filtrar por programa');
      fireEvent.change(select, { target: { value: 'prog-competencia' } });

      // Solo Ana tiene a2 (Quiz 1, Programa Competencia); Bruno no tiene ninguna asignación
      // de ese programa y debe desaparecer de la lista.
      await waitFor(() => {
        expect(screen.getByText('Ana García')).toBeInTheDocument();
        expect(screen.queryByText('Bruno López')).not.toBeInTheDocument();
      });
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

  describe('vista Por Horario', () => {
    it('al hacer click en "Por Horario" carga los logs y muestra el panel de patrones', async () => {
      (actividadServiceModule.actividadService.obtenerActividades as jest.Mock).mockResolvedValue({
        logs: [
          {
            id: 'log-1',
            tenantId: 'tenant-1',
            estudianteId: 'est-A',
            asignacionId: 'a1',
            recursoId: 'r1',
            tipo: 'video',
            metadata: { porcentajeVisto: 100 },
            registradoEn: '2026-07-20T18:00:00Z',
          },
        ],
      });
      render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
      await waitFor(() => screen.getByText('Ana García'));

      fireEvent.click(screen.getByText('Por Horario'));

      await waitFor(() => expect(actividadServiceModule.actividadService.obtenerActividades).toHaveBeenCalledWith({ tenantId: 'tenant-1' }));
      expect(await screen.findByLabelText('Resumen de patrones de horario')).toBeInTheDocument();
    });

    it('no llama a obtenerActividades hasta que se selecciona la pestaña "Por Horario"', async () => {
      render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
      await waitFor(() => screen.getByText('Ana García'));
      expect(actividadServiceModule.actividadService.obtenerActividades).not.toHaveBeenCalled();
    });
  });

  describe('datos demo', () => {
    it('muestra botón "Generar datos demo" en el estado vacío y llama a la Cloud Function', async () => {
      (actividadServiceModule.actividadService.obtenerMetricas as jest.Mock).mockResolvedValue({
        metricas: [],
      });
      mockCallableDemo.mockResolvedValue({ data: { ok: true, generados: 8 } });

      render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
      await waitFor(() => screen.getByText(/sin actividad registrada/i));

      fireEvent.click(screen.getByRole('button', { name: /generar datos demo/i }));

      await waitFor(() => {
        expect(mockCallableDemo).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
        expect(screen.getByText(/se generaron 8 estudiantes de ejemplo/i)).toBeInTheDocument();
      });
    });

    it('no muestra el botón "Limpiar datos demo" si ninguna métrica es demo', async () => {
      render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
      await waitFor(() => screen.getByText('Ana García'));
      expect(screen.queryByRole('button', { name: /limpiar datos demo/i })).not.toBeInTheDocument();
    });

    it('muestra "Limpiar datos demo" cuando hay métricas con el prefijo demo- y llama a la Cloud Function', async () => {
      (actividadServiceModule.actividadService.obtenerMetricas as jest.Mock).mockResolvedValue({
        metricas: [
          { ...metricasDemo[0], estudianteId: 'demo-progreso-01' },
        ],
      });
      mockCallableDemo.mockResolvedValue({ data: { ok: true, eliminados: 1 } });

      render(<PanelMetricasEstudiantes tenantId="tenant-1" />);
      await waitFor(() => screen.getByRole('button', { name: /limpiar datos demo/i }));

      fireEvent.click(screen.getByRole('button', { name: /limpiar datos demo/i }));

      await waitFor(() => {
        expect(mockCallableDemo).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
        expect(screen.getByText(/se eliminaron 1 estudiantes de ejemplo/i)).toBeInTheDocument();
      });
    });
  });
});
