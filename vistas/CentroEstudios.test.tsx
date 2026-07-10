import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CentroEstudios from './CentroEstudios';

jest.mock('../hooks/useCentroEstudios', () => ({
  useCentroEstudios: jest.fn(),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({
    mostrarNotificacion: jest.fn(),
  }),
}));

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
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin } });

    render(<CentroEstudios />);

    expect(screen.getByRole('heading', { name: /^centro de estudios$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/recursos aprobados/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/programa y publicacion/i)).toBeInTheDocument();
    expect(screen.queryByText(/viaje del maestro/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar jornada/i })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^programa/i })).toBeInTheDocument();

    // El grid de "Recursos aprobados" y su seleccion multiple viven en Biblioteca
    // (Centro de recursos); confirmar el lote ahi lo bridgea a Asignaciones via callback.
    const grupoRecursosAprobados = await screen.findByRole('group', { name: /^recursos aprobados$/i });
    await user.click(within(grupoRecursosAprobados).getByRole('checkbox', { name: /material aprobado para jornada/i }));
    await user.click(screen.getByRole('button', { name: /agregar seleccionados al lote/i }));

    const seccionLote = screen.getByRole('region', { name: /publicacion en lote/i });
    expect(await within(seccionLote).findByRole('checkbox', { name: /material aprobado para jornada/i })).toBeChecked();
    expect(screen.getByRole('button', { name: /^publicar todo$/i })).toBeInTheDocument();

    await waitFor(() => expect(mockObtenerAsignaciones).toHaveBeenCalled());
  });

  it('habilita publicar todo cuando hay material y clase seleccionados', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ usuario: { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin } });

    render(<CentroEstudios />);

    expect(screen.getByRole('button', { name: /^publicar todo$/i })).toBeDisabled();

    const grupoRecursosAprobados = await screen.findByRole('group', { name: /^recursos aprobados$/i });
    await user.click(within(grupoRecursosAprobados).getByRole('checkbox', { name: /material aprobado para jornada/i }));
    await user.click(screen.getByRole('button', { name: /agregar seleccionados al lote/i }));
    await user.click(await screen.findByRole('checkbox', { name: /clase 1/i }));

    expect(screen.getByRole('button', { name: /^publicar todo$/i })).not.toBeDisabled();
  });

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
