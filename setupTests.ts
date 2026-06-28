import '@testing-library/jest-dom';

// Workaround for TextEncoder/TextDecoder not being globally available in some Jest/JSDOM environments
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

// Mock window.location.hostname for configuracionApi tests
let hostnameMockValue = 'localhost';
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
    get hostname() {
      return hostnameMockValue;
    },
    set hostname(value) {
      hostnameMockValue = value;
    }
  },
  writable: true,
  configurable: true,
});
