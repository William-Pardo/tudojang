import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AutosavePrompt from './AutosavePrompt';

jest.mock('./Iconos', () => ({
  IconoGuardar: ({ className }: { className?: string }) => (
    <svg data-testid="save-icon" className={className} />
  ),
  IconoEliminar: ({ className }: { className?: string }) => (
    <svg data-testid="delete-icon" className={className} />
  ),
}));

describe('AutosavePrompt', () => {
  it('renders the alert message, actions, and their icons', () => {
    render(<AutosavePrompt onRestore={jest.fn()} onDiscard={jest.fn()} />);

    const alert = screen.getByRole('alert');
    const discard = screen.getByRole('button', { name: 'Descartar borrador' });
    const restore = screen.getByRole('button', { name: 'Restaurar borrador' });

    expect(alert).toHaveTextContent(/Encontramos un borrador no guardado/i);
    expect(alert).toHaveTextContent(/continuar donde lo dejaste/i);
    expect(discard).toHaveAttribute('type', 'button');
    expect(restore).toHaveAttribute('type', 'button');
    expect(discard).toContainElement(screen.getByTestId('delete-icon'));
    expect(restore).toContainElement(screen.getByTestId('save-icon'));
  });

  it('invokes only onDiscard when the discard action is clicked', async () => {
    const user = userEvent.setup();
    const onDiscard = jest.fn();
    const onRestore = jest.fn();
    render(<AutosavePrompt onRestore={onRestore} onDiscard={onDiscard} />);

    await user.click(screen.getByRole('button', { name: 'Descartar borrador' }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('invokes only onRestore when the restore action is clicked', async () => {
    const user = userEvent.setup();
    const onDiscard = jest.fn();
    const onRestore = jest.fn();
    render(<AutosavePrompt onRestore={onRestore} onDiscard={onDiscard} />);

    await user.click(screen.getByRole('button', { name: 'Restaurar borrador' }));

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });
});
