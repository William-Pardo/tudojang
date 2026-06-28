import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BibliotecaView from './BibliotecaView';

describe('BibliotecaView', () => {
  it('renderiza explorador de Drive y permite importar, clasificar y aprobar un recurso', async () => {
    const user = userEvent.setup();
    render(<BibliotecaView />);

    expect(screen.getByRole('heading', { name: /biblioteca academica/i })).toBeInTheDocument();
    expect(screen.getByText(/explorador de google drive/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Fundamentos tecnicos.pdf/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /importar fundamentos tecnicos.pdf/i }));

    expect(await screen.findByText(/estado: borrador/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/tipo de recurso/i), 'pdf');
    await user.clear(screen.getByLabelText(/disciplina/i));
    await user.type(screen.getByLabelText(/disciplina/i), 'Taekwondo');
    await user.selectOptions(screen.getByLabelText(/uso academico/i), 'estudio');
    await user.click(screen.getByRole('button', { name: /guardar clasificacion/i }));

    expect(await screen.findByText(/estado: pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/disciplina: taekwondo/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /aprobar recurso/i }));

    await waitFor(() => {
      expect(screen.getByText(/estado: aprobado/i)).toBeInTheDocument();
    });
  });
});
