import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AsignacionesView from './AsignacionesView';

describe('AsignacionesView', () => {
  it('renderiza formulario de publicacion de asignaciones academicas', () => {
    render(<AsignacionesView />);

    expect(screen.getByRole('heading', { name: /asignaciones academicas/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/recurso aprobado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/destinatario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha de apertura/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/momento pedagogico/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publicar asignacion/i })).toBeInTheDocument();
  });

  it('publica asignacion para grupo usando recurso aprobado', async () => {
    const user = userEvent.setup();
    render(<AsignacionesView />);

    await user.selectOptions(screen.getByLabelText(/recurso aprobado/i), 'recurso-pdf');
    await user.selectOptions(screen.getByLabelText(/destinatario/i), 'grupo');
    await user.type(screen.getByLabelText(/grupo objetivo/i), 'Infantil');
    await user.selectOptions(screen.getByLabelText(/momento pedagogico/i), 'preparacion');
    await user.type(screen.getByLabelText(/fecha de cierre/i), '2026-07-15');
    await user.click(screen.getByRole('button', { name: /publicar asignacion/i }));

    expect(screen.getByText(/asignacion publicada/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /fundamentos tecnicos/i })).toBeInTheDocument();
    expect(screen.getByText(/grupo: infantil/i)).toBeInTheDocument();
  });

  it('publica asignacion para grados especificos', async () => {
    const user = userEvent.setup();
    render(<AsignacionesView />);

    await user.selectOptions(screen.getByLabelText(/destinatario/i), 'grado');
    await user.type(screen.getByLabelText(/grupo objetivo/i), 'Precadetes');
    await user.type(screen.getByLabelText(/grados objetivo/i), 'Blanco, Amarillo');
    await user.click(screen.getByRole('button', { name: /publicar asignacion/i }));

    expect(screen.getByText(/grado: precadetes/i)).toBeInTheDocument();
    expect(screen.getByText(/blanco, amarillo/i)).toBeInTheDocument();
  });
});
