import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MisClasesView, { puedeEditarJornada } from './MisClasesView';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { RegistroAsistencia } from '../../models/academico/asistencia';
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

// Gap #5 (auditoria de integracion Centro de Estudios/Agenda, 2026-07-18): mismo helper
// que JornadasView.test.tsx -- mockea el repositorio de solo lectura de check-ins reales,
// para testear el wiring de asistencia derivada sin clickear un checkbox manual.
function crearAsistenciaRepositoryMock(registros: RegistroAsistencia[] = []) {
  return {
    listarPorJornada: jest.fn().mockResolvedValue(registros),
  };
}

// WS-4b (§9.3): mismo criterio que crearAsistenciaRepositoryMock -- mockea el servicio de
// checkpoint de materiales para testear el resumen de cobertura sin depender de Firestore.
function crearCheckpointServiceMock(
  materiales: Array<{ asignacionId: string; titulo: string }> = [],
  checkpoints: Array<{ asignacionId: string; estado: string; jornadaId: string; tenantId: string; registradoPorUid: string; actualizadoEn: string }> = [],
) {
  return {
    listarMaterialesDeJornada: jest.fn().mockResolvedValue(materiales),
    guardarCheckpoint: jest.fn().mockResolvedValue(undefined),
    listarCheckpoints: jest.fn().mockResolvedValue(checkpoints),
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
    // Rediseño 2026-07-13: 'borrador' ya no es un estado visualmente distinto -- se
    // muestra igual que 'confirmada' (ver describe "borrador se trata igual que confirmada").
    expect(screen.getByText(/confirmada/i)).toBeInTheDocument();
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

  // Rediseño 2026-07-12 (pedido explicito del usuario: "borrador como estado ya no
  // deberia existir", clases malleables por defecto): ya no existe un boton "Confirmar"
  // que transicione borrador->confirmada. Una jornada en borrador ahora ofrece las MISMAS
  // acciones que una confirmada (Reprogramar/Cancelar/Editar) -- ver describe dedicado
  // "borrador se trata igual que confirmada" mas abajo.
  it('una jornada en borrador NO ofrece un boton Confirmar (ya no existe ese paso manual)', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', estado: 'borrador' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByRole('button', { name: /^reprogramar$/i });
    expect(screen.queryByRole('button', { name: /^confirmar$/i })).not.toBeInTheDocument();
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
    // Gap #5: la asistencia ya no es un checkbox manual -- se deriva de check-ins reales
    // (mismo patron que JornadasView.tsx).
    const asistenciaRepository = crearAsistenciaRepositoryMock([
      { estudianteId: 'estudiante-1', horaEntrada: '2026-07-06T08:05:00.000Z' },
    ]);

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        repository={repository as any}
        asistenciaRepository={asistenciaRepository as any}
      />,
    );

    // Fase 3.7: la tarjeta muestra un badge de estado legible ("En curso"), no el valor
    // crudo del enum ("en_curso"). Se conserva la intención original del test (esperar a
    // que la vista muestre esta jornada como en curso antes de interactuar con ella).
    await screen.findByText(/en curso/i);

    // No hay checkbox manual: el conteo de check-ins reales (1) marca la asistencia.
    expect(await screen.findByText(/asistencia registrada \(1 check-in\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /asistencia registrada/i })).not.toBeInTheDocument();

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
    // Gap #5: sin check-ins reales registrados, cerrarJornada() debe seguir rechazando el
    // cierre -- misma regresion que ya cubre JornadasView.test.tsx.
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        repository={repository as any}
        asistenciaRepository={asistenciaRepository as any}
      />,
    );

    expect(await screen.findByText(/sin check-ins registrados/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));

    expect(await screen.findByText(/no se puede cerrar una jornada sin asistencia registrada/i)).toBeInTheDocument();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
  });

  it('una jornada confirmada muestra las acciones Reprogramar y Cancelar simultaneamente (Iniciar ya no existe: se automatizo por horario)', async () => {
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

    expect(screen.queryByRole('button', { name: /^iniciar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reprogramar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancelar clase$/i })).toBeInTheDocument();
  });

  // Rediseño 2026-07-11 (pedido explicito del usuario tras ver el screenshot en vivo):
  // "iniciar no deberia verse ni existir ya que esa funcion se automatizo" -- el
  // auto-inicio ahora corre por horario via functions/academico/jornadasScheduler.js.
  // Regresion dedicada (no solo una aserción suelta dentro de otro test) para dejar
  // constancia explicita de la decision de producto, ademas de la cobertura de estado.
  it('el boton Iniciar no existe en ningun estado (regresion: automatizado por horario)', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada' }),
        crearJornada({ id: 'jornada-2', estado: 'en_curso' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText(/^confirmada$/i);
    expect(screen.queryByRole('button', { name: /^iniciar$/i })).not.toBeInTheDocument();
  });

  // Reprogramar pasa de boton de texto ancho completo a icono (mismo estilo que
  // Editar/Confirmar), pedido explicito del usuario: "captа su esencia pero aplicale
  // el estilo de los iconos de editar o eliminar".
  it('Reprogramar se muestra como icono compacto (no boton de texto), con svg y aria-label', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    const boton = await screen.findByRole('button', { name: /^reprogramar$/i });
    expect(boton.textContent?.trim()).toBe('');
    expect(boton.querySelector('svg')).toBeInTheDocument();
  });

  // Rediseño 2026-07-12 (pedido explicito del usuario sobre un screenshot en vivo):
  // "Cancelar clase" pasa de icono+texto a icono solo, agrupado con Reagendar/Editar en
  // una misma linea junto a fecha/hora. El nombre accesible se conserva via aria-label.
  it('Cancelar clase se muestra como icono compacto (no boton de texto), agrupado con Reagendar/Editar', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    const boton = await screen.findByRole('button', { name: /^cancelar clase$/i });
    expect(boton.textContent?.trim()).toBe('');
    expect(boton.querySelector('svg')).toBeInTheDocument();
  });

  // Rediseño 2026-07-12 (segundo pase, pedido explicito del usuario sobre un screenshot en
  // vivo): los 3 iconos de accion pasan de fila horizontal a COLUMNA VERTICAL, en este
  // orden de arriba hacia abajo: Reagendar, Editar, Cancelar/Eliminar. Siguen junto a
  // fecha/hora (mismo contenedor), no junto al pill.
  it('Reagendar, Editar y Cancelar clase quedan agrupados en una columna vertical, en ese orden, junto a fecha/hora', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada' }),
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
        onEditarMaterial={() => {}}
      />,
    );

    const reagendar = await screen.findByRole('button', { name: /^reprogramar$/i });
    const editar = screen.getByRole('button', { name: /^editar material/i });
    const cancelar = screen.getByRole('button', { name: /^cancelar clase$/i });

    const columna = reagendar.parentElement;
    expect(editar.parentElement).toBe(columna);
    expect(cancelar.parentElement).toBe(columna);
    expect(columna?.className).toMatch(/flex-col/);

    // Orden de arriba hacia abajo: Reagendar, Editar, Cancelar.
    const hijos = Array.from(columna?.children ?? []);
    expect(hijos.indexOf(reagendar)).toBeLessThan(hijos.indexOf(editar));
    expect(hijos.indexOf(editar)).toBeLessThan(hijos.indexOf(cancelar));

    // La columna de iconos vive junto a la fecha (mismo contenedor abuelo), no junto al pill.
    const filaFecha = screen.getByText('2026-07-06').closest('div')?.parentElement;
    expect(filaFecha?.contains(reagendar)).toBe(true);
  });

  // Pedido explicito del usuario sobre un screenshot en vivo: fecha completa en su propia
  // linea, horario en una linea separada debajo (antes iban combinados en una sola linea).
  it('la fecha y el horario se muestran en lineas separadas (fecha arriba, horario abajo)', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    const fecha = await screen.findByText('2026-07-06');
    const horario = screen.getByText('08:00 - 09:00');

    // Fecha y horario son hermanos (mismo contenedor), apilados en lineas separadas via
    // flex-col -- no combinados en una sola linea como antes.
    expect(fecha.parentElement).toBe(horario.parentElement);
    expect(fecha.parentElement?.className).toMatch(/flex-col/);
  });

  // Pedido explicito del usuario sobre un screenshot en vivo: los iconos quedaban
  // demasiado pegados al texto de fecha/hora en tarjetas angostas (grilla 4x3) -- se
  // agrega un gap horizontal explicito mas generoso en la fila.
  it('deja espacio horizontal explicito entre el texto de fecha/hora y la linea de iconos', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    const reagendar = await screen.findByRole('button', { name: /^reprogramar$/i });
    const filaFechaEIconos = reagendar.parentElement?.parentElement;
    expect(filaFechaEIconos?.className).toMatch(/gap-x-4/);
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
    expect(screen.queryByRole('button', { name: /^cancelar clase$/i })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /^iniciar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reprogramar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancelar clase$/i })).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /^iniciar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reprogramar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancelar clase$/i })).toBeInTheDocument();
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

    await user.click(await screen.findByRole('button', { name: /^cancelar clase$/i }));
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
  // Rediseño 2026-07-12: vehiculo cambiado de Confirmar (eliminado) a Cerrar -- ambos pasan
  // por la misma funcion transicionar(), asi que la cobertura de concurrencia se preserva.
  it('muestra el mensaje de conflicto de concurrencia cuando otro usuario grabo primero', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'en_curso', objetivosPlaneados: ['obj-1'] }),
      ]),
      guardarJornada: jest.fn().mockRejectedValue(new ConflictoConcurrenciaError()),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };
    const asistenciaRepository = crearAsistenciaRepositoryMock([
      { estudianteId: 'estudiante-1', horaEntrada: '2026-07-06T08:05:00.000Z' },
    ]);

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        repository={repository as any}
        asistenciaRepository={asistenciaRepository as any}
      />,
    );

    await screen.findByText(/en curso/i);
    await screen.findByText(/asistencia registrada \(1 check-in\)/i);
    await user.click(screen.getByRole('checkbox', { name: /objetivos impartidos/i }));
    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));

    expect(await screen.findByText(/la clase fue modificada por otro usuario/i)).toBeInTheDocument();
    // Verifica el wiring 12.4: se pasa el actualizadoEn base (el leido) como opcion.
    expect(repository.guardarJornada).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'jornada-1', estado: 'cerrada' }),
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
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'en_curso', objetivosPlaneados: ['obj-1'] }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };
    const asistenciaRepository = crearAsistenciaRepositoryMock([
      { estudianteId: 'estudiante-1', horaEntrada: '2026-07-06T08:05:00.000Z' },
    ]);

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        rol={RolUsuario.Admin}
        repository={repository as any}
        asistenciaRepository={asistenciaRepository as any}
      />,
    );

    await screen.findByText(/en curso/i);
    await screen.findByText(/asistencia registrada \(1 check-in\)/i);
    await user.click(screen.getByRole('checkbox', { name: /objetivos impartidos/i }));
    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));

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
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'en_curso', objetivosPlaneados: ['obj-1'] }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockRejectedValue(new Error('fallo de red')),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };
    const asistenciaRepository = crearAsistenciaRepositoryMock([
      { estudianteId: 'estudiante-1', horaEntrada: '2026-07-06T08:05:00.000Z' },
    ]);

    render(
      <MisClasesView
        tenantId="tenant-1"
        programaId="programa-1"
        usuarioId="maestro-1"
        repository={repository as any}
        asistenciaRepository={asistenciaRepository as any}
      />,
    );

    await screen.findByText(/en curso/i);
    await screen.findByText(/asistencia registrada \(1 check-in\)/i);
    await user.click(screen.getByRole('checkbox', { name: /objetivos impartidos/i }));
    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));

    // El guardado principal SI se aplico (la jornada avanzo a cerrada en la UI).
    expect(await screen.findByText(/^cerrada$/i)).toBeInTheDocument();
    // El fallo de auditoria queda visible para el usuario (no solo en consola).
    expect(await screen.findByText(/no se pudo registrar la auditor/i)).toBeInTheDocument();
  });

  // WS-4b (§9.3): resumen de cobertura de materiales, informativo antes de cerrar.
  describe('resumen de cobertura de materiales (§9.3)', () => {
    it('muestra el % de cobertura de una jornada en_curso con materiales asignados', async () => {
      const repository = {
        listarJornadasPorTenant: jest.fn().mockResolvedValue([
          crearJornada({ id: 'jornada-1', estado: 'en_curso' }),
        ]),
        guardarJornada: jest.fn(),
        registrarAuditoria: jest.fn(),
        existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
      };
      const asistenciaRepository = crearAsistenciaRepositoryMock([]);
      const checkpointMaterialService = crearCheckpointServiceMock(
        [
          { asignacionId: 'asig-1', titulo: 'Taeguk 1' },
          { asignacionId: 'asig-2', titulo: 'Combate' },
        ],
        [
          {
            asignacionId: 'asig-1',
            estado: 'practicado',
            jornadaId: 'jornada-1',
            tenantId: 'tenant-1',
            registradoPorUid: 'maestro-1',
            actualizadoEn: '2026-07-06T08:10:00.000Z',
          },
        ],
      );

      render(
        <MisClasesView
          tenantId="tenant-1"
          programaId="programa-1"
          usuarioId="maestro-1"
          repository={repository as any}
          asistenciaRepository={asistenciaRepository as any}
          checkpointMaterialService={checkpointMaterialService as any}
        />,
      );

      await screen.findByText(/en curso/i);
      // 1 practicado (peso 1) + 1 sin_marcar (0) sobre 2 = 50%.
      expect(await screen.findByText(/cobertura de materiales: 50%/i)).toBeInTheDocument();
      expect(screen.getByText(/1 de 2 marcados/i)).toBeInTheDocument();
      expect(checkpointMaterialService.listarMaterialesDeJornada).toHaveBeenCalledWith('tenant-1', 'jornada-1');
    });

    it('no muestra el resumen de cobertura cuando la jornada no tiene materiales asignados', async () => {
      const repository = {
        listarJornadasPorTenant: jest.fn().mockResolvedValue([
          crearJornada({ id: 'jornada-1', estado: 'en_curso' }),
        ]),
        guardarJornada: jest.fn(),
        registrarAuditoria: jest.fn(),
        existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
      };
      const asistenciaRepository = crearAsistenciaRepositoryMock([]);
      const checkpointMaterialService = crearCheckpointServiceMock([], []);

      render(
        <MisClasesView
          tenantId="tenant-1"
          programaId="programa-1"
          usuarioId="maestro-1"
          repository={repository as any}
          asistenciaRepository={asistenciaRepository as any}
          checkpointMaterialService={checkpointMaterialService as any}
        />,
      );

      await screen.findByText(/en curso/i);
      await waitFor(() => expect(checkpointMaterialService.listarMaterialesDeJornada).toHaveBeenCalled());
      expect(screen.queryByText(/cobertura de materiales/i)).not.toBeInTheDocument();
    });

    it('el cierre NO queda bloqueado por una cobertura baja o incompleta', async () => {
      const user = userEvent.setup();
      const repository = {
        listarJornadasPorTenant: jest.fn().mockResolvedValue([
          crearJornada({ id: 'jornada-1', estado: 'en_curso', objetivosPlaneados: ['obj-1'] }),
        ]),
        guardarJornada: jest.fn().mockResolvedValue(undefined),
        registrarAuditoria: jest.fn().mockResolvedValue(undefined),
        existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
      };
      const asistenciaRepository = crearAsistenciaRepositoryMock([
        { estudianteId: 'estudiante-1', horaEntrada: '2026-07-06T08:05:00.000Z' },
      ]);
      const checkpointMaterialService = crearCheckpointServiceMock(
        [{ asignacionId: 'asig-1', titulo: 'Taeguk 1' }],
        [],
      );

      render(
        <MisClasesView
          tenantId="tenant-1"
          programaId="programa-1"
          usuarioId="maestro-1"
          repository={repository as any}
          asistenciaRepository={asistenciaRepository as any}
          checkpointMaterialService={checkpointMaterialService as any}
        />,
      );

      await screen.findByText(/en curso/i);
      expect(await screen.findByText(/cobertura de materiales: 0%/i)).toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: /objetivos impartidos/i }));
      await user.click(screen.getByRole('button', { name: /^cerrar$/i }));

      await waitFor(() => expect(repository.guardarJornada).toHaveBeenCalled());
    });
  });
});

