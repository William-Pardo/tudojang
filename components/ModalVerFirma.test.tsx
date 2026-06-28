// ModalVerFirma.test.tsx – corrected
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalVerFirma from './ModalVerFirma';

// Mock framer-motion globally
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    // Add other motion components if needed
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock IconoCerrar component
jest.mock('./Iconos', () => ({
  IconoCerrar: () => <svg data-testid="icon-cerrar" />,
}));

describe('ModalVerFirma', () => {
  const mockOnCerrar = jest.fn();
  const baseProps = {
    abierto: false,
    onCerrar: mockOnCerrar,
    firmaDigital: '',
    nombreTutor: 'Nombre Tutor Prueba',
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
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} />);
      jest.advanceTimersByTime(10);
    });
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    // Verify transition classes after visibility
    const overlay = modal;
    const content = overlay.querySelector('.bg-white') as HTMLElement;
    expect(overlay).toHaveClass('bg-opacity-60');
    expect(content).toHaveClass('opacity-100', 'scale-100');
  }, 10000);

  test('displays signature image when firmaDigital is a valid base64 string', async () => {
    const mockFirma = 'data:image/png;base64,mockdata';
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} firmaDigital={mockFirma} />);
      jest.advanceTimersByTime(10);
    });
    const signatureImage = screen.getByAltText(`Firma de ${baseProps.nombreTutor}`);
    expect(signatureImage).toBeInTheDocument();
    expect(signatureImage).toHaveAttribute('src', mockFirma);
  }, 10000);

  test('displays no signature message when firmaDigital is empty string', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} firmaDigital="" />);
      jest.advanceTimersByTime(10);
    });
    expect(screen.getByText('No hay una imagen de firma disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('displays no signature message when firmaDigital is null', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} firmaDigital={null as any} />);
      jest.advanceTimersByTime(10);
    });
    expect(screen.getByText('No hay una imagen de firma disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('displays no signature message when firmaDigital is undefined', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} firmaDigital={undefined as any} />);
      jest.advanceTimersByTime(10);
    });
    expect(screen.getByText('No hay una imagen de firma disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('calls onCerrar when header close button is clicked', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} />);
      jest.advanceTimersByTime(10);
    });
    const headerCloseButton = screen.getByTitle('Cerrar modal');
    await act(async () => {
      await userEvent.click(headerCloseButton);
      jest.advanceTimersByTime(200);
    });
    expect(mockOnCerrar).toHaveBeenCalledTimes(1);
  });

  test('calls onCerrar when footer close button is clicked', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} />);
      jest.advanceTimersByTime(10);
    });
    const footerCloseButton = screen.getByRole('button', { name: 'Cerrar' });
    await act(async () => {
      await userEvent.click(footerCloseButton);
      jest.advanceTimersByTime(200);
    });
    expect(mockOnCerrar).toHaveBeenCalledTimes(1);
  });

  test('calls onCerrar when clicking on the overlay', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} />);
      jest.advanceTimersByTime(10);
    });
    const overlay = screen.getByRole('dialog');
    await act(async () => {
      await userEvent.click(overlay);
      jest.advanceTimersByTime(200);
    });
    expect(mockOnCerrar).toHaveBeenCalledTimes(1);
  });

  test('does not call onCerrar when clicking inside the modal content', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} />);
      jest.advanceTimersByTime(10);
    });
    const modalContent = screen.getByRole('dialog').querySelector('.bg-white') as HTMLElement;
    await act(async () => {
      await userEvent.click(modalContent);
      jest.advanceTimersByTime(200);
    });
    expect(mockOnCerrar).not.toHaveBeenCalled();
  });

  test('displays nombreTutor in the modal title', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} />);
      jest.advanceTimersByTime(10);
    });
    expect(screen.getByRole('heading', { name: `Firma de ${baseProps.nombreTutor}` })).toBeInTheDocument();
  });

  test('signature image has correct alt text', async () => {
    const mockFirma = 'data:image/png;base64,mockdata';
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} firmaDigital={mockFirma} />);
      jest.advanceTimersByTime(10);
    });
    expect(screen.getByAltText(`Firma de ${baseProps.nombreTutor}`)).toBeInTheDocument();
  });

  test('modal has correct accessibility attributes', async () => {
    act(() => {
      render(<ModalVerFirma {...baseProps} abierto={true} />);
      jest.advanceTimersByTime(10);
    });
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('role', 'dialog');
  });
});