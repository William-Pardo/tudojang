import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JornadasView from './JornadasView';

describe('JornadasView', () => {
  it('renderiza agenda de jornadas para maestro', () => {
    render(<JornadasView />);

    expect(screen.getByRole('heading', { name: /plan y cierre de clase/i })).toBeInTheDocument();
    expect(screen.getByText(/grupo infantil/i)).toBeInTheDocument();
    expect(screen.getByText(/estado: borrador/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar jornada/i })).toBeInTheDocument();
  });

  it('se puede renderizar embebida sin duplicar el encabezado de Centro de Estudios', () => {
    render(<JornadasView embedded />);

    expect(screen.queryByRole('heading', { name: /plan y cierre de clase/i })).not.toBeInTheDocument();
    expect(screen.getByText(/grupo infantil/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar jornada/i })).toBeInTheDocument();
  });

  it('permite confirmar, iniciar, registrar asistencia y cerrar jornada', async () => {
    const user = userEvent.setup();
    render(<JornadasView />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));
    expect(screen.getByText(/estado: confirmada/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /iniciar jornada/i }));
    expect(screen.getByText(/estado: en curso/i)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /asistencia registrada/i }));
    await user.click(screen.getByRole('checkbox', { name: /objetivo saludo impartido/i }));
    await user.click(screen.getByRole('button', { name: /cerrar jornada/i }));

    expect(screen.getByText(/estado: cerrada/i)).toBeInTheDocument();
    expect(screen.getByText(/programa avanzo a: patada/i)).toBeInTheDocument();
    expect(screen.getByText(/refuerzos publicados: obj-patada/i)).toBeInTheDocument();
  });

  it('muestra error si intenta cerrar sin asistencia', async () => {
    const user = userEvent.setup();
    render(<JornadasView />);

    await user.click(screen.getByRole('button', { name: /confirmar jornada/i }));
    await user.click(screen.getByRole('button', { name: /iniciar jornada/i }));
    await user.click(screen.getByRole('checkbox', { name: /objetivo saludo impartido/i }));
    await user.click(screen.getByRole('button', { name: /cerrar jornada/i }));

    expect(screen.getByText(/no se puede cerrar una jornada sin asistencia registrada/i)).toBeInTheDocument();
  });
});
