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

  it('renderiza la vista de invitaciones correctamente', async () => {
    render(<InvitacionesView />);
    expect(screen.getByText('Invitaciones Académicas')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo Electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol Académico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar Invitación/i })).toBeInTheDocument();
    
    // Esperar a que se complete la carga asíncrona inicial
    expect(await screen.findByText('No hay invitaciones enviadas.')).toBeInTheDocument();
  });
});
