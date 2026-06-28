import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { RolUsuario } from '../tipos';

jest.mock('../firebase/config', () => ({
  db: {},
  isFirebaseConfigured: true,
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
}));

jest.mock('../servicios/api', () => ({
  autenticarUsuario: jest.fn(),
  cerrarSesion: jest.fn(),
  enviarCorreoRecuperacion: jest.fn(),
}));

const Probe = () => {
  const { usuario, cargandoSesion } = useAuth();
  return (
    <div>
      <p>{cargandoSesion ? 'cargando' : 'listo'}</p>
      <p>{usuario?.email ?? 'sin usuario'}</p>
      <p>{usuario?.rol ?? 'sin rol'}</p>
    </div>
  );
};

describe('AuthContext Cypress bypass', () => {
  afterEach(() => {
    delete (window as any).__TUDOJANG_E2E_USER__;
  });

  it('usa usuario inyectado por Cypress sin esperar Firebase Auth', async () => {
    (window as any).Cypress = true;
    (window as any).__TUDOJANG_E2E_USER__ = {
      id: 'est-1',
      email: 'estudiante@test.com',
      nombreUsuario: 'Estudiante Test',
      rol: RolUsuario.Tutor,
      tenantId: 'tenant-1',
    };

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('listo')).toBeInTheDocument();
    });
    expect(screen.getByText('estudiante@test.com')).toBeInTheDocument();
    expect(screen.getByText(RolUsuario.Tutor)).toBeInTheDocument();
  });
});
