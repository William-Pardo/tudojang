// vistas/PublicLanding.test.tsx
// SDD pricing-cupo-real (Bloque 4, precio-publico-calculadora): no existía test file para
// esta vista antes de este cambio. Cubre únicamente el reemplazo del grid de planes fijos
// por la calculadora -- Scenario "Landing sin planes fijos" -- y que el landing alimenta
// PrecioCalculadora directamente con calcularFacturacionMensual (utils/facturacion.ts,
// Bloque 2), sin una segunda fórmula de precios en el archivo.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicLanding from './PublicLanding';

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, initial, animate, exit, layout, transition, whileHover, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, initial, animate, exit, layout, transition, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

const renderLanding = () => render(<PublicLanding />, { wrapper: MemoryRouter });

describe('PublicLanding', () => {
  it('Scenario "Landing sin planes fijos": no renderiza tarjetas de plan starter/growth/pro', () => {
    renderLanding();
    expect(screen.queryByText(/plan starter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/plan growth/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/plan pro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/elegir este plan/i)).not.toBeInTheDocument();
  });

  it('monta la calculadora y actualiza el total mostrado al mover el slider de estudiantes', () => {
    renderLanding();

    const totalInicial = screen.getByTestId('precio-total').textContent;

    fireEvent.change(screen.getByLabelText(/cantidad de estudiantes activos/i), { target: { value: '200' } });

    expect(screen.getByTestId('precio-total').textContent).not.toBe(totalInicial);
  });
});
