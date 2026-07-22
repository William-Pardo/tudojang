import { renderHook, act, waitFor } from '@testing-library/react';
import { RolUsuario } from '../../tipos';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { JornadaRepository } from '../../servicios/academico/jornadaRepository';
import { EliminacionNoPermitidaError } from '../../servicios/academico/jornadaRepository';
import { useEliminacionJornadaSegura } from './useEliminacionJornadaSegura';

// Extension posterior al cierre del modulo 12 (matriz de roles + iconos de la parrilla de
// Agenda): este hook extrae el flujo de "eliminar clase" (confirmacion + eliminarJornadaSegura
// + auditoria) que ya vivia DENTRO de ModalEdicionJornada.tsx (12.9), para que tambien lo
// reutilice el nuevo icono de caneca de AgendaView.tsx sin duplicar la logica. Estos tests
// cubren el hook en aislamiento (sin UI), en paralelo a los tests de comportamiento ya
// existentes en ModalEdicionJornada.test.tsx (que verifican el mismo flujo a traves del modal).

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  const ahora = '2026-07-01T00:00:00.000Z';
  return {
    id: 'jornada-1',
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-07-07',
    horaInicio: '08:00',
    horaFin: '09:00',
    estado: 'confirmada',
    objetivosPlaneados: [],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearRepository(overrides: Partial<Record<string, jest.Mock>> = {}): JornadaRepository {
  return {
    guardarJornada: jest.fn().mockResolvedValue(undefined),
    registrarAuditoria: jest.fn().mockResolvedValue(undefined),
    eliminarJornadaSegura: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as JornadaRepository;
}

describe('useEliminacionJornadaSegura', () => {
  it('arranca cerrado (sin jornada objetivo, sin confirmar)', () => {
    const { result } = renderHook(() =>
      useEliminacionJornadaSegura({
        repository: crearRepository(),
        tenantId: 'tenant-1',
        usuarioId: 'admin-1',
        rol: RolUsuario.Admin,
        fuente: 'agenda',
      }),
    );

    expect(result.current.jornada).toBeNull();
    expect(result.current.confirmando).toBe(false);
  });

  it('iniciar() abre la confirmacion sobre la jornada indicada sin llamar todavia a eliminarJornadaSegura', () => {
    const repository = crearRepository();
    const { result } = renderHook(() =>
      useEliminacionJornadaSegura({ repository, tenantId: 'tenant-1', usuarioId: 'admin-1', rol: RolUsuario.Admin, fuente: 'agenda' }),
    );

    act(() => result.current.iniciar(crearJornada()));

    expect(result.current.confirmando).toBe(true);
    expect(result.current.jornada?.id).toBe('jornada-1');
    expect(repository.eliminarJornadaSegura).not.toHaveBeenCalled();
  });

  it('confirmar() llama a eliminarJornadaSegura, registra auditoria con accion eliminar, avisa onEliminada y cierra', async () => {
    const repository = crearRepository();
    const onEliminada = jest.fn();
    const { result } = renderHook(() =>
      useEliminacionJornadaSegura({ repository, tenantId: 'tenant-1', usuarioId: 'admin-1', rol: RolUsuario.Admin, fuente: 'agenda', onEliminada }),
    );

    act(() => result.current.iniciar(crearJornada()));
    await act(async () => { await result.current.confirmar(); });

    expect(repository.eliminarJornadaSegura).toHaveBeenCalledWith(expect.objectContaining({ id: 'jornada-1' }));
    expect(repository.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', usuarioId: 'admin-1', rol: RolUsuario.Admin, fuente: 'agenda', accion: 'eliminar' }),
    );
    expect(onEliminada).toHaveBeenCalledWith('jornada-1');
    await waitFor(() => expect(result.current.jornada).toBeNull());
    expect(result.current.confirmando).toBe(false);
  });

  it('si eliminarJornadaSegura rechaza con EliminacionNoPermitidaError, deja error.ofrecerCancelar=true y NO cierra', async () => {
    const repository = crearRepository({
      eliminarJornadaSegura: jest.fn().mockRejectedValue(new EliminacionNoPermitidaError('asistencia_registrada')),
    });
    const onEliminada = jest.fn();
    const { result } = renderHook(() =>
      useEliminacionJornadaSegura({ repository, tenantId: 'tenant-1', usuarioId: 'admin-1', rol: RolUsuario.Admin, fuente: 'agenda', onEliminada }),
    );

    act(() => result.current.iniciar(crearJornada()));
    await act(async () => { await result.current.confirmar(); });

    expect(result.current.error?.ofrecerCancelar).toBe(true);
    expect(result.current.error?.mensaje).toMatch(/no se puede eliminar esta clase porque ya tiene asistencia registrada/i);
    expect(result.current.jornada).not.toBeNull();
    expect(onEliminada).not.toHaveBeenCalled();
  });

  it('cancelarEnLugarDeEliminar() cancela la clase (soft), registra auditoria con accion cancelar, avisa onEliminada y cierra', async () => {
    const repository = crearRepository();
    const onEliminada = jest.fn();
    const { result } = renderHook(() =>
      useEliminacionJornadaSegura({ repository, tenantId: 'tenant-1', usuarioId: 'admin-1', rol: RolUsuario.Admin, fuente: 'agenda', onEliminada }),
    );

    act(() => result.current.iniciar(crearJornada({ estado: 'en_curso' })));
    await act(async () => { await result.current.cancelarEnLugarDeEliminar(); });

    expect(repository.guardarJornada).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'jornada-1', estado: 'cancelada' }),
      expect.objectContaining({ actualizadoEnEsperado: '2026-07-01T00:00:00.000Z' }),
    );
    expect(repository.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: 'agenda', accion: 'cancelar' }),
    );
    expect(onEliminada).toHaveBeenCalledWith('jornada-1');
    await waitFor(() => expect(result.current.jornada).toBeNull());
  });

  it('cerrar() descarta el flujo sin ejecutar ninguna accion', () => {
    const repository = crearRepository();
    const { result } = renderHook(() =>
      useEliminacionJornadaSegura({ repository, tenantId: 'tenant-1', usuarioId: 'admin-1', rol: RolUsuario.Admin, fuente: 'agenda' }),
    );

    act(() => result.current.iniciar(crearJornada()));
    act(() => result.current.cerrar());

    expect(result.current.jornada).toBeNull();
    expect(result.current.confirmando).toBe(false);
    expect(repository.eliminarJornadaSegura).not.toHaveBeenCalled();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
  });
});
