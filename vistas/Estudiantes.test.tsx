import React, { useMemo, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VistaEstudiantes } from './Estudiantes';
import { EstadoPago, GradoTKD, GrupoEdad, RolUsuario, type Estudiante } from '../tipos';
import { obtenerMisionActivaTenant } from '../servicios/censoApi';

let mockUsuario: any = { id: 'admin-1', tenantId: 'tenant-1', sedeId: 'sede-1', rol: RolUsuario.Admin, email: 'admin@test.com' };
let mockEscenario: any = {};
const mockMostrarNotificacion = jest.fn();
const mockCargarEstudiantes = jest.fn();
const mockExportarCSV = jest.fn();
const mockGenerar = jest.fn();
const mockRetirarEstudiante = jest.fn();
const mockReactivarEstudiante = jest.fn();

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ usuario: mockUsuario }) }));
jest.mock('../context/NotificacionContext', () => ({ useNotificacion: () => ({ mostrarNotificacion: mockMostrarNotificacion }) }));
jest.mock('../servicios/censoApi', () => ({ obtenerMisionActivaTenant: jest.fn() }));
jest.mock('../utils/userSeeder', () => ({ generarEstudiantesFicticios: (...args: any[]) => mockGenerar(...args) }));
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, initial, animate, exit, ...props }: any) => <div {...props}>{children}</div> },
}));

const crearEstudiante = (
  id: string,
  nombres: string,
  sedeId: string,
  grupo: GrupoEdad,
  grado: GradoTKD,
  estadoPago: EstadoPago,
): Estudiante => ({
  // Fix 2026-07-21 (`npm run typecheck`): faltaban `telefono` y `correo`, obligatorios en Estudiante.
  id, tenantId: 'tenant-1', nombres, apellidos: `Apellido ${id}`, numeroIdentificacion: `DOC-${id}`,
  telefono: '3000000000', correo: `${id}@test.com`,
  fechaNacimiento: '2010-01-01', grado, grupo, horasAcumuladasGrado: 0, sedeId,
  fechaIngreso: '2024-01-01', estadoPago, saldoDeudor: 0, historialPagos: [],
  consentimientoInformado: false, contratoServiciosFirmado: false, consentimientoImagenFirmado: false,
  consentimientoFotosVideos: false, carnetGenerado: false,
  estadoMatricula: 'activo', // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
});

const estudiantesBase = [
  crearEstudiante('1', 'Ana', 'norte', GrupoEdad.Infantil, GradoTKD.Blanco, EstadoPago.AlDia),
  crearEstudiante('2', 'Bruno', 'sur', GrupoEdad.Precadetes, GradoTKD.Amarillo, EstadoPago.Pendiente),
  crearEstudiante('3', 'Carla', 'norte', GrupoEdad.Cadetes, GradoTKD.Verde, EstadoPago.Vencido),
  crearEstudiante('4', 'Diego', 'sur', GrupoEdad.Adultos, GradoTKD.Azul, EstadoPago.AlDia),
  crearEstudiante('5', 'Elena', 'centro', GrupoEdad.Cadetes, GradoTKD.Rojo, EstadoPago.Pendiente),
];

