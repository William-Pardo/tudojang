// utils/finanzas.test.ts
import { describe, it, expect } from '@jest/globals';
import { calcularSaldoTrasPago, estadoPagoPorSaldo, calcularMontoSugeridoPago } from './finanzas';
import { EstadoPago } from '../tipos';

describe('calcularSaldoTrasPago', () => {
    it('resta el pago del saldo actual', () => {
        expect(calcularSaldoTrasPago(50000, 30000)).toBe(20000);
    });

    it('permite saldo negativo cuando el pago supera la deuda (saldo a favor)', () => {
        expect(calcularSaldoTrasPago(50000, 100000)).toBe(-50000);
    });
});

describe('estadoPagoPorSaldo', () => {
    it('saldo positivo queda Pendiente', () => {
        expect(estadoPagoPorSaldo(20000)).toBe(EstadoPago.Pendiente);
    });

    it('saldo en 0 queda Al día', () => {
        expect(estadoPagoPorSaldo(0)).toBe(EstadoPago.AlDia);
    });

    it('saldo negativo (a favor) queda Al día', () => {
        expect(estadoPagoPorSaldo(-50000)).toBe(EstadoPago.AlDia);
    });
});

describe('calcularMontoSugeridoPago', () => {
    it('con deuda pendiente, sugiere el saldo deudor completo', () => {
        expect(calcularMontoSugeridoPago(50000, 150000)).toBe(50000);
    });

    // Bug real (2026-09-04): sin esto, el formulario ignoraba el credito y sugeria la
    // mensualidad completa otra vez, como si el saldo a favor no existiera.
    it('con saldo a favor, descuenta el credito de la mensualidad sugerida', () => {
        expect(calcularMontoSugeridoPago(-30000, 150000)).toBe(120000);
    });

    it('con saldo a favor mayor a la mensualidad, sugiere 0 en vez de negativo', () => {
        expect(calcularMontoSugeridoPago(-200000, 150000)).toBe(0);
    });

    it('con saldo en 0 exacto y mensualidad configurada, sugiere la mensualidad completa', () => {
        expect(calcularMontoSugeridoPago(0, 150000)).toBe(150000);
    });

    it('sin mensualidad configurada y saldo a favor, sugiere 0 (nada que descontar)', () => {
        expect(calcularMontoSugeridoPago(-30000, 0)).toBe(0);
    });
});
