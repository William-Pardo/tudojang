// __mocks__/geminiService.ts
import { jest } from '@jest/globals';

export const generarMensajePersonalizado = jest.fn<() => Promise<string>>().mockResolvedValue("Este es un mensaje de prueba generado por el mock.");