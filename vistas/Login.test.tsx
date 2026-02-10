// vistas/Login.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import Login from './Login';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../components/BrandingProvider';

// Mock del contexto de autenticación
jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock del contexto de Branding
jest.mock('../components/BrandingProvider', () => ({
  useTenant: jest.fn(),
}));

// Mock de LogoDinamico
jest.mock('../components/LogoDinamico', () => ({
  __esModule: true,
  default: () => <div data-testid="logo-dinamico" />,
}));

// Mock de ModalRecuperarContrasena
jest.mock('../components/ModalRecuperarContrasena', () => ({
  __esModule: true,
  default: () => <div data-testid="modal-recuperar" />,
}));

const mockLogin = jest.fn();
const useAuthMock = useAuth as jest.Mock;
const useTenantMock = useTenant as jest.Mock;

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthMock.mockReturnValue({
      login: mockLogin,
      error: null,
      isSubmitting: false,
    });
    useTenantMock.mockReturnValue({
      tenant: { nombreClub: 'Test Club' },
      estaCargado: true
    });
  });

  it('renderiza el formulario de login correctamente', () => {
    render(<Login />);

    expect(screen.getByPlaceholderText('ejemplo@academia.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Sesión/i })).toBeInTheDocument();
  });

  it('permite al usuario escribir en los campos de usuario y contraseña', async () => {
    const user = userEvent.setup();
    render(<Login />);

    const usuarioInput = screen.getByPlaceholderText('ejemplo@academia.com');
    const contrasenaInput = screen.getByPlaceholderText('••••••••');

    await user.type(usuarioInput, 'testuser@test.com');
    await user.type(contrasenaInput, 'password123');

    expect(usuarioInput).toHaveValue('testuser@test.com');
    expect(contrasenaInput).toHaveValue('password123');
  });

  it('llama a la función login al enviar el formulario', async () => {
    const user = userEvent.setup();
    render(<Login />);

    const usuarioInput = screen.getByPlaceholderText('ejemplo@academia.com');
    const contrasenaInput = screen.getByPlaceholderText('••••••••');
    const submitButton = screen.getByRole('button', { name: /Iniciar Sesión/i });

    await user.type(usuarioInput, 'admin@test.com');
    await user.type(contrasenaInput, 'admin123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'admin123');
    });
  });

  it('muestra un mensaje de error si el login falla', () => {
    useAuthMock.mockReturnValue({
      login: mockLogin,
      error: 'Credenciales inválidas',
      isSubmitting: false,
    });

    render(<Login />);

    expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
  });

  it('muestra "Verificando..." y deshabilita el botón mientras se envía', () => {
    useAuthMock.mockReturnValue({
      login: mockLogin,
      error: null,
      isSubmitting: true,
    });

    render(<Login />);

    const submitButton = screen.getByRole('button', { name: /Verificando.../i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});