jest.mock('../hooks/useGestionEstudiantes', () => ({
  useGestionEstudiantes: () => {
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroGrupo, setFiltroGrupo] = useState<any>('todos');
    const [filtroEstado, setFiltroEstado] = useState<any>('todos');
    const [filtroSede, setFiltroSede] = useState<any>('todos');
    const [filtroGrado, setFiltroGrado] = useState<any>('todos');
    const estudiantes = mockEscenario.estudiantes ?? estudiantesBase;
    const estudiantesFiltrados = useMemo(() => estudiantes.filter((e: Estudiante) =>
      e.nombres.toLowerCase().includes(filtroNombre.toLowerCase()) &&
      (filtroGrupo === 'todos' || e.grupo === filtroGrupo) &&
      (filtroEstado === 'todos' || e.estadoPago === filtroEstado) &&
      (filtroGrado === 'todos' || e.grado === filtroGrado) &&
      (filtroSede === 'todos' || e.sedeId === filtroSede)
    ), [estudiantes, filtroNombre, filtroGrupo, filtroEstado, filtroGrado, filtroSede]);
    return {
      estudiantes, estudiantesFiltrados,
      estudiantesPaginados: estudiantesFiltrados.slice(0, mockEscenario.pageSize ?? estudiantesFiltrados.length),
      cargando: !!mockEscenario.cargando, error: mockEscenario.error ?? null,
      cargarEstudiantes: mockCargarEstudiantes,
      filtroNombre, setFiltroNombre, filtroGrupo, setFiltroGrupo, filtroEstado, setFiltroEstado,
      filtroSede, setFiltroSede,
      filtroGrado, setFiltroGrado,
      sedesVisibles: [{ id: 'norte', nombre: 'Norte' }, { id: 'sur', nombre: 'Sur' }],
      modalFormularioAbierto: !!mockEscenario.modalFormularioAbierto,
      estudianteEnEdicion: mockEscenario.estudianteEnEdicion ?? null,
      abrirFormulario: mockEscenario.abrirFormulario ?? jest.fn(() => { mockEscenario.modalFormularioAbierto = true; }),
      cerrarFormulario: jest.fn(), guardarEstudiante: jest.fn(), cargandoAccion: !!mockEscenario.cargandoAccion,
      modalConfirmacionAbierto: !!mockEscenario.modalConfirmacionAbierto,
      estudianteAEliminar: mockEscenario.estudianteAEliminar ?? null,
      abrirConfirmacionEliminar: jest.fn(), cerrarConfirmacion: jest.fn(), confirmarEliminacion: jest.fn(),
      modalFirmaAbierto: !!mockEscenario.modalFirmaAbierto, firmaParaVer: mockEscenario.firmaParaVer ?? null,
      abrirModalFirma: jest.fn(), cerrarModalFirma: jest.fn(), handleShareLink: jest.fn(),
      currentPage: mockEscenario.currentPage ?? 1, totalPages: mockEscenario.totalPages ?? 1,
      startIndex: mockEscenario.startIndex ?? 0, endIndex: mockEscenario.endIndex ?? estudiantesFiltrados.length,
      goToNextPage: jest.fn(), goToPreviousPage: jest.fn(), exportarCSV: mockExportarCSV,
      configClub: mockEscenario.configClub ?? { tenantId: 'tenant-1' },
      retirarEstudiante: mockRetirarEstudiante,
      reactivarEstudiante: mockReactivarEstudiante,
    };
  },
}));

jest.mock('../components/FiltrosEstudiantes', () => (props: any) => (
  <div>
    <input aria-label="buscar" value={props.filtroNombre} onChange={e => props.setFiltroNombre(e.target.value)} />
    <select aria-label="grupo" value={props.filtroGrupo} onChange={e => props.setFiltroGrupo(e.target.value)}>
      <option value="todos">todos</option><option value={GrupoEdad.Cadetes}>Cadetes</option>
    </select>
    <select aria-label="estado" value={props.filtroEstado} onChange={e => props.setFiltroEstado(e.target.value)}>
      <option value="todos">todos</option><option value={EstadoPago.Pendiente}>Pendiente</option>
    </select>
    <select aria-label="sede" onChange={e => (props.setFiltroSede?.(e.target.value))}>
      <option value="todos">todos</option><option value="norte">norte</option>
    </select>
    <select aria-label="grado" value={props.filtroGrado} onChange={e => props.setFiltroGrado(e.target.value)}>
      <option value="todos">todos</option><option value={GradoTKD.Rojo}>Rojo</option>
    </select>
  </div>
));

