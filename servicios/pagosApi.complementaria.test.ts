import { doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { anularPagoEfectivo, anularUltimoPagoEfectivo, obtenerDeudasEstudiante, procesarPagoEfectivo } from './pagosApi';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args) => ({ args })), doc: jest.fn((...args) => ({ id: args.at(-1) || 'auto', args })),
  getDoc: jest.fn(), getDocs: jest.fn(), query: jest.fn(), where: jest.fn(), writeBatch: jest.fn(),
  addDoc: jest.fn(), updateDoc: jest.fn(), Timestamp: {},
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
jest.mock('./emailService', () => ({ enviarEmailConfirmacionPago: jest.fn() }));

const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn() };

describe('pagosApi cobertura complementaria', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    batch.commit.mockResolvedValue(undefined);
    (writeBatch as jest.Mock).mockReturnValue(batch);
    (doc as jest.Mock).mockImplementation((...args: any[]) => ({ id: args.at(-1) || 'auto', args }));
  });

  it('rechaza estudiante inexistente al consultar deudas', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    await expect(obtenerDeudasEstudiante('missing')).rejects.toThrow('Estudiante no encontrado');
  });

  it('combina tienda, eventos disponibles/no disponibles y remanente', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, id: 'est', data: () => ({ saldoDeudor: 300 }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ nombre: 'Torneo', valor: 80 }) })
      .mockRejectedValueOnce(new Error('evento caído'));
    (getDocs as jest.Mock)
      .mockResolvedValueOnce({ forEach: (cb: any) => [
        { id: 't1', data: () => ({ pagado: false, implemento: { nombre: 'Dobok' }, variacion: { descripcion: 'T2', precio: 100 }, fechaSolicitud: '2026-01-02' }) },
        { id: 't2', data: () => ({ pagado: true }) },
      ].forEach(cb) })
      .mockResolvedValueOnce({ forEach: (cb: any) => [
        { id: 'e1', data: () => ({ pagado: false, eventoId: 'ev1', fechaSolicitud: '2026-01-01' }) },
        { id: 'e2', data: () => ({ pagado: false, eventoId: 'ev2', fechaSolicitud: '2026-01-03' }) },
        { id: 'e3', data: () => ({ pagado: true, eventoId: 'ev3' }) },
      ].forEach(cb) });
    const res = await obtenerDeudasEstudiante('est');
    expect(res.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: 'Tienda', monto: 100 }),
      expect.objectContaining({ descripcion: 'Torneo', monto: 80 }),
      expect.objectContaining({ descripcion: 'Evento (Info no disponible)', monto: 0 }),
      expect.objectContaining({ tipo: 'Mensualidad', monto: 120 }),
    ]));
  });

  it('no agrega mensualidad cuando los items cubren el saldo', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, id: 'est', data: () => ({ saldoDeudor: 50 }) });
    (getDocs as jest.Mock)
      .mockResolvedValueOnce({ forEach: (cb: any) => [{ id: 't', data: () => ({ pagado: false, implemento: { nombre: 'P' }, variacion: { descripcion: 'V', precio: 100 }, fechaSolicitud: '2026-01-01' }) }].forEach(cb) })
      .mockResolvedValueOnce({ forEach: () => undefined });
    const res = await obtenerDeudasEstudiante('est');
    expect(res.items).toHaveLength(1);
  });

  it.each([
    [[{ id: 't', tipo: 'Tienda', monto: 10 }], 'Implementos'],
    [[{ id: 'e', tipo: 'Evento', monto: 10 }], 'Eventos'],
    [[{ id: 'm', tipo: 'Mensualidad', monto: 10 }], 'Mensualidad'],
  ])('procesa categoría financiera', async (items: any, categoria) => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, id: 'est', data: () => ({ saldoDeudor: 100, tenantId: 't', sedeId: 's' }) });
    expect((await procesarPagoEfectivo('est', items, 10, 'Pago', 'nota')).exito).toBe(true);
    expect(batch.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ categoria }));
  });

  it('procesa otros conceptos sin notas', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, id: 'est', data: () => ({ saldoDeudor: 10, tenantId: 't' }) });
    expect((await procesarPagoEfectivo('est', [{ id: 'x', tipo: 'Mora', monto: 1 } as any], 1, 'Pago')).exito).toBe(true);
    expect(batch.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ categoria: 'Otros', descripcion: expect.stringContaining('Notas: ') }));
  });

  it('maneja estudiante inexistente y fallo de escritura', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    expect(await procesarPagoEfectivo('x', [], 1, 'p')).toEqual({ exito: false, mensaje: 'Estudiante no encontrado' });
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, id: 'e', data: () => ({ saldoDeudor: 1, tenantId: 't' }) });
    batch.commit.mockRejectedValueOnce(new Error('Escritura falló'));
    expect(await procesarPagoEfectivo('e', [], 1, 'p')).toEqual({ exito: false, mensaje: 'Escritura falló' });
  });

  it('anula evento sin estudiante asociado y registra sede N/A', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, id: 'trx', data: () => ({
        estado: 'Completado', estudianteId: 'missing', montoTotal: 100, tenantId: 't', reciboId: 'R',
        itemsPagados: [{ id: 'ev', tipo: 'Evento', monto: 100 }, { id: 'm', tipo: 'Mensualidad', monto: 0 }],
      }) })
      .mockResolvedValueOnce({ exists: () => false, data: () => ({}) });
    expect(await anularPagoEfectivo('trx')).toEqual({ exito: true });
    expect(batch.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sedeId: 'N/A' }));
  });

  it('maneja transacción inexistente y fallo de commit', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    expect(await anularPagoEfectivo('x')).toEqual({ exito: false, mensaje: 'Transacción no encontrada' });
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, id: 'trx', data: () => ({ estado: 'Completado', estudianteId: 'e', montoTotal: 1, tenantId: 't', itemsPagados: [] }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ saldoDeudor: -1, sedeId: 's' }) });
    batch.commit.mockRejectedValueOnce(new Error('Commit falló'));
    expect(await anularPagoEfectivo('trx', 'admin')).toEqual({ exito: false, mensaje: 'Commit falló' });
  });

  it('busca el pago más reciente y maneja ausencia/error', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ empty: false, docs: [
      { id: 'old', data: () => ({ fecha: '2025-01-01' }) }, { id: 'new', data: () => ({ fecha: '2026-01-01' }) },
    ] });
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    expect(await anularUltimoPagoEfectivo('e')).toEqual({ exito: false, mensaje: 'Transacción no encontrada' });
    (getDocs as jest.Mock).mockResolvedValueOnce({ empty: true });
    expect(await anularUltimoPagoEfectivo('e')).toEqual({ exito: false, mensaje: 'No hay pagos recientes para anular.' });
    (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Consulta falló'));
    expect(await anularUltimoPagoEfectivo('e')).toEqual({ exito: false, mensaje: 'Consulta falló' });
  });
});
