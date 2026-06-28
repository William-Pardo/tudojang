import { EstadoPago } from '../tipos';
import { useEstadoPago } from './useEstadoPago';

describe('useEstadoPago', () => {
  it.each([
    [EstadoPago.AlDia, EstadoPago.AlDia, 'bg-green-100'],
    [EstadoPago.Pendiente, EstadoPago.Pendiente, 'bg-yellow-100'],
    [EstadoPago.Vencido, EstadoPago.Vencido, 'bg-red-100'],
    ['paid', 'Paid', 'bg-green-100'],
    ['pending', 'Pending', 'bg-yellow-100'],
    ['overdue', 'Overdue', 'bg-red-100'],
    ['desconocido', 'desconocido', 'bg-gray-100'],
    ['', 'Sin estado', 'bg-gray-100'],
  ])('normaliza el estado %s', (status, label, color) => {
    expect(useEstadoPago(status)).toEqual(expect.objectContaining({ label }));
    expect(useEstadoPago(status).color).toContain(color);
  });
});
