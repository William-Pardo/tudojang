import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AportarRecursoView from './AportarRecursoView';

describe('AportarRecursoView', () => {
  it('permite al maestro proponer un archivo de Drive y lo deja pendiente de revision', async () => {
    const user = userEvent.setup();
    render(<AportarRecursoView />);

    expect(screen.getByRole('heading', { name: /aportar recurso/i })).toBeInTheDocument();
    expect(screen.getAllByText(/selecciona un archivo de drive/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /proponer patada frontal.mp4/i }));

    expect(await screen.findByText(/recurso propuesto/i)).toBeInTheDocument();
    expect(screen.getAllByText(/patada frontal.mp4/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/estado: pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/quedara disponible para revision del admin/i)).toBeInTheDocument();
  });
});
