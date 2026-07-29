import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EscanerAsistenciaClase from './EscanerAsistenciaClase';
import { registrarAsistenciaClase } from '../../servicios/academico/asistenciaClaseService';

const notify = jest.fn();
const detect = jest.fn();
const stop = jest.fn();
let scan: (() => Promise<void>) | undefined;

jest.mock('../../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: notify }),
}));
jest.mock('../../servicios/academico/asistenciaClaseService', () => ({
  registrarAsistenciaClase: jest.fn(),
}));
jest.mock('../Loader', () => () => <div>Iniciando Lente...</div>);

describe('EscanerAsistenciaClase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detect.mockReset().mockResolvedValue([]);
    (registrarAsistenciaClase as jest.Mock).mockReset();
    scan = undefined;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    });
    (window as any).BarcodeDetector = class {
      detect = detect;
    };
    // Fix 2026-07-21 (`npm run typecheck`): `window.setInterval` colisiona entre la firma
    // del DOM (devuelve `number`) y la de @types/node (devuelve `Timeout`), ambas cargadas
    // via `types: ["jest", "node"]` en tsconfig. Gana la de Node, que no admite este mock.
    // El cast acota esa colision de entorno; no hay defecto de codigo que arreglar.
    jest.spyOn(window, 'setInterval').mockImplementation(((callback: TimerHandler, delay?: number) => {
      if (delay === 500) scan = callback as () => Promise<void>;
      return 1;
    }) as unknown as typeof window.setInterval);
    jest.spyOn(window, 'clearInterval').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('registra un check-in via el callable de jornada, notifica y NO cierra el escaner (permite seguir escaneando)', async () => {
    detect.mockResolvedValue([{ rawValue: '{"id":"estudiante-1"}' }]);
    (registrarAsistenciaClase as jest.Mock).mockResolvedValue({ ok: true, tipo: 'entrada', hora: '2026-07-09T10:00:00.000Z' });
    const close = jest.fn();
    const onRegistrado = jest.fn();
    render(
      <EscanerAsistenciaClase tenantId="tenant-1" jornadaId="jornada-1" onClose={close} onRegistrado={onRegistrado} />
    );

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());

    expect(registrarAsistenciaClase).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-1',
      estudianteId: 'estudiante-1',
    });
    expect(notify).toHaveBeenCalledWith('Check-in registrado', 'success');
    expect(onRegistrado).toHaveBeenCalled();
    // A diferencia del escaner de guarderia, el de Clase en Vivo permanece
    // abierto tras un escaneo exitoso: se esperan multiples estudiantes.
    expect(close).not.toHaveBeenCalled();
  });

  it('registra un check-out (segundo escaneo del mismo estudiante) con mensaje distinto', async () => {
    detect.mockResolvedValue([{ rawValue: '{"id":"estudiante-1"}' }]);
    (registrarAsistenciaClase as jest.Mock).mockResolvedValue({
      ok: true, tipo: 'salida', hora: '2026-07-09T10:45:00.000Z', minutosAsistidos: 45,
    });
    render(<EscanerAsistenciaClase tenantId="tenant-1" jornadaId="jornada-1" onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());

    expect(notify).toHaveBeenCalledWith('Check-out registrado', 'success');
  });

  it('permite escanear a un segundo estudiante despues de un check-in exitoso (no queda bloqueado)', async () => {
    detect
      .mockResolvedValueOnce([{ rawValue: '{"id":"estudiante-1"}' }])
      .mockResolvedValueOnce([{ rawValue: '{"id":"estudiante-2"}' }]);
    (registrarAsistenciaClase as jest.Mock)
      .mockResolvedValueOnce({ ok: true, tipo: 'entrada', hora: '2026-07-09T10:00:00.000Z' })
      .mockResolvedValueOnce({ ok: true, tipo: 'entrada', hora: '2026-07-09T10:01:00.000Z' });
    render(<EscanerAsistenciaClase tenantId="tenant-1" jornadaId="jornada-1" onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());
    await act(async () => scan?.());

    expect(registrarAsistenciaClase).toHaveBeenCalledTimes(2);
    expect(registrarAsistenciaClase).toHaveBeenNthCalledWith(2, {
      tenantId: 'tenant-1',
      jornadaId: 'jornada-1',
      estudianteId: 'estudiante-2',
    });
  });

  it('muestra error si el callable rechaza (p.ej. estudiante fuera del roster) sin cerrar el escaner', async () => {
    detect.mockResolvedValue([{ rawValue: '{"id":"estudiante-3"}' }]);
    (registrarAsistenciaClase as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const close = jest.fn();
    render(<EscanerAsistenciaClase tenantId="tenant-1" jornadaId="jornada-1" onClose={close} />);

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());

    expect(notify).toHaveBeenCalledWith('Error al procesar el registro', 'error');
    expect(close).not.toHaveBeenCalled();
  });

  it('muestra el mensaje real del callable cuando el error viene con code functions/* (ej. estudiante no matriculado)', async () => {
    detect.mockResolvedValue([{ rawValue: '{"id":"estudiante-4"}' }]);
    const errorCallable = Object.assign(new Error('El estudiante no esta matriculado en la ejecucion de esta jornada'), {
      code: 'functions/permission-denied',
    });
    (registrarAsistenciaClase as jest.Mock).mockRejectedValue(errorCallable);
    render(<EscanerAsistenciaClase tenantId="tenant-1" jornadaId="jornada-1" onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());

    expect(notify).toHaveBeenCalledWith('El estudiante no esta matriculado en la ejecucion de esta jornada', 'error');
  });

  it('informa QR invalido sin invocar el callable', async () => {
    detect.mockResolvedValue([{ rawValue: '{"x":1}' }]);
    render(<EscanerAsistenciaClase tenantId="tenant-1" jornadaId="jornada-1" onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());

    expect(notify).toHaveBeenCalledWith('Código QR inválido', 'error');
    expect(registrarAsistenciaClase).not.toHaveBeenCalled();
  });

  it('el boton de cerrar invoca onClose', async () => {
    const close = jest.fn();
    render(<EscanerAsistenciaClase tenantId="tenant-1" jornadaId="jornada-1" onClose={close} />);
    await screen.findByText('Control de Asistencia');
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(close).toHaveBeenCalled();
  });
});