jest.mock('../components/TablaEstudiantes', () => (props: any) => (
  <div data-testid="tabla">
    {props.estudiantes.map((e: Estudiante) => (
      <div key={e.id} data-testid={`est-${e.id}`}>
        {e.nombres} ({e.estadoMatricula})
        {e.estadoMatricula === 'retirado' ? (
          <button onClick={() => props.onReactivar(e)}>Reactivar {e.nombres}</button>
        ) : (
          <button onClick={() => props.onRetirar(e)}>Retirar {e.nombres}</button>
        )}
      </div>
    ))}
    {props.estudiantes[0] && <>
      <button onClick={() => props.onEditar(props.estudiantes[0])}>Editar fila</button>
      <button onClick={() => props.onEliminar(props.estudiantes[0])}>Eliminar fila</button>
      <button onClick={() => props.onVerFirma('firma', { nombreCompleto: 'Tutor' })}>Ver firma fila</button>
      <button onClick={() => props.onCompartirLink('firma', props.estudiantes[0].id)}>Compartir fila</button>
      <button onClick={() => mockEscenario.registrarPago = true}>Registrar Pago</button>
      {mockEscenario.registrarPago && <div>Modal Registrar Pago</div>}
    </>}
  </div>
));

jest.mock('../components/FormularioEstudiante', () => (props: any) => <div data-testid="formulario"><button onClick={props.onCerrar}>Cerrar formulario</button><button onClick={() => props.onGuardar({})}>Guardar formulario</button></div>);
jest.mock('../components/ModalConfirmacion', () => (props: any) => <div data-testid="confirmacion">{props.mensaje}<button onClick={props.onCerrar}>Cerrar confirmación</button><button onClick={props.onConfirmar}>Confirmar</button></div>);
jest.mock('../components/ModalVerFirma', () => (props: any) => <div data-testid="firma">{props.firmaDigital}-{props.nombreTutor}<button onClick={props.onCerrar}>Cerrar firma</button></div>);
jest.mock('../components/ModalImportacionMasiva', () => (props: any) => <div data-testid="importar"><button onClick={props.onCerrar}>Cerrar importación</button><button onClick={props.onExito}>Importación exitosa</button></div>);
jest.mock('../components/skeletons/TablaEstudiantesSkeleton', () => ({ TablaEstudiantesSkeleton: () => <div>Cargando estudiantes</div> }));
jest.mock('../components/ErrorState', () => (props: any) => <div>{props.mensaje}<button onClick={props.onReintentar}>Reintentar</button></div>);
jest.mock('../components/EmptyState', () => (props: any) => <div><span>{props.titulo}</span>{props.children}</div>);
jest.mock('./GestionClase', () => () => <div>Vista Clase</div>);
jest.mock('./Carnetizacion', () => () => <div>Vista Carnets</div>);
jest.mock('./Certificaciones', () => () => <div>Vista Certificados</div>);
jest.mock('./MisionKicho', () => () => <div>Vista Kicho</div>);
jest.mock('../components/LogoDinamico', () => (props: any) => <span {...props}>Logo</span>);

const misionMock = obtenerMisionActivaTenant as jest.MockedFunction<typeof obtenerMisionActivaTenant>;

