import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilaEstudiante } from './FilaEstudiante';
import { EstadoPago, GradoTKD, GrupoEdad, RolUsuario, type Estudiante } from '../tipos';
import { anularUltimoPagoEfectivo } from '../servicios/pagosApi';

let mockUsuario: any = { id: 'admin-1', rol: RolUsuario.Admin };
const mockMostrarNotificacion = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: mockUsuario }),
}));

jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: mockMostrarNotificacion }),
}));

jest.mock('../servicios/pagosApi', () => ({
  anularUltimoPagoEfectivo: jest.fn(),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, layout, initial, animate, exit, ...props }: any) => <div {...props}>{children}</div>,
    tr: ({ children, layout, initial, animate, exit, ...props }: any) => <tr {...props}>{children}</tr>,
  },
}));

jest.mock('./ModalRegistrarPago', () => (props: any) => (
  props.abierto ? (
    <div data-testid="modal-pago">
      <button onClick={props.onPagoExitoso}>Pago exitoso</button>
      <button onClick={props.onCerrar}>Cerrar pago</button>
    </div>
  ) : null
));

jest.mock('./ModalConfirmacion', () => (props: any) => (
  props.abierto ? (
    <div data-testid="modal-confirmacion">
      <span>{props.titulo}</span>
      <span>{props.mensaje}</span>
      <span>{props.cargando ? 'cargando' : 'listo'}</span>
      <button onClick={props.onConfirmar}>Confirmar anulación</button>
      <button onClick={props.onCerrar}>Cerrar confirmación</button>
    </div>
  ) : null
));

jest.mock('./GeneradorQR', () => ({ estudiante }: any) => (
  <div data-testid="generador-qr">{estudiante.id}</div>
));

const anularMock = anularUltimoPagoEfectivo as jest.MockedFunction<typeof anularUltimoPagoEfectivo>;

const crearEstudiante = (overrides: Partial<Estudiante> = {}): Estudiante => ({
  id: 'est-1',
  tenantId: 'tenant-1',
  nombres: 'Ana',
  apellidos: 'García',
  numeroIdentificacion: '123456',
  fechaNacimiento: '2010-01-01',
  grado: GradoTKD.Amarillo,
  grupo: GrupoEdad.Precadetes,
  horasAcumuladasGrado: 10,
  sedeId: 'sede-1',
  fechaIngreso: '2024-01-01',
  estadoPago: EstadoPago.AlDia,
  saldoDeudor: 0,
  historialPagos: [],
  consentimientoInformado: true,
  contratoServiciosFirmado: true,
  consentimientoImagenFirmado: true,
  consentimientoFotosVideos: true,
  carnetGenerado: false,
  tutor: {
    nombreCompleto: 'Tutor Uno',
    numeroIdentificacion: '999',
    parentesco: 'Madre',
    telefono: '3000000000',
    correo: 'tutor@test.com',
    firmaDigital: 'firma-riesgos',
    firmaContratoDigital: 'firma-contrato',
    firmaImagenDigital: 'firma-imagen',
  },
  ...overrides,
});

const renderFila = (overrides: Partial<React.ComponentProps<typeof FilaEstudiante>> = {}) => {
  const props: React.ComponentProps<typeof FilaEstudiante> = {
    estudiante: crearEstudiante(),
    onEditar: jest.fn(),
    onEliminar: jest.fn(),
    onVerFirma: jest.fn(),
    onCompartirLink: jest.fn(),
    isCard: true,
    ...overrides,
  };
  const vista = props.isCard
    ? <FilaEstudiante {...props} />
    : <table><tbody><FilaEstudiante {...props} /></tbody></table>;
  return { ...render(vista), props };
};

