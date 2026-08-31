import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilaEstudiante } from './FilaEstudiante';
import { EstadoPago, GradoTKD, GrupoEdad, RolUsuario, type Estudiante } from '../tipos';

let mockUsuario: any = { id: 'admin-1', rol: RolUsuario.Admin };

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: mockUsuario }),
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

jest.mock('./GeneradorQR', () => ({ estudiante }: any) => (
  <div data-testid="generador-qr">{estudiante.id}</div>
));

const crearEstudiante = (overrides: Partial<Estudiante> = {}): Estudiante => ({
  id: 'est-1',
  tenantId: 'tenant-1',
  // Fix 2026-07-21 (`npm run typecheck`): faltaban `telefono` y `correo` a nivel
  // Estudiante -- estaban solo dentro de `tutor`, que es otro campo. Ambos son
  // obligatorios en el tipo.
  telefono: '3001112233',
  correo: 'ana@test.com',
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
  estadoMatricula: 'activo', // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
  tutor: {
    // Fix 2026-07-21 (`npm run typecheck`): `nombreCompleto` y `parentesco` NO EXISTEN en
    // el tipo `Estudiante['tutor']` (los campos reales son nombres/apellidos/
    // numeroIdentificacion/telefono/correo). Ninguno se renderiza en FilaEstudiante -- el
    // componente solo lee las firmas del tutor -- asi que corregirlos no altera ningun caso.
    nombres: 'Tutor',
    apellidos: 'Uno',
    numeroIdentificacion: '999',
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
    onRetirar: jest.fn(),
    onReactivar: jest.fn(),
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

    // Fix 2026-07-22: el title paso de 'Registrar Pago en Efectivo' a 'Gestión Financiera'
    // en b0ed3c5 (unificacion de acciones de pago en el modal). Mismo boton, mismo
    // onClick (setModalPagoAbierto) -- solo cambio la etiqueta.
    await user.click(screen.getByTitle('Gestión Financiera'));
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
    // Fix 2026-07-21 (`npm run typecheck`): RolUsuario.Instructor NO EXISTE en el enum
    // (el rol docente real es Maestro). Evaluaba a `undefined`, asi que este test verificaba
    // "no es admin" contra un valor basura en vez de contra un rol real del sistema.
    mockUsuario = { id: 'user-1', rol: RolUsuario.Maestro };
    renderFila();

    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Retirar (conserva historial)')).not.toBeInTheDocument();
    expect(screen.getByTitle('Editar')).toBeInTheDocument();
  });

  // SDD pricing-cupo-real (Bloque 4, matricula-estado-estudiante): conecta la UI a
  // retirarEstudiante/reactivarEstudiante (Bloque 1, ya implementadas y probadas en
  // servicios/estudiantesApi.ts -- no se reabre esa lógica acá).
  it('Scenario "Retirar un estudiante": un estudiante activo muestra el botón Retirar y lo invoca con el estudiante', async () => {
    const user = userEvent.setup();
    const { props } = renderFila({ estudiante: crearEstudiante({ estadoMatricula: 'activo' }) });

    expect(screen.queryByText('Retirado')).not.toBeInTheDocument();
    await user.click(screen.getByTitle('Retirar (conserva historial)'));
    expect(props.onRetirar).toHaveBeenCalledWith(props.estudiante);
    expect(screen.queryByTitle('Reactivar matrícula')).not.toBeInTheDocument();
  });

  it('Scenario "Reactivar un estudiante retirado": muestra el badge Retirado y el botón Reactivar, sin ocultar la fila', async () => {
    const user = userEvent.setup();
    const { props } = renderFila({ estudiante: crearEstudiante({ estadoMatricula: 'retirado' }) });

    expect(screen.getByText('Retirado')).toBeInTheDocument();
    expect(screen.getByText('Ana García')).toBeInTheDocument(); // la fila NO se borra
    await user.click(screen.getByTitle('Reactivar matrícula'));
    expect(props.onReactivar).toHaveBeenCalledWith(props.estudiante);
    expect(screen.queryByTitle('Retirar (conserva historial)')).not.toBeInTheDocument();
  });

  // Nota 2026-07-22: aca vivian 4 casos mas, sobre la anulacion del ultimo pago. El commit
  // b0ed3c5 ("feat(finance): unify payment actions in modal") movio esa funcionalidad de la
  // fila al modal, pero los tests quedaron aca apuntando a un boton `/Deshacer/` que ya no
  // existe en este componente -- eran 5 de los 6 fallos historicos de esta suite. Se
  // trasladaron a components/ModalRegistrarPago.test.tsx (describe "anulación del último
  // pago"), que es donde la funcionalidad vive ahora. NO se borro cobertura.

  it.each([true, false])('muestra el teléfono y el correo del estudiante en vista isCard=%s (antes invisibles en el Directorio)', (isCard) => {
    renderFila({ estudiante: crearEstudiante({ telefono: '3001112222', correo: 'ana@correo.com' }), isCard });
    expect(screen.getByText('3001112222')).toBeInTheDocument();
    expect(screen.getByText('ana@correo.com')).toBeInTheDocument();
  });

  it('sin alertasContacto, el teléfono y el correo se ven en gris, sin ícono de aviso', () => {
    renderFila({ estudiante: crearEstudiante({ telefono: '3001112222', correo: 'ana@correo.com' }) });
    expect(screen.getByText('3001112222')).toHaveClass('text-gray-500');
    expect(screen.queryByTitle(/Mismo teléfono que/)).not.toBeInTheDocument();
  });

  it('con alertasContacto de teléfono, resalta el dato en ámbar con el nombre del otro estudiante en el aviso', () => {
    renderFila({
      estudiante: crearEstudiante({ telefono: '3001112222', correo: 'ana@correo.com' }),
      alertasContacto: [{ campo: 'telefono', mensaje: 'Mismo teléfono que: Bruno García' }],
    });
    const valor = screen.getByText('3001112222');
    expect(valor).toHaveClass('text-amber-600');
    expect(screen.getByTitle('Mismo teléfono que: Bruno García')).toBeInTheDocument();
    // El correo no tiene alerta propia -- debe seguir en gris, no "contagiarse" del aviso de telefono.
    expect(screen.getByText('ana@correo.com')).toHaveClass('text-gray-500');
  });

  it('puede resaltar teléfono y correo a la vez, cada uno con su propio aviso', () => {
    renderFila({
      estudiante: crearEstudiante({ telefono: '3001112222', correo: 'carlos@correo.com' }),
      alertasContacto: [
        { campo: 'telefono', mensaje: 'Mismo teléfono que: Bruno García' },
        { campo: 'correo', mensaje: 'Mismo correo que: Carlos Pardo' },
      ],
    });
    expect(screen.getByTitle('Mismo teléfono que: Bruno García')).toBeInTheDocument();
    expect(screen.getByTitle('Mismo correo que: Carlos Pardo')).toBeInTheDocument();
  });
});
