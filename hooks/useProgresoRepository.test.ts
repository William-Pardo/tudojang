import { renderHook } from '@testing-library/react';
import { useProgresoRepository } from './useProgresoRepository';
import { FirestoreProgressRepository, ProgresoLocalRepository } from '../servicios/academico/progresoRepository';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../firebase/config', () => ({
  db: 'db-mock',
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

import { useAuth } from '../context/AuthContext';

const mockUseAuth = useAuth as jest.Mock;

describe('useProgresoRepository', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ usuario: { id: 'est-1' } });
  });

  it('entrega repositorio local por defecto para conservar la demo actual', () => {
    const { result } = renderHook(() => useProgresoRepository());

    expect(result.current).toBeInstanceOf(ProgresoLocalRepository);
  });

  it('entrega repositorio Firestore cuando se solicita y existe usuario', () => {
    const { result } = renderHook(() => useProgresoRepository({ modo: 'firestore' }));

    expect(result.current).toBeInstanceOf(FirestoreProgressRepository);
  });

  it('vuelve a local si se solicita Firestore sin usuario autenticado', () => {
    mockUseAuth.mockReturnValue({ usuario: null });

    const { result } = renderHook(() => useProgresoRepository({ modo: 'firestore' }));

    expect(result.current).toBeInstanceOf(ProgresoLocalRepository);
  });
});
