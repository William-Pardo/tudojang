import { doc, getDocs, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { EstadoValidacion } from '../tipos';
import {
  aprobarReportesEnLote,
  gestionarReportePago,
  obtenerEstudiantesDelTutor,
  obtenerHistorialReportes,
  obtenerReportesPendientes,
  reportarPagoEstudiante,
} from './pagosEstudiantesApi';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ path: 'reportes' })), query: jest.fn(() => 'query'),
  where: jest.fn(), getDocs: jest.fn(), doc: jest.fn((...args) => ({ args, id: 'rep-1' })),
  setDoc: jest.fn(), orderBy: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})), ref: jest.fn(() => 'storage-ref'),
  uploadString: jest.fn(), getDownloadURL: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

// gestionarReportePago (y por lo tanto aprobarReportesEnLote) es ahora un wrapper delgado
// sobre httpsCallable('gestionarReportePago') -- toda la lógica de negocio (calcular saldo,
// inyectar en finanzas, detectar referencia duplicada, notificar al tutor) vive server-side
// en functions/pagosValidacion.js y está testeada ahí (functions/pagosValidacion.test.js).
// Mismo patrón de mock ya usado en configuracionApi.test.ts/censoApi.test.ts.
const mockCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => 'functions-mock'),
  httpsCallable: jest.fn(() => mockCallable),
}));

const reporte: any = {
  id: 'rep-1', tenantId: 'tenant-1', estudianteId: 'est-1', estudianteNombre: 'Ana',
  montoInformado: 40, fechaReporte: '2026-01-01', comprobanteUrl: '', estado: EstadoValidacion.Pendiente,
};

describe('pagosEstudiantesApi', () => {
  beforeEach(() => jest.clearAllMocks());

  // ERR-0017: el reporte se crea con UN SOLO setDoc que YA trae la URL real, no
  // addDoc(url:'') + updateDoc(url) posterior -- así el trigger onCreate
  // (analizarComprobanteEstudiante, functions/index.js) siempre ve comprobanteUrl
  // poblado en la primera (y única) escritura, en vez de ver el guard descartar el
  // reporte porque la URL todavía no existía.
  it('crea el reporte con un solo setDoc: sube el comprobante ANTES de escribir, ya con la URL real', async () => {
    (uploadString as jest.Mock).mockResolvedValue({ ref: 'snapshot-ref' });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://comprobante');
    await expect(reportarPagoEstudiante('tenant-1', 'est-1', 'Ana', 100, 'data:image/png;base64,x')).resolves.toBe('rep-1');

    expect(ref).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('tenants/tenant-1/comprobantes/rep-1_'));
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rep-1' }),
      expect.objectContaining({ comprobanteUrl: 'https://comprobante', estado: EstadoValidacion.Pendiente })
    );
    // El upload debe resolver ANTES de que exista cualquier llamada a setDoc -- si el
    // orden se invirtiera, setDoc se llamaría con comprobanteUrl vacío otra vez.
    expect((uploadString as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((setDoc as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('propaga fallos al subir el comprobante o al escribir el registro', async () => {
    (uploadString as jest.Mock).mockRejectedValueOnce(new Error('Storage caído'));
    await expect(reportarPagoEstudiante('t', 'e', 'Ana', 100, 'img')).rejects.toThrow('Storage caído');
    expect(setDoc).not.toHaveBeenCalled();

    (uploadString as jest.Mock).mockResolvedValue({ ref: 'snapshot-ref' });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://comprobante');
    (setDoc as jest.Mock).mockRejectedValueOnce(new Error('Firestore caído'));
    await expect(reportarPagoEstudiante('t', 'e', 'Ana', 100, 'img')).rejects.toThrow('Firestore caído');
  });

  it('persiste tutorUsuarioId cuando el tutor está autenticado', async () => {
    (uploadString as jest.Mock).mockResolvedValue({ ref: 'snapshot-ref' });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://comprobante');
    await reportarPagoEstudiante('tenant-1', 'est-1', 'Ana', 100, 'data:image/png;base64,x', 'tutor-uid-1');
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tutorUsuarioId: 'tutor-uid-1' }));
  });

  it('omite tutorUsuarioId cuando no se informa (link público sin login)', async () => {
    (uploadString as jest.Mock).mockResolvedValue({ ref: 'snapshot-ref' });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://comprobante');
    await reportarPagoEstudiante('tenant-1', 'est-1', 'Ana', 100, 'data:image/png;base64,x');
    const payload = (setDoc as jest.Mock).mock.calls[0][1];
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
});

// gestionarReportePago: bug real (2026-09-03) -- toda la lógica de negocio (calcular saldo,
// inyectar en finanzas, detectar duplicados, notificar al tutor) se movió a la Cloud Function
// `gestionarReportePago` (functions/pagosValidacion.js, transacción atómica) porque el flujo
// 100% client-side dejaba a Editor/Asistente con el saldo del estudiante descontado sin
// ningún registro contable (finanzas exige isAdmin() en firestore.rules). Esos casos ya están
// cubiertos por functions/pagosValidacion.test.js (22 tests); acá solo se prueba que el
// wrapper del cliente arma la llamada correcta y propaga resultado/error.
describe('gestionarReportePago (wrapper sobre httpsCallable)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('llama a la Cloud Function con reporteId/nuevoEstado/observaciones -- NO con el objeto reporte completo ni adminId', async () => {
    mockCallable.mockResolvedValue({ data: { ok: true } });

    await gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin-1', 'todo ok');

    expect(mockCallable).toHaveBeenCalledWith({
      reporteId: 'rep-1', nuevoEstado: EstadoValidacion.Aprobado, observaciones: 'todo ok',
    });
  });

  it('propaga el error que devuelva la Cloud Function (p.ej. referencia duplicada, rol no autorizado)', async () => {
    mockCallable.mockRejectedValue(new Error('Referencia duplicada: ya existe un pago aprobado (reporte r-viejo) con esta misma referencia.'));

    await expect(gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin-1'))
      .rejects.toThrow('Referencia duplicada');
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

  // ERR-0019: `estadoMatricula` lo introdujo el cambio pricing-cupo-real; TODO estudiante
  // dado de alta antes NO tiene el campo. Un filtro `=== 'activo'` los descarta en silencio
  // y su tutor ve "Sin Estudiantes Vinculados" -- no puede reportar un pago nunca. Ausente
  // significa que nunca se lo retiró (retirarEstudiante es el único writer de 'retirado'),
  // así que cuenta como activo. Mismo criterio que el fix de carnets legacy (ERR-0015).
  it('incluye al estudiante legacy que no tiene el campo estadoMatricula (ausente = activo)', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { id: 'legacy', data: () => ({ tenantId: 'tenant-1', nombres: 'Samuel' }) },
        { id: 'retirado', data: () => ({ tenantId: 'tenant-1', estadoMatricula: 'retirado', nombres: 'Luis' }) },
      ],
    });
    const res = await obtenerEstudiantesDelTutor('tenant-1', 'tutor@correo.com');
    expect(res).toEqual([{ id: 'legacy', tenantId: 'tenant-1', nombres: 'Samuel' }]);
  });
});

