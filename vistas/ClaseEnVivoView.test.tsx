import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaseEnVivoView } from './ClaseEnVivoView';
import type { JornadaRepository } from '../servicios/academico/jornadaRepository';
import type { AsistenciaRepository } from '../servicios/academico/asistenciaRepository';
import type { JornadaInstruccion } from '../models/academico/jornada';
import type { RegistroAsistencia } from '../models/academico/asistencia';
import type { CheckpointMaterialService } from '../servicios/academico/checkpointMaterialService';
import type { CheckpointMaterialJornada } from '../models/academico/checkpointMaterial';

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

function crearCheckpointServiceMock(
  overrides: Partial<CheckpointMaterialService> = {}
): CheckpointMaterialService {
  return {
    listarMaterialesDeJornada: jest.fn().mockResolvedValue([]),
    guardarCheckpoint: jest.fn().mockResolvedValue(undefined),
    listarCheckpoints: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function renderViewSinId(props: {
  repository: JornadaRepository;
  asistenciaRepository: AsistenciaRepository;
  checkpointMaterialService?: CheckpointMaterialService;
}) {
  return render(
    <MemoryRouter initialEntries={['/clase-en-vivo']}>
      <Routes>
        <Route
          path="/clase-en-vivo"
          element={
            <ClaseEnVivoView
              repository={props.repository}
              asistenciaRepository={props.asistenciaRepository}
              checkpointMaterialService={props.checkpointMaterialService ?? crearCheckpointServiceMock()}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function renderView(props: {
  jornadaId?: string;
  repository: JornadaRepository;
  asistenciaRepository: AsistenciaRepository;
  checkpointMaterialService?: CheckpointMaterialService;
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
              checkpointMaterialService={props.checkpointMaterialService ?? crearCheckpointServiceMock()}
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

describe('ClaseEnVivoView — checkpoint de materiales (WS-4b, §9/§15.D)', () => {
  it('muestra "sin materiales" cuando la jornada no tiene ninguno asignado', async () => {
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    renderView({ repository, asistenciaRepository });

    expect(await screen.findByText(/no hay materiales asignados/i)).toBeInTheDocument();
  });

  it('lista los materiales asignados como "Sin marcar" cuando no tienen checkpoint previo', async () => {
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    const checkpointService = crearCheckpointServiceMock({
      listarMaterialesDeJornada: jest.fn().mockResolvedValue([{ asignacionId: 'asig-1', titulo: 'Taeguk 1' }]),
    });
    renderView({ repository, asistenciaRepository, checkpointMaterialService: checkpointService });

    expect(await screen.findByText('Taeguk 1')).toBeInTheDocument();
    expect(screen.getByText('Sin marcar')).toBeInTheDocument();
    expect(checkpointService.listarMaterialesDeJornada).toHaveBeenCalledWith('tenant-1', 'jornada-1');
  });

  it('muestra la etiqueta del estado ya registrado para un material con checkpoint previo', async () => {
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    const checkpointExistente: CheckpointMaterialJornada = {
      asignacionId: 'asig-1',
      jornadaId: 'jornada-1',
      tenantId: 'tenant-1',
      estado: 'practicado',
      registradoPorUid: 'maestro-1',
      actualizadoEn: '2026-07-09T10:00:00.000Z',
    };
    const checkpointService = crearCheckpointServiceMock({
      listarMaterialesDeJornada: jest.fn().mockResolvedValue([{ asignacionId: 'asig-1', titulo: 'Taeguk 1' }]),
      listarCheckpoints: jest.fn().mockResolvedValue([checkpointExistente]),
    });
    renderView({ repository, asistenciaRepository, checkpointMaterialService: checkpointService });

    expect(await screen.findByText('Practicado', { selector: 'span' })).toBeInTheDocument();
  });

  it('marcar un estado (chip) guarda el checkpoint SIN bloquear el escaneo de asistencia', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    const checkpointService = crearCheckpointServiceMock({
      listarMaterialesDeJornada: jest.fn().mockResolvedValue([{ asignacionId: 'asig-1', titulo: 'Taeguk 1' }]),
    });
    renderView({ repository, asistenciaRepository, checkpointMaterialService: checkpointService });

    await screen.findByText('Taeguk 1');
    // El boton de escaneo esta disponible independientemente del estado del checkpoint.
    expect(screen.getByRole('button', { name: /escanear asistencia/i })).toBeEnabled();

    const grupo = screen.getByRole('group', { name: /estado de taeguk 1/i });
    await user.click(within(grupo).getByRole('button', { name: /^practicado$/i }));

    await waitFor(() =>
      expect(checkpointService.guardarCheckpoint).toHaveBeenCalledWith(
        'tenant-1',
        'jornada-1',
        { asignacionId: 'asig-1', estado: 'practicado', notaCorta: undefined },
        'maestro-1'
      )
    );
    expect(checkpointService.listarCheckpoints).toHaveBeenCalledTimes(2); // carga inicial + recarga tras guardar
    expect(screen.getByRole('button', { name: /escanear asistencia/i })).toBeEnabled();
  });

  it('la nota corta solo se puede agregar sobre un material YA marcado, y viaja en el guardado', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    const checkpointExistente: CheckpointMaterialJornada = {
      asignacionId: 'asig-1',
      jornadaId: 'jornada-1',
      tenantId: 'tenant-1',
      estado: 'parcial',
      registradoPorUid: 'maestro-1',
      actualizadoEn: '2026-07-09T10:00:00.000Z',
    };
    const checkpointService = crearCheckpointServiceMock({
      listarMaterialesDeJornada: jest.fn().mockResolvedValue([{ asignacionId: 'asig-1', titulo: 'Taeguk 1' }]),
      listarCheckpoints: jest.fn().mockResolvedValue([checkpointExistente]),
    });
    renderView({ repository, asistenciaRepository, checkpointMaterialService: checkpointService });

    await screen.findByText('Taeguk 1');
    await user.click(screen.getByRole('button', { name: /\+ nota/i }));
    await user.type(screen.getByLabelText(/nota corta de taeguk 1/i), 'Cuesta el giro');
    await user.click(screen.getByRole('button', { name: /guardar nota/i }));

    await waitFor(() =>
      expect(checkpointService.guardarCheckpoint).toHaveBeenCalledWith(
        'tenant-1',
        'jornada-1',
        { asignacionId: 'asig-1', estado: 'parcial', notaCorta: 'Cuesta el giro' },
        'maestro-1'
      )
    );
  });

  it('un material SIN checkpoint todavia no ofrece agregar nota', async () => {
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    const checkpointService = crearCheckpointServiceMock({
      listarMaterialesDeJornada: jest.fn().mockResolvedValue([{ asignacionId: 'asig-1', titulo: 'Taeguk 1' }]),
    });
    renderView({ repository, asistenciaRepository, checkpointMaterialService: checkpointService });

    await screen.findByText('Taeguk 1');
    expect(screen.queryByRole('button', { name: /\+ nota/i })).not.toBeInTheDocument();
  });
});

// WS-6 (§4): selector multi-clase. Solo aplica cuando NO llega un jornadaId explicito por
// ruta/prop (renderViewSinId) -- con id explicito el comportamiento es el de siempre, ya
// cubierto arriba. `usuario.id` del mock de useAuth es 'maestro-1'; las jornadas de estos
// tests usan ese mismo instructorId para pasar el filtro de rol Editor del hook.
describe('ClaseEnVivoView — selector multi-clase (WS-6, §4)', () => {
  // 2026-07-09T15:01:00Z = 10:01 hora Bogota (UTC-5): dentro de la ventana [09:45,11:15] de
  // una jornada 10:00-11:00 (mismo criterio de offset que ventanaClaseEnVivoService.test.ts).
  const AHORA_EN_VENTANA = new Date('2026-07-09T15:01:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(AHORA_EN_VENTANA);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('con exactamente 1 jornada en ventana y sin id explicito, la auto-selecciona (sin selector)', async () => {
    const unica = crearJornada({ id: 'jornada-unica', instructorId: 'maestro-1', tema: 'Unica clase activa' });
    const repository = crearRepositoryMock([unica]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);

    renderViewSinId({ repository, asistenciaRepository });

    expect(await screen.findByText(/unica clase activa/i)).toBeInTheDocument();
    expect(screen.queryByText(/elegí cuál/i)).not.toBeInTheDocument();
  });

  it('con 2+ jornadas en ventana y sin id explicito, muestra el selector y NO auto-carga ninguna', async () => {
    const grupoA = crearJornada({ id: 'jornada-a', instructorId: 'maestro-1', tema: 'Grupo Infantil', horaInicio: '09:50', horaFin: '10:50' });
    const grupoB = crearJornada({ id: 'jornada-b', instructorId: 'maestro-1', tema: 'Grupo Avanzado', horaInicio: '10:00', horaFin: '11:00' });
    const repository = crearRepositoryMock([grupoB, grupoA]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);

    renderViewSinId({ repository, asistenciaRepository });

    expect(await screen.findByText(/tenés 2 clases activas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /grupo infantil/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /grupo avanzado/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /escanear asistencia/i })).not.toBeInTheDocument();
  });

  it('clickear una opcion del selector carga esa jornada (escaner, check-ins, materiales)', async () => {
    const grupoA = crearJornada({ id: 'jornada-a', instructorId: 'maestro-1', tema: 'Grupo Infantil', horaInicio: '09:50', horaFin: '10:50' });
    const grupoB = crearJornada({ id: 'jornada-b', instructorId: 'maestro-1', tema: 'Grupo Avanzado', horaInicio: '10:00', horaFin: '11:00' });
    const repository = crearRepositoryMock([grupoA, grupoB]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);

    renderViewSinId({ repository, asistenciaRepository });

    const opcionAvanzado = await screen.findByRole('button', { name: /grupo avanzado/i });
    fireEvent.click(opcionAvanzado);

    expect(await screen.findByRole('button', { name: /escanear asistencia/i })).toBeInTheDocument();
    expect(screen.queryByText(/tenés 2 clases activas/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /grupo infantil/i })).not.toBeInTheDocument();
  });

  it('sin ninguna jornada en ventana y sin id explicito, sigue mostrando "no encontrada" (regresion)', async () => {
    const repository = crearRepositoryMock([]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);

    renderViewSinId({ repository, asistenciaRepository });

    expect(await screen.findByText(/no se encontr.* la jornada/i)).toBeInTheDocument();
  });
});

// WS-6 (§15.A / §14): header completo -- sede, maestro y cuenta regresiva/expirada de la
// ventana. Usa jornadaId explicito (renderView), asi que el selector de arriba no interviene.
describe('ClaseEnVivoView — header completo (WS-6, §15.A/§14)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('muestra el nombre de la sede y del maestro cuando se resuelven', async () => {
    const repository = crearRepositoryMock([crearJornada({ sedeId: 'sede-1', instructorId: 'maestro-1' })]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    const obtenerSedes = jest.fn().mockResolvedValue([{ id: 'sede-1', nombre: 'Sede Central', tenantId: 'tenant-1', direccion: '', ciudad: '', telefono: '' }]);
    const obtenerUsuario = jest.fn().mockResolvedValue({ id: 'maestro-1', nombreUsuario: 'Maestro Kim' });

    render(
      <MemoryRouter initialEntries={['/clase-en-vivo/jornada-1']}>
        <Routes>
          <Route
            path="/clase-en-vivo/:jornadaId"
            element={
              <ClaseEnVivoView
                repository={repository}
                asistenciaRepository={asistenciaRepository}
                checkpointMaterialService={crearCheckpointServiceMock()}
                obtenerSedes={obtenerSedes}
                obtenerUsuario={obtenerUsuario}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/sede central.*maestro kim/i)).toBeInTheDocument();
    expect(obtenerSedes).toHaveBeenCalledWith('tenant-1');
    expect(obtenerUsuario).toHaveBeenCalledWith('maestro-1');
  });

  it('no rompe el header si la sede/el maestro no se pueden resolver (fallo silencioso)', async () => {
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);
    const obtenerSedes = jest.fn().mockRejectedValue(new Error('sin permiso'));
    const obtenerUsuario = jest.fn().mockRejectedValue(new Error('sin permiso'));

    render(
      <MemoryRouter initialEntries={['/clase-en-vivo/jornada-1']}>
        <Routes>
          <Route
            path="/clase-en-vivo/:jornadaId"
            element={
              <ClaseEnVivoView
                repository={repository}
                asistenciaRepository={asistenciaRepository}
                checkpointMaterialService={crearCheckpointServiceMock()}
                obtenerSedes={obtenerSedes}
                obtenerUsuario={obtenerUsuario}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/formas basicas/i)).toBeInTheDocument();
    await waitFor(() => expect(obtenerSedes).toHaveBeenCalled());
  });

  it('muestra los minutos restantes de la ventana mientras sigue abierta', async () => {
    jest.useFakeTimers();
    // Cierre de una jornada 10:00-11:00 (fecha 2026-07-09) = 11:00 Bogota + 15min = 16:15Z.
    jest.setSystemTime(new Date('2026-07-09T16:00:00.000Z'));
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);

    renderView({ repository, asistenciaRepository });

    expect(await screen.findByText(/15 min restantes/i)).toBeInTheDocument();
  });

  it('muestra "Ventana expirada" cuando ya paso el cierre, aunque la jornada siga en_curso', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-09T16:20:00.000Z'));
    const repository = crearRepositoryMock([crearJornada()]);
    const asistenciaRepository = crearAsistenciaRepositoryMock([]);

    renderView({ repository, asistenciaRepository });

    expect(await screen.findByText(/ventana expirada/i)).toBeInTheDocument();
  });
});
