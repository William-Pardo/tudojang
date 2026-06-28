import { addDoc, getDoc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { EstadoEntrega, EstadoPago } from '../tipos';
import {
  actualizarEstadoEntrega, buscarAsistenciaHoyPorIdAlumno, escucharAsistenciasActivasSede,
  obtenerAsistenciasActivasSede, registrarEntrada,
} from './asistenciaApi';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args) => ({ args })), addDoc: jest.fn(), query: jest.fn((...args) => ({ args })),
  where: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn(), updateDoc: jest.fn(),
  doc: jest.fn((...args) => ({ args })), Timestamp: {}, orderBy: jest.fn(), limit: jest.fn(), onSnapshot: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

describe('asistenciaApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [EstadoPago.AlDia, undefined],
    [EstadoPago.Pendiente, 'Estudiante con pago pendiente'],
    [EstadoPago.Vencido, 'Estudiante con pago pendiente'],
  ])('registra estudiante según estado %s', async (estadoPago, advertencia) => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ estadoPago }) });
    (addDoc as jest.Mock).mockResolvedValue({ id: 'a1' });
    await expect(registrarEntrada('e1', 's1')).resolves.toEqual(expect.objectContaining({
      id: 'a1', estudianteId: 'e1', estadoEntrega: EstadoEntrega.EnClase, advertenciaPago: advertencia,
    }));
  });

  it('rechaza estudiante inexistente y propaga fallo de escritura', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    await expect(registrarEntrada('x', 's')).rejects.toThrow('Estudiante no encontrado');
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, data: () => ({ estadoPago: EstadoPago.AlDia }) });
    (addDoc as jest.Mock).mockRejectedValueOnce(new Error('Firebase falló'));
    await expect(registrarEntrada('e', 's')).rejects.toThrow('Firebase falló');
  });

  it('actualiza entrega con recogidoPor y hora de salida', async () => {
    await actualizarEstadoEntrega('a1', EstadoEntrega.Entregado, 'Mamá');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ estadoEntrega: EstadoEntrega.Entregado, recogidoPor: 'Mamá', horaSalida: expect.any(String) }));
    await actualizarEstadoEntrega('a1', EstadoEntrega.Listo);
    expect(updateDoc).toHaveBeenLastCalledWith(expect.anything(), { estadoEntrega: EstadoEntrega.Listo });
  });

  it('propaga fallo al actualizar asistencia', async () => {
    (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Actualización falló'));
    await expect(actualizarEstadoEntrega('a1', EstadoEntrega.Listo)).rejects.toThrow('Actualización falló');
  });

  it('escucha asistencias y retorna unsubscribe', () => {
    const unsubscribe = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, cb) => {
      cb({ docs: [{ id: 'a1', data: () => ({ estudianteId: 'e1' }) }] });
      return unsubscribe;
    });
    const callback = jest.fn();
    expect(escucharAsistenciasActivasSede('s1', callback)).toBe(unsubscribe);
    expect(callback).toHaveBeenCalledWith([{ id: 'a1', estudianteId: 'e1' }]);
  });

  it('busca asistencia por identificación y ofusca nombre', async () => {
    (getDocs as jest.Mock)
      .mockResolvedValueOnce({ empty: false, docs: [{ id: 'e1', data: () => ({ nombres: 'Ana María', apellidos: 'Pérez' }) }] })
      .mockResolvedValueOnce({ empty: false, docs: [{ id: 'a1', data: () => ({ estudianteId: 'e1' }) }] });
    await expect(buscarAsistenciaHoyPorIdAlumno(' 123 ')).resolves.toEqual({
      asistencia: expect.objectContaining({ id: 'a1' }), nombres: 'Ana P.',
    });
  });

  it('retorna null para QR inexistente y rechaza QR corrupto', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ empty: true });
    await expect(buscarAsistenciaHoyPorIdAlumno('999')).resolves.toBeNull();
    await expect(buscarAsistenciaHoyPorIdAlumno('{"sin":"id"}')).rejects.toThrow('Código QR inválido');
    (getDocs as jest.Mock)
      .mockResolvedValueOnce({ empty: false, docs: [{ id: 'e1', data: () => ({ nombres: 'Ana', apellidos: 'P' }) }] })
      .mockResolvedValueOnce({ empty: true });
    await expect(buscarAsistenciaHoyPorIdAlumno('123')).resolves.toBeNull();
  });

  it('acepta QR JSON válido y consulta su identificación', async () => {
    (getDocs as jest.Mock)
      .mockResolvedValueOnce({ empty: false, docs: [{ id: 'e1', data: () => ({ nombres: 'Luis', apellidos: 'Rojas' }) }] })
      .mockResolvedValueOnce({ empty: false, docs: [{ id: 'a1', data: () => ({ estudianteId: 'e1' }) }] });
    await expect(buscarAsistenciaHoyPorIdAlumno('{"numeroIdentificacion":"456"}')).resolves.toEqual(expect.objectContaining({ nombres: 'Luis R.' }));
  });

  it('obtiene asistencias activas', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'a1', data: () => ({ sedeId: 's1' }) }] });
    await expect(obtenerAsistenciasActivasSede('s1')).resolves.toEqual([{ id: 'a1', sedeId: 's1' }]);
  });
});
