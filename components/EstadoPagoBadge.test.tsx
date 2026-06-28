import { render, screen } from '@testing-library/react';
import EstadoPagoBadge from './EstadoPagoBadge';
import { useEstadoPago } from '../hooks/useEstadoPago';

jest.mock('../hooks/useEstadoPago', () => ({
  useEstadoPago: jest.fn(),
}));

const mockedUseEstadoPago = useEstadoPago as jest.Mock;

describe('EstadoPagoBadge', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['paid', 'Paid', 'green'],
    ['pending', 'Pending', 'orange'],
    ['overdue', 'Overdue', 'red'],
  ])('renderiza %s usando la presentación del hook', (status, label, color) => {
    mockedUseEstadoPago.mockReturnValue({ label, color });
    render(<EstadoPagoBadge status={status} />);

    const badge = screen.getByText(label);
    expect(useEstadoPago).toHaveBeenCalledWith(status);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(color);
  });

  it('mantiene compatibilidad con la prop estado', () => {
    mockedUseEstadoPago.mockReturnValue({ label: 'Al Día', color: 'green' });
    render(<EstadoPagoBadge estado={'Al Día' as any} />);
    expect(useEstadoPago).toHaveBeenCalledWith('Al Día');
  });

  it('usa estado vacío cuando no recibe ninguna prop', () => {
    mockedUseEstadoPago.mockReturnValue({ label: 'Sin estado', color: 'gray' });
    render(<EstadoPagoBadge />);
    expect(useEstadoPago).toHaveBeenCalledWith('');
  });
});