// Rediseño visual del contenedor de clase (2026-07-11, pedido explícito del usuario):
// el pill pasa de mostrar el ESTADO a mostrar el TEMA de la clase (asignado en Publicar
// material); se agrega un ícono editar (lápiz) que abre el asistente de material vía
// callback del padre, preservando la configuración existente. El estado sigue visible
// (texto secundario, más chico/liviano) porque sigue siendo información operativa
// relevante -- solo deja de ser el contenido PRINCIPAL del pill.
// Rediseño 2026-07-12: el ícono check ("Confirmar") se eliminó por completo -- ver
// describe "borrador se trata igual que confirmada" más abajo.
describe('MisClasesView - rediseño visual (pill con tema, iconos check/editar)', () => {
  beforeEach(() => {
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('el pill muestra el tema de la clase, no el estado', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', tema: 'Patadas circulares' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    expect(await screen.findByText('Patadas circulares')).toBeInTheDocument();
    // El estado sigue visible, pero como texto secundario (no en el pill principal).
    // Rediseño 2026-07-13: 'borrador' se muestra igual que 'confirmada'.
    expect(screen.getByText(/confirmada/i)).toBeInTheDocument();
  });

  it('el pill muestra "Sin tema" cuando la jornada no tiene tema asignado', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', tema: undefined })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    expect(await screen.findByText(/sin tema/i)).toBeInTheDocument();
  });

  // Pedido del usuario (2026-07-11, tras ver el rediseño en vivo): el tema YA se podia
  // persistir por jornada individual (actualizarTemaJornada), pero solo desde un panel
  // separado en AsignacionesView, navegando de a una clase. Ahora se edita directo desde
  // el pill de la propia tarjeta, sin salir de Mis Clases.
  it('al hacer click en el pill (con permiso de edicion), permite editar el tema inline', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', tema: 'Bienvenida' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
      actualizarTemaJornada: jest.fn().mockResolvedValue(undefined),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByText('Bienvenida'));

    expect(screen.getByDisplayValue('Bienvenida')).toBeInTheDocument();
  });

  it('al perder el foco (blur) con un tema nuevo, persiste via actualizarTemaJornada y actualiza el pill', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', tema: 'Bienvenida' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
      actualizarTemaJornada: jest.fn().mockResolvedValue(undefined),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByText('Bienvenida'));
    const input = screen.getByDisplayValue('Bienvenida');
    await user.clear(input);
    await user.type(input, 'Tecnica de patada');
    await user.tab();

    await waitFor(() => expect(repository.actualizarTemaJornada).toHaveBeenCalledWith('tenant-1', 'jornada-1', 'Tecnica de patada'));
    expect(await screen.findByText('Tecnica de patada')).toBeInTheDocument();
  });

  it('Escape cancela la edicion del tema sin guardar', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', tema: 'Bienvenida' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
      actualizarTemaJornada: jest.fn().mockResolvedValue(undefined),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByText('Bienvenida'));
    const input = screen.getByDisplayValue('Bienvenida');
    await user.clear(input);
    await user.type(input, 'Algo que no se guarda');
    await user.keyboard('{Escape}');

    expect(repository.actualizarTemaJornada).not.toHaveBeenCalled();
    expect(await screen.findByText('Bienvenida')).toBeInTheDocument();
  });

  it('el pill NO es editable si el usuario no puede editar (no es el maestro asignado ni admin)', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', tema: 'Bienvenida', instructorId: 'maestro-1' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
      actualizarTemaJornada: jest.fn().mockResolvedValue(undefined),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="otro-maestro" repository={repository as any} />);

    await user.click(await screen.findByText('Bienvenida'));

    expect(screen.queryByDisplayValue('Bienvenida')).not.toBeInTheDocument();
  });

  it('el icono editar llama a onEditarMaterial con la jornada, cuando el usuario puede editar', async () => {
    const user = userEvent.setup();
    const onEditarMaterial = jest.fn();
    const jornada = crearJornada({ id: 'jornada-1', instructorId: 'maestro-1' });
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([jornada]),
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
        onEditarMaterial={onEditarMaterial}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /editar material/i }));

    expect(onEditarMaterial).toHaveBeenCalledWith(expect.objectContaining({ id: 'jornada-1' }));
  });

  it('no muestra el icono editar si el consumidor no pasa onEditarMaterial (compatibilidad)', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', instructorId: 'maestro-1' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByRole('button', { name: /^reprogramar$/i });
    expect(screen.queryByRole('button', { name: /editar material/i })).not.toBeInTheDocument();
  });

  it('no muestra el icono editar si el usuario no puede editar (no es el maestro asignado ni admin)', async () => {
    const onEditarMaterial = jest.fn();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', instructorId: 'maestro-1' })]),
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
        onEditarMaterial={onEditarMaterial}
      />,
    );

    await screen.findByText('2026-07-06');
    expect(screen.queryByRole('button', { name: /editar material/i })).not.toBeInTheDocument();
  });

  it('el icono check (confirmar) NO aparece si la jornada no esta en borrador', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([crearJornada({ id: 'jornada-1', estado: 'confirmada', instructorId: 'maestro-1' })]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText(/^confirmada$/i);
    expect(screen.queryByRole('button', { name: /^confirmar$/i })).not.toBeInTheDocument();
  });
});

