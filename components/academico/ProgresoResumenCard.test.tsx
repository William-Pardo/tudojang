import React from 'react';
import { render, screen } from '@testing-library/react';
import ProgresoResumenCard, { calcularPorcentajeGeneral } from './ProgresoResumenCard';

describe('ProgresoResumenCard', () => {
  it('calcula el porcentaje general con asignaciones completadas sobre total', () => {
    expect(calcularPorcentajeGeneral({
      total: 4,
      completadas: 3,
      enProgreso: 1,
      vencidas: 0,
      proximasAVencer: 1,
    })).toBe(75);
  });

  it('evita división por cero cuando no hay asignaciones', () => {
    expect(calcularPorcentajeGeneral({
      total: 0,
      completadas: 0,
      enProgreso: 0,
      vencidas: 0,
      proximasAVencer: 0,
    })).toBe(0);
  });

  it('renderiza métricas principales del estudiante', () => {
    render(
      <ProgresoResumenCard
        metricas={{
          total: 3,
          completadas: 1,
          enProgreso: 1,
          vencidas: 0,
          proximasAVencer: 1,
        }}
      />
    );

    expect(screen.getByText('Material publicado')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText(/1 completado/i)).toBeInTheDocument();
  });
});
