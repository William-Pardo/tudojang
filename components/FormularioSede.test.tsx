import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no renderiza nada cuando está cerrado', () => {
    const { container } = render(<FormularioSede {...defaultProps} abierto={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza correctamente el formulario para crear una nueva sede', () => {
    const { container } = render(<FormularioSede {...defaultProps} />);
    expect(screen.getByText('Nueva Sede')).toBeInTheDocument();
    
    expect(container.querySelector('input[name="nombre"]')).toHaveValue('');
    expect(container.querySelector('input[name="direccion"]')).toHaveValue('');
    expect(container.querySelector('input[name="ciudad"]')).toHaveValue('');
    expect(container.querySelector('input[name="telefono"]')).toHaveValue('');
    expect(container.querySelector('input[name="valorMensualidad"]')).toHaveValue(0);
  });

  it('pre-rellena el formulario cuando se edita una sede existente', () => {
    const sede = {
      id: 'sede-1',
      nombre: 'Sede Central',
      direccion: 'Carrera 10 # 5',
      ciudad: 'Cali',
      telefono: '3151234567',
      valorMensualidad: 60000
    };
    const { container } = render(<FormularioSede {...defaultProps} sedeActual={sede} />);
    expect(screen.getByText('Editar Sede')).toBeInTheDocument();
    expect(container.querySelector('input[name="nombre"]')).toHaveValue('Sede Central');
    expect(container.querySelector('input[name="direccion"]')).toHaveValue('Carrera 10 # 5');
    expect(container.querySelector('input[name="ciudad"]')).toHaveValue('Cali');
    expect(container.querySelector('input[name="telefono"]')).toHaveValue('3151234567');
    expect(container.querySelector('input[name="valorMensualidad"]')).toHaveValue(60000);
  });

  it('muestra mensajes de error cuando los campos requeridos están vacíos', async () => {
    const user = userEvent.setup();
    render(<FormularioSede {...defaultProps} />);
    
    // Intentar enviar formulario vacío
    await user.click(screen.getByRole('button', { name: /Guardar Sede/i }));

    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    expect(await screen.findByText('La dirección es obligatoria.')).toBeInTheDocument();
    expect(await screen.findByText('La ciudad es obligatoria.')).toBeInTheDocument();
    expect(await screen.findByText('El teléfono es obligatorio.')).toBeInTheDocument();
    expect(onGuardarMock).not.toHaveBeenCalled();
  });

  it('llama a onGuardar con los datos correctos al crear una nueva sede', async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioSede {...defaultProps} />);

    await user.type(container.querySelector('input[name="nombre"]')!, 'Sede Norte');
    await user.type(container.querySelector('input[name="direccion"]')!, 'Calle 100 # 20');
    await user.type(container.querySelector('input[name="ciudad"]')!, 'Bogotá');
    await user.type(container.querySelector('input[name="telefono"]')!, '3007654321');
    await user.clear(container.querySelector('input[name="valorMensualidad"]')!);
    await user.type(container.querySelector('input[name="valorMensualidad"]')!, '45000');

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
    const user = userEvent.setup();
    const sede = {
      id: 'sede-2',
      nombre: 'Sede Antigua',
      direccion: 'Av 0',
      ciudad: 'Medellín',
      telefono: '000000',
      valorMensualidad: 5000
    };
    const { container } = render(<FormularioSede {...defaultProps} sedeActual={sede} />);

    await user.clear(container.querySelector('input[name="nombre"]')!);
    await user.type(container.querySelector('input[name="nombre"]')!, 'Sede Renovada');

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
    const user = userEvent.setup();
    const { container } = render(<FormularioSede {...defaultProps} />);

    await user.type(container.querySelector('input[name="nombre"]')!, 'Sede Test');
    await user.type(container.querySelector('input[name="direccion"]')!, 'Calle 1');
    await user.type(container.querySelector('input[name="ciudad"]')!, 'Cali');
    await user.type(container.querySelector('input[name="telefono"]')!, '1234');
    
    // Test valor negativo
    await user.clear(container.querySelector('input[name="valorMensualidad"]')!);
    await user.type(container.querySelector('input[name="valorMensualidad"]')!, '-50');
    await user.click(screen.getByRole('button', { name: /Guardar Sede/i }));
    
    // Debería bloquear el submit (onGuardar no se llama)
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(onGuardarMock).not.toHaveBeenCalled();
  });

  it('se deshabilita el botón de submit cuando cargando es true', () => {
    render(<FormularioSede {...defaultProps} cargando={true} />);
    const submitBtn = screen.getByRole('button', { name: '...' });
    expect(submitBtn).toBeDisabled();
  });

  it('llama a onCerrar al hacer clic en cancelar o en cerrar', async () => {
    const user = userEvent.setup();
    render(<FormularioSede {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCerrarMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole('button')[0]); // Cerrar header button (X)
    expect(onCerrarMock).toHaveBeenCalledTimes(2);
  });
});
