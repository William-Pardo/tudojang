import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MisClasesView from './MisClasesView';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import { ConflictoConcurrenciaError } from '../../servicios/academico/jornadaRepository';
import { RolUsuario } from '../../tipos';

jest.mock('../../servicios/academico/asignacionService', () => ({
  listarAsignacionesPorTenant: jest.fn(),
}));

import { listarAsignacionesPorTenant } from '../../servicios/academico/asignacionService';

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
    fecha: '2026-07-06',
    horaInicio: '08:00',
    horaFin: '09:00',
    estado: 'borrador',
    objetivosPlaneados: ['obj-1'],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearAsignacion(overrides: Partial<AsignacionAcademica> = {}): AsignacionAcademica {
  const ahora = '2026-06-01T00:00:00.000Z';
  return {
    id: 'asig-1',
    tenantId: 'tenant-1',
    recursoId: 'recurso-1',
    titulo: 'Material tecnico',
    destinatario: { tipo: 'grupo', grupo: 'Infantil' },
    uso: 'estudio',
    momento: 'preparacion',
    obligatoria: true,
    fechaApertura: ahora,
    estado: 'publicada',
    creadoPorUid: 'maestro-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

describe('MisClasesView', () => {
  beforeEach(() => {
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('lista las clases del programa con fecha, hora y estado', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', fecha: '2026-07-06' }),
        crearJornada({ id: 'jornada-2', fecha: '2026-07-13', programaId: 'otro-programa' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    expect(await screen.findByText('2026-07-06')).toBeInTheDocument();
    expect(screen.queryByText('2026-07-13')).not.toBeInTheDocument();
    expect(screen.getByText(/borrador/i)).toBeInTheDocument();
  });

  it('muestra el material asignado por clase', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([
      crearAsignacion({ jornadaId: 'jornada-1', titulo: 'Fundamentos tecnicos' }),
    ]);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    expect(await screen.findByText(/fundamentos tecnicos/i)).toBeInTheDocument();
  });

  it('confirma una clase en borrador y persiste el cambio', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', estado: 'borrador' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(repository.guardarJornada).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'jornada-1', estado: 'confirmada' }),
        expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
      );
    });
    expect(await screen.findByText(/^confirmada$/i)).toBeInTheDocument();
  });

  it('cierra una clase en curso solo tras registrar asistencia y objetivos, igual que JornadasView', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'en_curso', objetivosPlaneados: ['obj-1'] }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    // Fase 3.7: la tarjeta muestra un badge de estado legible ("En curso"), no el valor
    // crudo del enum ("en_curso"). Se conserva la intención original del test (esperar a
    // que la vista muestre esta jornada como en curso antes de interactuar con ella).
    await screen.findByText(/en curso/i);

    await user.click(screen.getByRole('checkbox', { name: /asistencia registrada/i }));
    await user.click(screen.getByRole('checkbox', { name: /objetivos impartidos/i }));
    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));

    await waitFor(() => {
      expect(repository.guardarJornada).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'jornada-1',
          estado: 'cerrada',
          asistenciaRegistrada: true,
          objetivosImpartidos: ['obj-1'],
        }),
        expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
      );
    });
    expect(await screen.findByText(/^cerrada$/i)).toBeInTheDocument();
    expect(screen.queryByText(/no se puede cerrar/i)).not.toBeInTheDocument();
  });

  it('muestra error si intenta cerrar una clase en curso sin registrar asistencia', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'en_curso' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /^cerrar$/i }));

    expect(await screen.findByText(/no se puede cerrar una jornada sin asistencia registrada/i)).toBeInTheDocument();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
  });

  it('una jornada confirmada muestra las acciones Iniciar, Reprogramar y Cancelar simultaneamente', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText(/^confirmada$/i);

    expect(screen.getByRole('button', { name: /^iniciar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reprogramar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument();
  });

  // Subtarea 12.2 — permiso "maestro asignado". El backend (firestore.rules) ya rechaza
  // la edicion de una jornada ajena; aqui verificamos que el frontend NO ofrezca las
  // acciones de edicion/cancelacion/reprogramacion a quien no es el maestro asignado ni admin.
  it('oculta las acciones de edicion cuando el usuario no es el maestro asignado ni admin', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada', instructorId: 'maestro-1' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="otro-maestro"
        repository={repository as any}
      />,
    );

    // La tarjeta se sigue viendo (lectura permitida), pero sin botones de accion.
    await screen.findByText(/^confirmada$/i);
    expect(screen.queryByRole('button', { name: /^iniciar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reprogramar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).not.toBeInTheDocument();
  });

  it('muestra las acciones de edicion para el maestro asignado', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada', instructorId: 'maestro-1' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        repository={repository as any}
      />,
    );

    await screen.findByText(/^confirmada$/i);
    expect(screen.getByRole('button', { name: /^iniciar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reprogramar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument();
  });

  it('muestra las acciones de edicion para un admin aunque no sea el maestro asignado', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada', instructorId: 'maestro-1' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="otro-maestro"
        esAdmin
        repository={repository as any}
      />,
    );

    await screen.findByText(/^confirmada$/i);
    expect(screen.getByRole('button', { name: /^iniciar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reprogramar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument();
  });

  it('cancela una jornada con motivo, en linea, y persiste el cambio registrando auditoria', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /^cancelar$/i }));
    await user.type(screen.getByLabelText(/motivo de cancelacion/i), 'Feriado nacional');
    await user.click(screen.getByRole('button', { name: /confirmar cancelacion/i }));

    await waitFor(() => {
      expect(repository.guardarJornada).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'jornada-1',
          estado: 'cancelada',
          motivoCancelacion: 'Feriado nacional',
        }),
        expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
      );
    });
    // Subtarea 12.5: cambios ahora es un diff por campo (anterior/nuevo), no el estado
    // resultante plano; ademas se guarda rol y fuente ("mis_clases") del cambio.
    expect(repository.registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'cancelar',
      rol: 'Editor',
      fuente: 'mis_clases',
      cambios: [
        { campo: 'estado', anterior: 'confirmada', nuevo: 'cancelada' },
        { campo: 'motivoCancelacion', anterior: undefined, nuevo: 'Feriado nacional' },
      ],
    }));
    expect(await screen.findByText(/^cancelada$/i)).toBeInTheDocument();
  });

  it('reprograma sin conflicto, persiste confirmada con la nueva fecha/hora y audita actualizar', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada', fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /^reprogramar$/i }));

    fireEvent.change(screen.getByLabelText(/nueva fecha/i), { target: { value: '2026-07-20' } });
    fireEvent.change(screen.getByLabelText(/nueva hora de inicio/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/nueva hora de fin/i), { target: { value: '11:00' } });

    await user.click(screen.getByRole('button', { name: /guardar reprogramacion/i }));

    await waitFor(() => {
      expect(repository.guardarJornada).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'jornada-1',
          estado: 'confirmada',
          fecha: '2026-07-20',
          horaInicio: '10:00',
          horaFin: '11:00',
        }),
        expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
      );
    });
    // Subtarea 12.5: idem cancelar -- diff por campo con anterior/nuevo. El estado no
    // aparece en el diff porque reprogramarJornada pasa por 'reprogramada' y vuelve a
    // 'confirmada': el valor neto no cambia.
    expect(repository.registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'actualizar',
      rol: 'Editor',
      fuente: 'mis_clases',
      cambios: [
        { campo: 'fecha', anterior: '2026-07-06', nuevo: '2026-07-20' },
        { campo: 'horaInicio', anterior: '08:00', nuevo: '10:00' },
        { campo: 'horaFin', anterior: '09:00', nuevo: '11:00' },
      ],
    }));
    expect(await screen.findByText('2026-07-20')).toBeInTheDocument();
  });

  // Bug confirmado en verificacion E2E manual de unificar-flujo-publicar-material (Fase 5):
  // si listarAsignacionesPorTenant rechaza (p.ej. permisos insuficientes en Firestore real),
  // el Promise.all original hundia toda la carga y las jornadas jamas se pintaban, aun cuando
  // listarJornadasPorTenant si habia resuelto correctamente.
  // Fix 4 (CIERRE CENTRO DE ESTUDIOS.md, "Fix: persistencia y seleccion de Programa
  // academico"): el usuario reporto que al editar un programa, "el contenedor de mis
  // clases no se actualiza". `cargar()` solo dependia de [tenantId, programaId,
  // repository] -- si el id del programa no cambiaba (edicion in-place, no creacion),
  // nunca volvia a llamarse tras guardar. Mismo patron ya usado en AsignacionesView.tsx
  // para BibliotecaView (`refreshTrigger` incrementado por el padre tras una accion).
  it('Fix 4: recarga las jornadas cuando cambia refreshTrigger, sin necesidad de remount', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([crearJornada({ id: 'jornada-nueva', fecha: '2026-08-01' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    const { rerender } = render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        repository={repository as any}
        refreshTrigger={0}
      />,
    );

    expect(await screen.findByText(/todavia no tiene clases generadas/i)).toBeInTheDocument();
    expect(repository.listarJornadasPorTenant).toHaveBeenCalledTimes(1);

    rerender(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        repository={repository as any}
        refreshTrigger={1}
      />,
    );

    expect(await screen.findByText('2026-08-01')).toBeInTheDocument();
    expect(repository.listarJornadasPorTenant).toHaveBeenCalledTimes(2);
  });

  it('muestra las jornadas aunque falle la carga de asignaciones (material)', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', fecha: '2026-07-06' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };
    (listarAsignacionesPorTenant as jest.Mock).mockRejectedValue(new Error('permisos insuficientes'));

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    expect(await screen.findByText('2026-07-06')).toBeInTheDocument();
    expect(screen.getByText(/sin material asignado/i)).toBeInTheDocument();
  });

  it('bloquea la reprogramacion y muestra mensaje especifico si el conflicto es de espacio, preservando la jornada original', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada', fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: true, motivo: 'espacio' }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /^reprogramar$/i }));

    fireEvent.change(screen.getByLabelText(/nueva fecha/i), { target: { value: '2026-07-20' } });
    fireEvent.change(screen.getByLabelText(/nueva hora de inicio/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/nueva hora de fin/i), { target: { value: '11:00' } });

    await user.click(screen.getByRole('button', { name: /guardar reprogramacion/i }));

    expect(await screen.findByText(/la sede seleccionada no esta disponible entre 10:00 y 11:00/i)).toBeInTheDocument();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
    expect(screen.getByText('2026-07-06')).toBeInTheDocument();
  });

  it('bloquea la reprogramacion y muestra mensaje especifico si el conflicto es de instructor', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada', fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: true, motivo: 'instructor' }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /^reprogramar$/i }));

    fireEvent.change(screen.getByLabelText(/nueva fecha/i), { target: { value: '2026-07-20' } });
    fireEvent.change(screen.getByLabelText(/nueva hora de inicio/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/nueva hora de fin/i), { target: { value: '11:00' } });

    await user.click(screen.getByRole('button', { name: /guardar reprogramacion/i }));

    expect(await screen.findByText(/el maestro ya tiene una clase asignada en este horario/i)).toBeInTheDocument();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
    expect(screen.getByText('2026-07-06')).toBeInTheDocument();
  });

  // Subtarea 12.4 — bloqueo optimista. Si otro usuario grabo la misma jornada entre que
  // esta vista la leyo y la vuelve a guardar, guardarJornada rechaza con
  // ConflictoConcurrenciaError: la vista muestra el mensaje de negocio y no pierde la tarjeta.
  it('muestra el mensaje de conflicto de concurrencia cuando otro usuario grabo primero', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'borrador' }),
      ]),
      guardarJornada: jest.fn().mockRejectedValue(new ConflictoConcurrenciaError()),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /confirmar/i }));

    expect(await screen.findByText(/la clase fue modificada por otro usuario/i)).toBeInTheDocument();
    // Verifica el wiring 12.4: se pasa el actualizadoEn base (el leido) como opcion.
    expect(repository.guardarJornada).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'jornada-1', estado: 'confirmada' }),
      expect.objectContaining({ actualizadoEnEsperado: '2026-06-01T00:00:00.000Z' }),
    );
    // La jornada sigue visible: no se sobrescribio ni se perdio localmente.
    expect(screen.getByText('2026-07-06')).toBeInTheDocument();
  });

  // Subtarea 12.5: el rol de quien hizo el cambio se recibe por prop (esta vista no lee
  // useAuth directamente, solo recibe usuarioId/esAdmin) y se envia tal cual a la auditoria.
  it('envia el rol recibido por prop a la auditoria del cambio', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', estado: 'borrador' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        rol={RolUsuario.Admin}
        repository={repository as any}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(repository.registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({ rol: 'Admin' }));
    });
  });

  // Subtarea 12.5 — el diagnostico (12.1) encontro que un fallo al registrar la auditoria
  // solo se logueaba con console.warn, sin quedar constancia visible para el usuario. El
  // guardado principal (guardarJornada) ya se aplico y no se revierte, pero el fallo de
  // auditoria debe hacerse visible en la UI.
  it('si falla el registro de auditoria, muestra una advertencia visible sin revertir el guardado principal', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', estado: 'borrador' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockRejectedValue(new Error('fallo de red')),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /confirmar/i }));

    // El guardado principal SI se aplico (la jornada avanzo a confirmada en la UI).
    expect(await screen.findByText(/^confirmada$/i)).toBeInTheDocument();
    // El fallo de auditoria queda visible para el usuario (no solo en consola).
    expect(await screen.findByText(/no se pudo registrar la auditor/i)).toBeInTheDocument();
  });
});

