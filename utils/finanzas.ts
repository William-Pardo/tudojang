import { EstadoPago } from '../tipos';

export const calcularSaldoTrasPago = (saldoActual: number, montoPagado: number): number =>
    saldoActual - montoPagado;

export const estadoPagoPorSaldo = (saldo: number): EstadoPago =>
    saldo <= 0 ? EstadoPago.AlDia : EstadoPago.Pendiente;

/**
 * Monto a sugerir al reportar/registrar un pago nuevo. saldoDeudor negativo es un saldo A
 * FAVOR (el tutor pagó de más en un pago anterior, ver calcularSaldoTrasPago) -- sin esto, el
 * formulario ignoraba el crédito y sugería la mensualidad completa otra vez.
 */
export const calcularMontoSugeridoPago = (saldoDeudor: number, valorMensualidad: number): number => {
    if (saldoDeudor > 0) return saldoDeudor;
    if (!valorMensualidad) return 0;
    return Math.max(0, valorMensualidad + saldoDeudor);
};
