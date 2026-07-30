import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import InvitacionesView from './InvitacionesView';
import { useEstudiantes } from '../../context/DataContext';
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  type InvitacionUsuario
} from '../../servicios/academico/invitacionService';
import { vincularTutorAEstudiantes, desvincularTutorDeEstudiante } from '../../servicios/estudiantesApi';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    usuario: { tenantId: 'tenant-123' }
  })
}));

jest.mock('../../context/NotificacionContext', () => ({
  useNotificacion: () => ({
    mostrarNotificacion: jest.fn()
  })
}));

jest.mock('../../context/DataContext', () => ({
  useEstudiantes: jest.fn()
}));

jest.mock('../../servicios/academico/invitacionService', () => ({
  createInvitation: jest.fn(),
  listInvitations: jest.fn(() => Promise.resolve([])),
  resendInvitation: jest.fn()
}));

jest.mock('../../servicios/estudiantesApi', () => ({
  vincularTutorAEstudiantes: jest.fn(),
  desvincularTutorDeEstudiante: jest.fn()
}));

const useEstudiantesMock = useEstudiantes as jest.Mock;
const listInvitationsMock = listInvitations as jest.Mock<() => Promise<InvitacionUsuario[]>>;
const createInvitationMock = createInvitation as jest.Mock<() => Promise<any>>;
const resendInvitationMock = resendInvitation as jest.Mock;
const vincularTutorAEstudiantesMock = vincularTutorAEstudiantes as jest.Mock<() => Promise<void>>;
const desvincularTutorDeEstudianteMock = desvincularTutorDeEstudiante as jest.Mock<() => Promise<void>>;

const tutorAna = {
  nombres: 'Ana',
  apellidos: 'Gómez',
  numeroIdentificacion: '111',
  telefono: '3001112233',
  correo: 'ana@test.com'
};

const cargarEstudiantes = jest.fn();

const buildEstudiantesConTutorCompartido = () => [
  { id: 'est-1', nombres: 'Juan', apellidos: 'Pérez', numeroIdentificacion: '10101', tutor: tutorAna },
  { id: 'est-2', nombres: 'Maria', apellidos: 'Lopez', numeroIdentificacion: '20202', tutor: { ...tutorAna } },
  { id: 'est-3', nombres: 'Pedro', apellidos: 'Diaz', numeroIdentificacion: '30303' }
];

