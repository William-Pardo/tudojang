import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

let functionsInstance: Functions | null = null;
let emulatorConnected = false;

export function getAppFunctions(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions();
  }

  const host = process.env.VITE_FUNCTIONS_EMULATOR_HOST;
  const port = Number(process.env.VITE_FUNCTIONS_EMULATOR_PORT);
  const esLocalhost = typeof window !== 'undefined'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (!emulatorConnected && esLocalhost && host && Number.isInteger(port) && port > 0) {
    connectFunctionsEmulator(functionsInstance, host, port);
    emulatorConnected = true;
  }

  return functionsInstance;
}
