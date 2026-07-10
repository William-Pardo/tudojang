import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, normalizeRol } from './AuthContext';
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

// Regla canonica de roles (CIERRE CENTRO DE ESTUDIOS.md 14.9): existe un rol Maestro
// propio; Firestore puede traer el rol en cualquier capitalizacion y normalizeRol debe
// mapearlo al enum sin confundirlo con Tutor (padre/acudiente).
describe('normalizeRol', () => {
  it('normaliza "maestro" (cualquier capitalizacion) al enum Maestro', () => {
    expect(normalizeRol('maestro')).toBe(RolUsuario.Maestro);
    expect(normalizeRol('MAESTRO')).toBe(RolUsuario.Maestro);
    expect(normalizeRol(' Maestro ')).toBe(RolUsuario.Maestro);
  });

  it('sigue normalizando tutor a Tutor (padre/acudiente), sin alias hacia Maestro', () => {
    expect(normalizeRol('tutor')).toBe(RolUsuario.Tutor);
    expect(normalizeRol('TUTOR')).toBe(RolUsuario.Tutor);
  });

  it('devuelve undefined para roles desconocidos o vacios', () => {
    expect(normalizeRol('sabonim')).toBeUndefined();
    expect(normalizeRol(undefined)).toBeUndefined();
    expect(normalizeRol('')).toBeUndefined();
  });
});

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
