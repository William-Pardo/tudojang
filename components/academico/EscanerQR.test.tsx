import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EscanerQR from './EscanerQR';
import jsQR from 'jsqr';

const stop = jest.fn();
const detectorNativo = jest.fn();
let scan: (() => Promise<void>) | undefined;

jest.mock('../../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: jest.fn() }),
}));
jest.mock('../Loader', () => () => <div>Iniciando Lente...</div>);
// Bug real (2026-09-04): jsQR es el fallback puro-JS para navegadores sin BarcodeDetector
// (Safari/iOS, que nunca implementó esa API). Se mockea para no depender del canvas 2D real
// de jsdom (no implementado) -- solo interesa que EscanerQR lo invoque correctamente y actúe
// según lo que devuelva.
jest.mock('jsqr', () => jest.fn());

describe('EscanerQR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scan = undefined;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: jest.fn(),
      getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
    } as unknown as CanvasRenderingContext2D);
    // Mismo cast/motivo documentado en EscanerAsistencia.test.tsx: window.setInterval
    // colisiona entre la firma del DOM y la de @types/node.
    jest.spyOn(window, 'setInterval').mockImplementation(((callback: TimerHandler, delay?: number) => {
      if (delay === 500) scan = callback as () => Promise<void>;
      return 1;
    }) as unknown as typeof window.setInterval);
    jest.spyOn(window, 'clearInterval').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const marcarVideoConDatos = (container: HTMLElement) => {
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
    return video;
  };

  it('usa BarcodeDetector nativo cuando está disponible (Chrome/Edge/Android) -- jsQR nunca se llama', async () => {
    (window as any).BarcodeDetector = class { detect = detectorNativo; };
    detectorNativo.mockResolvedValue([{ rawValue: 'est-1' }]);
    const onDetectar = jest.fn().mockResolvedValue(undefined);
    render(<EscanerQR onDetectarEstudiante={onDetectar} onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());

    expect(onDetectar).toHaveBeenCalledWith('est-1');
    expect(jsQR).not.toHaveBeenCalled();
  });

  // Bug real (2026-09-04): sin BarcodeDetector (Safari/iOS), el escaneo debe seguir
  // funcionando via jsQR -- antes de este fix, este camino ni siquiera iniciaba un
  // intervalo de deteccion (ver EscanerAsistencia.test.tsx).
  it('sin BarcodeDetector, decodifica el QR via jsQR y llama a onDetectarEstudiante', async () => {
    delete (window as any).BarcodeDetector;
    (jsQR as jest.Mock).mockReturnValue({ data: 'est-2' });
    const onDetectar = jest.fn().mockResolvedValue(undefined);
    const { container } = render(<EscanerQR onDetectarEstudiante={onDetectar} onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    marcarVideoConDatos(container);
    await act(async () => scan?.());

    expect(jsQR).toHaveBeenCalled();
    expect(onDetectar).toHaveBeenCalledWith('est-2');
  });

  it('sin BarcodeDetector, si jsQR no detecta nada en el frame actual, no llama a onDetectarEstudiante ni rompe', async () => {
    delete (window as any).BarcodeDetector;
    (jsQR as jest.Mock).mockReturnValue(null);
    const onDetectar = jest.fn();
    const { container } = render(<EscanerQR onDetectarEstudiante={onDetectar} onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    marcarVideoConDatos(container);
    await act(async () => scan?.());

    expect(jsQR).toHaveBeenCalled();
    expect(onDetectar).not.toHaveBeenCalled();
  });

  it('sin BarcodeDetector, mientras el video no tiene datos suficientes (readyState < HAVE_ENOUGH_DATA), ni siquiera llama a jsQR', async () => {
    delete (window as any).BarcodeDetector;
    const onDetectar = jest.fn();
    render(<EscanerQR onDetectarEstudiante={onDetectar} onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    await act(async () => scan?.());

    expect(jsQR).not.toHaveBeenCalled();
    expect(onDetectar).not.toHaveBeenCalled();
  });

  // Bug real (2026-09-04, reportado por el usuario): el botón de cerrar existía pero era
  // fácil de no ver (opacidad 50%, solo ícono, sin texto). Ahora lleva una etiqueta visible.
  it('el botón "Cerrar" es visible (con texto) y llama a onClose', async () => {
    (window as any).BarcodeDetector = class { detect = detectorNativo; };
    const onClose = jest.fn();
    render(<EscanerQR onDetectarEstudiante={jest.fn()} onClose={onClose} />);

    const boton = await screen.findByRole('button', { name: /cerrar escáner/i });
    expect(boton).toHaveTextContent('Cerrar');
    fireEvent.click(boton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('apaga la cámara (detiene los tracks) al desmontarse', async () => {
    (window as any).BarcodeDetector = class { detect = detectorNativo; };
    const { unmount } = render(<EscanerQR onDetectarEstudiante={jest.fn()} onClose={jest.fn()} />);

    await waitFor(() => expect(scan).toBeDefined());
    unmount();

    expect(stop).toHaveBeenCalled();
    expect(window.clearInterval).toHaveBeenCalledWith(1);
  });
});
