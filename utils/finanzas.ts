import { EstadoPago } from '../tipos';

export const calcularSaldoTrasPago = (saldoActual: number, montoPagado: number): number =>
    saldoActual - montoPagado;

export const estadoPagoPorSaldo = (saldo: number): EstadoPago =>
    saldo <= 0 ? EstadoPago.AlDia : EstadoPago.Pendiente;
