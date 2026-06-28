import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import FormularioSede from './FormularioSede';

describe('FormularioSede', () => {
  const onCerrarMock = jest.fn();
  const onGuardarMock = jest.fn() as any;

  const defaultProps = {
    abierto: true,
    onCerrar: onCerrarMock,
    onGuardar: onGuardarMock,
    sedeActual: null,
    cargando: false
  };

  const setupUser = () => userEvent.setup({ delay: null });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no renderiza nada cuando está cerrado', () => {
    const { container } = render(<FormularioSede {...defaultProps} abierto={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza correctamente el formulario para crear una nueva sede', async () => {
    const { container } = render(<FormularioSede {...defaultProps} />);
    expect(await screen.findByText('Nueva Sede')).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector('input[name="nombre"]')).toHaveValue('');
      expect(container.querySelector('input[name="direccion"]')).toHaveValue('');
      expect(container.querySelector('input[name="ciudad"]')).toHaveValue('');
      expect(container.querySelector('input[name="telefono"]')).toHaveValue('');
      expect(container.querySelector('input[name="valorMensualidad"]')).toHaveValue(null);
    });
  });

  it('pre-rellena el formulario cuando se edita una sede existente', async () => {
    const sede = {
      id: 'sede-1',
      nombre: 'Sede Central',
      direccion: 'Carrera 10 # 5',
      ciudad: 'Cali',
      telefono: '3151234567',
      valorMensualidad: 60000
    };
    const { container } = render(<FormularioSede {...defaultProps} sedeActual={sede} />);
    expect(await screen.findByText('Editar Sede')).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector('input[name="nombre"]')).toHaveValue('Sede Central');
      expect(container.querySelector('input[name="direccion"]')).toHaveValue('Carrera 10 # 5');
      expect(container.querySelector('input[name="ciudad"]')).toHaveValue('Cali');
      expect(container.querySelector('input[name="telefono"]')).toHaveValue('3151234567');
      expect(container.querySelector('input[name="valorMensualidad"]')).toHaveValue(60000);
    });
  });

  it('muestra mensajes de error cuando los campos requeridos están vacíos', async () => {
    const user = setupUser();
    render(<FormularioSede {...defaultProps} />);

    await user.click(await screen.findByRole('button', { name: /Guardar Sede/i }));

    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('La dirección es obligatoria.')).toBeInTheDocument();
    expect(screen.getByText('La ciudad es obligatoria.')).toBeInTheDocument();
    expect(screen.getByText('El teléfono es obligatorio.')).toBeInTheDocument();
    expect(onGuardarMock).not.toHaveBeenCalled();
  });

  it('llama a onGuardar con los datos correctos al crear una nueva sede', async () => {
    const user = setupUser();
    const { container } = render(<FormularioSede {...defaultProps} />);
    await screen.findByText('Nueva Sede');

    fireEvent.change(container.querySelector('input[name="nombre"]')!, { target: { value: 'Sede Norte' } });
    fireEvent.change(container.querySelector('input[name="direccion"]')!, { target: { value: 'Calle 100 # 20' } });
    fireEvent.change(container.querySelector('input[name="ciudad"]')!, { target: { value: 'Bogotá' } });
    fireEvent.change(container.querySelector('input[name="telefono"]')!, { target: { value: '3007654321' } });
    fireEvent.change(container.querySelector('input[name="valorMensualidad"]')!, { target: { value: '45000' } });

    await user.click(screen.getByRole('button', { name: /Guardar Sede/i }));

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalledWith({
        nombre: 'Sede Norte',
        direccion: 'Calle 100 # 20',
        ciudad: 'Bogotá',
        telefono: '3007654321',
        valorMensualidad: 45000
      });
    });
  });

  it('llama a onGuardar con la sede unificada al editar una sede', async () => {
    const user = setupUser();
    const sede = {
      id: 'sede-2',
      nombre: 'Sede Antigua',
      direccion: 'Av 0',
      ciudad: 'Medellín',
      telefono: '000000',
      valorMensualidad: 5000
    };
    const { container } = render(<FormularioSede {...defaultProps} sedeActual={sede} />);
    await screen.findByText('Editar Sede');

    fireEvent.change(container.querySelector('input[name="nombre"]')!, { target: { value: 'Sede Renovada' } });

    await user.click(screen.getByRole('button', { name: /Guardar Sede/i }));

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalledWith({
        id: 'sede-2',
        nombre: 'Sede Renovada',
        direccion: 'Av 0',
        ciudad: 'Medellín',
        telefono: '000000',
        valorMensualidad: 5000
      });
    });
  });

  it('bloquea el submit si valorMensualidad es negativo', async () => {
    const user = setupUser();
    const { container } = render(<FormularioSede {...defaultProps} />);
    await screen.findByText('Nueva Sede');

    fireEvent.change(container.querySelector('input[name="nombre"]')!, { target: { value: 'Sede Test' } });
    fireEvent.change(container.querySelector('input[name="direccion"]')!, { target: { value: 'Calle 1' } });
    fireEvent.change(container.querySelector('input[name="ciudad"]')!, { target: { value: 'Cali' } });
    fireEvent.change(container.querySelector('input[name="telefono"]')!, { target: { value: '1234' } });
    fireEvent.change(container.querySelector('input[name="valorMensualidad"]')!, { target: { value: '-50' } });

    await user.click(screen.getByRole('button', { name: /Guardar Sede/i }));

    await waitFor(() => {
      expect(onGuardarMock).not.toHaveBeenCalled();
    });
  });

  it('se deshabilita el botón de submit cuando cargando es true', () => {
    render(<FormularioSede {...defaultProps} cargando={true} />);
    const submitBtn = screen.getByRole('button', { name: '...' });
    expect(submitBtn).toBeDisabled();
  });

  it('llama a onCerrar al hacer clic en cancelar o en cerrar', async () => {
    const user = setupUser();
    render(<FormularioSede {...defaultProps} />);
    await screen.findByText('Nueva Sede');

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCerrarMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole('button')[0]);
    expect(onCerrarMock).toHaveBeenCalledTimes(2);
  });
});
