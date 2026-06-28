import React, { ReactNode } from 'react';

// Minimal AuthProvider stub for unit tests.
// Provides a null user so components that depend on AuthContext don't crash.

const AuthContext = React.createContext<any>(undefined);

export const TestAuthProvider: React.FC<{ children: ReactNode; usuario?: any }> = ({
  children,
  usuario = null,
}) => {
  const value = {
    usuario,
    login: jest.fn(),
    logout: jest.fn(),
    enviarEnlaceRecuperacion: jest.fn(),
    error: null,
    isSubmitting: false,
    cargandoSesion: false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default TestAuthProvider;
