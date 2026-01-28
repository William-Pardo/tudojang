// components/ModalConfirmacion.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// FIX: Added 'expect' to the import from '@jest/globals' to resolve type inference issues with jest-dom matchers.
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import ModalConfirmacion from './ModalConfirmacion';

describe('ModalConfirmacion', () => {
  const onConfirmarMock = jest.fn();
  const onCerrarMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no renderiza nada si "abierto" es falso', () => {
    render(
      <ModalConfirmacion
        abierto={false}
        titulo="Test"
        mensaje="¿Seguro?"
        onCerrar={onCerrarMock}
        onConfirmar={onConfirmarMock}
        cargando={false}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renderiza el modal con el título y mensaje correctos', () => {
    render(
      <ModalConfirmacion
        abierto={true}
        titulo="Eliminar Ítem"
        mensaje="¿Estás seguro de que quieres eliminar este ítem?"
        onCerrar={onCerrarMock}
        onConfirmar={onConfirmarMock}
        cargando={false}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Eliminar Ítem')).toBeInTheDocument();
    expect(screen.getByText('¿Estás seguro de que quieres eliminar este ítem?')).toBeInTheDocument();
  });

  it('llama a onConfirmar cuando se hace clic en el botón de confirmar', () => {
    render(
      <ModalConfirmacion
        abierto={true}
        titulo="Confirmar"
        mensaje="Proceder"
        onCerrar={onCerrarMock}
        onConfirmar={onConfirmarMock}
        cargando={false}
        textoBotonConfirmar="Sí, proceder"
      />
    );

    const botonConfirmar = screen.getByText('Sí, proceder');
    fireEvent.click(botonConfirmar);
    expect(onConfirmarMock).toHaveBeenCalledTimes(1);
  });

  it('llama a onCerrar cuando se hace clic en el botón de cancelar', () => {
    render(
      <ModalConfirmacion
        abierto={true}
        titulo="Confirmar"
        mensaje="Proceder"
        onCerrar={onCerrarMock}
        onConfirmar={onConfirmarMock}
        cargando={false}
      />
    );

    const botonCancelar = screen.getByText('Cancelar');
    fireEvent.click(botonCancelar);
    expect(onCerrarMock).toHaveBeenCalledTimes(1);
  });

  it('deshabilita los botones cuando "cargando" es verdadero', () => {
    render(
      <ModalConfirmacion
        abierto={true}
        titulo="Cargando"
        mensaje="Espere..."
        onCerrar={onCerrarMock}
        onConfirmar={onConfirmarMock}
        cargando={true}
      />
    );
    
    expect(screen.getByText('Procesando...')).toBeInTheDocument();
    expect(screen.getByText('Procesando...').closest('button')).toBeDisabled();
    expect(screen.getByText('Cancelar').closest('button')).toBeDisabled();
  });
});