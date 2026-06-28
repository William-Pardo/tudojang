// hooks/useCentroEstudios.test.ts
import { renderHook } from '@testing-library/react';
import { useCentroEstudios } from './useCentroEstudios';

// Mock del módulo DataContext para controlar lo que devuelve useConfiguracion
jest.mock('../context/DataContext', () => ({
  useConfiguracion: jest.fn(),
}));

import { useConfiguracion } from '../context/DataContext';

const mockUseConfiguracion = useConfiguracion as jest.Mock;

describe('useCentroEstudios', () => {
  it('devuelve false cuando features es undefined', () => {
    mockUseConfiguracion.mockReturnValue({ configClub: {} });
    const { result } = renderHook(() => useCentroEstudios());
    expect(result.current.centroEstudiosActivo).toBe(false);
  });

  it('devuelve false cuando centroEstudios es false', () => {
    mockUseConfiguracion.mockReturnValue({
      configClub: { features: { centroEstudios: false } },
    });
    const { result } = renderHook(() => useCentroEstudios());
    expect(result.current.centroEstudiosActivo).toBe(false);
  });

  it('devuelve true cuando centroEstudios es true', () => {
    mockUseConfiguracion.mockReturnValue({
      configClub: { features: { centroEstudios: true } },
    });
    const { result } = renderHook(() => useCentroEstudios());
    expect(result.current.centroEstudiosActivo).toBe(true);
  });

  it('devuelve false cuando configClub es null', () => {
    mockUseConfiguracion.mockReturnValue({ configClub: null });
    const { result } = renderHook(() => useCentroEstudios());
    expect(result.current.centroEstudiosActivo).toBe(false);
  });
});
