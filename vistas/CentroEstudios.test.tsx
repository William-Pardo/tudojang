import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CentroEstudios from './CentroEstudios';

jest.mock('../hooks/useCentroEstudios', () => ({
  useCentroEstudios: jest.fn(),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../servicios/academico/centroEstudiosRepository', () => ({
  centroEstudiosRepository: {
    obtenerAsignaciones: jest.fn(),
  },
  prepararAsignacionesCentroEstudios: jest.requireActual('../servicios/academico/centroEstudiosRepository').prepararAsignacionesCentroEstudios,
}));

import { useCentroEstudios } from '../hooks/useCentroEstudios';
import { useAuth } from '../context/AuthContext';
import { centroEstudiosRepository } from '../servicios/academico/centroEstudiosRepository';
import { RolUsuario } from '../tipos';

const mockUseCentroEstudios = useCentroEstudios as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockObtenerAsignaciones = centroEstudiosRepository.obtenerAsignaciones as jest.Mock;

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

    expect(screen.getByRole('heading', { name: /centro de estudios/i })).toBeInTheDocument();
    expect(screen.getByText(/materiales, tareas y progreso/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /fundamentos técnicos del dojang/i })).toBeInTheDocument();
    });

    expect(mockObtenerAsignaciones).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      estudianteId: 'est-1',
    });
  });

  it('advierte modo piloto cuando el feature flag está apagado', async () => {
    mockUseCentroEstudios.mockReturnValue({ centroEstudiosActivo: false });

    render(<CentroEstudios />);

    expect(screen.getByText(/modo piloto visible/i)).toBeInTheDocument();
    await waitFor(() => expect(mockObtenerAsignaciones).toHaveBeenCalled());
  });

  it('usa el header operativo compacto que comparten los demás módulos internos', async () => {
    render(<CentroEstudios />);

    expect(screen.getByRole('heading', { name: /centro de estudios/i })).toBeInTheDocument();
    expect(screen.getByText(/gestión de materiales y progreso académico/i)).toBeInTheDocument();
    expect(screen.getByText(/materiales, tareas y progreso · sin consumo de ia/i)).toBeInTheDocument();

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

    expect(screen.getByRole('heading', { name: /centro de estudios/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /plan y cierre de clase/i })).toBeInTheDocument();
    expect(screen.getByText(/gestion academica del maestro/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar jornada/i })).toBeInTheDocument();

    await waitFor(() => expect(mockObtenerAsignaciones).toHaveBeenCalled());
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
