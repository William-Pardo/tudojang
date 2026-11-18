import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalClasificarVideo from './ModalClasificarVideo';

describe('ModalClasificarVideo', () => {
  it('no se renderiza cuando abierto es false', () => {
    render(<ModalClasificarVideo abierto={false} onCerrar={jest.fn()} onGuardar={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza título, campos y tags sugeridos cuando está abierto', () => {
    render(
      <ModalClasificarVideo
        abierto={true}
        onCerrar={jest.fn()}
        onGuardar={jest.fn()}
        tagsSugeridosIniciales={['infantil']}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /clasificar recurso/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/título visible/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url del video/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tags/i)).toHaveValue('infantil');
  });

  it('muestra error si el título está vacío al intentar guardar', async () => {
    const onGuardar = jest.fn();
    render(<ModalClasificarVideo abierto={true} onCerrar={jest.fn()} onGuardar={onGuardar} />);

    fireEvent.click(screen.getByRole('button', { name: /guardar y aprobar/i }));

    expect(await screen.findByText(/el título visible es obligatorio/i)).toBeInTheDocument();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('muestra error si la URL del video no es válida', async () => {
    const onGuardar = jest.fn();
    render(<ModalClasificarVideo abierto={true} onCerrar={jest.fn()} onGuardar={onGuardar} />);

    await userEvent.type(screen.getByLabelText(/título visible/i), 'Patada en Hacha');
    await userEvent.type(screen.getByLabelText(/url del video/i), 'https://sitio-invalido.com/video');

    fireEvent.click(screen.getByRole('button', { name: /guardar y aprobar/i }));

    expect(await screen.findByText(/no tiene un formato de video reproducible/i)).toBeInTheDocument();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('permite alternar tags sugeridos haciendo click en los chips', async () => {
    render(<ModalClasificarVideo abierto={true} onCerrar={jest.fn()} onGuardar={jest.fn()} />);

    const chipCombate = screen.getByRole('button', { name: 'combate' });
    fireEvent.click(chipCombate);

    const inputTags = screen.getByLabelText(/tags/i);
    expect(inputTags).toHaveValue('combate');

    // Deseleccionar al hacer click nuevamente
    fireEvent.click(chipCombate);
    expect(inputTags).toHaveValue('');
  });

  it('llama a onGuardar con los datos formateados al enviar un formulario válido', async () => {
    const onGuardar = jest.fn().mockResolvedValue(undefined);
    const onCerrar = jest.fn();

    render(<ModalClasificarVideo abierto={true} onCerrar={onCerrar} onGuardar={onGuardar} />);

    await userEvent.type(screen.getByLabelText(/título visible/i), 'Patada en Hacha');
    await userEvent.type(screen.getByLabelText(/url del video/i), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await userEvent.type(screen.getByLabelText(/tags/i), 'patadas, avanzado');

    fireEvent.click(screen.getByRole('button', { name: /guardar y aprobar/i }));

    await waitFor(() => {
      expect(onGuardar).toHaveBeenCalledWith({
        titulo: 'Patada en Hacha',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        disciplina: 'Taekwondo',
        tags: ['patadas', 'avanzado'],
      });
      expect(onCerrar).toHaveBeenCalled();
    });
  });

  it('traduce el error Missing or insufficient permissions de Firebase al español', async () => {
    const onGuardar = jest.fn().mockRejectedValue(new Error('Missing or insufficient permissions.'));
    render(<ModalClasificarVideo abierto={true} onCerrar={jest.fn()} onGuardar={onGuardar} />);

    await userEvent.type(screen.getByLabelText(/título visible/i), 'Patada en Hacha');
    await userEvent.type(screen.getByLabelText(/url del video/i), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    fireEvent.click(screen.getByRole('button', { name: /guardar y aprobar/i }));

    expect(
      await screen.findByText(/permisos insuficientes para realizar esta acción/i)
    ).toBeInTheDocument();
  });

  describe('Pre-validación interactiva y bloqueo de reproducción', () => {
    class FakeYoutubePlayer {
      static instancias: FakeYoutubePlayer[] = [];
      events: any;
      constructor(_id: string, config: any) {
        this.events = config.events;
        FakeYoutubePlayer.instancias.push(this);
        Promise.resolve().then(() => this.events?.onReady?.());
      }
      getCurrentTime() { return 0; }
      getDuration() { return 90; }
      destroy() {}
    }

    beforeEach(() => {
      FakeYoutubePlayer.instancias = [];
      (window as any).YT = {
        Player: FakeYoutubePlayer,
        PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
      };
    });

    afterEach(() => {
      delete (window as any).YT;
    });

    it('monta la vista previa interactiva al ingresar una URL de YouTube válida', async () => {
      render(<ModalClasificarVideo abierto={true} onCerrar={jest.fn()} onGuardar={jest.fn()} />);

      fireEvent.change(screen.getByLabelText(/url del video/i), {
        target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      });

      expect((await screen.findAllByText(/vista previa del video/i)).length).toBeGreaterThan(0);
      await waitFor(() => {
        expect(FakeYoutubePlayer.instancias.length).toBeGreaterThan(0);
      });
    });

    it('bloquea el guardado y muestra alerta si YouTube reporta restricción de inserción (error 150/101)', async () => {
      const onGuardar = jest.fn();
      render(<ModalClasificarVideo abierto={true} onCerrar={jest.fn()} onGuardar={onGuardar} />);

      fireEvent.change(screen.getByLabelText(/título visible/i), {
        target: { value: 'Video Con Copyright' },
      });
      fireEvent.change(screen.getByLabelText(/url del video/i), {
        target: { value: 'https://www.youtube.com/watch?v=XKTP3sFOADM' },
      });

      // Esperar a que monte el FakeYoutubePlayer
      await waitFor(() => {
        expect(FakeYoutubePlayer.instancias.length).toBeGreaterThan(0);
      });

      const player = FakeYoutubePlayer.instancias[0];
      // Simula que YouTube dispara el error 150 (LatinAutor / embed blocked)
      act(() => {
        player.events?.onError?.({ data: 150 });
      });

      expect(
        await screen.findByText(/el propietario de este video no permite su reproducción insertada en sitios externos/i)
      ).toBeInTheDocument();

      const botonGuardar = screen.getByRole('button', { name: /guardar y aprobar/i });
      expect(botonGuardar).toBeDisabled();

      fireEvent.click(botonGuardar);
      expect(onGuardar).not.toHaveBeenCalled();
    });
  });
});