// Rediseño 2026-07-12 (pedido explicito del usuario, sobre screenshot en vivo): "borrador
// como estado ya no deberia existir, y por defecto cada contenedor debe mostrar la linea
// de iconos... la idea es hacer maleable cada clase, donde por default todo quede tal
// como se muestra en el contenedor, y que solo si se requiere modificar se usen los
// iconos de reagendar, eliminar o editar". Una jornada en borrador (legacy o creada desde
// JornadasView.tsx) ahora ofrece EXACTAMENTE las mismas acciones que una confirmada.
describe('MisClasesView - borrador se trata igual que confirmada (clases malleables por defecto)', () => {
  beforeEach(() => {
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('una jornada en borrador muestra Reprogramar y Cancelar clase, igual que una confirmada', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'borrador' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByRole('button', { name: /^reprogramar$/i });
    expect(screen.getByRole('button', { name: /^cancelar clase$/i })).toBeInTheDocument();
  });

  // Rediseño 2026-07-13 (pedido explicito del usuario: "igual borra el estado borrador,
  // tanto de los estados como de la visualizacion del contenedor"): completa la
  // unificacion -- ya no solo las ACCIONES son iguales, la ETIQUETA visible tambien.
  it('una jornada en borrador muestra la etiqueta "Confirmada" (no "Borrador")', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'borrador' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-06');
    expect(screen.getByText(/^confirmada$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^borrador$/i)).not.toBeInTheDocument();
  });

  it('permite reprogramar directamente una jornada en borrador (sin exigir confirmar primero)', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'borrador', fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00' }),
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
        expect.objectContaining({ id: 'jornada-1', estado: 'confirmada', fecha: '2026-07-20' }),
        expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
      );
    });
  });

  it('permite cancelar directamente una jornada en borrador (sin exigir confirmar primero)', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'borrador' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /^cancelar clase$/i }));
    await user.type(screen.getByLabelText(/motivo de cancelacion/i), 'Feriado nacional');
    await user.click(screen.getByRole('button', { name: /confirmar cancelacion/i }));

    await waitFor(() => {
      expect(repository.guardarJornada).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'jornada-1', estado: 'cancelada' }),
        expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
      );
    });
  });
});

