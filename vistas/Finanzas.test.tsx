import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VistaFinanzas from './Finanzas';
import { RolUsuario, TipoMovimiento } from '../tipos';
import { enviarNotificacion } from '../servicios/api';

const cargarMovimientos = jest.fn(), agregarMovimiento = jest.fn(), actualizarMovimiento = jest.fn(), eliminarMovimiento = jest.fn();
const mostrarNotificacion = jest.fn();
let mockMovimientos: any[] = [];
let mockCargando = false;
let mockUsuario: any = { rol: RolUsuario.Admin };
let mockEstudiantes: any[] = [];

jest.mock('../context/DataContext', () => ({
  useFinanzas: () => ({ movimientos: mockMovimientos, cargando: mockCargando, cargarMovimientos, agregarMovimiento, actualizarMovimiento, eliminarMovimiento }),
  useSedes: () => ({ sedesVisibles: [{ id: 's1', nombre: 'Norte' }] }),
  useEstudiantes: () => ({ estudiantes: mockEstudiantes }),
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ usuario: mockUsuario }) }));
jest.mock('../context/NotificacionContext', () => ({ useNotificacion: () => ({ mostrarNotificacion }) }));
jest.mock('../servicios/api', () => ({ enviarNotificacion: jest.fn() }));
jest.mock('../components/Loader', () => (props: any) => <div>{props.texto}</div>);
jest.mock('../components/EmptyState', () => (props: any) => <div>{props.titulo}</div>);
jest.mock('../components/Finanzas/InformeVisualEjecutivo', () => (props: any) => <div>Informe {props.movimientos.length}-{props.estudiantes.length}</div>);
jest.mock('../components/ModalRegistrarPago', () => (props: any) => <div data-testid="modal-pago">{props.estudiante.nombres}<button onClick={props.onCerrar}>Cerrar pago</button></div>);
jest.mock('../components/FormularioMovimiento', () => (props: any) => (
  <div data-testid="formulario">
    <span>{props.movimientoActual?.descripcion || 'nuevo'}</span>
    <button onClick={() => props.onGuardar({ descripcion: 'Nuevo', monto: 10 })}>Guardar nuevo</button>
    <button onClick={() => props.onGuardar({ id: 'm1', descripcion: 'Editado', monto: 20 })}>Guardar edición</button>
    <button onClick={props.onCerrar}>Cerrar formulario</button>
  </div>
));
jest.mock('../components/ModalConfirmacion', () => (props: any) => (
  <div data-testid="confirmacion">{props.mensaje}<button onClick={props.onConfirmar}>Confirmar eliminar</button><button onClick={props.onCerrar}>Cerrar eliminar</button></div>
));

const ingreso = { id: 'm1', fecha: '2026-01-10', descripcion: 'Mensualidad', categoria: 'Mensualidad', tipo: TipoMovimiento.Ingreso, monto: 100, sedeId: 's1' };
const egreso = { id: 'm2', fecha: '2026-02-10', descripcion: 'Arriendo', categoria: 'Operación', tipo: TipoMovimiento.Egreso, monto: 50, sedeId: 's2' };
const deudor = { id: 'e1', nombres: 'Ana', apellidos: 'P', saldoDeudor: 100, telefono: '300', tutor: { telefono: '301' } };

