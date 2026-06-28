import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificacionToast from './NotificacionToast';
import { useNotificacion } from '../context/NotificacionContext';

// Mock del contexto useNotificacion
jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: jest.fn(),
}));

// Mock de los componentes de iconos que son importados (IconoCerrar)
jest.mock('./Iconos', () => ({
  IconoCerrar: () => <svg data-testid="icon-cerrar" />,
}));

describe('NotificacionToast', () => {
  const mockOcultarNotificacion = jest.fn();

  beforeEach(() => {
    // Resetear el mock antes de cada test
    (useNotificacion as jest.Mock).mockReturnValue({
      toasts: [],
      ocultarNotificacion: mockOcultarNotificacion,
    });
    mockOcultarNotificacion.mockClear();
  });

  // Test Case 1: No debe renderizar ningún toast si la lista `toasts` está vacía.
  test('does not render any toast when the toasts list is empty', () => {
    render(<NotificacionToast />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Test Case 2.1: Debe renderizar un toast de tipo success
  test('renders a success toast with correct content and icon', () => {
    (useNotificacion as jest.Mock).mockReturnValue({
      toasts: [{ id: '1', tipo: 'success', mensaje: 'Operación exitosa!' }],
      ocultarNotificacion: mockOcultarNotificacion,
    });
    render(<NotificacionToast />);

    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Operación exitosa!');
    expect(toast).toHaveClass('bg-green-50'); // Check for success specific class

    // Check for success icon by its container color and presence of an SVG
    const successIconContainer = toast.querySelector('.flex-shrink-0.text-green-500');
    expect(successIconContainer).toBeInTheDocument();
    expect(successIconContainer?.querySelector('svg')).toBeInTheDocument();
  });

  // Test Case 2.2: Debe renderizar un toast de tipo error
  test('renders an error toast with correct content and icon', () => {
    (useNotificacion as jest.Mock).mockReturnValue({
      toasts: [{ id: '2', tipo: 'error', mensaje: 'Hubo un error.' }],
      ocultarNotificacion: mockOcultarNotificacion,
    });
    render(<NotificacionToast />);

    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Hubo un error.');
    expect(toast).toHaveClass('bg-red-50'); // Check for error specific class

    // Check for error icon by its container color and presence of an SVG
    const errorIconContainer = toast.querySelector('.flex-shrink-0.text-red-500');
    expect(errorIconContainer).toBeInTheDocument();
    expect(errorIconContainer?.querySelector('svg')).toBeInTheDocument();
  });

  // Test Case 2.3: Debe renderizar un toast de tipo info
  test('renders an info toast with correct content and icon', () => {
    (useNotificacion as jest.Mock).mockReturnValue({
      toasts: [{ id: '3', tipo: 'info', mensaje: 'Información importante.' }],
      ocultarNotificacion: mockOcultarNotificacion,
    });
    render(<NotificacionToast />);

    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Información importante.');
    expect(toast).toHaveClass('bg-blue-50'); // Check for info specific class

    // Check for info icon by its container color and presence of an SVG
    const infoIconContainer = toast.querySelector('.flex-shrink-0.text-blue-500');
    expect(infoIconContainer).toBeInTheDocument();
    expect(infoIconContainer?.querySelector('svg')).toBeInTheDocument();
  });

  // Test Case 2.4: Debe renderizar un toast de tipo warning
  test('renders a warning toast with correct content and icon', () => {
    (useNotificacion as jest.Mock).mockReturnValue({
      toasts: [{ id: '4', tipo: 'warning', mensaje: 'Advertencia del sistema.' }],
      ocultarNotificacion: mockOcultarNotificacion,
    });
    render(<NotificacionToast />);

    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Advertencia del sistema.');
    expect(toast).toHaveClass('bg-yellow-50'); // Check for warning specific class

    // Check for warning icon by its container color and presence of an SVG (warning uses error icon)
    const warningIconContainer = toast.querySelector('.flex-shrink-0.text-yellow-500');
    expect(warningIconContainer).toBeInTheDocument();
    expect(warningIconContainer?.querySelector('svg')).toBeInTheDocument();
  });

  // Test Case 3: Debe renderizar varios toasts de diferentes tipos simultáneamente.
  test('renders multiple toasts of different types', () => {
    (useNotificacion as jest.Mock).mockReturnValue({
      toasts: [
        { id: '1', tipo: 'success', mensaje: 'Toast 1' },
        { id: '2', tipo: 'error', mensaje: 'Toast 2' },
        { id: '3', tipo: 'info', mensaje: 'Toast 3' },
      ],
      ocultarNotificacion: mockOcultarNotificacion,
    });
    render(<NotificacionToast />);

    const toasts = screen.getAllByRole('alert');
    expect(toasts).toHaveLength(3);
    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
  });

  // Test Case 4: Al hacer clic en el botón de cerrar de un toast, debe llamar a la función ocultarNotificacion con el id correcto de ese toast.
  test('calls ocultarNotificacion with the correct id when close button is clicked', async () => {
    (useNotificacion as jest.Mock).mockReturnValue({
      toasts: [{ id: '5', tipo: 'info', mensaje: 'Click para cerrar.' }],
      ocultarNotificacion: mockOcultarNotificacion,
    });
    render(<NotificacionToast />);

    const closeButton = screen.getByLabelText('Cerrar');
    await userEvent.click(closeButton);

    expect(mockOcultarNotificacion).toHaveBeenCalledTimes(1);
    expect(mockOcultarNotificacion).toHaveBeenCalledWith('5');
  });

  // Test Case 5: Accesibilidad - Cada elemento toast debe tener el role="alert". (Already covered by getByRole)
  // Test Case 5: Accesibilidad - El botón de cerrar de cada toast debe tener el aria-label="Cerrar". (Already covered by getByLabelText)
});