// Rediseño 2026-07-13 (pedido explicito del usuario): posibilidad de restituir una
// clase cancelada por error. El icono check (antes "Confirmar", eliminado) hace switch:
// para una jornada CANCELADA, se muestra en su lugar como "Restaurar" -- unico icono en
// esa columna (reemplaza a reagendar/editar/cancelar, que no aplican a una clase ya
// cancelada). Al confirmar, el estado pasa de 'cancelada' a 'confirmada'.
describe('MisClasesView - restituir clase cancelada', () => {
  beforeEach(() => {
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('una jornada cancelada muestra SOLO el icono Restaurar (no reagendar/editar/cancelar)', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'cancelada' }),
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
        onEditarMaterial={() => {}}
      />,
    );

    expect(await screen.findByRole('button', { name: /^restaurar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reprogramar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancelar clase$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar material/i })).not.toBeInTheDocument();
  });

  it('al hacer click en Restaurar, la clase vuelve a "confirmada" y persiste el cambio', async () => {
    const user = userEvent.setup();
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'cancelada' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /^restaurar$/i }));

    await waitFor(() => {
      expect(repository.guardarJornada).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'jornada-1', estado: 'confirmada' }),
        expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
      );
    });
    expect(await screen.findByRole('button', { name: /^reprogramar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^restaurar$/i })).not.toBeInTheDocument();
  });

  it('el icono Restaurar NO aparece para una jornada que no esta cancelada', async () => {
    const repository = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([
        crearJornada({ id: 'jornada-1', estado: 'confirmada' }),
      ]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByRole('button', { name: /^reprogramar$/i });
    expect(screen.queryByRole('button', { name: /^restaurar$/i })).not.toBeInTheDocument();
  });
});

