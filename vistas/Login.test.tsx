// vistas/Login.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// FIX: Added 'expect' to the import from '@jest/globals' to resolve type inference issues with jest-dom matchers.
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import Login from './Login';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Mock del contexto de autenticación
jest.mock('../context/AuthContext', () => ({
  ...(jest.requireActual('../context/AuthContext') as object),
  useAuth: jest.fn(),
}));

const mockLogin = jest.fn();
const useAuthMock = useAuth as jest.Mock;

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthMock.mockReturnValue({
      login: mockLogin,
      error: null,
      isSubmitting: false,
    });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <AuthProvider>
          {component}
      </AuthProvider>
    );
  };
  
  it('renderiza el formulario de login correctamente', () => {
    renderWithProvider(<Login />);
    
    expect(screen.getByPlaceholderText('Correo Electrónico')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ingresar/i })).toBeInTheDocument();
  });

  it('permite al usuario escribir en los campos de usuario y contraseña', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Login />);
    
    const usuarioInput = screen.getByPlaceholderText('Correo Electrónico');
    const contrasenaInput = screen.getByPlaceholderText('Contraseña');

    await user.type(usuarioInput, 'testuser@test.com');
    await user.type(contrasenaInput, 'password123');

    expect(usuarioInput).toHaveValue('testuser@test.com');
    expect(contrasenaInput).toHaveValue('password123');
  });

  it('llama a la función login al enviar el formulario', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Login />);
    
    const usuarioInput = screen.getByPlaceholderText('Correo Electrónico');
    const contrasenaInput = screen.getByPlaceholderText('Contraseña');
    const submitButton = screen.getByRole('button', { name: /Ingresar/i });

    await user.type(usuarioInput, 'admin@test.com');
    await user.type(contrasenaInput, 'admin123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'admin123');
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
  });

  it('muestra un mensaje de error si el login falla', () => {
    useAuthMock.mockReturnValue({
      login: mockLogin,
      error: 'Credenciales inválidas',
      isSubmitting: false,
    });
    
    renderWithProvider(<Login />);
    
    expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
  });

  it('muestra "Ingresando..." y deshabilita el botón mientras se envía', () => {
    useAuthMock.mockReturnValue({
      login: mockLogin,
      error: null,
      isSubmitting: true,
    });
    
    renderWithProvider(<Login />);

    const submitButton = screen.getByRole('button', { name: /Ingresando.../i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});