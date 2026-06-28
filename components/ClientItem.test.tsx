import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientItem from './ClientItem';

describe('ClientItem', () => {
  it('renders complete client data, photo, and active status', () => {
    render(
      <ClientItem
        cliente={{
          id: 'client-1',
          nombre: 'Ana Torres',
          email: 'ana@test.com',
          fotoUrl: 'https://example.com/ana.jpg',
          activo: true,
        }}
      />,
    );

    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ana Torres' })).toBeInTheDocument();
    expect(screen.getByText('ana@test.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto de Ana Torres' })).toHaveAttribute(
      'src',
      'https://example.com/ana.jpg',
    );
    expect(screen.getByText('Activo')).toHaveClass('bg-green-100');
  });

  it('renders safe fallbacks and inactive status for incomplete data', () => {
    render(<ClientItem cliente={{ nombre: ' ', email: '', fotoUrl: ' ' }} />);

    expect(screen.getByText('Cliente sin nombre')).toBeInTheDocument();
    expect(screen.getByText('Sin correo registrado')).toBeInTheDocument();
    expect(screen.getByLabelText('Avatar de Cliente sin nombre')).toHaveTextContent('C');
    expect(screen.getByText('Inactivo')).toHaveClass('bg-gray-100');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('does not fail when cliente is %s', (_, cliente) => {
    expect(() => render(<ClientItem cliente={cliente} />)).not.toThrow();
    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(screen.getByText('Cliente sin nombre')).toBeInTheDocument();
  });

  it('invokes onVerDetalle with the client id', async () => {
    const user = userEvent.setup();
    const onVerDetalle = jest.fn();
    render(
      <ClientItem
        cliente={{ id: 'client-42', nombre: 'Luis', activo: false }}
        onVerDetalle={onVerDetalle}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ver detalle' }));

    expect(onVerDetalle).toHaveBeenCalledTimes(1);
    expect(onVerDetalle).toHaveBeenCalledWith('client-42');
  });

  it('allows clicking without a callback and normalizes a missing id', async () => {
    const user = userEvent.setup();
    render(<ClientItem cliente={{ nombre: 'Sin ID' }} />);

    await expect(
      user.click(screen.getByRole('button', { name: 'Ver detalle' })),
    ).resolves.toBeUndefined();
  });
});
