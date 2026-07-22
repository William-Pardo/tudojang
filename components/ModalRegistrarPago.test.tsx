import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { obtenerDeudasEstudiante, procesarPagoEfectivo, obtenerUltimoPagoEfectivo, anularUltimoPagoEfectivo } from '../servicios/pagosApi';
import { obtenerConfiguracionClub } from '../servicios/configuracionApi';

const generarImagen = jest.fn(), descargarComprobante = jest.fn(), compartirPorWhatsApp = jest.fn();
jest.mock('./ComprobantesPago', () => ({ useGeneradorComprobante: () => ({ generarImagen, descargarComprobante, compartirPorWhatsApp }) }));
// Fix 2026-07-22: el mock solo declaraba 2 de las 4 funciones que el componente importa.
// `obtenerUltimoPagoEfectivo` y `anularUltimoPagoEfectivo` llegaban como `undefined` y
// reventaban al invocarse -- la funcionalidad de anular el ultimo pago se agrego al
// componente y este mock nunca se actualizo.
jest.mock('../servicios/pagosApi', () => ({
  obtenerDeudasEstudiante: jest.fn(),
  procesarPagoEfectivo: jest.fn(),
  obtenerUltimoPagoEfectivo: jest.fn(),
  anularUltimoPagoEfectivo: jest.fn(),
}));
jest.mock('../servicios/configuracionApi', () => ({ obtenerConfiguracionClub: jest.fn() }));

// Fix 2026-07-22: el componente pasó a usar `useAuth()` (linea 35) para gatear la anulacion
// de pagos a Admin. Sin este mock, los 8 tests morian con "useAuth debe ser usado dentro de
// un AuthProvider" antes de renderizar nada.
const usuarioLogueado: { valor: any } = { valor: null };
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: usuarioLogueado.valor }),
}));

// Idem: el componente tambien tomo dependencia de `useNotificacion` para avisar el
// resultado de la anulacion. Sin proveedor ni mock, moria antes de renderizar.
const mostrarNotificacion = jest.fn();
jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion }),
}));

import ModalRegistrarPago from './ModalRegistrarPago';

const estudiante: any = {
  id: 'e1', tenantId: 't1', nombres: 'Ana', apellidos: 'Pérez', telefono: '300 111',
  tutor: { nombres: 'Tutor', apellidos: 'Pérez', telefono: '300-222' },
};
const deudas: any[] = [
  { id: 'd1', tipo: 'Mensualidad', descripcion: 'Mensualidad', monto: 100, fechaGeneracion: '2026-01-01' },
  { id: 'd2', tipo: 'Tienda', descripcion: 'Dobok', monto: 40, fechaGeneracion: '2026-01-02' },
  { id: 'd3', tipo: 'Evento', descripcion: 'Torneo', monto: 20, fechaGeneracion: '2026-01-03' },
  { id: 'd4', tipo: 'Mora', descripcion: 'Mora', monto: 10, fechaGeneracion: '2026-01-04' },
];