describe('aprobarReportesEnLote', () => {
  const reporteBase: any = {
    id: 'r1', tenantId: 'tenant-1', estudianteId: 'est-1', estudianteNombre: 'Ana',
    montoInformado: 40, fechaReporte: '2026-01-01', comprobanteUrl: '', estado: EstadoValidacion.ValidadoIA,
  };

  beforeEach(() => jest.clearAllMocks());

  it('aprueba todos los reportes cuando la Cloud Function resuelve cada uno con éxito', async () => {
    mockCallable.mockResolvedValue({ data: { ok: true } });
    const reportes = [{ ...reporteBase, id: 'r1' }, { ...reporteBase, id: 'r2' }];

    const resultado = await aprobarReportesEnLote(reportes, 'admin-1');

    expect(resultado).toEqual({ exitosos: ['r1', 'r2'], fallidos: [] });
  });

  it('marca como fallido el reporte que la Cloud Function rechaza (p.ej. referencia duplicada), sin afectar al resto del lote', async () => {
    mockCallable
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockRejectedValueOnce(new Error('Referencia duplicada: ya existe un pago aprobado (reporte r-viejo) con esta misma referencia.'));
    const reportes = [{ ...reporteBase, id: 'r1' }, { ...reporteBase, id: 'r2' }];

    const resultado = await aprobarReportesEnLote(reportes, 'admin-1');

    expect(resultado).toEqual({
      exitosos: ['r1'],
      fallidos: [{ id: 'r2', error: 'Referencia duplicada: ya existe un pago aprobado (reporte r-viejo) con esta misma referencia.' }],
    });
  });

  it('captura el fallo de un reporte individual sin abortar el resto del lote', async () => {
    mockCallable
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockRejectedValueOnce(new Error('No se encontró el estudiante'));
    const reportes = [{ ...reporteBase, id: 'r1' }, { ...reporteBase, id: 'r2' }];

    const resultado = await aprobarReportesEnLote(reportes, 'admin-1');

    expect(resultado).toEqual({
      exitosos: ['r1'],
      fallidos: [{ id: 'r2', error: 'No se encontró el estudiante' }],
    });
  });
});
