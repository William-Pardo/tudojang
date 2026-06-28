import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorState from './ErrorState';

jest.mock('./Iconos', () => ({
  IconoAlertaTriangulo: ({ className }: { className?: string }) => (
    <svg data-testid="error-icon" className={className} aria-label="Error icon" />
  ),
}));

describe('ErrorState', () => {
  it('renders the error title, message, and icon without a retry button', () => {
    render(<ErrorState mensaje="No fue posible cargar los datos." />);

    expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /algo sali.* mal/i })).toBeInTheDocument();
    expect(screen.getByText('No fue posible cargar los datos.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Intentar Nuevamente' })).not.toBeInTheDocument();
  });

  it('invokes the retry callback when the retry button is clicked', async () => {
    const user = userEvent.setup();
    const onReintentar = jest.fn();
    render(<ErrorState mensaje="Error temporal." onReintentar={onReintentar} />);

    await user.click(screen.getByRole('button', { name: 'Intentar Nuevamente' }));

    expect(onReintentar).toHaveBeenCalledTimes(1);
  });
});
