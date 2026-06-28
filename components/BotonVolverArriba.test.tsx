import React, { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BotonVolverArriba from './BotonVolverArriba';

jest.mock('./Iconos', () => ({
  IconoFlechaArriba: ({ className }: { className?: string }) => (
    <svg data-testid="up-icon" className={className} />
  ),
}));

const createScrollContainer = () => {
  const container = document.createElement('div');
  Object.defineProperty(container, 'scrollTop', {
    configurable: true,
    writable: true,
    value: 0,
  });
  container.scrollTo = jest.fn();
  return container;
};

const dispatchScroll = (container: HTMLDivElement, scrollTop: number) => {
  container.scrollTop = scrollTop;
  act(() => container.dispatchEvent(new Event('scroll')));
};

describe('BotonVolverArriba', () => {
  it('stays hidden and does not subscribe when the container is unavailable', () => {
    const ref = createRef<HTMLDivElement>();
    const { unmount } = render(<BotonVolverArriba scrollContainerRef={ref} />);

    const button = screen.getByRole('button', { name: 'Volver arriba' });
    expect(button).toHaveClass('opacity-0', 'translate-y-10', 'pointer-events-none');
    expect(screen.getByTestId('up-icon')).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });

  it('is hidden initially and at or below the 300px threshold', () => {
    const container = createScrollContainer();
    const ref = { current: container };
    render(<BotonVolverArriba scrollContainerRef={ref} />);
    const button = screen.getByRole('button', { name: 'Volver arriba' });

    expect(button).toHaveClass('opacity-0');
    dispatchScroll(container, 299);
    expect(button).toHaveClass('opacity-0');
    dispatchScroll(container, 300);
    expect(button).toHaveClass('opacity-0');
  });

  it('becomes visible above the threshold and hides again below it', () => {
    const container = createScrollContainer();
    render(<BotonVolverArriba scrollContainerRef={{ current: container }} />);
    const button = screen.getByRole('button', { name: 'Volver arriba' });

    dispatchScroll(container, 301);
    expect(button).toHaveClass('opacity-100', 'translate-y-0');
    expect(button).not.toHaveClass('pointer-events-none');

    dispatchScroll(container, 100);
    expect(button).toHaveClass('opacity-0', 'translate-y-10', 'pointer-events-none');
  });

  it('smoothly scrolls the active container to the top when clicked', async () => {
    const user = userEvent.setup();
    const container = createScrollContainer();
    render(<BotonVolverArriba scrollContainerRef={{ current: container }} />);

    dispatchScroll(container, 400);
    await user.click(screen.getByRole('button', { name: 'Volver arriba' }));

    expect(container.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('does not fail if the container disappears before clicking', async () => {
    const user = userEvent.setup();
    const container = createScrollContainer();
    const ref: React.RefObject<HTMLDivElement | null> = { current: container };
    render(<BotonVolverArriba scrollContainerRef={ref} />);
    dispatchScroll(container, 400);
    ref.current = null;

    await expect(user.click(screen.getByRole('button', { name: 'Volver arriba' }))).resolves.toBeUndefined();
  });

  it('removes the same scroll listener when unmounted', () => {
    const container = createScrollContainer();
    const addSpy = jest.spyOn(container, 'addEventListener');
    const removeSpy = jest.spyOn(container, 'removeEventListener');
    const { unmount } = render(
      <BotonVolverArriba scrollContainerRef={{ current: container }} />,
    );

    const registeredListener = addSpy.mock.calls.find(([type]) => type === 'scroll')?.[1];
    expect(registeredListener).toEqual(expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', registeredListener);
  });
});
