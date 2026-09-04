// utils/calculations.test.ts
import { describe, it, expect } from '@jest/globals';
import { calcularMontoCobroJusto } from './calculations';

describe('calcularMontoCobroJusto', () => {
    it('cobra el mes completo si el ingreso es el día 1', () => {
        const monto = calcularMontoCobroJusto(100000, new Date(2026, 0, 1)); // enero, 31 días
        expect(monto).toBe(100000);
    });

    it('cobra solo el último día si el ingreso es el último día del mes', () => {
        const monto = calcularMontoCobroJusto(310000, new Date(2026, 0, 31)); // enero, 31 días
        expect(monto).toBe(10000); // 310000 / 31 = 10000
    });

    it('prorratea proporcional a los días que quedan, incluyendo el día de ingreso', () => {
        // Abril 2026 tiene 30 días. Ingreso el día 10 -> quedan 21 días (10..30 inclusive).
        const monto = calcularMontoCobroJusto(300000, new Date(2026, 3, 10));
        expect(monto).toBe(Math.round((300000 * 21) / 30));
    });

    it('respeta la cantidad real de días del mes (febrero no bisiesto)', () => {
        // Febrero 2026 tiene 28 días. Ingreso el día 20 -> quedan 9 días (20..28 inclusive).
        const monto = calcularMontoCobroJusto(280000, new Date(2026, 1, 20));
        expect(monto).toBe(Math.round((280000 * 9) / 28));
    });

    it('redondea al peso más cercano', () => {
        // Mayo 2026 tiene 31 días. Ingreso el día 15 -> quedan 17 días.
        const monto = calcularMontoCobroJusto(100000, new Date(2026, 4, 15));
        expect(monto).toBe(Math.round((100000 * 17) / 31));
        expect(Number.isInteger(monto)).toBe(true);
    });
});