describe('InvitacionesView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEstudiantesMock.mockReturnValue({ estudiantes: [], cargarEstudiantes });
    listInvitationsMock.mockResolvedValue([]);
  });

  it('renderiza la vista de accesos academicos correctamente', async () => {
    render(<InvitacionesView />);

    expect(screen.getByText('Cuentas Externas')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol académico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar invitación/i })).toBeInTheDocument();
    expect(await screen.findByText('No hay invitaciones enviadas.')).toBeInTheDocument();
  });

  it('renderiza filas Estudiante exactamente como antes, sin UI de vinculación', async () => {
    listInvitationsMock.mockResolvedValue([
      {
        id: 'inv-est-1',
        email: 'alumno@test.com',
        rol: 'Estudiante',
        tenantId: 'tenant-123',
        estado: 'pendiente',
        creadoPor: 'admin',
        creadoEn: '2026-07-01T00:00:00.000Z',
        expiraEn: '2026-07-08T00:00:00.000Z',
        activationLink: 'http://localhost/activar'
      }
    ]);

    render(<InvitacionesView />);

    expect(await screen.findByText('alumno@test.com')).toBeInTheDocument();
    expect(screen.getByText('pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copiar enlace/i })).toBeInTheDocument();
    expect(screen.queryByText('Estudiantes vinculados:')).not.toBeInTheDocument();
    expect(screen.queryByText(/Agregar estudiante/i)).not.toBeInTheDocument();
  });

  it('un tutor con invitación Y estudiantes vinculados muestra el estado real y los chips vinculados', async () => {
    useEstudiantesMock.mockReturnValue({ estudiantes: buildEstudiantesConTutorCompartido(), cargarEstudiantes });
    listInvitationsMock.mockResolvedValue([
      {
        id: 'inv-tutor-1',
        email: 'ana@test.com',
        rol: 'Tutor',
        tenantId: 'tenant-123',
        estado: 'aceptada',
        creadoPor: 'admin',
        creadoEn: '2026-07-01T00:00:00.000Z',
        expiraEn: '2026-07-08T00:00:00.000Z'
      }
    ]);

    render(<InvitacionesView />);

    expect(await screen.findByText('ana@test.com')).toBeInTheDocument();
    expect(screen.getByText('aceptada')).toBeInTheDocument();
    expect(screen.getByText('Estudiantes vinculados:')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    // aceptada no muestra Reenviar/Copiar enlace (misma condición de siempre)
    expect(screen.queryByRole('button', { name: /Reenviar/i })).not.toBeInTheDocument();
  });

  it('un tutor conocido solo por estudiantes.tutor.correo (sin invitación) muestra "Sin invitación" e invita al hacer click', async () => {
    const user = userEvent.setup();
    useEstudiantesMock.mockReturnValue({ estudiantes: buildEstudiantesConTutorCompartido(), cargarEstudiantes });
    listInvitationsMock.mockResolvedValue([]);
    createInvitationMock.mockResolvedValue({});

    render(<InvitacionesView />);

    expect(await screen.findByText('ana@test.com')).toBeInTheDocument();
    expect(screen.getByText('Sin invitación')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    const botonInvitar = screen.getByRole('button', { name: /^Invitar$/i });
    await user.click(botonInvitar);

    expect(createInvitationMock).toHaveBeenCalledWith('tenant-123', 'ana@test.com', 'Tutor', {
      nombreDestinatario: 'Ana'
    });
  });

  it('un tutor conocido solo por invitación (0 estudiantes vinculados) exige la identidad completa antes de vincular', async () => {
    const user = userEvent.setup();
    useEstudiantesMock.mockReturnValue({ estudiantes: [], cargarEstudiantes });
    listInvitationsMock.mockResolvedValue([
      {
        id: 'inv-tutor-2',
        email: 'nuevo@test.com',
        rol: 'Tutor',
        tenantId: 'tenant-123',
        estado: 'pendiente',
        creadoPor: 'admin',
        creadoEn: '2026-07-01T00:00:00.000Z',
        expiraEn: '2026-07-08T00:00:00.000Z'
      }
    ]);
    useEstudiantesMock.mockReturnValue({
      estudiantes: [{ id: 'est-9', nombres: 'Lucia', apellidos: 'Rios', numeroIdentificacion: '999' }],
      cargarEstudiantes
    });
    vincularTutorAEstudiantesMock.mockResolvedValue(undefined);

    render(<InvitacionesView />);

    expect(await screen.findByText('nuevo@test.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Agregar estudiante/i }));

    expect(screen.getByLabelText('Nombres del tutor nuevo@test.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Apellidos del tutor nuevo@test.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Número de identificación del tutor nuevo@test.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono del tutor nuevo@test.com')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nombres del tutor nuevo@test.com'), 'Carlos');
    await user.type(screen.getByLabelText('Apellidos del tutor nuevo@test.com'), 'Ramirez');
    await user.type(screen.getByLabelText('Número de identificación del tutor nuevo@test.com'), '555');
    await user.type(screen.getByLabelText('Teléfono del tutor nuevo@test.com'), '3009998888');

    const checklist = screen.getByTestId('checklist-vincular-tutor-nuevo@test.com');
    await user.click(within(checklist).getByLabelText(/Lucia Rios/));

    await user.click(screen.getByRole('button', { name: /Vincular a 1 estudiante/i }));

    expect(vincularTutorAEstudiantesMock).toHaveBeenCalledWith(['est-9'], {
      nombres: 'Carlos',
      apellidos: 'Ramirez',
      numeroIdentificacion: '555',
      telefono: '3009998888',
      correo: 'nuevo@test.com'
    });
  });

  it('un tutor con >=1 estudiante vinculado no pide identidad, solo el checklist, y excluye al ya vinculado', async () => {
    const user = userEvent.setup();
    useEstudiantesMock.mockReturnValue({ estudiantes: buildEstudiantesConTutorCompartido(), cargarEstudiantes });
    listInvitationsMock.mockResolvedValue([]);
    vincularTutorAEstudiantesMock.mockResolvedValue(undefined);

    render(<InvitacionesView />);

    expect(await screen.findByText('ana@test.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Agregar estudiante/i }));

    expect(screen.queryByLabelText(/Nombres del tutor/)).not.toBeInTheDocument();

    const checklist = screen.getByTestId('checklist-vincular-tutor-ana@test.com');
    expect(within(checklist).getByLabelText(/Pedro Diaz/)).toBeInTheDocument();
    expect(within(checklist).queryByLabelText(/Juan Pérez/)).not.toBeInTheDocument();
    expect(within(checklist).queryByLabelText(/Maria Lopez/)).not.toBeInTheDocument();

    await user.click(within(checklist).getByLabelText(/Pedro Diaz/));
    await user.click(screen.getByRole('button', { name: /Vincular a 1 estudiante/i }));

    expect(vincularTutorAEstudiantesMock).toHaveBeenCalledWith(['est-3'], tutorAna);
  });

  it('clic en "✕" de un chip vinculado llama a desvincularTutorDeEstudiante', async () => {
    const user = userEvent.setup();
    useEstudiantesMock.mockReturnValue({ estudiantes: buildEstudiantesConTutorCompartido(), cargarEstudiantes });
    listInvitationsMock.mockResolvedValue([]);
    desvincularTutorDeEstudianteMock.mockResolvedValue(undefined);

    render(<InvitacionesView />);

    await screen.findByText('ana@test.com');

    await user.click(screen.getByLabelText('Quitar Juan Pérez'));

    expect(desvincularTutorDeEstudianteMock).toHaveBeenCalledWith('est-1');
  });
});
