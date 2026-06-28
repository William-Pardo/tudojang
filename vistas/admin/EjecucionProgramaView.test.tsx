import React from 'react';
import { render, screen } from '@testing-library/react';
import EjecucionProgramaView from './EjecucionProgramaView';

describe('EjecucionProgramaView', () => {
  it('muestra estado del ciclo, posicion actual y objetivos completados', () => {
    render(<EjecucionProgramaView />);

    expect(screen.getByRole('heading', { name: /ejecucion de programa/i })).toBeInTheDocument();
    expect(screen.getByText(/programa cinturón blanco/i)).toBeInTheDocument();
    expect(screen.getByText(/grupo infantil/i)).toBeInTheDocument();
    expect(screen.getByText(/unidad actual: fundamentos/i)).toBeInTheDocument();
    expect(screen.getByText(/objetivo actual: patada frontal/i)).toBeInTheDocument();
    expect(screen.getByText(/objetivos completados: 1\/3/i)).toBeInTheDocument();
  });

  it('mantiene ritmos independientes entre dos grupos', () => {
    render(<EjecucionProgramaView />);

    const infantil = screen.getByTestId('ejecucion-grupo-infantil');
    const cadetes = screen.getByTestId('ejecucion-grupo-cadetes');

    expect(infantil).toHaveTextContent(/objetivo actual: patada frontal/i);
    expect(infantil).toHaveTextContent(/objetivos completados: 1\/3/i);

    expect(cadetes).toHaveTextContent(/objetivo actual: desplazamiento basico/i);
    expect(cadetes).toHaveTextContent(/objetivos completados: 2\/3/i);
  });
});
