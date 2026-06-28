import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProgramasView from './ProgramasView';

describe('ProgramasView', () => {
  it('renderiza gestor de programas academicos con formulario inicial', () => {
    render(<ProgramasView />);

    expect(screen.getByRole('heading', { name: /programas academicos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre del programa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripcion/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear programa/i })).toBeInTheDocument();
  });

  it('crea, publica y asigna un programa a un grupo', async () => {
    const user = userEvent.setup();
    render(<ProgramasView />);

    await user.clear(screen.getByLabelText(/nombre del programa/i));
    await user.type(screen.getByLabelText(/nombre del programa/i), 'Programa infantil base');
    await user.clear(screen.getByLabelText(/descripcion/i));
    await user.type(screen.getByLabelText(/descripcion/i), 'Ruta inicial para infantil');
    await user.click(screen.getByRole('button', { name: /crear programa/i }));

    expect(screen.getByText('Programa infantil base')).toBeInTheDocument();
    expect(screen.getByText(/borrador/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /publicar programa/i }));

    expect(screen.getByText(/publicado/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /asignar a grupo infantil/i }));

    expect(screen.getByText('Grupo infantil')).toBeInTheDocument();
    expect(screen.getByText(/objetivo actual: saludo y postura/i)).toBeInTheDocument();
  });
});