describe('VistaFinanzas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMovimientos = [ingreso, egreso];
    mockCargando = false;
    mockUsuario = { rol: RolUsuario.Admin };
    mockEstudiantes = [deudor, { id: 'e2', nombres: 'Luis', saldoDeudor: 0, telefono: '' }];
  });

  it('renderiza movimientos, saldos y carga por sede', async () => {
    const user = userEvent.setup();
    render(<VistaFinanzas />);
    expect(screen.getAllByText('Mensualidad')).toHaveLength(2);
    expect(screen.getByText('Arriendo')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox'), 's1');
    expect(cargarMovimientos).toHaveBeenLastCalledWith('s1');
    expect(screen.getAllByText('Mensualidad')).toHaveLength(2);
    expect(screen.queryByText('Arriendo')).not.toBeInTheDocument();
  });

  it('alterna Diario/Analíticas y sincroniza initialView', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<VistaFinanzas />);
    await user.click(screen.getByText('Analíticas'));
    expect(screen.getByText(/Informe 2-2/)).toBeInTheDocument();
    await user.click(screen.getByText('Diario'));
    expect(screen.getAllByText('Mensualidad')).toHaveLength(2);
    rerender(<VistaFinanzas initialView="analitica" />);
    expect(screen.getByText(/Informe/)).toBeInTheDocument();
  });

  it('alterna Resumen/Pagos/Deudores, abre y cierra modal de pago', async () => {
    const user = userEvent.setup();
    render(<VistaFinanzas />);
    await user.click(screen.getByText('pagos'));
    await user.click(screen.getByText(/Registrar pago: Ana/));
    expect(screen.getByTestId('modal-pago')).toHaveTextContent('Ana');
    await user.click(screen.getByText('Cerrar pago'));
    expect(screen.queryByTestId('modal-pago')).not.toBeInTheDocument();
    await user.click(screen.getByText('deudores'));
    expect(screen.getByText(/Ana -/)).toBeInTheDocument();
    await user.click(screen.getByText('resumen'));
  });

  it('notifica deuda con éxito, error y teléfono ausente', async () => {
    const user = userEvent.setup();
    (enviarNotificacion as jest.Mock).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('red'));
    const { rerender } = render(<VistaFinanzas />);
    await user.click(screen.getByText('deudores'));
    await user.click(screen.getByText('Notificar Deuda'));
    expect(enviarNotificacion).toHaveBeenCalledWith('WhatsApp', '301', expect.stringContaining('100'));
    expect(mostrarNotificacion).toHaveBeenCalledWith('Notificación de deuda enviada', 'success');
    await user.click(screen.getByText('Notificar Deuda'));
    expect(mostrarNotificacion).toHaveBeenCalledWith('No se pudo enviar la notificación', 'error');
    mockEstudiantes = [{ ...deudor, tutor: undefined, telefono: '' }];
    rerender(<VistaFinanzas />);
    await user.click(screen.getByText('Notificar Deuda'));
    expect(mostrarNotificacion).toHaveBeenCalledWith('El estudiante no tiene teléfono registrado', 'error');
  });

  it('filtra por fechas y muestra vacío', async () => {
    const user = userEvent.setup();
    render(<VistaFinanzas />);
    const fechas = screen.getAllByDisplayValue('');
    await user.type(fechas[0], '2026-02-01');
    expect(screen.queryByText('Mensualidad')).not.toBeInTheDocument();
    await user.type(fechas[1], '2026-02-05');
    expect(screen.getByText('Sin registros financieros')).toBeInTheDocument();
  });

  it('crea y actualiza movimientos, incluyendo errores', async () => {
    const user = userEvent.setup();
    render(<VistaFinanzas />);
    await user.click(screen.getByText('Registrar'));
    await user.click(screen.getByText('Guardar nuevo'));
    expect(agregarMovimiento).toHaveBeenCalled();
    expect(mostrarNotificacion).toHaveBeenCalledWith('Movimiento registrado', 'success');
    await user.click(screen.getAllByRole('button').find(button => button.querySelector('svg'))!);
  });

  it('edita y elimina como admin, con éxito y error', async () => {
    const user = userEvent.setup();
    actualizarMovimiento.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error());
    eliminarMovimiento.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error());
    const { container } = render(<VistaFinanzas />);
    const filas = container.querySelectorAll('tbody tr');
    const botones = filas[0].querySelectorAll('button');
    await user.click(botones[0]);
    await user.click(screen.getByText('Guardar edición'));
    expect(actualizarMovimiento).toHaveBeenCalled();
    await user.click(botones[1]);
    await user.click(screen.getByText('Confirmar eliminar'));
    expect(eliminarMovimiento).toHaveBeenCalledWith('m1');
  });

  it('maneja errores de guardar/eliminar y cierres de modales', async () => {
    const user = userEvent.setup();
    agregarMovimiento.mockRejectedValueOnce(new Error('fallo'));
    eliminarMovimiento.mockRejectedValueOnce(new Error('fallo'));
    const { container } = render(<VistaFinanzas />);

    await user.click(screen.getByText('Registrar'));
    await user.click(screen.getByText('Guardar nuevo'));
    expect(mostrarNotificacion).toHaveBeenCalledWith('Error al procesar', 'error');
    await user.click(screen.getByText('Cerrar formulario'));
    expect(screen.queryByTestId('formulario')).not.toBeInTheDocument();

    const eliminar = container.querySelectorAll('tbody tr')[0].querySelectorAll('button')[1];
    await user.click(eliminar);
    await user.click(screen.getByText('Confirmar eliminar'));
    expect(mostrarNotificacion).toHaveBeenCalledWith('Error al eliminar', 'error');
    await user.click(screen.getByText('Cerrar eliminar'));
    expect(screen.queryByTestId('confirmacion')).not.toBeInTheDocument();
  });

  // Bug real (2026-09-04): un pago que supera la deuda deja saldoDeudor negativo (saldo a
  // favor, ver utils/finanzas.ts::calcularSaldoTrasPago) -- sin esta sección, el filtro de
  // "deudores" (saldoDeudor > 0) lo excluía por construcción y quedaba invisible en Tesorería.
  it('muestra la sección Saldo a Favor con el total correcto, excluyendo a los deudores', async () => {
    const user = userEvent.setup();
    const conCredito = { id: 'e3', nombres: 'Sofía', apellidos: 'R', saldoDeudor: -30000, telefono: '302' };
    mockEstudiantes = [deudor, conCredito, { id: 'e2', nombres: 'Luis', saldoDeudor: 0, telefono: '' }];
    render(<VistaFinanzas />);

    await user.click(screen.getByText('Saldo a Favor'));

    expect(screen.getByText('Sofía R')).toBeInTheDocument();
    expect(screen.queryByText('Ana P')).not.toBeInTheDocument(); // deudor, no tiene saldo a favor
    expect(screen.getByText(/Total:/)).toBeInTheDocument();
  });

  it('sin ningún estudiante con saldo a favor, muestra el estado vacío', async () => {
    const user = userEvent.setup();
    mockEstudiantes = [deudor];
    render(<VistaFinanzas />);

    await user.click(screen.getByText('Saldo a Favor'));

    expect(screen.getByText('Ningún estudiante tiene saldo a favor.')).toBeInTheDocument();
  });

  it('oculta eliminar a no admin, maneja loading y subview', () => {
    // Fix 2026-07-21 (`npm run typecheck`): RolUsuario.Instructor NO EXISTE (ver enum en
    // tipos.ts). Evaluaba a `undefined` -- el test pasaba por accidente, no por rol real.
    mockUsuario = { rol: RolUsuario.Maestro };
    const { container, rerender } = render(<VistaFinanzas isSubView />);
    expect(container.querySelectorAll('tbody tr')[0].querySelectorAll('button')).toHaveLength(1);
    mockCargando = true;
    mockMovimientos = [];
    rerender(<VistaFinanzas />);
    expect(screen.getByText('Cargando finanzas...')).toBeInTheDocument();
  });
});
