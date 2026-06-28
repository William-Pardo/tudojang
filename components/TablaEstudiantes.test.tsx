import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TablaEstudiantes from './TablaEstudiantes';
import { EstadoPago, GradoTKD, GrupoEdad, type Estudiante } from '../tipos';

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

jest.mock('./FilaEstudiante', () => ({
  FilaEstudiante: (props: any) => {
    const contenido = (
      <>
      <span>{props.estudiante.nombres}</span>
      <button onClick={() => props.onEditar(props.estudiante)}>Editar {props.estudiante.id}</button>
      <button onClick={() => props.onEliminar(props.estudiante)}>Eliminar {props.estudiante.id}</button>
      <button onClick={() => props.onVerFirma(`firma-${props.estudiante.id}`, props.estudiante.tutor)}>Ver Firma {props.estudiante.id}</button>
      <button onClick={() => props.onCompartirLink('firma', props.estudiante.id)}>Compartir {props.estudiante.id}</button>
      </>
    );
    return props.isCard
      ? <div data-testid={`fila-card-${props.estudiante.id}`}>{contenido}</div>
      : <tr data-testid={`fila-table-${props.estudiante.id}`}><td>{contenido}</td></tr>;
  },
}));

const crearEstudiante = (id: string, nombres: string): Estudiante => ({
  id,
  tenantId: 'tenant-1',
  nombres,
  apellidos: 'Prueba',
  numeroIdentificacion: id,
  fechaNacimiento: '2010-01-01',
  grado: GradoTKD.Blanco,
  grupo: GrupoEdad.Precadetes,
  horasAcumuladasGrado: 0,
  sedeId: 'sede-1',
  fechaIngreso: '2024-01-01',
  estadoPago: EstadoPago.AlDia,
  saldoDeudor: 0,
  historialPagos: [],
  consentimientoInformado: false,
  contratoServiciosFirmado: false,
  consentimientoImagenFirmado: false,
  consentimientoFotosVideos: false,
  carnetGenerado: false,
});

describe('TablaEstudiantes', () => {
  const callbacks = {
    onEditar: jest.fn(),
    onEliminar: jest.fn(),
    onVerFirma: jest.fn(),
    onCompartirLink: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renderiza encabezados y ambas variantes por cada estudiante', () => {
    const estudiantes = [
      crearEstudiante('1', 'Ana'),
      crearEstudiante('2', 'Luis'),
      crearEstudiante('3', 'Marta'),
    ];
    render(<TablaEstudiantes estudiantes={estudiantes} {...callbacks} />);

    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Estado de Pago')).toBeInTheDocument();
    estudiantes.forEach(({ id, nombres }) => {
      expect(screen.getByTestId(`fila-table-${id}`)).toHaveTextContent(nombres);
      expect(screen.getByTestId(`fila-card-${id}`)).toHaveTextContent(nombres);
    });
  });

  it('renderiza las vistas vacías sin filas', () => {
    render(<TablaEstudiantes estudiantes={[]} {...callbacks} />);
    expect(screen.queryByTestId(/fila-/)).not.toBeInTheDocument();
  });

  it('propaga Editar, Eliminar, Ver Firma y Compartir desde una fila', async () => {
    const user = userEvent.setup();
    const estudiante = crearEstudiante('1', 'Ana');
    render(<TablaEstudiantes estudiantes={[estudiante]} {...callbacks} />);

    const fila = screen.getByTestId('fila-table-1');
    await user.click(within(fila).getByText('Editar 1'));
    await user.click(within(fila).getByText('Eliminar 1'));
    await user.click(within(fila).getByText('Ver Firma 1'));
    await user.click(within(fila).getByText('Compartir 1'));

    expect(callbacks.onEditar).toHaveBeenCalledWith(estudiante);
    expect(callbacks.onEliminar).toHaveBeenCalledWith(estudiante);
    expect(callbacks.onVerFirma).toHaveBeenCalledWith('firma-1', estudiante.tutor);
    expect(callbacks.onCompartirLink).toHaveBeenCalledWith('firma', '1');
  });
});
