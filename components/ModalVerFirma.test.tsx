import React from 'react';
import { render, screen, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalVerFirma from './ModalVerFirma';

describe('ModalVerFirma', () => {
  const mockOnCerrar = jest.fn();
  const baseProps = {
    abierto: false,
    onCerrar: mockOnCerrar,
    firmaDigital: '',
    nombreTutor: 'Nombre Tutor Prueba',
  };

  const abrirModal = async (props: Partial<React.ComponentProps<typeof ModalVerFirma>> = {}) => {
    render(<ModalVerFirma {...baseProps} abierto={true} {...props} />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  };

  beforeEach(() => {
    mockOnCerrar.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('renders null when abierto is false', () => {
    const { container } = render(<ModalVerFirma {...baseProps} abierto={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the modal when abierto is true', async () => {
    await abrirModal();
    const modal = screen.getByRole('dialog');
    const content = modal.querySelector('.bg-white') as HTMLElement;
    expect(modal).toHaveClass('bg-opacity-60');
    expect(content).toHaveClass('opacity-100', 'scale-100');
  });

  test('displays signature image when firmaDigital is a valid base64 string', async () => {
    const mockFirma = 'data:image/png;base64,mockdata';
    await abrirModal({ firmaDigital: mockFirma });
    const signatureImage = screen.getByAltText(`Firma de ${baseProps.nombreTutor}`);
    expect(signatureImage).toBeInTheDocument();
    expect(signatureImage).toHaveAttribute('src', mockFirma);
  });

  test('displays no signature message when firmaDigital is empty string', async () => {
    await abrirModal({ firmaDigital: '' });
    expect(screen.getByText('No hay una imagen de firma disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('displays no signature message when firmaDigital is null', async () => {
    await abrirModal({ firmaDigital: null as any });
    expect(screen.getByText('No hay una imagen de firma disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('displays no signature message when firmaDigital is undefined', async () => {
    await abrirModal({ firmaDigital: undefined as any });
    expect(screen.getByText('No hay una imagen de firma disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('calls onCerrar when header close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await abrirModal();
    await user.click(screen.getByTitle('Cerrar modal'));
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(mockOnCerrar).toHaveBeenCalledTimes(1);
  });

  test('calls onCerrar when footer close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await abrirModal();
    const dialog = screen.getByRole('dialog');
    const footer = dialog.querySelector('footer') as HTMLElement;
    await user.click(within(footer).getByRole('button', { name: 'Cerrar' }));
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(mockOnCerrar).toHaveBeenCalledTimes(1);
  });

  test('calls onCerrar when clicking on the overlay', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await abrirModal();
    await user.click(screen.getByRole('dialog'));
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(mockOnCerrar).toHaveBeenCalledTimes(1);
  });

  test('does not call onCerrar when clicking inside the modal content', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await abrirModal();
    const modalContent = screen.getByRole('dialog').querySelector('.bg-white') as HTMLElement;
    await user.click(modalContent);
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(mockOnCerrar).not.toHaveBeenCalled();
  });

  test('displays nombreTutor in the modal title', async () => {
    await abrirModal();
    expect(screen.getByRole('heading', { name: `Firma de ${baseProps.nombreTutor}` })).toBeInTheDocument();
  });

  test('signature image has correct alt text', async () => {
    const mockFirma = 'data:image/png;base64,mockdata';
    await abrirModal({ firmaDigital: mockFirma });
    expect(screen.getByAltText(`Firma de ${baseProps.nombreTutor}`)).toBeInTheDocument();
  });

  test('modal has correct accessibility attributes', async () => {
    await abrirModal();
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('role', 'dialog');
  });
});