describe('FilaEstudiante', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsuario = { id: 'admin-1', rol: RolUsuario.Admin };
  });

  it.each([true, false])('renderiza identidad, grupo, grado y badge de pago en vista isCard=%s', (isCard) => {
    const estudiante = crearEstudiante();
    const { container } = renderFila({ estudiante, isCard });

    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(screen.getByText(GrupoEdad.Precadetes)).toBeInTheDocument();
    expect(screen.getByText(GradoTKD.Amarillo)).toHaveClass('rounded-full');
    expect(screen.getByText(EstadoPago.AlDia)).toHaveClass('bg-green-100');
    if (!isCard) expect(container.querySelector('tr')).toBeInTheDocument();
  });

  it.each([
    [EstadoPago.AlDia, 'bg-green-100'],
    [EstadoPago.Pendiente, 'bg-yellow-100'],
    [EstadoPago.Vencido, 'bg-red-100'],
  ])('renderiza el badge %s con su estilo', (estado, clase) => {
    renderFila({ estudiante: crearEstudiante({ estadoPago: estado }) });
    expect(screen.getByText(estado)).toHaveClass(clase);
  });

  it('ejecuta Editar y Eliminar con el estudiante', async () => {
    const user = userEvent.setup();
    const { props } = renderFila();

    await user.click(screen.getByTitle('Editar'));
    await user.click(screen.getByTitle('Eliminar'));

    expect(props.onEditar).toHaveBeenCalledWith(props.estudiante);
    expect(props.onEliminar).toHaveBeenCalledWith(props.estudiante);
  });

  it('ejecuta Ver Firma para los tres documentos firmados', async () => {
    const user = userEvent.setup();
    const { props } = renderFila();

    await user.click(screen.getByTitle('Ver Contrato de Servicios Firmado'));
    await user.click(screen.getByTitle('Ver Consentimiento Informado (Riesgos) Firmado'));
    await user.click(screen.getByTitle('Ver Autorización de Manejo de Imagen Firmado'));

    expect(props.onVerFirma).toHaveBeenNthCalledWith(1, 'firma-contrato', props.estudiante.tutor);
    expect(props.onVerFirma).toHaveBeenNthCalledWith(2, 'firma-riesgos', props.estudiante.tutor);
    expect(props.onVerFirma).toHaveBeenNthCalledWith(3, 'firma-imagen', props.estudiante.tutor);
  });

  it('comparte enlaces cuando los documentos están pendientes o carecen de firma', async () => {
    const user = userEvent.setup();
    const estudiante = crearEstudiante({
      contratoServiciosFirmado: false,
      consentimientoInformado: true,
      consentimientoImagenFirmado: false,
      tutor: undefined,
    });
    const { props } = renderFila({ estudiante });

    await user.click(screen.getByTitle(/Enviar enlace de Contrato/));
    await user.click(screen.getByTitle(/Enviar enlace de Consentimiento/));
    await user.click(screen.getByTitle(/Enviar enlace de Autorización/));

    expect(props.onCompartirLink).toHaveBeenNthCalledWith(1, 'contrato', estudiante.id);
    expect(props.onCompartirLink).toHaveBeenNthCalledWith(2, 'firma', estudiante.id);
    expect(props.onCompartirLink).toHaveBeenNthCalledWith(3, 'imagen', estudiante.id);
  });

  it('abre y cierra los modales de pago y carnet, incluyendo cierre por fondo', async () => {
    const user = userEvent.setup();
    renderFila();

    await user.click(screen.getByTitle('Registrar Pago en Efectivo'));
    expect(screen.getByTestId('modal-pago')).toBeInTheDocument();
    await user.click(screen.getByText('Pago exitoso'));
    await user.click(screen.getByText('Cerrar pago'));
    expect(screen.queryByTestId('modal-pago')).not.toBeInTheDocument();

    await user.click(screen.getByTitle('Ver Carnet y QR'));
    expect(screen.getByTestId('generador-qr')).toHaveTextContent('est-1');
    fireEvent.click(screen.getByTestId('generador-qr'));
    expect(screen.getByTestId('generador-qr')).toBeInTheDocument();
    await user.click(screen.getByText('Cerrar'));
    expect(screen.queryByTestId('generador-qr')).not.toBeInTheDocument();

    await user.click(screen.getByTitle('Ver Carnet y QR'));
    fireEvent.click(screen.getByText('Carnet Digital').parentElement!.parentElement!);
    expect(screen.queryByTestId('generador-qr')).not.toBeInTheDocument();
  });

  it('oculta acciones administrativas para usuarios no administradores', () => {
    mockUsuario = { id: 'user-1', rol: RolUsuario.Instructor };
    renderFila();

    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Deshacer/)).not.toBeInTheDocument();
    expect(screen.getByTitle('Editar')).toBeInTheDocument();
  });

  it('permite cerrar la confirmación de anulación', async () => {
    const user = userEvent.setup();
    renderFila();

    await user.click(screen.getByTitle(/Deshacer/));
    expect(screen.getByTestId('modal-confirmacion')).toHaveTextContent('Ana');
    await user.click(screen.getByText('Cerrar confirmación'));
    expect(screen.queryByTestId('modal-confirmacion')).not.toBeInTheDocument();
  });

  it('notifica y cierra cuando la anulación es exitosa', async () => {
    const user = userEvent.setup();
    let resolver!: (value: any) => void;
    anularMock.mockReturnValue(new Promise(resolve => { resolver = resolve; }) as any);
    renderFila();

    await user.click(screen.getByTitle(/Deshacer/));
    await user.click(screen.getByText('Confirmar anulación'));

    expect(screen.getByTestId('modal-confirmacion')).toHaveTextContent('cargando');
    resolver({ exito: true, mensaje: 'ok' });
    await waitFor(() => expect(mockMostrarNotificacion).toHaveBeenCalledWith('Último pago anulado correctamente', 'success'));
    expect(anularMock).toHaveBeenCalledWith('est-1', 'admin-1');
    expect(screen.queryByTestId('modal-confirmacion')).not.toBeInTheDocument();
  });

  it.each([
    [{ exito: false, mensaje: 'No hay pagos' }, 'No hay pagos'],
    [{ exito: false }, 'Error al anular pago'],
  ])('notifica un resultado fallido sin cerrar la confirmación', async (resultado, mensaje) => {
    const user = userEvent.setup();
    anularMock.mockResolvedValue(resultado as any);
    renderFila();

    await user.click(screen.getByTitle(/Deshacer/));
    await user.click(screen.getByText('Confirmar anulación'));

    await waitFor(() => expect(mockMostrarNotificacion).toHaveBeenCalledWith(mensaje, 'error'));
    expect(screen.getByTestId('modal-confirmacion')).toBeInTheDocument();
  });

  it('captura excepciones al anular incluso sin usuario autenticado', async () => {
    const user = userEvent.setup();
    mockUsuario = { rol: RolUsuario.Admin };
    anularMock.mockRejectedValue(new Error('Fallo de red'));
    renderFila();

    await user.click(screen.getByTitle(/Deshacer/));
    await user.click(screen.getByText('Confirmar anulación'));

    await waitFor(() => expect(mockMostrarNotificacion).toHaveBeenCalledWith('Fallo de red', 'error'));
    expect(anularMock).toHaveBeenCalledWith('est-1', undefined);
  });
});
