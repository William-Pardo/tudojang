import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToggleSwitch from './ToggleSwitch';

jest.mock('framer-motion', () => ({
  motion: {
    span: ({ layout, transition, ...props }: any) => <span {...props} />,
  },
}));

describe('ToggleSwitch', () => {
  it('renders unchecked and calls onChange with true when clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <ToggleSwitch
        id="notifications"
        checked={false}
        onChange={onChange}
        aria-label="Activar notificaciones"
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Activar notificaciones' });
    const thumb = toggle.querySelector('span');

    expect(toggle).toHaveAttribute('id', 'notifications');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveClass('bg-gray-300');
    expect(toggle).not.toBeDisabled();
    expect(thumb).toHaveClass('translate-x-0');
    expect(thumb).toHaveAttribute('aria-hidden', 'true');

    await user.click(toggle);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders checked and calls onChange with false when clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <ToggleSwitch
        checked
        onChange={onChange}
        aria-label="Desactivar notificaciones"
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Desactivar notificaciones' });

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveClass('bg-tkd-blue');
    expect(toggle.querySelector('span')).toHaveClass('translate-x-5');

    await user.click(toggle);

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not invoke onChange when disabled', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <ToggleSwitch
        checked={false}
        onChange={onChange}
        disabled
        aria-label="Opción bloqueada"
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Opción bloqueada' });

    expect(toggle).toBeDisabled();
    expect(toggle).toHaveClass('cursor-not-allowed', 'opacity-50');

    await user.click(toggle);

    expect(onChange).not.toHaveBeenCalled();
  });
});
