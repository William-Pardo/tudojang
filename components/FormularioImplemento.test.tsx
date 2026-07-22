import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import FormularioImplemento from './FormularioImplemento';
import { CategoriaImplemento } from '../tipos';

describe('FormularioImplemento', () => {
  const onCerrarMock = jest.fn();
  const onGuardarMock = jest.fn() as any;

  const defaultProps = {
    abierto: true,
    onCerrar: onCerrarMock,
    onGuardar: onGuardarMock,
    itemActual: null,
    cargando: false
  };

  const mockFileReaderInstance = {
    result: 'data:image/png;base64,mockedbase64',
    readAsDataURL: jest.fn().mockImplementation(function (this: any) {
      if (this.onloadend) {
        this.onloadend();
      }
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReaderInstance as any);
  });

  it('no renderiza nada cuando está cerrado', () => {
    const { container } = render(<FormularioImplemento {...defaultProps} abierto={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza correctamente el formulario para registrar un implemento', () => {
    const { container } = render(<FormularioImplemento {...defaultProps} />);
    expect(screen.getByText('Editor de Equipamiento')).toBeInTheDocument();
    expect(container.querySelector('input[name="nombre"]')).toHaveValue('');
    expect(container.querySelector('select[name="categoria"]')).toHaveValue(CategoriaImplemento.Uniformes);
    expect(container.querySelector('textarea[name="descripcion"]')).toHaveValue('');
    expect(screen.getByText('Sin Imagen')).toBeInTheDocument();
  });

  it('pre-rellena el formulario cuando se edita un implemento existente', () => {
    const item = {
      id: 'item-1',
      nombre: 'Guantes de Boxeo',
      descripcion: 'Guantes de entrenamiento de 12oz',
      // Fix 2026-07-21 (`npm run typecheck`): CategoriaImplemento.Protecciones NO EXISTE.
      // Los valores reales son ProteccionTorso/ProteccionCabeza/ProteccionExtremidades. Para
      // "Guantes de Boxeo" corresponde ProteccionExtremidades. Antes la assertion de abajo
      // comparaba contra `undefined`, o sea que no verificaba la categoria en absoluto.
      categoria: CategoriaImplemento.ProteccionExtremidades,
      imagenUrl: 'https://example.com/imagen.png',
      variaciones: [{ id: 'v-1', descripcion: '12 OZ / AZUL', precio: 120000 }]
    };
    const { container } = render(<FormularioImplemento {...defaultProps} itemActual={item} />);
    expect(container.querySelector('input[name="nombre"]')).toHaveValue('Guantes de Boxeo');
    expect(container.querySelector('select[name="categoria"]')).toHaveValue(CategoriaImplemento.ProteccionExtremidades);
    expect(container.querySelector('textarea[name="descripcion"]')).toHaveValue('Guantes de entrenamiento de 12oz');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/imagen.png');
  });

  it('muestra mensajes de error cuando los campos requeridos están vacíos', async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioImplemento {...defaultProps} />);

    // Borrar variaciones por defecto para forzar validación min(1)
    const deleteBtn = container.querySelector('button.text-tkd-red')!;
    await user.click(deleteBtn);

    const saveBtn = container.querySelector('button.bg-tkd-red')!;
    await user.click(saveBtn);

    expect(await screen.findByText('El nombre comercial es obligatorio.')).toBeInTheDocument();
    expect(await screen.findByText('Describe las especificaciones técnicas.')).toBeInTheDocument();
    expect(await screen.findByText('Revisar parámetros de variaciones.')).toBeInTheDocument();
    expect(onGuardarMock).not.toHaveBeenCalled();
  });

  it('permite cargar una imagen a través del file input y previsualizarla', async () => {
    const { container } = render(<FormularioImplemento {...defaultProps} />);
    const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]')!;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockFileReaderInstance.readAsDataURL).toHaveBeenCalledWith(file);
      expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,mockedbase64');
    });
  });

  it('agrega y elimina variaciones dinámicamente', async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioImplemento {...defaultProps} />);

    // Inicialmente hay una variación (variaciones.0.descripcion)
    expect(container.querySelectorAll('input[name*="descripcion"]').length).toBe(1);

    // Agregar nueva opción
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Nueva Opción'))!;
    await user.click(addBtn);

    // Ahora debería haber una variación más
    expect(container.querySelectorAll('input[name*="precio"]').length).toBe(2);

    // Eliminar la segunda variación
    const deleteButtons = container.querySelectorAll('button.text-tkd-red');
    await user.click(deleteButtons[1]); // Clic en el botón eliminar de la segunda variación

    expect(container.querySelectorAll('input[name*="precio"]').length).toBe(1);
  });

  it('llama a onGuardar y onCerrar al enviar un formulario válido', async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioImplemento {...defaultProps} />);

    await user.type(container.querySelector('input[name="nombre"]')!, 'Dobok Master');
    await user.type(container.querySelector('textarea[name="descripcion"]')!, 'Dobok oficial de taekwondo homologado');
    await user.selectOptions(container.querySelector('select[name="categoria"]')!, CategoriaImplemento.Uniformes);
    
    // Rellenar la primera variación
    const descVar = container.querySelector('input[name="variaciones.0.descripcion"]')!;
    const precioVar = container.querySelector('input[name="variaciones.0.precio"]')!;
    await user.clear(descVar);
    await user.type(descVar, 'Talla 160');
    await user.clear(precioVar);
    await user.type(precioVar, '180000');

    const saveBtn = container.querySelector('button.bg-tkd-red')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalledWith(expect.objectContaining({
        nombre: 'Dobok Master',
        descripcion: 'Dobok oficial de taekwondo homologado',
        categoria: CategoriaImplemento.Uniformes,
        variaciones: [
          expect.objectContaining({
            descripcion: 'Talla 160',
            precio: 180000
          })
        ]
      }));
      expect(onCerrarMock).toHaveBeenCalled();
    });
  });

  it('llama a onGuardar con el itemActual unificado al enviar un formulario válido en modo edición', async () => {
    const user = userEvent.setup();
    const item = {
      id: 'item-1',
      nombre: 'Guantes de Boxeo',
      descripcion: 'Guantes de entrenamiento de 12oz',
      categoria: CategoriaImplemento.Uniformes,
      imagenUrl: 'https://example.com/imagen.png',
      variaciones: [{ id: 'v-1', descripcion: '12 OZ / AZUL', precio: 120000 }]
    };
    const { container } = render(<FormularioImplemento {...defaultProps} itemActual={item} />);

    await user.clear(container.querySelector('input[name="nombre"]')!);
    await user.type(container.querySelector('input[name="nombre"]')!, 'Guantes Pro');

    const saveBtn = container.querySelector('button.bg-tkd-red')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'item-1',
        nombre: 'Guantes Pro',
        descripcion: 'Guantes de entrenamiento de 12oz',
        categoria: CategoriaImplemento.Uniformes,
        variaciones: [
          expect.objectContaining({
            descripcion: '12 OZ / AZUL',
            precio: 120000
          })
        ]
      }));
      expect(onCerrarMock).toHaveBeenCalled();
    });
  });

  it('muestra loader spinner cuando cargando es true', () => {
    const { container } = render(<FormularioImplemento {...defaultProps} cargando={true} />);
    const saveBtn = container.querySelector('button.bg-tkd-red') as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
    expect(saveBtn.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('llama a onCerrar al hacer clic en cancelar o en el botón del encabezado', async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioImplemento {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCerrarMock).toHaveBeenCalledTimes(1);

    await user.click(container.querySelector('header button')!); // Botón X del encabezado
    expect(onCerrarMock).toHaveBeenCalledTimes(2);
  });
});
