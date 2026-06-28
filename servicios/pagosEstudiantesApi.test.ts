import { addDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { EstadoPago, EstadoValidacion } from '../tipos';
import { obtenerEstudiantePorId } from './estudiantesApi';
import { agregarMovimiento } from './finanzasApi';
import { gestionarReportePago, obtenerReportesPendientes, reportarPagoEstudiante } from './pagosEstudiantesApi';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ path: 'reportes' })), addDoc: jest.fn(), query: jest.fn(() => 'query'),
  where: jest.fn(), getDocs: jest.fn(), doc: jest.fn((...args) => ({ args })), updateDoc: jest.fn(), orderBy: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})), ref: jest.fn(() => 'storage-ref'),
  uploadString: jest.fn(), getDownloadURL: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
jest.mock('./estudiantesApi', () => ({ obtenerEstudiantePorId: jest.fn() }));
jest.mock('./finanzasApi', () => ({ agregarMovimiento: jest.fn() }));

const reporte: any = {
  id: 'rep-1', tenantId: 'tenant-1', estudianteId: 'est-1', estudianteNombre: 'Ana',
  montoInformado: 40, fechaReporte: '2026-01-01', comprobanteUrl: '', estado: EstadoValidacion.Pendiente,
};

describe('pagosEstudiantesApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crea el reporte, sube el comprobante y persiste su URL', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 'rep-1' });
    (uploadString as jest.Mock).mockResolvedValue({ ref: 'snapshot-ref' });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://comprobante');
    await expect(reportarPagoEstudiante('tenant-1', 'est-1', 'Ana', 100, 'data:image/png;base64,x')).resolves.toBe('rep-1');
    expect(ref).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('tenants/tenant-1/comprobantes/rep-1_'));
    expect(updateDoc).toHaveBeenCalledWith({ id: 'rep-1' }, { comprobanteUrl: 'https://comprobante' });
  });

  it('propaga fallos al escribir el registro o subir el comprobante', async () => {
    (addDoc as jest.Mock).mockRejectedValueOnce(new Error('Firestore caído'));
    await expect(reportarPagoEstudiante('t', 'e', 'Ana', 100, 'img')).rejects.toThrow('Firestore caído');
    (addDoc as jest.Mock).mockResolvedValue({ id: 'rep-1' });
    (uploadString as jest.Mock).mockRejectedValueOnce(new Error('Storage caído'));
    await expect(reportarPagoEstudiante('t', 'e', 'Ana', 100, 'img')).rejects.toThrow('Storage caído');
  });

  it('obtiene y normaliza reportes pendientes', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'r1', data: () => ({ montoInformado: 100 }) }] });
    await expect(obtenerReportesPendientes('tenant-1')).resolves.toEqual([{ id: 'r1', montoInformado: 100 }]);
  });

  it.each([[100, 100, 0], [100, 40, 60], [100, 120, -20]])(
    'triangula saldo inicial %i con pago %i -> %i', async (saldo, pago, esperado) => {
      (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({
        saldoDeudor: saldo, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 'sede-1',
      });
      await gestionarReportePago({ ...reporte, montoInformado: pago }, EstadoValidacion.Aprobado, 'admin-1');
      expect(updateDoc).toHaveBeenCalledWith(expect.objectContaining({ args: expect.any(Array) }), expect.objectContaining({
        saldoDeudor: esperado,
        estadoPago: esperado <= 0 ? EstadoPago.AlDia : EstadoPago.Pendiente,
      }));
      expect(agregarMovimiento).toHaveBeenCalledWith(expect.objectContaining({ monto: pago, sedeId: 'sede-1' }));
    });

  it('preserva historial, referencia IA y usa sede por defecto', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({
      saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [{ id: 'viejo' }],
    });
    await gestionarReportePago({ ...reporte, datosIA: { referencia: 'REF-IA' } }, EstadoValidacion.Aprobado, 'admin', 'ok');
    expect(updateDoc).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      historialPagos: [expect.objectContaining({ referencia: 'REF-IA' }), { id: 'viejo' }],
    }));
    expect(agregarMovimiento).toHaveBeenCalledWith(expect.objectContaining({ sedeId: '1' }));
  });

  it('usa referencia por defecto e historial vacío', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, sedeId: 's' });
    await gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin');
    expect(updateDoc).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      historialPagos: [expect.objectContaining({ referencia: 'REPORTE-APP' })],
    }));
  });

  it('rechaza sin modificar estudiante ni finanzas', async () => {
    await gestionarReportePago(reporte, EstadoValidacion.Rechazado, 'admin');
    expect(obtenerEstudiantePorId).not.toHaveBeenCalled();
    expect(agregarMovimiento).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      estado: EstadoValidacion.Rechazado, observaciones: '',
    }));
  });

  it('propaga fallos al actualizar saldo o escribir finanzas/reporte', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ saldoDeudor: 100, estadoPago: EstadoPago.Pendiente });
    (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Saldo no actualizado'));
    await expect(gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin')).rejects.toThrow('Saldo no actualizado');
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (agregarMovimiento as jest.Mock).mockRejectedValueOnce(new Error('Registro financiero falló'));
    await expect(gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin')).rejects.toThrow('Registro financiero falló');
  });
});
