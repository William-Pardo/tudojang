import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import YoutubePlayer from './YoutubePlayer';

class FakeYoutubePlayer {
  static instancias: FakeYoutubePlayer[] = [];
  currentTime = 0;
  duration = 90;
  events: any;
  destroyed = false;

  constructor(_elementId: string, config: any) {
    this.events = config.events;
    FakeYoutubePlayer.instancias.push(this);
    // Simula que la API tarda un microtask en confirmar que el player esta listo.
    Promise.resolve().then(() => this.events?.onReady?.());
  }

  getCurrentTime() {
    return this.currentTime;
  }

  getDuration() {
    return this.duration;
  }

  destroy() {
    this.destroyed = true;
  }

  dispararEstado(estado: number) {
    this.events?.onStateChange?.({ data: estado });
  }
}

const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 };

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('YoutubePlayer', () => {
  beforeEach(() => {
    FakeYoutubePlayer.instancias = [];
    (window as any).YT = {
      Player: FakeYoutubePlayer,
      PlayerState: PLAYER_STATE,
    };
  });

  afterEach(() => {
    delete (window as any).YT;
    jest.useRealTimers();
  });

  it('instancia el reproductor de YouTube con el videoId recibido', async () => {
    render(
      <YoutubePlayer
        videoId="dQw4w9WgXcQ"
        titulo="Clase 1: fundamentos"
        estudianteId="est-1"
        registrarSync={jest.fn()}
      />
    );

    expect(screen.getByText(/cargando reproductor de youtube/i)).toBeInTheDocument();
    await flushMicrotasks();

    expect(FakeYoutubePlayer.instancias).toHaveLength(1);
    expect(await screen.findByLabelText(/reproductor de youtube: clase 1: fundamentos/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/cargando reproductor de youtube/i)).not.toBeInTheDocument();
    });
  });

  it('hace flush inmediato con la posicion actual al pausar el video', async () => {
    const registrarSync = jest.fn();
    render(
      <YoutubePlayer
        videoId="dQw4w9WgXcQ"
        titulo="Clase 1"
        estudianteId="est-1"
        estudianteNombre="Juan Perez"
        registrarSync={registrarSync}
      />
    );
    await flushMicrotasks();

    const player = FakeYoutubePlayer.instancias[0];
    player.currentTime = 45;
    player.duration = 90;

    act(() => {
      player.dispararEstado(PLAYER_STATE.PLAYING);
    });
    act(() => {
      player.dispararEstado(PLAYER_STATE.PAUSED);
    });

    expect(registrarSync).toHaveBeenCalledWith(
      expect.objectContaining({
        estudianteNombre: 'Juan Perez',
        posicionSegundos: 45,
        duracionSegundos: 90,
        nuevoInicio: true,
      })
    );
  });

  it('hace flush con nuevoInicio=true al terminar (ENDED) tras haber reproducido', async () => {
    const registrarSync = jest.fn();
    render(
      <YoutubePlayer
        videoId="dQw4w9WgXcQ"
        titulo="Clase 1"
        estudianteId="est-1"
        registrarSync={registrarSync}
      />
    );
    await flushMicrotasks();

    const player = FakeYoutubePlayer.instancias[0];
    player.currentTime = 90;
    player.duration = 90;

    act(() => {
      player.dispararEstado(PLAYER_STATE.PLAYING);
    });
    act(() => {
      player.dispararEstado(PLAYER_STATE.ENDED);
    });

    expect(registrarSync).toHaveBeenCalledWith(
      expect.objectContaining({ posicionSegundos: 90, duracionSegundos: 90 })
    );
  });

  it('sondea la posicion periodicamente mientras reproduce y hace flush por intervalo', async () => {
    jest.useFakeTimers();
    const registrarSync = jest.fn();

    render(
      <YoutubePlayer
        videoId="dQw4w9WgXcQ"
        titulo="Clase 1"
        estudianteId="est-1"
        intervaloSondeoMs={5000}
        intervaloFlushMs={30000}
        registrarSync={registrarSync}
      />
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const player = FakeYoutubePlayer.instancias[0];
    player.duration = 100;

    act(() => {
      player.dispararEstado(PLAYER_STATE.PLAYING);
    });

    // Avanza el sondeo interno (5s) y va subiendo la posicion "real" del player.
    player.currentTime = 20;
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Todavia no deberia haber flush -- solo se actualizo la posicion sondeada.
    expect(registrarSync).not.toHaveBeenCalled();

    // Llega el flush de 30s (useVideoTrackingSync).
    act(() => {
      jest.advanceTimersByTime(25000);
    });

    expect(registrarSync).toHaveBeenCalledWith(
      expect.objectContaining({ posicionSegundos: 20, duracionSegundos: 100, nuevoInicio: true })
    );
  });

  it('no llama registrarSync si no hay estudianteId (ej. vista previa administrativa)', async () => {
    const registrarSync = jest.fn();
    render(
      <YoutubePlayer
        videoId="dQw4w9WgXcQ"
        titulo="Clase 1"
        registrarSync={registrarSync}
      />
    );
    await flushMicrotasks();

    const player = FakeYoutubePlayer.instancias[0];
    player.currentTime = 45;
    player.duration = 90;

    act(() => {
      player.dispararEstado(PLAYER_STATE.PLAYING);
    });
    act(() => {
      player.dispararEstado(PLAYER_STATE.PAUSED);
    });

    expect(registrarSync).not.toHaveBeenCalled();
  });
});
