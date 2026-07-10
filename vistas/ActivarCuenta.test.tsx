import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VistaActivarCuenta from './ActivarCuenta';
import { acceptInvitation } from '../servicios/academico/invitacionService';

jest.mock('../servicios/academico/invitacionService', () => ({
  acceptInvitation: jest.fn(),
}));

describe('VistaActivarCuenta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('activa cuenta con tenant, invitacion, token y contrasena', async () => {
    (acceptInvitation as jest.Mock).mockResolvedValueOnce({ ok: true, uid: 'uid-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/activar-cuenta?tenantId=tenant-1&invitacionId=inv-1&token=tok-1']}>
        <Routes>
          <Route path="/activar-cuenta" element={<VistaActivarCuenta />} />
          <Route path="/login" element={<div>Login destino</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/^contraseña$/i), 'ClaveSegura123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'ClaveSegura123');
    await user.click(screen.getByRole('button', { name: /activar cuenta/i }));

    expect(acceptInvitation).toHaveBeenCalledWith('tenant-1', 'inv-1', 'tok-1', 'ClaveSegura123');
    expect(await screen.findByText(/cuenta activada correctamente/i)).toBeInTheDocument();
  });

  it('bloquea envio si el enlace esta incompleto', () => {
    render(
      <MemoryRouter initialEntries={['/activar-cuenta?tenantId=tenant-1']}>
        <Routes>
          <Route path="/activar-cuenta" element={<VistaActivarCuenta />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /activar cuenta/i })).toBeDisabled();
    expect(screen.getByText(/enlace de activación está incompleto/i)).toBeInTheDocument();
  });
});
