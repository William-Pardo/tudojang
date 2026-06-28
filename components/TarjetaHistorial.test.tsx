import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TarjetaHistorial from './TarjetaHistorial';
import type { NotificacionHistorial } from '../tipos';

jest.mock('./Iconos', () => ({
  IconoWhatsApp: ({ className }: { className?: string }) => (
    <svg data-testid="whatsapp-icon" className={className} />
  ),
  IconoEmail: ({ className }: { className?: string }) => (
    <svg data-testid="email-icon" className={className} />
  ),
  IconoAprobar: ({ className }: { className?: string }) => (
    <svg data-testid="approve-icon" className={className} />
  ),
}));

const baseItem: NotificacionHistorial = {
  id: 'notification-1',
  estudianteId: 'student-1',
  estudianteNombre: 'Ana Pérez',
  tutorNombre: 'Carlos Pérez',
  destinatario: '3001234567',
  canal: 'WhatsApp',
  mensaje: 'Mensaje de prueba suficientemente descriptivo.',
  fecha: '2026-06-22T15:30:00.000Z',
  leida: false,
};

describe('TarjetaHistorial', () => {
  it('renders an unread WhatsApp notification and marks it as read', async () => {
    const user = userEvent.setup();
    const onMarcarLeida = jest.fn();
    const { container } = render(
      <TarjetaHistorial item={baseItem} onMarcarLeida={onMarcarLeida} />,
    );

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText(/Enviado a Carlos Pérez \(3001234567\)/)).toBeInTheDocument();
    expect(screen.getByText(new Date(baseItem.fecha).toLocaleString('es-CO'))).toBeInTheDocument();
    expect(screen.getByTestId('whatsapp-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('email-icon')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-white');

    const markButton = screen.getByTitle(/Marcar como le/i);
    expect(markButton).toContainElement(screen.getByTestId('approve-icon'));
    await user.click(markButton);
    expect(onMarcarLeida).toHaveBeenCalledWith('notification-1');
  });

  it('renders a read Email notification without the mark-as-read action', () => {
    const { container } = render(
      <TarjetaHistorial
        item={{ ...baseItem, canal: 'Email', leida: true }}
        onMarcarLeida={jest.fn()}
      />,
    );

    expect(screen.getByTestId('email-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('whatsapp-icon')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Marcar como le/i)).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass('opacity-70', 'bg-gray-50');
  });

  it('expands and collapses the notification message', async () => {
    const user = userEvent.setup();
    render(<TarjetaHistorial item={baseItem} onMarcarLeida={jest.fn()} />);
    const message = screen.getByText(baseItem.mensaje);

    expect(message).toHaveClass('line-clamp-2');
    await user.click(screen.getByRole('button', { name: /Leer m/i }));
    expect(message).not.toHaveClass('line-clamp-2');
    expect(screen.getByRole('button', { name: 'Leer menos' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Leer menos' }));
    expect(message).toHaveClass('line-clamp-2');
    expect(screen.getByRole('button', { name: /Leer m/i })).toBeInTheDocument();
  });

  it('renders an empty message without failing', () => {
    const { container } = render(
      <TarjetaHistorial
        item={{ ...baseItem, mensaje: '' }}
        onMarcarLeida={jest.fn()}
      />,
    );

    const message = container.querySelector('.line-clamp-2');
    expect(message).toBeInTheDocument();
    expect(message).toBeEmptyDOMElement();
  });
});
