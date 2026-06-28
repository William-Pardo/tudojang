import React from 'react';
import { act, render } from '@testing-library/react';
import HeatmapOverlay from './HeatmapOverlay';
import type { PuntoCalor } from '../tipos';

const addColorStop = jest.fn();
const gradient = { addColorStop };
const context = {
  clearRect: jest.fn(),
  createRadialGradient: jest.fn(() => gradient),
  beginPath: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  fillStyle: null as unknown,
};

const clickPoint: PuntoCalor = {
  x: 50,
  y: 25,
  tipo: 'click',
  intensidad: 1,
};

const movePoint: PuntoCalor = {
  x: 100,
  y: 0,
  tipo: 'move',
  intensidad: 0,
};

describe('HeatmapOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('renders nothing and does not request a context when inactive', () => {
    const { container } = render(<HeatmapOverlay puntos={[clickPoint]} activo={false} />);

    expect(container).toBeEmptyDOMElement();
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it('renders the overlay but stops safely when the 2D context is unavailable', () => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { container } = render(<HeatmapOverlay puntos={[]} activo />);
    const canvas = container.querySelector('canvas');

    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass('fixed', 'pointer-events-none', 'opacity-80');
    expect(canvas).toHaveStyle({ mixBlendMode: 'screen' });
  });

  it('clears an empty active canvas without drawing heat points', () => {
    const { container } = render(<HeatmapOverlay puntos={[]} activo />);
    const canvas = container.querySelector('canvas')!;

    expect(canvas).toHaveAttribute('width', '1000');
    expect(canvas).toHaveAttribute('height', '800');
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1000, 800);
    expect(context.createRadialGradient).not.toHaveBeenCalled();
    expect(context.arc).not.toHaveBeenCalled();
  });

  it('draws click and movement points with their coordinates, radii, and colors', () => {
    render(<HeatmapOverlay puntos={[clickPoint, movePoint]} activo />);

    expect(context.createRadialGradient).toHaveBeenNthCalledWith(1, 500, 200, 0, 500, 200, 40);
    expect(context.arc).toHaveBeenNthCalledWith(1, 500, 200, 40, 0, Math.PI * 2);
    expect(addColorStop).toHaveBeenNthCalledWith(1, 0, 'rgba(255, 0, 0, 0.6)');
    expect(addColorStop).toHaveBeenNthCalledWith(2, 0.5, 'rgba(255, 100, 0, 0.2)');
    expect(addColorStop).toHaveBeenNthCalledWith(3, 1, 'rgba(255, 0, 0, 0)');

    expect(context.createRadialGradient).toHaveBeenNthCalledWith(2, 1000, 0, 0, 1000, 0, 25);
    expect(context.arc).toHaveBeenNthCalledWith(2, 1000, 0, 25, 0, Math.PI * 2);
    expect(addColorStop).toHaveBeenNthCalledWith(4, 0, 'rgba(0, 200, 255, 0.3)');
    expect(addColorStop).toHaveBeenNthCalledWith(5, 1, 'rgba(0, 150, 255, 0)');
    expect(context.beginPath).toHaveBeenCalledTimes(2);
    expect(context.fill).toHaveBeenCalledTimes(2);
    expect(context.fillStyle).toBe(gradient);
  });

  it('redraws using new viewport dimensions on resize', () => {
    const { container } = render(<HeatmapOverlay puntos={[{ ...clickPoint, x: 0, y: 100 }]} activo />);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });

    act(() => window.dispatchEvent(new Event('resize')));

    const canvas = container.querySelector('canvas')!;
    expect(canvas).toHaveAttribute('width', '1200');
    expect(canvas).toHaveAttribute('height', '600');
    expect(context.createRadialGradient).toHaveBeenLastCalledWith(0, 600, 0, 0, 600, 40);
  });

  it('removes the resize listener when unmounted', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = render(<HeatmapOverlay puntos={[]} activo />);
    const resizeHandler = addSpy.mock.calls.find(([type]) => type === 'resize')?.[1];

    expect(resizeHandler).toEqual(expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', resizeHandler);
  });
});
