import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import InvitacionesView from './InvitacionesView';

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

jest.mock('../../servicios/academico/invitacionService', () => ({
  createInvitation: jest.fn(),
  listInvitations: jest.fn(() => Promise.resolve([])),
  resendInvitation: jest.fn()
}));

describe('InvitacionesView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza la vista de accesos academicos correctamente', async () => {
    render(<InvitacionesView />);

    expect(screen.getByText('Cuentas Externas')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol académico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar invitación/i })).toBeInTheDocument();
    expect(await screen.findByText('No hay invitaciones enviadas.')).toBeInTheDocument();
  });
});
