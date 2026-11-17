import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
});
