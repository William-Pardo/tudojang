import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TablaUsuarios from './TablaUsuarios';
import type { Usuario } from '../tipos';
import { RolUsuario } from '../tipos';

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./FilaUsuario', () => ({
  FilaUsuario: ({ usuario, onEditar, onEliminar, onGestionarContrato, isCard }: any) =>
    isCard ? (
      <div data-testid={`card-${usuario.id}`}>
        <span>{usuario.nombreUsuario} móvil</span>
        <button onClick={() => onEditar(usuario)}>Editar móvil {usuario.id}</button>
        <button onClick={() => onEliminar(usuario)}>Eliminar móvil {usuario.id}</button>
        <button onClick={() => onGestionarContrato(usuario)}>Contrato móvil {usuario.id}</button>
      </div>
    ) : (
      <tr data-testid={`row-${usuario.id}`}>
        <td>{usuario.nombreUsuario} desktop</td>
        <td>
          <button onClick={() => onEditar(usuario)}>Editar desktop {usuario.id}</button>
          <button onClick={() => onEliminar(usuario)}>Eliminar desktop {usuario.id}</button>
          <button onClick={() => onGestionarContrato(usuario)}>Contrato desktop {usuario.id}</button>
        </td>
      </tr>
    ),
}));

const usuarios: Usuario[] = [
  {
    id: 'u1',
    nombreUsuario: 'Ana Ruiz',
    email: 'ana@test.com',
    numeroIdentificacion: '1',
    whatsapp: '3000000001',
    rol: RolUsuario.Admin,
    tenantId: 'tenant-1',
  },
  {
    id: 'u2',
    nombreUsuario: 'Luis Pérez',
    email: 'luis@test.com',
    numeroIdentificacion: '2',
    whatsapp: '3000000002',
    rol: RolUsuario.Asistente,
    tenantId: 'tenant-1',
  },
];

const renderTable = (list: Usuario[] = usuarios) => {
  const callbacks = {
    onEditar: jest.fn(),
    onEliminar: jest.fn(),
    onGestionarContrato: jest.fn(),
  };
  render(<TablaUsuarios usuarios={list} {...callbacks} />);
  return callbacks;
};

describe('TablaUsuarios', () => {
  it('renders desktop headers and both empty-state variants', () => {
    renderTable([]);

    expect(screen.getByRole('columnheader', { name: 'Nombre y Email' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Rol' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Estado Legal' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
    expect(screen.getAllByText('No hay personal registrado.')).toHaveLength(2);
    expect(screen.queryByTestId(/^(row|card)-/)).not.toBeInTheDocument();
  });

  it('renders every user in desktop and mobile variants', () => {
    renderTable();

    expect(screen.getByTestId('row-u1')).toHaveTextContent('Ana Ruiz desktop');
    expect(screen.getByTestId('card-u1')).toHaveTextContent('Ana Ruiz móvil');
    expect(screen.getByTestId('row-u2')).toHaveTextContent('Luis Pérez desktop');
    expect(screen.getByTestId('card-u2')).toHaveTextContent('Luis Pérez móvil');
    expect(screen.queryByText('No hay personal registrado.')).not.toBeInTheDocument();
  });

  it('forwards edit, delete, and contract callbacks with the selected user', async () => {
    const user = userEvent.setup();
    const callbacks = renderTable([usuarios[1]]);

    await user.click(screen.getByRole('button', { name: 'Editar desktop u2' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar móvil u2' }));
    await user.click(screen.getByRole('button', { name: 'Contrato desktop u2' }));

    expect(callbacks.onEditar).toHaveBeenCalledWith(usuarios[1]);
    expect(callbacks.onEliminar).toHaveBeenCalledWith(usuarios[1]);
    expect(callbacks.onGestionarContrato).toHaveBeenCalledWith(usuarios[1]);
  });

  it('renders a single user exactly once per responsive view', () => {
    renderTable([usuarios[0]]);

    expect(screen.getAllByTestId(/^(row|card)-u1$/)).toHaveLength(2);
    expect(screen.queryByTestId('row-u2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-u2')).not.toBeInTheDocument();
  });
});
