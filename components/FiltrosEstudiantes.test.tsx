import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FiltrosEstudiantes from './FiltrosEstudiantes';
import { EstadoPago, GradoTKD, GrupoEdad } from '../tipos';

describe('FiltrosEstudiantes', () => {
  const props = {
    filtroNombre: '',
    setFiltroNombre: jest.fn(),
    filtroGrupo: 'todos' as const,
    setFiltroGrupo: jest.fn(),
    filtroEstado: 'todos' as const,
    setFiltroEstado: jest.fn(),
    filtroGrado: 'todos' as const,
    setFiltroGrado: jest.fn(),
    filtroSede: 'todos',
    setFiltroSede: jest.fn(),
    sedes: [{ id: 'norte', nombre: 'Sede Norte' }, { id: 'sur', nombre: 'Sede Sur' }] as any,
    // Fix 2026-07-21 (`npm run typecheck`): faltaban `onLimpiar` y `filtrosActivos`, props
    // OBLIGATORIAS de FiltrosEstudiantes que se agregaron al componente y nunca al fixture.
    // Los 6 tests venian renderizando el componente con ambas en `undefined`, o sea que la
    // funcion de limpiar filtros jamas se ejercio en ninguna prueba.
    onLimpiar: jest.fn(),
    filtrosActivos: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('renderiza valores y todas las opciones disponibles', () => {
    render(<FiltrosEstudiantes {...props} />);

    expect(screen.getByPlaceholderText('Buscar por nombre...')).toHaveValue('');
    Object.values(GrupoEdad).forEach(grupo => expect(screen.getByRole('option', { name: grupo })).toBeInTheDocument());
    Object.values(EstadoPago).forEach(estado => expect(screen.getByRole('option', { name: estado })).toBeInTheDocument());
    Object.values(GradoTKD).forEach(grado => expect(screen.getByRole('option', { name: grado })).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Sede Norte' })).toBeInTheDocument();
  });

  it('informa cada valor escrito en la búsqueda', async () => {
    const user = userEvent.setup();
    render(<FiltrosEstudiantes {...props} />);

    await user.type(screen.getByPlaceholderText('Buscar por nombre...'), 'Ana');

    expect(props.setFiltroNombre).toHaveBeenNthCalledWith(1, 'A');
    expect(props.setFiltroNombre).toHaveBeenLastCalledWith('a');
  });

  it('informa el grupo seleccionado', async () => {
    const user = userEvent.setup();
    render(<FiltrosEstudiantes {...props} />);

    await user.selectOptions(screen.getAllByRole('combobox')[0], GrupoEdad.Cadetes);

    expect(props.setFiltroGrupo).toHaveBeenCalledWith(GrupoEdad.Cadetes);
  });

  it('informa el estado de pago seleccionado', async () => {
    const user = userEvent.setup();
    render(<FiltrosEstudiantes {...props} />);

    await user.selectOptions(screen.getByLabelText('Estado de pago'), EstadoPago.Vencido);

    expect(props.setFiltroEstado).toHaveBeenCalledWith(EstadoPago.Vencido);
  });

  it('informa el grado seleccionado', async () => {
    const user = userEvent.setup();
    render(<FiltrosEstudiantes {...props} />);
    await user.selectOptions(screen.getByLabelText('Grado'), GradoTKD.Verde);
    expect(props.setFiltroGrado).toHaveBeenCalledWith(GradoTKD.Verde);
  });

  it('informa la sede seleccionada', async () => {
    const user = userEvent.setup();
    render(<FiltrosEstudiantes {...props} />);
    await user.selectOptions(screen.getByLabelText('Sede'), 'sur');
    expect(props.setFiltroSede).toHaveBeenCalledWith('sur');
  });
});
