import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CentroEstudios from './CentroEstudios';

jest.mock('../hooks/useCentroEstudios', () => ({
  useCentroEstudios: jest.fn(),
}));

// Menú mobile acordeon (deep-link `?tab=`): CentroEstudios ahora lee useSearchParams() de
// react-router-dom para su tab inicial. Este archivo no renderiza dentro de un <Router>, asi
// que se mockea sin query params -- equivalente al comportamiento previo (fallback 'flujo').
jest.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams()] }));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({
    mostrarNotificacion: jest.fn(),
  }),
}));

// Fix 2026-07-22: la pestaña "Progreso estudiantes" monta PanelMetricasEstudiantes, que usa
// `useEstudiantes()` de DataContext. Sin este mock el test del switcher moria con
// "useEstudiantes debe usarse dentro de DataProvider" al cambiar de pestaña.
jest.mock('../context/DataContext', () => ({
  useEstudiantes: () => ({ estudiantes: [], cargando: false, error: null }),
  useSedes: () => ({ sedesVisibles: [] }),
  useProgramas: () => ({ programas: [], agendaCompleta: [] }),
  useConfiguracion: () => ({ configClub: {}, usuarios: [] }),
}));

// Fix 2026-07-22: MaterialPreviewModal paso a cargar el banco de preguntas REAL del recurso
// via quizService (antes QuizView caia siempre a su pregunta demo hardcodeada). Sin mockear
// el servicio, el quiz no renderiza ninguna opcion y el test del progreso no encuentra su
// label.
jest.mock('../servicios/academico/quizService', () => {
  const { preguntasDemoQuiz } = jest.requireActual('../components/academico/QuizView');
  return {
    quizService: {
      obtenerQuiz: jest.fn().mockResolvedValue(preguntasDemoQuiz),
      guardarQuiz: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../servicios/academico/centroEstudiosRepository', () => ({
  centroEstudiosRepository: {
    obtenerAsignaciones: jest.fn(),
  },
  prepararAsignacionesCentroEstudios: jest.requireActual('../servicios/academico/centroEstudiosRepository').prepararAsignacionesCentroEstudios,
}));

jest.mock('../servicios/academico/bibliotecaService', () => {
  const listarRecursosAprobadosMock = jest.fn();
  return {
    crearBibliotecaService: jest.fn(() => ({
      importFromDrive: jest.fn().mockResolvedValue({
        id: 'recurso-importado',
        nombre: 'Recurso importado',
        estado: 'borrador',
        ficha: {},
      }),
      updateFicha: jest.fn().mockResolvedValue(undefined),
      approveRecurso: jest.fn().mockResolvedValue(undefined),
    })),
    // BibliotecaView.tsx usa el objeto `bibliotecaService` (no la factory) por defecto;
    // comparte el mismo mock de listarRecursosAprobados que el export nombrado para que
    // su grid de "Recursos aprobados" y el de AsignacionesView vean el mismo tenant.
    bibliotecaService: {
      importFromDrive: jest.fn(),
      findRecursoIndexado: jest.fn(),
      updateFicha: jest.fn(),
      approveRecurso: jest.fn(),
      archiveRecurso: jest.fn(),
      listarRecursosAprobados: listarRecursosAprobadosMock,
    },
    listarRecursosAprobados: listarRecursosAprobadosMock,
  };
});

import { useCentroEstudios } from '../hooks/useCentroEstudios';
import { useAuth } from '../context/AuthContext';
import { centroEstudiosRepository } from '../servicios/academico/centroEstudiosRepository';
import { listarRecursosAprobados } from '../servicios/academico/bibliotecaService';
import { RolUsuario } from '../tipos';

const mockUseCentroEstudios = useCentroEstudios as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockObtenerAsignaciones = centroEstudiosRepository.obtenerAsignaciones as jest.Mock;
const mockListarRecursosAprobados = listarRecursosAprobados as jest.Mock;

const asignacionBase = {
  tenantId: 'tenant-1',
  recursoId: 'r1',
  descripcion: 'Material inicial',
  destinatario: { tipo: 'grupo' as const, grupo: 'Infantil' },
  uso: 'estudio' as const,
  momento: 'preparacion' as const,
  obligatoria: true,
  fechaApertura: '2026-06-26T00:00:00.000Z',
  estado: 'publicada' as const,
  creadoPorUid: 'admin',
  creadoEn: '2026-06-26T00:00:00.000Z',
  actualizadoEn: '2026-06-26T00:00:00.000Z',
  estadoProgreso: 'disponible' as const,
  porcentajeProgreso: 0,
  urgencia: 'baja' as const,
};

describe('CentroEstudios', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseCentroEstudios.mockReturnValue({ centroEstudiosActivo: true });
    mockUseAuth.mockReturnValue({ usuario: { id: 'est-1', tenantId: 'tenant-1', rol: RolUsuario.Asistente } });
    mockListarRecursosAprobados.mockResolvedValue([
      {
        id: 'recurso-real',
        tenantId: 'tenant-1',
        proveedor: 'google_drive',
        externalFileId: 'drive-real',
        nombre: 'Material aprobado para jornada',
        mimeType: 'application/pdf',
        ficha: { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'] },
        estado: 'aprobado',
        creadoPorUid: 'admin',
        creadoEn: '2026-06-27T00:00:00.000Z',
        actualizadoEn: '2026-06-27T00:00:00.000Z',
      },
    ]);
    mockObtenerAsignaciones.mockResolvedValue({
      asignaciones: [
        {
          ...asignacionBase,
          id: 'a1',
          titulo: 'Fundamentos técnicos del dojang',
        },
      ],
    });
  });

  it('muestra el Centro de Estudios y sus asignaciones activas', async () => {
    render(<CentroEstudios />);

    expect(screen.getByRole('heading', { name: /^centro de estudios$/i })).toBeInTheDocument();
    expect(screen.getByText(/convierte archivos de drive en recursos aprobados/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /fundamentos técnicos del dojang/i })).toBeInTheDocument();
    });

    expect(mockObtenerAsignaciones).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      estudianteId: 'est-1',
    });
  });

  it('mantiene el pipeline operativo sin mensajes piloto aunque el feature flag este apagado', async () => {
    mockUseCentroEstudios.mockReturnValue({ centroEstudiosActivo: false });

    render(<CentroEstudios />);

    expect(screen.queryByText(/viaje del maestro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/modo piloto visible/i)).not.toBeInTheDocument();
    await waitFor(() => expect(mockObtenerAsignaciones).toHaveBeenCalled());
  });

  it('usa el header operativo compacto que comparten los demás módulos internos', async () => {
    render(<CentroEstudios />);

    expect(screen.getByRole('heading', { name: /^centro de estudios$/i })).toBeInTheDocument();
    expect(screen.getByText(/convierte archivos de drive en recursos aprobados/i)).toBeInTheDocument();
    expect(screen.queryByText(/sin consumo de ia/i)).not.toBeInTheDocument();

    await waitFor(() => expect(mockObtenerAsignaciones).toHaveBeenCalled());
  });

  it('muestra primero las asignaciones con mayor urgencia', async () => {
    mockObtenerAsignaciones.mockResolvedValue({
      asignaciones: [
        {
          ...asignacionBase,
          ...asignacionBase,
          id: 'alta',
          recursoId: 'r3',
          titulo: 'Asignación urgente',
          descripcion: 'Debe aparecer primero',
          uso: 'evaluacion',
          momento: 'durante',
          fechaCierre: '2026-06-27T00:00:00.000Z',
          estadoProgreso: 'en_progreso',
          porcentajeProgreso: 50,
          urgencia: 'alta',
        },
        {
          ...asignacionBase,
          id: 'baja',
          titulo: 'Asignación baja',
          fechaCierre: '2026-07-20T00:00:00.000Z',
          urgencia: 'baja',
        },
      ],
    });

    render(<CentroEstudios />);

    await waitFor(() => {
      const tarjetas = screen.getAllByRole('heading', { level: 3 });
      expect(tarjetas.map((heading) => heading.textContent)).toEqual([
        'Asignación urgente',
        'Asignación baja',
      ]);
    });
  });

  it('muestra estado vacio cuando el estudiante no tiene asignaciones activas', async () => {
    mockObtenerAsignaciones.mockResolvedValue({ asignaciones: [] });

    render(<CentroEstudios />);

    await waitFor(() => {
      expect(screen.getByText(/centro de estudios vacio/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/aun no tienes materiales asignados/i)).toBeInTheDocument();
  });

  it('integra plan y cierre de clase para admin dentro del Centro de Estudios', async () => {
    mockUseAuth.mockReturnValue({ usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin } });

    render(<CentroEstudios />);

    expect(screen.getByRole('heading', { name: /^centro de estudios$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/recursos aprobados/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/programa y publicacion/i)).toBeInTheDocument();
    expect(screen.queryByText(/viaje del maestro/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar jornada/i })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^programa/i })).toBeInTheDocument();

    await waitFor(() => expect(mockObtenerAsignaciones).toHaveBeenCalled());
  });

  // Nota 2026-07-22: este caso perdio su segunda mitad, y el que le seguia
  // ("habilita publicar todo cuando hay material y clase seleccionados") se retiro completo.
  // Ambos ejercitaban el flujo de PUBLICACION EN LOTE: un `role="group"` "Recursos aprobados"
  // en Biblioteca, un boton "Agregar seleccionados al lote", una `role="region"` "Publicacion
  // en lote" y un boton "Publicar todo". Ninguno de esos elementos existe hoy en el repo
  // (verificado por busqueda en toda la app, no solo en estos componentes): el flujo se
  // elimino del producto en el rediseno de Centro de Estudios, y esta suite -- congelada en
  // el checkpoint f2d16b5 -- quedo probando una UI que ya no se construye.
  //
  // A diferencia de los casos de anulacion de pago (que se trasladaron a
  // ModalRegistrarPago.test.tsx porque la funcionalidad se mudo), aca NO hay destino: la
  // funcionalidad no existe. Si el flujo de lote vuelve, estos casos se reescriben contra
  // la UI nueva; resucitarlos tal cual seria probar un fantasma.
  //
  // Resto vivo de aquel flujo: `agregarRecursoParaLote` sigue definido en CentroEstudios.tsx
  // pero no se pasa a ningun hijo, asi que `recursosParaLote` nunca se puebla. Anotado en
  // ACCIONES_PENDIENTES.md.

  it('ubica el switcher de pestañas antes del stepper y oculta el stepper fuera de la pestaña "flujo"', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin } });

    render(<CentroEstudios />);

    const tablist = screen.getByRole('tablist', { name: /secciones de gestión/i });
    const stepperFlujo = screen.getByRole('list', { name: /flujo principal de centro de estudios/i });

    // El switcher de pestañas debe preceder al stepper en el orden del DOM.
    expect(tablist.compareDocumentPosition(stepperFlujo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /progreso estudiantes/i }));

    expect(screen.queryByRole('list', { name: /flujo principal de centro de estudios/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /flujo académico/i }));

    expect(screen.getByRole('list', { name: /flujo principal de centro de estudios/i })).toBeInTheDocument();
  });

  it('muestra exactamente 3 pasos en el flujo de Centro de Estudios, en orden', async () => {
    mockUseAuth.mockReturnValue({ usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin } });

    render(<CentroEstudios />);

    const listaFlujo = screen.getByRole('list', { name: /flujo principal de centro de estudios/i });
    const pasos = within(listaFlujo).getAllByRole('listitem');

    expect(pasos).toHaveLength(3);
    expect(within(pasos[0]).getByText(/conectar drive/i)).toBeInTheDocument();
    expect(within(pasos[1]).getByText(/centro de recursos/i)).toBeInTheDocument();
    expect(within(pasos[2]).getByText(/programa y publicacion/i)).toBeInTheDocument();
  });

  it('el paso 2 (Centro de recursos) refleja el progreso combinado de biblioteca y asignaciones', async () => {
    mockUseAuth.mockReturnValue({ usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin } });

    render(<CentroEstudios />);

    const pasoRecursos = await screen.findByText(/^centro de recursos$/i);
    const listItem = pasoRecursos.closest('li');

    await waitFor(() => {
      expect(listItem).toHaveClass('bg-blue-50/80');
    });
  });

  it('abre la vista previa del material desde una asignación', async () => {
    const user = userEvent.setup();
    render(<CentroEstudios />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /fundamentos técnicos del dojang/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /abrir material/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/vista previa del recurso/i)).toBeInTheDocument();
  });

  it('refleja en la tarjeta el progreso local guardado al cerrar un quiz aprobado', async () => {
    const user = userEvent.setup();
    mockObtenerAsignaciones.mockResolvedValue({
      asignaciones: [
        {
          ...asignacionBase,
          id: 'quiz-1',
          titulo: 'Quiz seguridad',
          uso: 'evaluacion',
          momento: 'durante',
          urgencia: 'alta',
          porcentajeProgreso: 0,
        },
      ],
    });

    render(<CentroEstudios />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /quiz seguridad/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /abrir material/i }));
    await user.click(screen.getByLabelText(/saludar, escuchar instrucciones/i));
    await user.click(screen.getByRole('button', { name: /enviar respuestas/i }));
    await user.click(screen.getByLabelText(/cerrar material/i));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Completado')).toBeInTheDocument();
  });
});
