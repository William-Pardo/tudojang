import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilaUsuario } from './FilaUsuario';
import type { Usuario } from '../tipos';

// Mock de framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
    td: ({ children, ...props }: any) => <td {...props}>{children}</td>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock de los iconos
jest.mock('./Iconos', () => ({
  IconoEditar: () => <svg data-testid="icon-editar" />,
  IconoEliminar: () => <svg data-testid="icon-eliminar" />,
  IconoContrato: () => <svg data-testid="icon-contrato" />,
  IconoAprobar: () => <svg data-testid="icon-aprobar" />,
}));

describe('FilaUsuario', () => {
  const mockUsuarioBase: Usuario = {
    id: '1',
    nombreUsuario: 'Juan Perez',
    email: 'juan.perez@example.com',
    rol: 'Administrador',
    contrato: null,
  };

  const mockOnEditar = jest.fn();
  const mockOnEliminar = jest.fn();
  const mockOnGestionarContrato = jest.fn();

  beforeEach(() => {
    mockOnEditar.mockClear();
    mockOnEliminar.mockClear();
    mockOnGestionarContrato.mockClear();
  });

  // Test Case 1.1: Debe renderizar la vista de tarjeta cuando isCard es true.
  test('renders as a card when isCard is true', () => {
    render(
      <FilaUsuario
        usuario={mockUsuarioBase}
        onEditar={mockOnEditar}
        onEliminar={mockOnEliminar}
        onGestionarContrato={mockOnGestionarContrato}
        isCard={true}
      />
    );
    const cardElement = screen.getByText('Juan Perez').closest('.bg-white');
    expect(cardElement).toBeInTheDocument();
    expect(cardElement).toHaveClass('rounded-lg'); // Check for another card specific class
    expect(screen.queryByRole('row')).not.toBeInTheDocument(); // Should not be a table row
  });

  // Test Case 1.2: Debe renderizar la vista de fila de tabla cuando isCard es false.
  test('renders as a table row when isCard is false', () => {
    render(
      <table>
        <tbody>
          <FilaUsuario
            usuario={mockUsuarioBase}
            onEditar={mockOnEditar}
            onEliminar={mockOnEliminar}
            onGestionarContrato={mockOnGestionarContrato}
            isCard={false}
          />
        </tbody>
      </table>
    );
    const tableRow = screen.getByRole('row');
    expect(tableRow).toBeInTheDocument();
    expect(tableRow).toHaveTextContent('Juan Perez');
    expect(tableRow).toHaveClass('dark:hover:bg-gray-700/50'); // Check for a table row specific class
  });

  // Test Case 2: Renderizado de Información del Usuario
  test('displays user information', () => {
    render(
      <FilaUsuario
        usuario={mockUsuarioBase}
        onEditar={mockOnEditar}
        onEliminar={mockOnEliminar}
        onGestionarContrato={mockOnGestionarContrato}
        isCard={false}
      />
    );
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('juan.perez@example.com')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
  });

  // Test Case 3.1: Contrato: Firmado
  test('displays "Contrato: Firmado" when contract is signed', () => {
    const usuarioFirmado = { ...mockUsuarioBase, contrato: { firmado: true } };
    render(
      <FilaUsuario
        usuario={usuarioFirmado}
        onEditar={mockOnEditar}
        onEliminar={mockOnEliminar}
        onGestionarContrato={mockOnGestionarContrato}
        isCard={false}
      />
    );
    const badge = screen.getByText(/Contrato: Firmado/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100');
    expect(screen.getByTitle('Gestionar Vínculo Legal')).toHaveClass('text-green-500');
  });

  // Test Case 3.2: Contrato: Pendiente
  test('displays "Contrato: Pendiente" when contract is pending', () => {
    const usuarioPendiente = { ...mockUsuarioBase, contrato: { firmado: false } };
    render(
      <FilaUsuario
        usuario={usuarioPendiente}
        onEditar={mockOnEditar}
        onEliminar={mockOnEliminar}
        onGestionarContrato={mockOnGestionarContrato}
        isCard={false}
      />
    );
    const badge = screen.getByText(/Contrato: Pendiente/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-100');
    expect(screen.getByTitle('Gestionar Vínculo Legal')).toHaveClass('text-gray-400');
  });

  // Test Case 3.3: Contrato: Sin configurar
  test('displays "Contrato: Sin configurar" when contract is null', () => {
    render(
      <FilaUsuario
        usuario={mockUsuarioBase}
        onEditar={mockOnEditar}
        onEliminar={mockOnEliminar}
        onGestionarContrato={mockOnGestionarContrato}
        isCard={false}
      />
    );
    const badge = screen.getByText(/Contrato: Sin configurar/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100');
    expect(screen.getByTitle('Gestionar Vínculo Legal')).toHaveClass('text-gray-400');
  });

  // Test Case 4.1: Interacciones - Gestionar Vínculo Legal
  test('calls onGestionarContrato when "Gestionar Vínculo Legal" button is clicked', async () => {
    render(
      <FilaUsuario
        usuario={mockUsuarioBase}
        onEditar={mockOnEditar}
        onEliminar={mockOnEliminar}
        onGestionarContrato={mockOnGestionarContrato}
        isCard={false}
      />
    );
    await userEvent.click(screen.getByTitle('Gestionar Vínculo Legal'));
    expect(mockOnGestionarContrato).toHaveBeenCalledTimes(1);
    expect(mockOnGestionarContrato).toHaveBeenCalledWith(mockUsuarioBase);
  });

  // Test Case 4.2: Interacciones - Editar Perfil
  test('calls onEditar when "Editar Perfil" button is clicked', async () => {
    render(
      <FilaUsuario
        usuario={mockUsuarioBase}
        onEditar={mockOnEditar}
        onEliminar={mockOnEliminar}
        onGestionarContrato={mockOnGestionarContrato}
        isCard={false}
      />
    );
    await userEvent.click(screen.getByTitle('Editar Perfil'));
    expect(mockOnEditar).toHaveBeenCalledTimes(1);
    expect(mockOnEditar).toHaveBeenCalledWith(mockUsuarioBase);
  });

  // Test Case 4.3: Interacciones - Eliminar
  test('calls onEliminar when "Eliminar" button is clicked', async () => {
    render(
      <FilaUsuario
        usuario={mockUsuarioBase}
        onEditar={mockOnEditar}
        onEliminar={mockOnEliminar}
        onGestionarContrato={mockOnGestionarContrato}
        isCard={false}
      />
    );
    await userEvent.click(screen.getByTitle('Eliminar'));
    expect(mockOnEliminar).toHaveBeenCalledTimes(1);
    expect(mockOnEliminar).toHaveBeenCalledWith(mockUsuarioBase);
  });
});