describe('VistaEstudiantes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEscenario = {};
    mockUsuario = { id: 'admin-1', tenantId: 'tenant-1', sedeId: 'sede-1', rol: RolUsuario.Admin, email: 'admin@test.com' };
    misionMock.mockResolvedValue(null);
  });

  it('inyecta cinco estudiantes y filtra por búsqueda, grupo, estado y sede', async () => {
    render(<VistaEstudiantes />);
    await waitFor(() => expect(misionMock).toHaveBeenCalledWith('tenant-1'));
    await waitFor(() => expect(screen.getAllByTestId(/est-/)).toHaveLength(5));

    fireEvent.change(screen.getByLabelText('buscar'), { target: { value: 'Carla' } });
    expect(screen.getByTestId('tabla')).toHaveTextContent('Carla');
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('buscar'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('grado'), { target: { value: GradoTKD.Rojo } });
    expect(screen.getAllByTestId(/est-/)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('grado'), { target: { value: 'todos' } });
    fireEvent.change(screen.getByLabelText('grupo'), { target: { value: GrupoEdad.Cadetes } });
    expect(screen.getAllByTestId(/est-/)).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('estado'), { target: { value: EstadoPago.Pendiente } });
    expect(screen.getAllByTestId(/est-/)).toHaveLength(1);
  });

  it('abre los flujos de formulario, registrar pago y ver firma', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<VistaEstudiantes />);
    await user.click(screen.getByText('Nuevo Alumno'));
    rerender(<VistaEstudiantes />);
    expect(screen.getByTestId('formulario')).toBeInTheDocument();
    await user.click(screen.getByText('Registrar Pago'));
    rerender(<VistaEstudiantes />);
    expect(screen.getByText('Modal Registrar Pago')).toBeInTheDocument();

    mockEscenario.modalFirmaAbierto = true;
    mockEscenario.firmaParaVer = { firma: 'firma-digital', tutor: 'Tutor Uno' };
    rerender(<VistaEstudiantes />);
    expect(screen.getByTestId('firma')).toHaveTextContent('firma-digital-Tutor Uno');
  });

  it.each([
    [{ cargando: true }, 'Cargando estudiantes'],
    [{ error: 'Red caída' }, 'Red caída'],
    [{ estudiantes: [] }, 'Aún no hay estudiantes'],
  ])('renderiza estados alternativos del directorio', (escenario, texto) => {
    mockEscenario = escenario;
    render(<VistaEstudiantes />);
    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  it('muestra estado sin resultados al aplicar un filtro imposible', async () => {
    const user = userEvent.setup();
    render(<VistaEstudiantes />);
    await user.type(screen.getByLabelText('buscar'), 'Inexistente');
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('abre importación desde estado vacío y ejecuta sus callbacks', async () => {
    const user = userEvent.setup();
    mockEscenario = { estudiantes: [] };
    const { rerender } = render(<VistaEstudiantes />);
    await user.click(screen.getByText('Agregar Uno a Uno'));
    await user.click(screen.getByText('Carga Masiva (CSV)'));
    expect(screen.getByTestId('importar')).toBeInTheDocument();
    await user.click(screen.getByText('Importación exitosa'));
    expect(mockCargarEstudiantes).toHaveBeenCalled();
    rerender(<VistaEstudiantes />);
  });

  it('abre y cierra importación desde el encabezado', async () => {
    const user = userEvent.setup();
    render(<VistaEstudiantes />);
    await user.click(screen.getByText('Importar CSV'));
    expect(screen.getByTestId('importar')).toBeInTheDocument();
    await user.click(screen.getByText('Cerrar importación'));
    expect(screen.queryByTestId('importar')).not.toBeInTheDocument();
  });

  it('renderiza confirmación, firma y formulario controlados por el hook', async () => {
    const user = userEvent.setup();
    mockEscenario = {
      modalFormularioAbierto: true,
      modalConfirmacionAbierto: true,
      estudianteAEliminar: estudiantesBase[0],
      modalFirmaAbierto: true,
      firmaParaVer: { firma: 'abc', tutor: 'Tutor' },
    };
    render(<VistaEstudiantes />);
    expect(screen.getByTestId('formulario')).toBeInTheDocument();
    expect(screen.getByTestId('confirmacion')).toHaveTextContent('Ana');
    expect(screen.getByTestId('firma')).toHaveTextContent('abc-Tutor');
    await user.click(screen.getByText('Guardar formulario'));
    await user.click(screen.getByText('Confirmar'));
  });

  it('navega por las sub-vistas y usa paginación y exportación', async () => {
    const user = userEvent.setup();
    mockEscenario = { totalPages: 3, currentPage: 2, startIndex: 1, endIndex: 3, pageSize: 2 };
    render(<VistaEstudiantes />);

    await user.click(screen.getByTitle('Exportar CSV'));
    expect(mockExportarCSV).toHaveBeenCalled();
    await user.click(screen.getByText('Anterior'));
    await user.click(screen.getByText('Siguiente'));
    await user.click(screen.getByTitle('Control de Asistencia'));
    expect(screen.getByText('Vista Clase')).toBeInTheDocument();
    await user.click(screen.getByTitle('Carnetización'));
    expect(screen.getByText('Vista Carnets')).toBeInTheDocument();
    await user.click(screen.getByTitle('Certificaciones'));
    expect(screen.getByText('Vista Certificados')).toBeInTheDocument();
    await user.click(screen.getByTitle('Misión KICHO'));
    expect(screen.getByText('Vista Kicho')).toBeInTheDocument();
  });

  it('muestra una misión activa, actualiza el contador y permite gestionarla', async () => {
    jest.useFakeTimers();
    misionMock.mockResolvedValue({ fechaExpiracion: new Date(Date.now() + 3_600_000).toISOString() } as any);
    render(<VistaEstudiantes />);
    await act(async () => {});
    expect(await screen.findByText('Protocolo de Onboarding Activo')).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByText(/restantes|EXPIRADA/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Gestionar Registro/));
    expect(screen.getByText('Vista Kicho')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('cubre misión expirada y vista inicial de tutor', async () => {
    jest.useFakeTimers();
    mockUsuario = { tenantId: 'tenant-1', rol: RolUsuario.Tutor };
    misionMock.mockResolvedValue({ fechaExpiracion: new Date(Date.now() - 1).toISOString() } as any);
    render(<VistaEstudiantes />);
    await act(async () => {});
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByText('Vista Clase')).toBeInTheDocument();
    expect(screen.queryByTitle('Directorio')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('ejecuta generación de datos ficticios con éxito y error', async () => {
    const user = userEvent.setup();
    mockUsuario.email = 'aliantlab@gmail.com';
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockGenerar.mockResolvedValueOnce(undefined);
    const { unmount } = render(<VistaEstudiantes />);
    await user.click(screen.getByText('Generar Data Test'));
    await waitFor(() => expect(mockMostrarNotificacion).toHaveBeenCalledWith(expect.stringContaining('inyectados'), 'success'));
    expect(mockCargarEstudiantes).toHaveBeenCalled();
    unmount();

    mockGenerar.mockRejectedValueOnce(new Error('Sin cupo'));
    render(<VistaEstudiantes />);
    await user.click(screen.getByText('Generar Data Test'));
    await waitFor(() => expect(mockMostrarNotificacion).toHaveBeenCalledWith('Sin cupo', 'error'));
  });

  it('cubre el fallo de generación de data ficticia (ya no hay tope de capacidad que validar)', async () => {
    const user = userEvent.setup();
    mockUsuario = { tenantId: 'tenant-1', rol: 'SuperAdmin' };
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockGenerar.mockRejectedValueOnce('fallo');
    render(<VistaEstudiantes />);

    await user.click(screen.getByText('Generar Data Test'));
    await waitFor(() => expect(mockMostrarNotificacion).toHaveBeenCalledWith('Error al generar data de prueba', 'error'));
    expect(mockGenerar).toHaveBeenCalledWith(10, '1', 'tenant-1');
  });

  it('cancela la generación de data ficticia si el operador no confirma', async () => {
    const user = userEvent.setup();
    mockUsuario = { tenantId: 'tenant-1', rol: 'SuperAdmin' };
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<VistaEstudiantes />);

    await user.click(screen.getByText('Generar Data Test'));
    expect(mockGenerar).not.toHaveBeenCalled();
  });

  it('Scenario "matricula-estado-estudiante": retira un estudiante activo sin eliminar la fila (conserva historial)', async () => {
    const user = userEvent.setup();
    render(<VistaEstudiantes />);

    await user.click(screen.getByText('Retirar Ana'));

    expect(mockRetirarEstudiante).toHaveBeenCalledWith(estudiantesBase[0]);
    // La fila sigue en pantalla -- retirar NO borra el registro.
    expect(screen.getByTestId('est-1')).toBeInTheDocument();
  });

  it('reactiva un estudiante retirado', async () => {
    const user = userEvent.setup();
    const retirado = { ...estudiantesBase[1], estadoMatricula: 'retirado' as const };
    mockEscenario = { estudiantes: [retirado] };
    render(<VistaEstudiantes />);

    await user.click(screen.getByText(`Reactivar ${retirado.nombres}`));

    expect(mockReactivarEstudiante).toHaveBeenCalledWith(retirado);
  });
});
