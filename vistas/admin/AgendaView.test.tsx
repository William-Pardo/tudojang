import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaView from './AgendaView';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import { obtenerRangoSemana, formatearFechaIso } from '../../servicios/academico/agendaSemanalService';

jest.mock('../../servicios/academico/asignacionService', () => ({
  listarAsignacionesPorTenant: jest.fn(),
}));

jest.mock('../../servicios/academico/jornadaContextService', () => ({
  obtenerContextoJornada: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { listarAsignacionesPorTenant } from '../../servicios/academico/asignacionService';
import { obtenerContextoJornada } from '../../servicios/academico/jornadaContextService';
import { useAuth } from '../../context/AuthContext';

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
    fecha: '2026-07-07',
    horaInicio: '08:00',
    horaFin: '09:00',
    estado: 'confirmada',
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

const contextoVacio = {
  programas: [{ id: 'programa-1', nombre: 'Fundamentos Taekwondo' }],
  grupos: [],
  sedes: [{ id: 'sede-principal', nombre: 'Sede Principal' }],
  espacios: [],
  instructores: [{ id: 'maestro-1', nombre: 'Maestro Juan' }],
};

function mockUsuario(overrides: Partial<{ id: string; tenantId: string; rol: string }> = {}) {
  (useAuth as jest.Mock).mockReturnValue({
    usuario: {
      id: 'maestro-1',
      tenantId: 'tenant-1',
      rol: 'Editor',
      email: 'maestro@test.com',
      ...overrides,
    },
  });
}

describe('AgendaView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
    (obtenerContextoJornada as jest.Mock).mockResolvedValue(contextoVacio);
    mockUsuario();
  });

  it('muestra columnas Lunes a Domingo', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalled());

    for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      expect(screen.getByText(dia)).toBeInTheDocument();
    }
  });

  it('muestra las marcas de hora de 7:00 a 22:00', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalled());

    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByText('22:00')).toBeInTheDocument();
  });

  it('muestra en el encabezado el rango de fechas de la semana actual al montar', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    const hoyIso = formatearFechaIso(new Date());
    const rangoEsperado = obtenerRangoSemana(hoyIso);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`${rangoEsperado.inicioIso}.*${rangoEsperado.finIso}`))).toBeInTheDocument();
    });
  });

  it('muestra los botones de navegacion semana anterior/siguiente/hoy', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /semana anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /semana siguiente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /semana actual|^hoy$/i })).toBeInTheDocument();
  });

  it('al montar, carga la semana actual con el rango de fechas correcto', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    const hoyIso = formatearFechaIso(new Date());
    const rangoEsperado = obtenerRangoSemana(hoyIso);

    await waitFor(() => {
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledWith(
        'tenant-1',
        rangoEsperado.inicioIso,
        rangoEsperado.finIso,
      );
    });
  });

  it('click en semana siguiente dispara una nueva carga con el rango de fechas correcto', async () => {
    const user = userEvent.setup();
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    const hoyIso = formatearFechaIso(new Date());
    const rangoActual = obtenerRangoSemana(hoyIso);
    await waitFor(() => {
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledWith(
        'tenant-1',
        rangoActual.inicioIso,
        rangoActual.finIso,
      );
    });

    await user.click(screen.getByRole('button', { name: /semana siguiente/i }));

    const siguienteInicio = obtenerRangoSemana(
      formatearFechaIso(new Date(new Date(`${rangoActual.inicioIso}T00:00:00`).getTime() + 7 * 24 * 60 * 60 * 1000)),
    );

    await waitFor(() => {
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledWith(
        'tenant-1',
        siguienteInicio.inicioIso,
        siguienteInicio.finIso,
      );
    });
  });

  it('click en semana anterior y luego en hoy vuelve a la semana actual', async () => {
    const user = userEvent.setup();
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    const hoyIso = formatearFechaIso(new Date());
    const rangoActual = obtenerRangoSemana(hoyIso);
    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /semana anterior/i }));
    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole('button', { name: /semana actual|^hoy$/i }));
    await waitFor(() => {
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenLastCalledWith(
        'tenant-1',
        rangoActual.inicioIso,
        rangoActual.finIso,
      );
    });
  });

  it('un bloque de clase muestra los campos minimos requeridos', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([
      crearAsignacion({ jornadaId: 'jornada-1', titulo: 'Fundamentos tecnicos' }),
    ]);

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByText(/fundamentos taekwondo/i)).toBeInTheDocument();
    expect(screen.getByText('08:00 - 09:00')).toBeInTheDocument();
    expect(screen.getByText(/sede principal/i)).toBeInTheDocument();
    expect(screen.getByText(/maestro juan/i)).toBeInTheDocument();
    expect(screen.getByText(/confirmada/i)).toBeInTheDocument();
    expect(screen.getByText(/fundamentos tecnicos/i)).toBeInTheDocument();
  });

  it('muestra un indicador de material pendiente cuando la clase no tiene material asignado', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByText(/material pendiente/i)).toBeInTheDocument();
  });

  it('marca una clase cancelada como atenuada/con badge, sin mostrarla como bloque activo normal', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', estado: 'cancelada' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByText(/cancelada/i)).toBeInTheDocument();
  });

  it('muestra el icono de edicion cuando el usuario es el maestro asignado', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'maestro-1', rol: 'Editor' });

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByRole('button', { name: /editar clase/i })).toBeInTheDocument();
  });

  it('oculta el icono de edicion cuando el usuario no es el maestro asignado ni admin', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'otro-maestro', rol: 'Editor' });

    render(<AgendaView repository={repository as any} />);

    await screen.findByText(/fundamentos taekwondo/i);
    expect(screen.queryByRole('button', { name: /editar clase/i })).not.toBeInTheDocument();
  });

  it('muestra el icono de edicion para un admin aunque no sea el maestro asignado', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'otro-admin', rol: 'Admin' });

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByRole('button', { name: /editar clase/i })).toBeInTheDocument();
  });
});
