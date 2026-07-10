import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaseEnVivoView } from './ClaseEnVivoView';
import type { JornadaRepository } from '../servicios/academico/jornadaRepository';
import type { AsistenciaRepository } from '../servicios/academico/asistenciaRepository';
import type { JornadaInstruccion } from '../models/academico/jornada';
import type { RegistroAsistencia } from '../models/academico/asistencia';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    usuario: { id: 'maestro-1', tenantId: 'tenant-1', rol: 'Editor', email: 'm@test.com' },
  }),
}));

jest.mock('../components/academico/EscanerAsistenciaClase', () => (props: any) => (
  <div data-testid="escaner-clase-mock">
    <p>jornadaId:{props.jornadaId}</p>
    <p>tenantId:{props.tenantId}</p>
    <button onClick={() => props.onRegistrado?.()}>Simular check-in</button>
    <button onClick={props.onClose}>Cerrar escaner</button>
  </div>
));

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  return {
    id: 'jornada-1',
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-1',
    sedeId: 'sede-1',
    espacioId: 'espacio-1',
    instructorId: 'maestro-1',
    fecha: '2026-07-09',
    horaInicio: '10:00',
    horaFin: '11:00',
    estado: 'en_curso',
    objetivosPlaneados: [],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    tema: 'Formas basicas',
    creadoEn: '2026-07-01T00:00:00.000Z',
    actualizadoEn: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function crearRepositoryMock(jornadas: JornadaInstruccion[]): JornadaRepository {
  return {
    guardarJornada: jest.fn(),
    guardarEjecucion: jest.fn(),
    registrarAuditoria: jest.fn(),
    existeConflictoHorario: jest.fn(),
    listarJornadasPorTenant: jest.fn().mockResolvedValue(jornadas),
    guardarJornadasEnLote: jest.fn(),
    actualizarTemaJornada: jest.fn(),
    eliminarJornadasEnLote: jest.fn(),
  } as unknown as JornadaRepository;
}

function crearAsistenciaRepositoryMock(registros: RegistroAsistencia[]): AsistenciaRepository {
  return {
    listarPorJornada: jest.fn().mockResolvedValue(registros),
  };
}

function renderView(props: {
  jornadaId?: string;
  repository: JornadaRepository;
  asistenciaRepository: AsistenciaRepository;
}) {
  return render(
    <MemoryRouter initialEntries={[`/clase-en-vivo/${props.jornadaId ?? 'jornada-1'}`]}>
      <Routes>
        <Route
          path="/clase-en-vivo/:jornadaId"
          element={
            <ClaseEnVivoView
              repository={props.repository}
              asistenciaRepository={props.asistenciaRepository}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClaseEnVivoView', () => {
  it('muestra "no encontrada" si el jornadaId de la ruta no corresponde a ninguna jornada real', async () => {
    const repository = crearRepositoryMock([]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    renderView({ jornadaId: 'jornada-inexistente', repository, asistenciaRepository });

    expect(await screen.findByText(/no se encontr.* la jornada/i)).toBeInTheDocument();
    expect(screen.queryByTestId('escaner-clase-mock')).not.toBeInTheDocument();
  });

  it('muestra estado "no esta en curso" si la jornada existe pero no esta en_curso', async () => {
    const repository = crearRepositoryMock([crearJornada({ estado: 'confirmada' })]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    renderView({ repository, asistenciaRepository });

    expect(await screen.findByText(/no est.* en curso/i)).toBeInTheDocument();
    expect(screen.queryByTestId('escaner-clase-mock')).not.toBeInTheDocument();
  });

  it('carga la jornada real por jornadaId de la ruta y lista los check-ins existentes', async () => {
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([
      { estudianteId: 'estudiante-1', horaEntrada: '2026-07-09T10:05:00.000Z' },
    ]);
    renderView({ repository, asistenciaRepository });

    expect(await screen.findByText(/formas basicas/i)).toBeInTheDocument();
    expect(repository.listarJornadasPorTenant).toHaveBeenCalledWith('tenant-1');
    expect(asistenciaRepository.listarPorJornada).toHaveBeenCalledWith('tenant-1', 'jornada-1');
    expect(screen.getByText(/estudiante-1/)).toBeInTheDocument();
  });

  it('muestra estado vacio cuando la jornada en curso todavia no tiene check-ins', async () => {
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    renderView({ repository, asistenciaRepository });

    expect(await screen.findByText(/todav.a no hay check-ins/i)).toBeInTheDocument();
  });

  it('abre el escaner de Clase en Vivo con jornadaId/tenantId reales y refresca la lista tras un check-in', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    renderView({ repository, asistenciaRepository });

    await screen.findByText(/formas basicas/i);
    await user.click(screen.getByRole('button', { name: /escanear asistencia/i }));

    expect(screen.getByTestId('escaner-clase-mock')).toBeInTheDocument();
    expect(screen.getByText('jornadaId:jornada-1')).toBeInTheDocument();
    expect(screen.getByText('tenantId:tenant-1')).toBeInTheDocument();

    (asistenciaRepository.listarPorJornada as jest.Mock).mockResolvedValueOnce([
      { estudianteId: 'estudiante-2', horaEntrada: '2026-07-09T10:10:00.000Z' },
    ]);
    await user.click(screen.getByRole('button', { name: /simular check-in/i }));

    await waitFor(() => expect(asistenciaRepository.listarPorJornada).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/estudiante-2/)).toBeInTheDocument();
  });

  it('cierra el escaner al invocar onClose', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    renderView({ repository, asistenciaRepository });

    await screen.findByText(/formas basicas/i);
    await user.click(screen.getByRole('button', { name: /escanear asistencia/i }));
    expect(screen.getByTestId('escaner-clase-mock')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cerrar escaner/i }));
    expect(screen.queryByTestId('escaner-clase-mock')).not.toBeInTheDocument();
  });
});