describe('ModalRegistrarPago', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Rol no-Admin por defecto: la anulacion de pagos esta gateada a Admin, y los casos
    // originales de esta suite no la ejercitan.
    usuarioLogueado.valor = { id: 'u1', tenantId: 't1', rol: 'Editor' };
    (obtenerDeudasEstudiante as jest.Mock).mockResolvedValue({ items: deudas });
    (obtenerConfiguracionClub as jest.Mock).mockResolvedValue({ nombreClub: 'Club' });
    generarImagen.mockResolvedValue('data:image/png,ok');
  });

  it('no renderiza si está cerrado o no hay estudiante', () => {
    const { container, rerender } = render(<ModalRegistrarPago estudiante={estudiante} abierto={false} onCerrar={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ModalRegistrarPago estudiante={null} abierto onCerrar={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('carga y renderiza deudas, tipos y total seleccionado', async () => {
    const user = userEvent.setup();
    render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
    expect(await screen.findByText('Dobok')).toBeInTheDocument();
    expect(screen.getByText('Dobok')).toBeInTheDocument();
    await user.click(screen.getAllByText('Mensualidad')[1]);
    expect(screen.getAllByText(/100/)).toHaveLength(2);
    await user.click(screen.getAllByText('Mensualidad')[1]);
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled();
  });

  it('procesa pago exitoso, genera imagen, descarga y comparte por WhatsApp', async () => {
    const user = userEvent.setup();
    const onPagoExitoso = jest.fn();
    (procesarPagoEfectivo as jest.Mock).mockResolvedValue({ exito: true, reciboId: 'REC-1', nuevoSaldo: 0 });
    render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} onPagoExitoso={onPagoExitoso} />);
    await screen.findByText('Dobok');
    await user.click(screen.getAllByText('Mensualidad')[1]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('¡Pago Exitoso!')).toBeInTheDocument();
    expect(onPagoExitoso).toHaveBeenCalled();
    expect(generarImagen).toHaveBeenCalled();
    expect(screen.getByAltText('Comprobante de pago')).toHaveAttribute('src', 'data:image/png,ok');
    await user.click(screen.getByText('Descargar PNG'));
    expect(descargarComprobante).toHaveBeenCalled();
    await user.click(screen.getByText('Enviar WA'));
    expect(compartirPorWhatsApp).toHaveBeenCalledWith(expect.anything(), expect.anything(), '300222');
  });

  it('muestra error de resultado y excepción controlada', async () => {
    const user = userEvent.setup();
    (procesarPagoEfectivo as jest.Mock).mockResolvedValueOnce({ exito: false, mensaje: 'Pago rechazado' });
    const { unmount } = render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
    await user.click(await screen.findByText('Dobok'));
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Pago rechazado')).toBeInTheDocument();
    unmount();
    (procesarPagoEfectivo as jest.Mock).mockRejectedValueOnce(new Error('Red caída'));
    render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
    await user.click(await screen.findByText('Torneo'));
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Red caída')).toBeInTheDocument();
  });

  it('usa mensajes de error por defecto y omite comprobante sin configuración', async () => {
    const user = userEvent.setup();
    (obtenerConfiguracionClub as jest.Mock).mockRejectedValue(new Error('sin config'));
    (procesarPagoEfectivo as jest.Mock).mockResolvedValueOnce({ exito: false });
    const { unmount } = render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
    await screen.findByText('Dobok');
    await user.click(screen.getAllByText('Evento')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Error al procesar el pago.')).toBeInTheDocument();
    unmount();

    (procesarPagoEfectivo as jest.Mock).mockRejectedValueOnce({});
    render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
    await screen.findByText('Dobok');
    await user.click(screen.getAllByText('Tienda')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Error desconocido al procesar pago.')).toBeInTheDocument();
  });

  it('maneja errores de carga/configuración y estado sin deudas', async () => {
    (obtenerDeudasEstudiante as jest.Mock).mockRejectedValueOnce(new Error('fallo'));
    (obtenerConfiguracionClub as jest.Mock).mockRejectedValueOnce(new Error('config'));
    const { unmount } = render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
    expect(await screen.findByText('No se pudieron cargar las deudas pendientes.')).toBeInTheDocument();
    unmount();
    (obtenerDeudasEstudiante as jest.Mock).mockResolvedValueOnce({ items: [] });
    render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
    expect(await screen.findByText('Estudiante Al Día')).toBeInTheDocument();
  });

  it('alerta cuando no existe teléfono y permite cerrar', async () => {
    const user = userEvent.setup();
    const onCerrar = jest.fn();
    const sinTelefono = { ...estudiante, telefono: '', tutor: undefined };
    (procesarPagoEfectivo as jest.Mock).mockResolvedValue({ exito: true, reciboId: 'R' });
    window.alert = jest.fn();
    render(<ModalRegistrarPago estudiante={sinTelefono} abierto onCerrar={onCerrar} />);
    await screen.findByText('Dobok');
    await user.click(screen.getAllByText('Mora')[1]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    await screen.findByText('¡Pago Exitoso!');
    await user.click(screen.getByText('Enviar WA'));
    expect(window.alert).toHaveBeenCalled();
    await user.click(screen.getByText(/Cerrar y Continuar/));
    expect(onCerrar).toHaveBeenCalled();
  });

  it('muestra generación transitoria y crea recibo fallback', async () => {
    const user = userEvent.setup();
    let resolver!: (value: string | null) => void;
    generarImagen.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
    (procesarPagoEfectivo as jest.Mock).mockResolvedValue({ exito: true });
    render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
    await screen.findByText('Dobok');
    await user.click(screen.getByText('Dobok'));
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Generando comprobante...')).toBeInTheDocument();
    resolver(null);
    await waitFor(() => expect(screen.queryByText('Generando comprobante...')).not.toBeInTheDocument());
    expect(screen.queryByAltText('Comprobante de pago')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------------
  // Anulacion del ultimo pago.
  //
  // Estos casos VIVIAN en components/FilaEstudiante.test.tsx. El commit b0ed3c5
  // ("feat(finance): unify payment actions in modal") movio la funcionalidad de la fila al
  // modal, pero los tests se quedaron en el archivo viejo apuntando a un boton `/Deshacer/`
  // que ya no existe ahi -- por eso 5 de los 6 fallos de esa suite. Se trasladan aca, a
  // donde la funcionalidad realmente vive, en vez de borrarlos y perder la cobertura.
  // ---------------------------------------------------------------------------------
  describe('anulación del último pago', () => {
    const ultimoPago: any = {
      id: 'tx-1', reciboId: 'REC-9', fecha: '2026-01-05T10:00:00.000Z',
      montoTotal: 100, itemsPagados: [{ descripcion: 'Mensualidad', monto: 100 }],
    };

    const abrirConfirmacion = async (user: ReturnType<typeof userEvent.setup>) => {
      await screen.findByText('Dobok');
      await user.click(screen.getByRole('button', { name: /Último Recibo/i }));
      await user.click(await screen.findByRole('button', { name: /Anular Este Recibo/i }));
    };

    beforeEach(() => {
      // La pestaña "Último Recibo" y todo el flujo de anulación estan gateados a Admin
      // (ModalRegistrarPago.tsx:277, `!resultado && esAdmin`), igual que en la fila de la
      // que se trasladaron estos casos.
      usuarioLogueado.valor = { id: 'u1', tenantId: 't1', rol: 'Admin' };
      (obtenerUltimoPagoEfectivo as jest.Mock).mockResolvedValue(ultimoPago);
    });

    it('permite cerrar la confirmación sin anular', async () => {
      const user = userEvent.setup();
      render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
      await abrirConfirmacion(user);

      expect(screen.getByText('Deshacer Último Pago')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Cancelar/i }));

      // ModalConfirmacion.handleClose difiere el onCerrar 200ms para la animacion de
      // salida, asi que el cierre no es sincrono.
      await waitFor(() =>
        expect(screen.queryByText('Deshacer Último Pago')).not.toBeInTheDocument()
      );
      expect(anularUltimoPagoEfectivo).not.toHaveBeenCalled();
    });

    it('notifica y cierra la confirmación cuando la anulación es exitosa', async () => {
      const user = userEvent.setup();
      let resolver!: (value: any) => void;
      (anularUltimoPagoEfectivo as jest.Mock).mockReturnValue(new Promise((r) => { resolver = r; }));
      render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
      await abrirConfirmacion(user);
      await user.click(screen.getByRole('button', { name: /^Confirmar$/i }));

      resolver({ exito: true });

      await waitFor(() =>
        expect(mostrarNotificacion).toHaveBeenCalledWith('Pago anulado correctamente', 'success')
      );
      // El id del usuario logueado viaja al servicio para la traza de auditoria.
      expect(anularUltimoPagoEfectivo).toHaveBeenCalledWith('e1', 'u1');
      await waitFor(() =>
        expect(screen.queryByText('Deshacer Último Pago')).not.toBeInTheDocument()
      );
    });

    it.each([
      [{ exito: false, mensaje: 'No hay pagos' }, 'No hay pagos'],
      [{ exito: false }, 'Error al anular pago'],
    ])('notifica un resultado fallido sin cerrar la confirmación', async (resultado, mensaje) => {
      const user = userEvent.setup();
      (anularUltimoPagoEfectivo as jest.Mock).mockResolvedValue(resultado);
      render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
      await abrirConfirmacion(user);
      await user.click(screen.getByRole('button', { name: /^Confirmar$/i }));

      await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith(mensaje, 'error'));
      expect(screen.getByText('Deshacer Último Pago')).toBeInTheDocument();
    });

    it('captura excepciones al anular incluso sin usuario autenticado', async () => {
      const user = userEvent.setup();
      // Admin sin `id`: reproduce el caso original ("sin usuario autenticado" = sin uid que
      // mandar a auditoria). Con usuario null la pestaña ni se renderiza, porque esAdmin
      // seria false.
      usuarioLogueado.valor = { rol: 'Admin' };
      (anularUltimoPagoEfectivo as jest.Mock).mockRejectedValue(new Error('Fallo de red'));
      render(<ModalRegistrarPago estudiante={estudiante} abierto onCerrar={jest.fn()} />);
      await abrirConfirmacion(user);
      await user.click(screen.getByRole('button', { name: /^Confirmar$/i }));

      await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith('Fallo de red', 'error'));
      expect(anularUltimoPagoEfectivo).toHaveBeenCalledWith('e1', undefined);
    });
  });
});
