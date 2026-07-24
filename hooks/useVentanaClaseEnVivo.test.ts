/**
 * NOTA (2026-07-22): los instantes fijados con `jest.setSystemTime` estan en UTC pero
 * representan hora de pared de AMERICA/BOGOTA (UTC-5) -- que es como el usuario carga
 * `horaInicio`/`horaFin` y como los interpreta `ventanaClaseEnVivoService` desde el fix
 * del desfase horario (ver `servicios/academico/claseEnVivo.integracion.test.ts`).
 * Se corrieron +5h para seguir describiendo LOS MISMOS minutos de pared.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { RolUsuario } from '../tipos';
import type { JornadaInstruccion } from '../models/academico/jornada';
import type { JornadaRepository } from '../servicios/academico/jornadaRepository';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../context/AuthContext';
import { useVentanaClaseEnVivo } from './useVentanaClaseEnVivo';

const mockUseAuth = useAuth as jest.Mock;

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  const ahora = '2026-06-01T00:00:00.000Z';
  return {
    id: 'jornada-1',
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-06-06',
    horaInicio: '10:00',
    horaFin: '11:00',
    estado: 'en_curso',
    objetivosPlaneados: [],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearRepositoryMock(jornadas: JornadaInstruccion[]): JornadaRepository {
  return {
    listarJornadasPorTenant: jest.fn().mockResolvedValue(jornadas),
  } as unknown as JornadaRepository;
}

const AHORA_DENTRO_DE_VENTANA = new Date('2026-06-06T15:30:00.000Z');

describe('useVentanaClaseEnVivo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(AHORA_DENTRO_DE_VENTANA);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('devuelve la jornada activa de la ventana para un Admin (ve todas las del tenant)', async () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin },
    });
    const jornada = crearJornada({ instructorId: 'maestro-1' });
    const repository = crearRepositoryMock([jornada]);

    const { result } = renderHook(() => useVentanaClaseEnVivo(repository));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.jornadaActiva).toEqual(jornada);
  });

  it('un Editor (maestro) solo ve jornadas donde instructorId===uid', async () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'maestro-1', tenantId: 'tenant-1', rol: RolUsuario.Editor },
    });
    const propia = crearJornada({ id: 'jornada-propia', instructorId: 'maestro-1' });
    const deOtro = crearJornada({ id: 'jornada-de-otro', instructorId: 'maestro-2' });
    const repository = crearRepositoryMock([deOtro, propia]);

    const { result } = renderHook(() => useVentanaClaseEnVivo(repository));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.jornadaActiva?.id).toBe('jornada-propia');
  });

  it('un Editor no ve una jornada activa de otro instructor (devuelve null)', async () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'maestro-1', tenantId: 'tenant-1', rol: RolUsuario.Editor },
    });
    const deOtro = crearJornada({ id: 'jornada-de-otro', instructorId: 'maestro-2' });
    const repository = crearRepositoryMock([deOtro]);

    const { result } = renderHook(() => useVentanaClaseEnVivo(repository));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.jornadaActiva).toBeNull();
  });

  it('devuelve null sin jornada activa (spec: Sin jornada activa)', async () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin },
    });
    const repository = crearRepositoryMock([]);

    const { result } = renderHook(() => useVentanaClaseEnVivo(repository));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.jornadaActiva).toBeNull();
  });

  // WS-6 (§4, selector multi-clase): jornadasEnVentana expone TODAS las candidatas, no solo
  // la mas cercana (jornadaActiva), para que la UI pueda ofrecer un selector.
  it('jornadasEnVentana devuelve las 2+ jornadas activas simultaneas de un Admin', async () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin },
    });
    const grupoA = crearJornada({ id: 'jornada-grupo-a', instructorId: 'maestro-1', horaInicio: '09:50', horaFin: '10:50' });
    const grupoB = crearJornada({ id: 'jornada-grupo-b', instructorId: 'maestro-2', horaInicio: '10:00', horaFin: '11:00' });
    const repository = crearRepositoryMock([grupoB, grupoA]);

    const { result } = renderHook(() => useVentanaClaseEnVivo(repository));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.jornadasEnVentana.map((j) => j.id)).toEqual(['jornada-grupo-a', 'jornada-grupo-b']);
  });

  it('jornadasEnVentana respeta el mismo filtro de permiso que jornadaActiva (Editor solo ve las suyas)', async () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'maestro-1', tenantId: 'tenant-1', rol: RolUsuario.Editor },
    });
    const propia = crearJornada({ id: 'jornada-propia', instructorId: 'maestro-1' });
    const deOtro = crearJornada({ id: 'jornada-de-otro', instructorId: 'maestro-2' });
    const repository = crearRepositoryMock([deOtro, propia]);

    const { result } = renderHook(() => useVentanaClaseEnVivo(repository));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.jornadasEnVentana.map((j) => j.id)).toEqual(['jornada-propia']);
  });

  it('recalcula la ventana cada 60s sin volver a consultar el repositorio (memo sobre el resultado ya cargado)', async () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin },
    });
    // La jornada esta a punto de salir de ventana: cierre = horaFin(11:00)+15 = 11:15.
    const jornada = crearJornada({ horaInicio: '10:00', horaFin: '11:00' });
    const repository = crearRepositoryMock([jornada]);
    jest.setSystemTime(new Date('2026-06-06T16:14:00.000Z'));

    const { result } = renderHook(() => useVentanaClaseEnVivo(repository));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.jornadaActiva).toEqual(jornada);

    // Avanza el reloj del sistema mas alla del cierre de ventana, y dispara el polling de 60s.
    jest.setSystemTime(new Date('2026-06-06T16:16:00.000Z'));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(result.current.jornadaActiva).toBeNull());
    expect(repository.listarJornadasPorTenant).toHaveBeenCalledTimes(1);
  });
});