// Fase 3.7 (2026-07-07): rediseño de la tabla plana a una grilla de tarjetas con
// paginación cuando el programa tiene más jornadas de las que entran en una pagina.
// Rediseño 2026-07-12 (pedido explicito del usuario): la grilla pasa de 3x3 (9 por
// pagina) a 4x3 (12 por pagina).
describe('MisClasesView - paginacion (grilla 4x3)', () => {
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

  it('muestra como maximo 12 tarjetas por pagina cuando el programa tiene mas de 12 jornadas', async () => {
    const jornadas = crearJornadas(15);
    const repository = crearRepository(jornadas);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-01');
    expect(screen.getAllByText(/^2026-07-\d{2}$/)).toHaveLength(12);
  });

  it('no muestra tabs de paginacion cuando hay 12 jornadas o menos', async () => {
    const jornadas = crearJornadas(12);
    const repository = crearRepository(jornadas);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-01');
    expect(screen.queryByRole('navigation', { name: /paginacion de clases/i })).not.toBeInTheDocument();
  });

  it('muestra tabs de paginacion cuando hay mas de 12 jornadas, una tab por pagina', async () => {
    const jornadas = crearJornadas(20);
    const repository = crearRepository(jornadas);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-01');
    const nav = screen.getByRole('navigation', { name: /paginacion de clases/i });
    expect(within(nav).getAllByRole('button')).toHaveLength(Math.ceil(20 / 12));
  });

  it('al hacer click en la pagina 2 muestra las siguientes jornadas', async () => {
    const user = userEvent.setup();
    const jornadas = crearJornadas(15);
    const repository = crearRepository(jornadas);

    render(<MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />);

    await screen.findByText('2026-07-01');
    expect(screen.queryByText('2026-07-13')).not.toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /paginacion de clases/i });
    await user.click(within(nav).getByRole('button', { name: '2' }));

    expect(await screen.findByText('2026-07-13')).toBeInTheDocument();
    expect(screen.queryByText('2026-07-01')).not.toBeInTheDocument();
  });

  it('la grilla usa 4 columnas en pantallas grandes', async () => {
    const jornadas = crearJornadas(1);
    const repository = crearRepository(jornadas);

    const { container } = render(
      <MisClasesView tenantId="tenant-1" programaId="programa-1" usuarioId="maestro-1" repository={repository as any} />,
    );

    await screen.findByText('2026-07-01');
    expect(container.querySelector('.xl\\:grid-cols-4')).toBeInTheDocument();
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

// Extension posterior al cierre del modulo 12 (matriz de roles de Agenda, ver CIERRE
// CENTRO DE ESTUDIOS.md): `puedeEditarJornada` es la fuente unica de verdad de permiso de
// edicion, reutilizada por MisClasesView (este archivo), AgendaView.tsx y
// ModalEdicionJornada.tsx. Estos tests cubren la matriz completa en aislamiento (sin
// montar ninguna vista), incluyendo el 4to parametro opcional `contexto` (rol +
// permisoEdicionAgenda) agregado en esta extension.
describe('puedeEditarJornada — matriz de permisos (extension posterior al cierre del modulo 12)', () => {
  const jornadaDeMaestro1 = crearJornada({ instructorId: 'maestro-1' });

  it('Admin siempre puede editar, sea o no el instructor asignado', () => {
    expect(puedeEditarJornada(jornadaDeMaestro1, 'admin-1', true, { rol: RolUsuario.Admin })).toBe(true);
  });

  it('SuperAdmin (esAdmin=true) siempre puede editar', () => {
    expect(puedeEditarJornada(jornadaDeMaestro1, 'super-1', true, { rol: RolUsuario.SuperAdmin })).toBe(true);
  });

  it('Maestro asignado (instructorId === usuarioId) puede editar su propia clase', () => {
    expect(puedeEditarJornada(jornadaDeMaestro1, 'maestro-1', false, { rol: RolUsuario.Maestro })).toBe(true);
  });

  it('Maestro NO asignado no puede editar la clase de otro maestro', () => {
    expect(puedeEditarJornada(jornadaDeMaestro1, 'maestro-otro', false, { rol: RolUsuario.Maestro })).toBe(false);
  });

  it('Asistente sin permisoEdicionAgenda no puede editar una clase ajena', () => {
    expect(
      puedeEditarJornada(jornadaDeMaestro1, 'asistente-1', false, { rol: RolUsuario.Asistente, permisoEdicionAgenda: false }),
    ).toBe(false);
  });

  it('Asistente sin permisoEdicionAgenda informado (undefined) tampoco puede editar una clase ajena', () => {
    expect(puedeEditarJornada(jornadaDeMaestro1, 'asistente-1', false, { rol: RolUsuario.Asistente })).toBe(false);
  });

  it('Asistente CON permisoEdicionAgenda=true puede editar una clase ajena (permiso otorgado por Admin)', () => {
    expect(
      puedeEditarJornada(jornadaDeMaestro1, 'asistente-1', false, { rol: RolUsuario.Asistente, permisoEdicionAgenda: true }),
    ).toBe(true);
  });

  it('Editor (secretaria) sigue el mismo criterio que Asistente: solo edita con el flag en true', () => {
    expect(
      puedeEditarJornada(jornadaDeMaestro1, 'editor-1', false, { rol: RolUsuario.Editor, permisoEdicionAgenda: false }),
    ).toBe(false);
    expect(
      puedeEditarJornada(jornadaDeMaestro1, 'editor-1', false, { rol: RolUsuario.Editor, permisoEdicionAgenda: true }),
    ).toBe(true);
  });

  it('un Asistente/Editor que SI es el instructor asignado edita sin necesitar el flag (mismo criterio que Maestro)', () => {
    expect(
      puedeEditarJornada(jornadaDeMaestro1, 'maestro-1', false, { rol: RolUsuario.Editor, permisoEdicionAgenda: false }),
    ).toBe(true);
  });

  it('Estudiante nunca puede editar, ni siquiera si permisoEdicionAgenda fuera true por error de datos', () => {
    expect(
      puedeEditarJornada(jornadaDeMaestro1, 'estudiante-1', false, { rol: RolUsuario.Estudiante, permisoEdicionAgenda: true }),
    ).toBe(false);
  });

  it('Estudiante nunca puede editar, ni siquiera si coincidiera (por error de datos) con instructorId', () => {
    expect(puedeEditarJornada(jornadaDeMaestro1, 'maestro-1', false, { rol: RolUsuario.Estudiante })).toBe(false);
  });

  it('Tutor (padre/acudiente) nunca puede editar Agenda', () => {
    expect(puedeEditarJornada(jornadaDeMaestro1, 'tutor-1', false, { rol: RolUsuario.Tutor })).toBe(false);
  });

  it('retrocompatibilidad: sin el 4to parametro `contexto`, se comporta exactamente igual que antes (esAdmin || instructorId===usuarioId)', () => {
    expect(puedeEditarJornada(jornadaDeMaestro1, 'maestro-1', false)).toBe(true);
    expect(puedeEditarJornada(jornadaDeMaestro1, 'otro-1', false)).toBe(false);
    expect(puedeEditarJornada(jornadaDeMaestro1, 'otro-1', true)).toBe(true);
  });
});
