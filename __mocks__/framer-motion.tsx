import React from 'react';

const ignoredProps = new Set([
  'animate',
  'exit',
  'initial',
  'layout',
  'transition',
  'variants',
  'whileHover',
  'whileTap',
]);

const createMotionComponent = (tag: string) =>
  React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
    const domProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !ignoredProps.has(key)),
    );
    return React.createElement(tag, { ...domProps, ref });
  });

const componentCache = new Map<string, React.ComponentType<any>>();

export const motion = new Proxy(
  {},
  {
    get: (_target, property: string) => {
      if (!componentCache.has(property)) {
        componentCache.set(property, createMotionComponent(property));
      }
      return componentCache.get(property);
    },
  },
) as Record<string, React.ComponentType<any>>;

export const AnimatePresence = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const MotionConfig = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
