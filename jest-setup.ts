// jest-setup.ts
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock navigator.share
Object.defineProperty(navigator, 'share', {
  writable: true,
  configurable: true,
  // FIX: Use mockResolvedValue(undefined) for Promises that resolve to void to fix type inference issues.
  value: jest.fn().mockResolvedValue(undefined),
});

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  configurable: true,
  value: {
    // FIX: Use mockResolvedValue(undefined) for Promises that resolve to void to fix type inference issues.
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});