import { renderHook } from '@testing-library/react';
import { useVisualizacionRepository } from './useVisualizacionRepository';
import {
  FirestoreVisualizacionRepository,
  VisualizacionLocalRepository,
} from '../servicios/academico/visualizacionRepository';

jest.mock('../firebase/config', () => ({
  db: 'db-mock',
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
}));

describe('useVisualizacionRepository', () => {
  it('entrega repositorio local por defecto', () => {
    const { result } = renderHook(() => useVisualizacionRepository());

    expect(result.current).toBeInstanceOf(VisualizacionLocalRepository);
  });

  it('entrega repositorio Firestore cuando se solicita modo firestore', () => {
    const { result } = renderHook(() => useVisualizacionRepository({ modo: 'firestore' }));

    expect(result.current).toBeInstanceOf(FirestoreVisualizacionRepository);
  });
});
