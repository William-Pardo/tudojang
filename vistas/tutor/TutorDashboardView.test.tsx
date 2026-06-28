import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TutorDashboardView, {
  obtenerAlertasTutor,
  type EstudianteVinculadoTutor,
} from './TutorDashboardView';

const baseAsignacion = {
  id: 'asig-1',
  tenantId: 'tenant-1',
  recursoId: 'recurso-1',
  titulo: 'Manual de poomsae',
  descripcion: 'Lectura obligatoria',
  destinatario: { tipo: 'grupo' as const, grupo: 'Infantil' },
  uso: 'estudio' as const,
  momento: 'preparacion' as const,
  obligatoria: true,
  fechaApertura: '2026-06-20T00:00:00.000Z',
  fechaCierre: '2026-06-28T00:00:00.000Z',
  estado: 'publicada' as const,
  creadoPorUid: 'maestro-1',
  creadoEn: '2026-06-20T00:00:00.000Z',
  actualizadoEn: '2026-06-20T00:00:00.000Z',
  estadoProgreso: 'en_progreso' as const,
  porcentajeProgreso: 45,
  urgencia: 'alta' as const,
};

const estudiantes: EstudianteVinculadoTutor[] = [
  {
    id: 'est-1',
    nombre: 'Samuel Martínez',
    grupo: 'Infantil',
    asignaciones: [
      baseAsignacion,
      {
        ...baseAsignacion,
        id: 'asig-2',
        titulo: 'Quiz reglamento',
        uso: 'evaluacion',
        estadoProgreso: 'aprobado',
        porcentajeProgreso: 100,
        urgencia: 'baja',
      },
    ],
  },
  {
    id: 'est-2',
    nombre: 'Valeria Hernández',
    grupo: 'Cadetes',
    asignaciones: [
      {
        ...baseAsignacion,
        id: 'asig-3',
        titulo: 'Video defensa básica',
        estadoProgreso: 'vencido',
        porcentajeProgreso: 10,
        urgencia: 'vencida',
      },
    ],
  },
];

describe('TutorDashboardView', () => {
  it('muestra selector de estudiantes vinculados y progreso solo lectura', () => {
    render(<TutorDashboardView estudiantes={estudiantes} />);

    expect(screen.getByRole('heading', { name: /panel del tutor/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/estudiante vinculado/i)).toHaveValue('est-1');
    expect(screen.getByRole('heading', { name: /samuel martínez/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /manual de poomsae/i })).toBeInTheDocument();
    expect(screen.getByText(/45%/i)).toBeInTheDocument();
    screen.getAllByRole('button', { name: /solo lectura/i }).forEach((boton) => {
      expect(boton).toBeDisabled();
    });
  });

  it('permite cambiar de estudiante vinculado', async () => {
    const user = userEvent.setup();

    render(<TutorDashboardView estudiantes={estudiantes} />);

    await user.selectOptions(screen.getByLabelText(/estudiante vinculado/i), 'est-2');

    expect(screen.getByRole('heading', { name: /valeria hernández/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /video defensa básica/i })).toBeInTheDocument();
  });

  it('calcula alertas vencidas y proximas para el tutor', () => {
    const alertas = obtenerAlertasTutor(estudiantes);

    expect(alertas.map((alerta) => alerta.asignacion.titulo)).toEqual([
      'Video defensa básica',
      'Manual de poomsae',
    ]);
  });

  it('muestra estado vacio si el tutor no tiene estudiantes vinculados', () => {
    render(<TutorDashboardView estudiantes={[]} />);

    expect(screen.getByText(/sin estudiantes vinculados/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/estudiante vinculado/i)).not.toBeInTheDocument();
  });
});
