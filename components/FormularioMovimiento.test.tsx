import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import FormularioMovimiento from './FormularioMovimiento';
import { TipoMovimiento, CategoriaFinanciera, type Sede, type MovimientoFinanciero } from '../tipos';

describe('FormularioMovimiento', () => {
  const onCerrarMock = jest.fn();
  const onGuardarMock = jest.fn() as any;

  const mockSedes: Sede[] = [
    { id: 'sede-1', nombre: 'Sede Principal', ciudad: 'Bogotá', direccion: 'Calle 1', telefono: '123' },
    { id: 'sede-2', nombre: 'Sede Secundaria', ciudad: 'Medellín', direccion: 'Calle 2', telefono: '456' }
  ];

  const defaultProps = {
    abierto: true,
    onCerrar: onCerrarMock,
    onGuardar: onGuardarMock,
    sedes: mockSedes,
    cargando: false,
    movimientoActual: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no renderiza nada cuando está cerrado', () => {
    const { container } = render(<FormularioMovimiento {...defaultProps} abierto={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza correctamente el formulario para registrar un movimiento', () => {
    const { container } = render(<FormularioMovimiento {...defaultProps} />);
    expect(screen.getByText('Nuevo Movimiento')).toBeInTheDocument();
    
    expect(container.querySelector('select[name="tipo"]')).toHaveValue(TipoMovimiento.Ingreso);
    expect(container.querySelector('select[name="categoria"]')).toHaveValue(CategoriaFinanciera.Otros);
    expect(container.querySelector('select[name="sedeId"]')).toHaveValue('sede-1');
    expect(container.querySelector('input[name="monto"]')).toHaveValue(0);
    expect(container.querySelector('input[name="descripcion"]')).toHaveValue('');
    expect(container.querySelector('input[name="categoriaNueva"]')).not.toBeInTheDocument();
  });

  it('pre-rellena el formulario cuando se edita un movimiento con categoría estándar', () => {
    const movimiento: MovimientoFinanciero = {
      id: 'mov-1',
      tipo: TipoMovimiento.Egreso,
      categoria: CategoriaFinanciera.Servicios,
      monto: 150000,
      descripcion: 'Pago de luz',
      fecha: '2026-06-20',
      sedeId: 'sede-2',
      tenantId: 'test-tenant'
    };
    const { container } = render(<FormularioMovimiento {...defaultProps} movimientoActual={movimiento} />);
    expect(screen.getByText('Editar Movimiento')).toBeInTheDocument();
    expect(container.querySelector('select[name="tipo"]')).toHaveValue(TipoMovimiento.Egreso);
    expect(container.querySelector('select[name="categoria"]')).toHaveValue(CategoriaFinanciera.Servicios);
    expect(container.querySelector('input[name="monto"]')).toHaveValue(150000);
    expect(container.querySelector('input[name="descripcion"]')).toHaveValue('Pago de luz');
    expect(container.querySelector('select[name="sedeId"]')).toHaveValue('sede-2');
    expect(container.querySelector('input[name="categoriaNueva"]')).not.toBeInTheDocument();
  });

  it('pre-rellena el formulario cuando se edita un movimiento con categoría personalizada', () => {
    const movimiento: MovimientoFinanciero = {
      id: 'mov-2',
      tipo: TipoMovimiento.Egreso,
      categoria: 'Publicidad Especial',
      monto: 300000,
      descripcion: 'Volantes de calle',
      fecha: '2026-06-20',
      sedeId: 'sede-1',
      tenantId: 'test-tenant'
    };
    const { container } = render(<FormularioMovimiento {...defaultProps} movimientoActual={movimiento} />);
    expect(container.querySelector('select[name="categoria"]')).toHaveValue('__NUEVA__');
    expect(container.querySelector('input[name="categoriaNueva"]')).toHaveValue('Publicidad Especial');
  });

  it('muestra mensajes de error cuando los campos requeridos están vacíos o el monto es menor o igual a cero', async () => {
    const user = userEvent.setup();
    render(<FormularioMovimiento {...defaultProps} />);

    // Intentar enviar formulario vacío (monto es 0 por defecto, lo cual falla la regla de positivo)
    await user.click(screen.getByRole('button', { name: /Registrar/i }));

    expect(await screen.findByText('El monto debe ser mayor a 0')).toBeInTheDocument();
    expect(await screen.findByText('La descripción es obligatoria.')).toBeInTheDocument();
    expect(onGuardarMock).not.toHaveBeenCalled();
  });

  it('muestra error de categoría personalizada cuando se selecciona la opción de nueva categoría pero queda vacía', async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioMovimiento {...defaultProps} />);

    await user.selectOptions(container.querySelector('select[name="categoria"]')!, '__NUEVA__');
    expect(container.querySelector('input[name="categoriaNueva"]')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Registrar/i }));
    expect(await screen.findByText('Debes escribir el nombre de la nueva categoría.')).toBeInTheDocument();
  });

  it('llama a onGuardar con los datos correctos en modo de creación con categoría estándar', async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioMovimiento {...defaultProps} />);

    await user.selectOptions(container.querySelector('select[name="tipo"]')!, TipoMovimiento.Ingreso);
    await user.selectOptions(container.querySelector('select[name="categoria"]')!, CategoriaFinanciera.Mensualidad);
    await user.type(container.querySelector('input[name="monto"]')!, '120000');
    await user.type(container.querySelector('input[name="descripcion"]')!, 'Mensualidad Alumno');
    await user.selectOptions(container.querySelector('select[name="sedeId"]')!, 'sede-2');

    await user.click(screen.getByRole('button', { name: /Registrar/i }));

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalledWith({
        tipo: TipoMovimiento.Ingreso,
        categoria: CategoriaFinanciera.Mensualidad,
        monto: 120000,
        descripcion: 'Mensualidad Alumno',
        fecha: expect.any(String),
        sedeId: 'sede-2'
      });
    });
  });

  it('llama a onGuardar mapeando la categoría personalizada al enviar el formulario', async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioMovimiento {...defaultProps} />);

    await user.selectOptions(container.querySelector('select[name="categoria"]')!, '__NUEVA__');
    await user.type(container.querySelector('input[name="categoriaNueva"]')!, 'Mantenimiento Luces');
    await user.type(container.querySelector('input[name="monto"]')!, '45000');
    await user.type(container.querySelector('input[name="descripcion"]')!, 'Bombillos Sede');

    await user.click(screen.getByRole('button', { name: /Registrar/i }));

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalledWith({
        tipo: TipoMovimiento.Ingreso,
        categoria: 'Mantenimiento Luces',
        monto: 45000,
        descripcion: 'Bombillos Sede',
        fecha: expect.any(String),
        sedeId: 'sede-1'
      });
    });
  });

  it('llama a onGuardar con los datos unificados en modo de edición', async () => {
    const user = userEvent.setup();
    const movimiento: MovimientoFinanciero = {
      id: 'mov-3',
      tipo: TipoMovimiento.Ingreso,
      categoria: CategoriaFinanciera.Inscripcion,
      monto: 80000,
      descripcion: 'Inscripción Inicial',
      fecha: '2026-06-21',
      sedeId: 'sede-1',
      tenantId: 'test-tenant'
    };
    const { container } = render(<FormularioMovimiento {...defaultProps} movimientoActual={movimiento} />);

    await user.clear(container.querySelector('input[name="descripcion"]')!);
    await user.type(container.querySelector('input[name="descripcion"]')!, 'Inscripción Corregida');

    await user.click(screen.getByRole('button', { name: /Actualizar/i }));

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalledWith({
        id: 'mov-3',
        tipo: TipoMovimiento.Ingreso,
        categoria: CategoriaFinanciera.Inscripcion,
        monto: 80000,
        descripcion: 'Inscripción Corregida',
        fecha: '2026-06-21',
        sedeId: 'sede-1',
        tenantId: 'test-tenant'
      });
    });
  });

  it('deshabilita el botón de guardar y muestra cargando en true', () => {
    render(<FormularioMovimiento {...defaultProps} cargando={true} />);
    const submitBtn = screen.getByRole('button', { name: /Guardando\.\.\./i });
    expect(submitBtn).toBeDisabled();
  });

  it('llama a onCerrar al hacer clic en cancelar o en el botón del encabezado', async () => {
    const user = userEvent.setup();
    render(<FormularioMovimiento {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCerrarMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole('button')[0]); // Botón X del encabezado
    expect(onCerrarMock).toHaveBeenCalledTimes(2);
  });
});
