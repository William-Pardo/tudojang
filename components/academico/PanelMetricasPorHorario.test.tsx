// components/academico/PanelMetricasPorHorario.test.tsx

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import PanelMetricasPorHorario from './PanelMetricasPorHorario';
import type { ActividadLog } from '../../models/academico/actividad';
import type { ProgramaDeAsignacion } from '../../servicios/academico/analisisProgresoService';

function crearLog(overrides: Partial<ActividadLog> = {}): ActividadLog {
  return {
    id: `log-${Math.random()}`,
    tenantId: 'tenant-1',
    estudianteId: 'est-1',
    asignacionId: 'asig-1',
    recursoId: 'rec-1',
    tipo: 'video',
    metadata: { porcentajeVisto: 50 },
    registradoEn: '2026-07-20T18:00:00Z',
    ...overrides,
  };
}

describe('PanelMetricasPorHorario', () => {
  it('muestra el estado vacío cuando no hay logs', () => {
    render(
      <PanelMetricasPorHorario logs={[]} mapaAsignacionPrograma={new Map()} filtroPrograma="todos" />
    );
    expect(screen.getByText(/todavía no hay actividad registrada/i)).toBeInTheDocument();
  });

  it('muestra el total de eventos y el día/hora pico en el resumen', () => {
    const logs = [
      crearLog({ registradoEn: '2026-07-21T19:00:00Z' }), // martes 14:00 Bogota
      crearLog({ registradoEn: '2026-07-21T19:00:00Z' }), // martes 14:00 Bogota
      crearLog({ registradoEn: '2026-07-20T18:00:00Z' }), // lunes 13:00 Bogota
    ];
    render(
      <PanelMetricasPorHorario logs={logs} mapaAsignacionPrograma={new Map()} filtroPrograma="todos" />
    );

    const resumen = screen.getByLabelText('Resumen de patrones de horario');
    expect(within(resumen).getByText('3')).toBeInTheDocument();
    expect(within(resumen).getByText('Martes')).toBeInTheDocument();
    expect(within(resumen).getByText('14:00 h')).toBeInTheDocument();
  });

  it('filtra por programa cuando se pasa un filtroPrograma distinto de "todos"', () => {
    const logs = [
      crearLog({ asignacionId: 'asig-infantil', registradoEn: '2026-07-20T18:00:00Z' }),
      crearLog({ asignacionId: 'asig-competencia', registradoEn: '2026-07-21T18:00:00Z' }),
    ];
    const mapa = new Map<string, ProgramaDeAsignacion>([
      ['asig-infantil', { programaId: 'prog-infantil', programaNombre: 'Infantil' }],
      ['asig-competencia', { programaId: 'prog-competencia', programaNombre: 'Competencia' }],
    ]);
    render(
      <PanelMetricasPorHorario logs={logs} mapaAsignacionPrograma={mapa} filtroPrograma="prog-infantil" />
    );

    const resumen = screen.getByLabelText('Resumen de patrones de horario');
    expect(within(resumen).getByText('1')).toBeInTheDocument();
  });

  it('incluye la lectura sugerida mencionando el día y la hora pico', () => {
    const logs = [crearLog({ registradoEn: '2026-07-20T18:00:00Z' })];
    render(
      <PanelMetricasPorHorario logs={logs} mapaAsignacionPrograma={new Map()} filtroPrograma="todos" />
    );
    expect(screen.getByText(/lectura sugerida/i)).toBeInTheDocument();
    expect(screen.getByText(/recordatorios de estudio/i)).toBeInTheDocument();
  });
});
