import { act, renderHook } from '@testing-library/react';
import { useProgressSync } from './useProgressSync';

describe('useProgressSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('acumula progreso local sin sincronizar en cada evento individual', () => {
    const sincronizar = jest.fn();
    const { result } = renderHook(() => useProgressSync({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'video',
      intervaloMs: 30000,
      sincronizar,
    }));

    act(() => {
      result.current.registrarVideoSegundo(1);
      result.current.registrarVideoSegundo(2);
      result.current.registrarVideoSegundo(3);
    });

    expect(sincronizar).not.toHaveBeenCalled();
    expect(result.current.progreso.segundosUnicos).toEqual([1, 2, 3]);
  });

  it('sincroniza el batch acumulado al cumplirse el intervalo', () => {
    const sincronizar = jest.fn();
    renderHook(() => useProgressSync({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'video',
      intervaloMs: 30000,
      sincronizar,
    }));

    act(() => {
      window.dispatchEvent(new CustomEvent('tudojang:test-progress-video', { detail: 12 }));
      jest.advanceTimersByTime(30000);
    });

    expect(sincronizar).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'video',
      segundosUnicos: [12],
    }));
  });

  it('hace flush al desmontar para no perder progreso', () => {
    const sincronizar = jest.fn();
    const { result, unmount } = renderHook(() => useProgressSync({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'pdf',
      sincronizar,
    }));

    act(() => {
      result.current.registrarPaginaPdf(4);
    });

    unmount();

    expect(sincronizar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'pdf',
      paginasVistas: [4],
    }));
  });

  it('hace flush cuando el documento queda oculto', () => {
    const sincronizar = jest.fn();
    const { result } = renderHook(() => useProgressSync({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'pdf',
      sincronizar,
    }));

    act(() => {
      result.current.registrarPaginaPdf(2);
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(sincronizar).toHaveBeenCalledWith(expect.objectContaining({
      paginasVistas: [2],
    }));
  });

  it('reanuda progreso guardado al iniciar el hook', async () => {
    const sincronizar = jest.fn();
    const cargarProgreso = jest.fn().mockResolvedValue({
      paginasVistas: [1, 3],
      segundosUnicos: [12, 30],
    });

    const { result } = renderHook(() => useProgressSync({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'pdf',
      sincronizar,
      cargarProgreso,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(cargarProgreso).toHaveBeenCalledTimes(1);
    expect(result.current.progreso.paginasVistas).toEqual([1, 3]);
    expect(result.current.progreso.segundosUnicos).toEqual([12, 30]);
  });

  it('prefiere el progreso remoto sobre localStorage para reanudar desde Firestore', async () => {
    localStorage.setItem('tudojang:centro-estudios:progress-sync:tenant-1:asig-1', JSON.stringify({
      paginasVistas: [1],
      segundosUnicos: [],
    }));

    const sincronizar = jest.fn();
    const cargarProgreso = jest.fn().mockResolvedValue({
      paginasVistas: [1, 2, 3],
      segundosUnicos: [],
    });

    const { result } = renderHook(() => useProgressSync({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'pdf',
      sincronizar,
      cargarProgreso,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.progreso.paginasVistas).toEqual([1, 2, 3]);
  });
});
