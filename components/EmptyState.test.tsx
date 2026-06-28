import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from './EmptyState';

const TestIcon = ({ className }: { className?: string }) => (
  <svg data-testid="empty-icon" className={className} aria-label="Empty icon" />
);

describe('EmptyState', () => {
  it('renders its icon, title, and message without an action', () => {
    render(
      <EmptyState
        Icono={TestIcon}
        titulo="No hay resultados"
        mensaje="Todavía no existen elementos."
      />,
    );

    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No hay resultados' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no existen elementos.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders its action and invokes its callback when clicked', async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();

    render(
      <EmptyState Icono={TestIcon} titulo="Sin estudiantes" mensaje="Agrega el primero.">
        <button onClick={onAction}>Agregar estudiante</button>
      </EmptyState>,
    );

    await user.click(screen.getByRole('button', { name: 'Agregar estudiante' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
