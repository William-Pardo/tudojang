import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EscanerAsistencia from './EscanerAsistencia';
import * as api from '../servicios/api';

const notify = jest.fn();
const detect = jest.fn();
const stop = jest.fn();
let scan: (() => Promise<void>) | undefined;

jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: notify }),
}));
jest.mock('../servicios/api', () => ({
  obtenerEstudiantePorId: jest.fn(),
  registrarEntrada: jest.fn(),
}));
jest.mock('./Loader', () => () => <div>Iniciando Lente...</div>);

describe('EscanerAsistencia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detect.mockReset().mockResolvedValue([]);
    (api.obtenerEstudiantePorId as jest.Mock).mockReset().mockResolvedValue({ nombres: 'Estudiante' });
    (api.registrarEntrada as jest.Mock).mockReset().mockResolvedValue({});
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

  it('detecta un QR JSON válido, registra y apaga la cámara', async () => {
    detect.mockResolvedValue([{ rawValue: '{"id":"e1"}' }]);
    (api.obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ nombres: 'Ana' });
    (api.registrarEntrada as jest.Mock).mockResolvedValue({});
    const close = jest.fn();
    const { unmount } = render(<EscanerAsistencia sedeId="s1" onClose={close} />);

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());

    expect(api.obtenerEstudiantePorId).toHaveBeenCalledWith('e1');
    expect(api.registrarEntrada).toHaveBeenCalledWith('e1', 's1');
    expect(notify).toHaveBeenCalledWith('Asistencia registrada: Ana', 'success');
    expect(close).toHaveBeenCalled();
    unmount();
    expect(window.clearInterval).toHaveBeenCalledWith(1);
    expect(stop).toHaveBeenCalled();
    await act(async () => scan?.());
  });

  it('informa QR corrupto, permite reintentar y controla error del servicio', async () => {
    detect.mockResolvedValueOnce([{ rawValue: '{"x":1}' }]).mockResolvedValueOnce([]);
    render(<EscanerAsistencia sedeId="s1" onClose={jest.fn()} />);
    await waitFor(() => expect(scan).toBeDefined());

    await act(async () => scan?.());
    expect(notify).toHaveBeenCalledWith('Código QR inválido', 'error');
    await act(async () => scan?.());

    (api.obtenerEstudiantePorId as jest.Mock).mockRejectedValue(new Error('firebase'));
    fireEvent.click(screen.getByText('Simular Captura'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Error al procesar el registro', 'error'));
  });

  it('informa JSON malformado', async () => {
    detect.mockResolvedValue([{ rawValue: '{malformado' }]);
    render(<EscanerAsistencia sedeId="s" onClose={jest.fn()} />);
    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());
    expect(notify).toHaveBeenCalledWith('Código QR inválido', 'error');
  });

  it('registra el identificador plano desde la captura simulada', async () => {
    (api.obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ nombres: 'Luis' });
    (api.registrarEntrada as jest.Mock).mockResolvedValue({});
    const close = jest.fn();
    render(<EscanerAsistencia sedeId="s2" onClose={close} />);
    const button = (await screen.findByText('Simular Captura')).closest('button')!;
    await act(async () => fireEvent.click(button));
    await waitFor(() => expect(api.registrarEntrada).toHaveBeenCalledWith('1', 's2'));
  });

  it('captura error de cámara y ofrece ambos cierres', async () => {
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(new Error('permiso'));
    const close = jest.fn();
    const { rerender } = render(<EscanerAsistencia sedeId="s" onClose={close} />);
    expect(await screen.findByText(/No se pudo acceder/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Entendido'));
    expect(close).toHaveBeenCalledTimes(1);
    rerender(<EscanerAsistencia sedeId="s" onClose={close} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('captura la excepción del detector y cubre detector no disponible', async () => {
    detect.mockRejectedValue(new Error('hardware'));
    const first = render(<EscanerAsistencia sedeId="s" onClose={jest.fn()} />);
    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());
    expect(await screen.findByText('Error del hardware de la cámara.')).toBeInTheDocument();
    first.unmount();

    delete (window as any).BarcodeDetector;
    scan = undefined;
    (window.setInterval as jest.Mock).mockClear();
    render(<EscanerAsistencia sedeId="s" onClose={jest.fn()} />);
    await screen.findByText('Simular Captura');
    expect((window.setInterval as jest.Mock).mock.calls.some(([, delay]) => delay === 500)).toBe(false);
  });
});