// Fase 3.7 (2026-07-07): rediseño de la tabla plana a una grilla de tarjetas 3x3 con
// paginación cuando el programa tiene más de 9 jornadas.
describe('MisClasesView - paginacion (grilla 3x3)', () => {
  function crearJornadas(cantidad: number): JornadaInstruccion[] {
    return Array.from({ length: cantidad }, (_, indice) =>
      crearJornada({
        id: `jornada-${indice + 1}`,
        fecha: `2026-07-${String(indice + 1).padStart(2, '0')}`,
      }),
    );
  }

  function crearRepository(jornadas: JornadaInstruccion[]) {
    return {
      listarJornadasPorTenant: jest.fn().mockResolvedValue(jornadas),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };
  }

  it('muestra como maximo 9 tarjetas por pagina cuando el programa tiene mas de 9 jornadas', async () => {
    const jornadas = crearJornadas(12);
    const repository = crearRepository(jornadas);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-01');
    expect(screen.getAllByText(/^2026-07-\d{2}$/)).toHaveLength(9);
  });

  it('no muestra tabs de paginacion cuando hay 9 jornadas o menos', async () => {
    const jornadas = crearJornadas(9);
    const repository = crearRepository(jornadas);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-01');
    expect(screen.queryByRole('navigation', { name: /paginacion de clases/i })).not.toBeInTheDocument();
  });

  it('muestra tabs de paginacion cuando hay mas de 9 jornadas, una tab por pagina', async () => {
    const jornadas = crearJornadas(20);
    const repository = crearRepository(jornadas);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-01');
    const nav = screen.getByRole('navigation', { name: /paginacion de clases/i });
    expect(within(nav).getAllByRole('button')).toHaveLength(Math.ceil(20 / 9));
  });

  it('al hacer click en la pagina 2 muestra las siguientes 9 jornadas', async () => {
    const user = userEvent.setup();
    const jornadas = crearJornadas(12);
    const repository = crearRepository(jornadas);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-01');
    expect(screen.queryByText('2026-07-10')).not.toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /paginacion de clases/i });
    await user.click(within(nav).getByRole('button', { name: '2' }));

    expect(await screen.findByText('2026-07-10')).toBeInTheDocument();
    expect(screen.queryByText('2026-07-01')).not.toBeInTheDocument();
  });

  it('muestra el boton Forzar Cierre y permite cancelar administrativamente si la clase en curso esta en el pasado', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({
          id: 'jornada-past-1',
          estado: 'en_curso',
          fecha: '2020-01-01',
          horaFin: '09:00',
        }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    // Esperar a que renderice
    await screen.findByText(/clase expirada/i);

    // Debe mostrar el boton de Forzar Cierre
    const forzarBtn = screen.getByRole('button', { name: /forzar cierre/i });
    expect(forzarBtn).toBeInTheDocument();

    // Al hacer click, debe llamar a cancelarJornada
    await user.click(forzarBtn);

    await waitFor(() => {
      expect(repository.guardarJornada).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'jornada-past-1',
          estado: 'cancelada',
          motivoCancelacion: expect.stringContaining('Cierre administrativo'),
        }),
        expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
      );
    });
  });
});
