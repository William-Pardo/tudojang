import { addDoc, doc, getDocs, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { EstadoPago, EstadoValidacion } from '../tipos';
import { obtenerEstudiantePorId } from './estudiantesApi';
import { agregarMovimiento } from './finanzasApi';
import {
  aprobarReportesEnLote,
  buscarReferenciaDuplicada,
  gestionarReportePago,
  obtenerEstudiantesDelTutor,
  obtenerHistorialReportes,
  obtenerReportesPendientes,
  reportarPagoEstudiante,
} from './pagosEstudiantesApi';

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

  it('persiste tutorUsuarioId cuando el tutor está autenticado', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 'rep-2' });
    (uploadString as jest.Mock).mockResolvedValue({ ref: 'snapshot-ref' });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://comprobante');
    await reportarPagoEstudiante('tenant-1', 'est-1', 'Ana', 100, 'data:image/png;base64,x', 'tutor-uid-1');
    expect(addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tutorUsuarioId: 'tutor-uid-1' }));
  });

  it('omite tutorUsuarioId cuando no se informa (link público sin login)', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 'rep-2' });
    (uploadString as jest.Mock).mockResolvedValue({ ref: 'snapshot-ref' });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://comprobante');
    await reportarPagoEstudiante('tenant-1', 'est-1', 'Ana', 100, 'data:image/png;base64,x');
    const payload = (addDoc as jest.Mock).mock.calls[0][1];
    expect(payload).not.toHaveProperty('tutorUsuarioId');
  });

  it('obtiene y normaliza reportes pendientes', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'r1', data: () => ({ montoInformado: 100 }) }] });
    await expect(obtenerReportesPendientes('tenant-1')).resolves.toEqual([{ id: 'r1', montoInformado: 100 }]);
  });

  it('obtiene el historial de reportes ya resueltos', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'r1', data: () => ({ estado: 'Aprobado' }) }] });
    await expect(obtenerHistorialReportes('tenant-1')).resolves.toEqual([{ id: 'r1', estado: 'Aprobado' }]);
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

describe('obtenerEstudiantesDelTutor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delega en resolveLinkedStudent (mismo resolver que usa el buzón de notificaciones) y filtra por matrícula activa', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { id: 'e1', data: () => ({ tenantId: 'tenant-1', estadoMatricula: 'activo', nombres: 'Ana' }) },
        { id: 'e2', data: () => ({ tenantId: 'tenant-1', estadoMatricula: 'retirado', nombres: 'Luis' }) },
      ],
    });
    const res = await obtenerEstudiantesDelTutor('tenant-1', '  Tutor@Correo.COM ');
    expect(where).toHaveBeenCalledWith('tutor.correo', '==', 'tutor@correo.com');
    expect(res).toEqual([{ id: 'e1', tenantId: 'tenant-1', estadoMatricula: 'activo', nombres: 'Ana' }]);
  });
});

describe('buscarReferenciaDuplicada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('encuentra otro reporte con la misma referencia, excluyendo el propio', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { id: 'rep-1', data: () => ({ estado: 'Pendiente' }) },
        { id: 'rep-2', data: () => ({ estado: 'Aprobado' }) },
      ],
    });
    await expect(buscarReferenciaDuplicada('tenant-1', 'REF-1', 'rep-1')).resolves.toEqual({ id: 'rep-2', estado: 'Aprobado' });
  });

  it('devuelve null si no hay otro reporte con esa referencia', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'rep-1', data: () => ({}) }] });
    await expect(buscarReferenciaDuplicada('tenant-1', 'REF-1', 'rep-1')).resolves.toBeNull();
  });
});

describe('aprobarReportesEnLote', () => {
  const reporteBase: any = {
    id: 'r1', tenantId: 'tenant-1', estudianteId: 'est-1', estudianteNombre: 'Ana',
    montoInformado: 40, fechaReporte: '2026-01-01', comprobanteUrl: '', estado: EstadoValidacion.ValidadoIA,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 's1' });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (agregarMovimiento as jest.Mock).mockResolvedValue(undefined);
  });

  it('aprueba todos los reportes cuando ninguno tiene referencia duplicada', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    const reportes = [
      { ...reporteBase, id: 'r1' },
      { ...reporteBase, id: 'r2', datosIA: { referencia: 'REF-2' } },
    ];
    const resultado = await aprobarReportesEnLote(reportes, 'admin-1');
    expect(resultado).toEqual({ exitosos: ['r1', 'r2'], fallidos: [] });
  });

  it('marca como fallido el reporte con referencia duplicada, sin afectar al resto del lote', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'r-viejo', data: () => ({ estado: 'Aprobado' }) }] });
    const reportes = [{ ...reporteBase, id: 'r1', datosIA: { referencia: 'REF-DUP' } }];
    const resultado = await aprobarReportesEnLote(reportes, 'admin-1');
    expect(resultado).toEqual({
      exitosos: [],
      fallidos: [{ id: 'r1', error: 'Referencia duplicada con el reporte r-viejo.' }],
    });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('captura el fallo de un reporte individual sin abortar el resto del lote', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    (obtenerEstudiantePorId as jest.Mock)
      .mockResolvedValueOnce({ saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 's1' })
      .mockRejectedValueOnce(new Error('Estudiante no encontrado.'));
    const reportes = [
      { ...reporteBase, id: 'r1' },
      { ...reporteBase, id: 'r2' },
    ];
    const resultado = await aprobarReportesEnLote(reportes, 'admin-1');
    expect(resultado).toEqual({
      exitosos: ['r1'],
      fallidos: [{ id: 'r2', error: 'Estudiante no encontrado.' }],
    });
  });
});
