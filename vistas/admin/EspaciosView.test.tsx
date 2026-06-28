import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EspaciosView from './EspaciosView';

describe('EspaciosView', () => {
  it('renderiza gestion de espacios por sede', () => {
    render(<EspaciosView />);

    expect(screen.getByRole('heading', { name: /espacios fisicos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre del espacio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/capacidad/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear espacio/i })).toBeInTheDocument();
  });

  it('crea un espacio y muestra disponibilidad sin conflicto', async () => {
    const user = userEvent.setup();
    render(<EspaciosView />);

    await user.clear(screen.getByLabelText(/nombre del espacio/i));
    await user.type(screen.getByLabelText(/nombre del espacio/i), 'Tatami auxiliar');
    await user.clear(screen.getByLabelText(/capacidad/i));
    await user.type(screen.getByLabelText(/capacidad/i), '15');
    await user.click(screen.getByRole('button', { name: /crear espacio/i }));

    expect(screen.getByText('Tatami auxiliar')).toBeInTheDocument();
    expect(screen.getByText(/capacidad: 15/i)).toBeInTheDocument();
    expect(screen.getByText(/disponible/i)).toBeInTheDocument();
  });

  it('muestra conflicto visual cuando hay reserva superpuesta', async () => {
    const user = userEvent.setup();
    render(<EspaciosView />);

    await user.click(screen.getByRole('button', { name: /probar horario con conflicto/i }));

    expect(screen.getByText(/conflicto detectado/i)).toBeInTheDocument();
    expect(screen.getByText(/jornada existente/i)).toBeInTheDocument();
  });
});
