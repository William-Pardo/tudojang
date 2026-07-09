import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JornadasView from './JornadasView';
import { ConflictoConcurrenciaError } from '../../servicios/academico/jornadaRepository';
import type { RegistroAsistencia } from '../../models/academico/asistencia';

jest.mock('../../servicios/academico/jornadaContextService', () => ({
  obtenerContextoJornada: jest.fn(),
}));

import { obtenerContextoJornada } from '../../servicios/academico/jornadaContextService';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    usuario: {
      id: 'maestro-real',
      tenantId: 'tenant-real',
      rol: 'Editor',
      email: 'maestro@test.com',
    },
  }),
}));

describe('JornadasView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (obtenerContextoJornada as jest.Mock).mockResolvedValue({
      programas: [
        { id: 'programa-real', nombre: 'Programa real' },
        { id: 'programa-competencia', nombre: 'Programa competencia' },
      ],
      grupos: [
        { id: 'grupo-infantil', nombre: 'Grupo infantil' },
        { id: 'grupo-precadetes', nombre: 'Grupo precadetes' },
      ],
      sedes: [
        { id: 'sede-principal', nombre: 'Sede principal' },
        { id: 'sede-norte', nombre: 'Sede norte' },
      ],
      espacios: [
        { id: 'tatami-1', nombre: 'Tatami 1' },
        { id: 'tatami-2', nombre: 'Tatami 2' },
      ],
      instructores: [
        { id: 'maestro-real', nombre: 'Maestro real' },
      ],
    });
  });

  it('renderiza agenda de jornadas para maestro', () => {
    render(<JornadasView />);

    expect(screen.getByRole('heading', { name: /plan y cierre de clase/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /grupo infantil/i })).toBeInTheDocument();
    expect(screen.getByText(/estado: borrador/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar jornada/i })).toBeInTheDocument();
  });

  it('se puede renderizar embebida sin duplicar el encabezado de Centro de Estudios', () => {
    render(<JornadasView embedded />);

    expect(screen.queryByRole('heading', { name: /plan y cierre de clase/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /grupo infantil/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar jornada/i })).toBeInTheDocument();
  });

  // Fase 2: `asistenciaRegistrada` ya no es un checkbox manual, viene de contar
  // check-ins reales de la subcoleccion `asistencias` (design.md, Data Flow).
  it('permite confirmar, iniciar, derivar asistencia de check-ins reales y cerrar jornada', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock();
    const asistenciaRepository = crearAsistenciaRepositoryMock([
      { estudianteId: 'estudiante-1', horaEntrada: '2026-06-27T08:05:00.000Z' },
    ]);
    render(<JornadasView repository={repository} asistenciaRepository={asistenciaRepository} />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));
    expect(screen.getByText(/estado: confirmada/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /iniciar jornada/i }));
    expect(screen.getByText(/estado: en curso/i)).toBeInTheDocument();

    // No hay checkbox manual: el conteo de check-ins reales (1) marca la asistencia.
    expect(await screen.findByText(/asistencia registrada \(1 check-in\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /asistencia registrada/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /objetivo saludo impartido/i }));
    await user.click(screen.getByRole('button', { name: /cerrar jornada/i }));

    expect(screen.getByText(/estado: cerrada/i)).toBeInTheDocument();
    expect(screen.queryByText(/programa avanzo a/i)).not.toBeInTheDocument();
    expect(screen.getByText(/refuerzos publicados: obj-patada/i)).toBeInTheDocument();
    expect(repository.guardarJornada).toHaveBeenCalledTimes(3);
    expect(repository.guardarEjecucion).toHaveBeenCalledTimes(1);
    expect(repository.registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-real',
      usuarioId: 'maestro-real',
      accion: 'cerrar',
    }));
  });

  it('confirma la jornada con grupo, sede y espacio seleccionados por el maestro', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock();
    render(<JornadasView repository={repository} />);

    await user.selectOptions(screen.getByLabelText(/grupo/i), 'grupo-precadetes');
    await user.selectOptions(screen.getByLabelText(/sede/i), 'sede-norte');
    await user.selectOptions(screen.getByLabelText(/espacio/i), 'tatami-2');
    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));

    expect(repository.guardarJornada).toHaveBeenCalledWith(
      expect.objectContaining({
        grupoId: 'grupo-precadetes',
        sedeId: 'sede-norte',
        espacioId: 'tatami-2',
        estado: 'confirmada',
      }),
      expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
    );
  });

  it('confirma la jornada con el programa real seleccionado por el maestro', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock();
    render(<JornadasView repository={repository} />);

    await user.selectOptions(await screen.findByLabelText(/programa/i), 'programa-competencia');
    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));

    expect(repository.guardarJornada).toHaveBeenCalledWith(
      expect.objectContaining({
        programaId: 'programa-competencia',
        estado: 'confirmada',
      }),
      expect.objectContaining({ actualizadoEnEsperado: expect.any(String) }),
    );
  });

  it('carga opciones de jornada desde contexto real del tenant autenticado', async () => {
    render(<JornadasView />);

    expect(await screen.findByRole('option', { name: /grupo precadetes/i })).toBeInTheDocument();
    expect(obtenerContextoJornada).toHaveBeenCalledWith('tenant-real');
  });

  it('bloquea confirmacion y muestra mensaje especifico si el conflicto es de espacio', async () => {
    const user = userEvent.setup();
    const repository = {
      ...crearRepositoryMock(),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: true, motivo: 'espacio' }),
    };
    render(<JornadasView repository={repository} />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));

    expect(screen.getByText(/la sede seleccionada no esta disponible entre 08:00 y 09:00/i)).toBeInTheDocument();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
  });

  it('bloquea confirmacion y muestra mensaje especifico si el conflicto es de instructor', async () => {
    const user = userEvent.setup();
    const repository = {
      ...crearRepositoryMock(),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: true, motivo: 'instructor' }),
    };
    render(<JornadasView repository={repository} />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));

    expect(screen.getByText(/el maestro ya tiene una clase asignada en este horario/i)).toBeInTheDocument();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
  });

  // Subtarea 12.4 — bloqueo optimista. Si guardarJornada rechaza con
  // ConflictoConcurrenciaError (otro usuario grabo primero), la vista muestra el mensaje
  // de negocio y no avanza el estado de la jornada.
  it('muestra el mensaje de conflicto de concurrencia si el guardado es rechazado por otra edicion', async () => {
    const user = userEvent.setup();
    const repository = {
      ...crearRepositoryMock(),
      guardarJornada: jest.fn().mockRejectedValue(new ConflictoConcurrenciaError()),
    };
    render(<JornadasView repository={repository} />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));

    expect(await screen.findByText(/la clase fue modificada por otro usuario/i)).toBeInTheDocument();
    // La jornada no avanza a confirmada: el conflicto detuvo la transicion visible.
    expect(screen.getByText(/estado: borrador/i)).toBeInTheDocument();
  });

  // Fase 2, tarea 2.7 (regresion): cierre sin asistencia registrada se comporta igual
  // que antes de este change, ahora con la fuente derivada de check-ins reales (0
  // check-ins en la subcoleccion) en vez del checkbox manual sin marcar.
  it('muestra error si intenta cerrar sin check-ins de asistencia registrados', async () => {
    const user = userEvent.setup();
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    render(<JornadasView asistenciaRepository={asistenciaRepository} />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));
    await user.click(screen.getByRole('button', { name: /iniciar jornada/i }));
    expect(await screen.findByText(/sin check-ins registrados/i)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /objetivo saludo impartido/i }));
    await user.click(screen.getByRole('button', { name: /cerrar jornada/i }));

    expect(screen.getByText(/no se puede cerrar una jornada sin asistencia registrada/i)).toBeInTheDocument();
  });

  // Subtarea 12.5 — auditoria completa por cambio: el diagnostico (12.1) encontro que
  // registrarAuditoria no guardaba el rol de quien hizo el cambio, ni la fuente (que
  // vista origino el cambio), ni el valor anterior de cada campo modificado (solo el
  // resultado). Aca se verifica el wiring end-to-end desde JornadasView.
  it('registra auditoria con el rol del usuario, la fuente "jornadas" y el diff de campos (anterior/nuevo)', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock();
    render(<JornadasView repository={repository} />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));

    expect(repository.registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({
      rol: 'Editor',
      fuente: 'jornadas',
      cambios: expect.arrayContaining([
        expect.objectContaining({ campo: 'estado', anterior: 'borrador', nuevo: 'confirmada' }),
      ]),
    }));
  });

  // Subtarea 12.5 — el diagnostico (12.1) tambien encontro que un fallo al registrar la
  // auditoria solo se logueaba con console.warn: no quedaba constancia visible para el
  // usuario. El guardado principal (guardarJornada) ya se aplico y no se revierte (no hay
  // infraestructura de transaccion/rollback), pero el fallo de auditoria debe ser visible.
  it('si falla el registro de auditoria, muestra una advertencia visible sin revertir el guardado principal', async () => {
    const user = userEvent.setup();
    const repository = {
      ...crearRepositoryMock(),
      registrarAuditoria: jest.fn().mockRejectedValue(new Error('fallo de red')),
    };
    render(<JornadasView repository={repository} />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));

    // El guardado principal SI se aplico.
    expect(screen.getByText(/estado: confirmada/i)).toBeInTheDocument();
    // El fallo de auditoria queda visible para el usuario (no solo en consola).
    expect(await screen.findByText(/no se pudo registrar la auditor/i)).toBeInTheDocument();
  });
});

function crearRepositoryMock() {
  return {
    guardarJornada: jest.fn().mockResolvedValue(undefined),
    guardarEjecucion: jest.fn().mockResolvedValue(undefined),
    registrarAuditoria: jest.fn().mockResolvedValue(undefined),
    existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
  };
}

function crearAsistenciaRepositoryMock(registros: RegistroAsistencia[] = []) {
  return {
    listarPorJornada: jest.fn().mockResolvedValue(registros),
  };
}
