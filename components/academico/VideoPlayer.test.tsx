import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VideoPlayer from './VideoPlayer';

const mockRegistrarVideoSegundo = jest.fn();
const mockFlush = jest.fn();
const mockUseProgressSync = jest.fn(() => ({
  progreso: { paginasVistas: [], segundosUnicos: [5] },
  registrarVideoSegundo: mockRegistrarVideoSegundo,
  flush: mockFlush,
}));

jest.mock('../../hooks/academico/useProgressSync', () => ({
  useProgressSync: (options: unknown) => mockUseProgressSync(options),
}));

describe('VideoPlayer', () => {
  beforeEach(() => {
    mockRegistrarVideoSegundo.mockClear();
    mockFlush.mockClear();
    mockUseProgressSync.mockClear();
  });

  it('renderiza el video académico y registra segundo visto', async () => {
    const user = userEvent.setup();

    render(
      <VideoPlayer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Patada frontal"
        url="https://example.com/video.mp4"
        totalSegundos={120}
        sincronizar={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /patada frontal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/video patada frontal/i)).toHaveAttribute('src', 'https://example.com/video.mp4');

    await user.click(screen.getByRole('button', { name: /registrar segundo 12/i }));

    expect(mockRegistrarVideoSegundo).toHaveBeenCalledWith(12);
  });

  it('muestra segundos únicos acumulados y permite sincronizar avance', async () => {
    const user = userEvent.setup();

    render(
      <VideoPlayer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Patada frontal"
        url="https://example.com/video.mp4"
        totalSegundos={120}
        sincronizar={jest.fn()}
      />
    );

    expect(screen.getByText(/segundos registrados: 1\/120/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sincronizar avance/i }));

    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('muestra estado vacio cuando no hay URL de video', () => {
    render(
      <VideoPlayer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Video pendiente"
        url=""
        totalSegundos={120}
        sincronizar={jest.fn()}
      />
    );

    expect(screen.getByText(/video no disponible/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/video video pendiente/i)).not.toBeInTheDocument();
  });
  it('conecta la carga de progreso guardado para reanudar video', () => {
    const cargarProgreso = jest.fn();

    render(
      <VideoPlayer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Patada frontal"
        url="https://example.com/video.mp4"
        totalSegundos={120}
        sincronizar={jest.fn()}
        cargarProgreso={cargarProgreso}
      />
    );

    expect(mockUseProgressSync).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'video',
      cargarProgreso,
    }));
  });

  it('registra segundos desde reproduccion normal y no cuenta seeking', () => {
    render(
      <VideoPlayer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Patada frontal"
        url="https://example.com/video.mp4"
        totalSegundos={120}
        sincronizar={jest.fn()}
      />
    );

    const video = screen.getByLabelText(/video patada frontal/i) as HTMLVideoElement;

    Object.defineProperty(video, 'currentTime', { configurable: true, value: 12.8 });
    video.dispatchEvent(new Event('timeupdate'));
    expect(mockRegistrarVideoSegundo).toHaveBeenCalledWith(12);

    mockRegistrarVideoSegundo.mockClear();
    video.dispatchEvent(new Event('seeking'));
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 90.1 });
    video.dispatchEvent(new Event('timeupdate'));
    expect(mockRegistrarVideoSegundo).not.toHaveBeenCalled();

    video.dispatchEvent(new Event('seeked'));
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 91.2 });
    video.dispatchEvent(new Event('timeupdate'));
    expect(mockRegistrarVideoSegundo).toHaveBeenCalledWith(91);
  });
});
