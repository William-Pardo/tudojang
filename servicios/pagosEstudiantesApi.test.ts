import { doc, getDocs, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { EstadoPago, EstadoValidacion, TipoNotificacion } from '../tipos';
import { obtenerEstudiantePorId } from './estudiantesApi';
import { agregarMovimiento } from './finanzasApi';
import { guardarNotificacionEnHistorial } from './notificacionesApi';
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
  collection: jest.fn(() => ({ path: 'reportes' })), query: jest.fn(() => 'query'),
  where: jest.fn(), getDocs: jest.fn(), doc: jest.fn((...args) => ({ args, id: 'rep-1' })),
  setDoc: jest.fn(), updateDoc: jest.fn(), orderBy: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})), ref: jest.fn(() => 'storage-ref'),
  uploadString: jest.fn(), getDownloadURL: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
jest.mock('./estudiantesApi', () => ({ obtenerEstudiantePorId: jest.fn() }));
jest.mock('./finanzasApi', () => ({ agregarMovimiento: jest.fn() }));
jest.mock('./notificacionesApi', () => ({ guardarNotificacionEnHistorial: jest.fn() }));

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
    // D5 (design.md): rechazar YA NO deja obtenerEstudiantePorId sin llamar -- el paso 7
    // (notificación al tutor, best-effort) lo necesita para resolver destinatario/tutorNombre,
    // porque el camino de rechazo nunca hizo esa lectura antes (a diferencia de aprobar).
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ correo: 'ana@correo.com' });
    await gestionarReportePago(reporte, EstadoValidacion.Rechazado, 'admin');
    expect(obtenerEstudiantePorId).toHaveBeenCalledTimes(1);
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

// SDD notificaciones-pagos (R2/R3/R4/R5, D4/D5 design.md): notificación tutor-facing al
// resolver un reporte -- escrita cliente-side (a diferencia del aviso admin-facing, que va
// desde la Cloud Function per D2) porque quien llama a gestionarReportePago siempre es un
// Admin autenticado (isInstructor() en firestore.rules), así que la regla de creación de
// historialNotificaciones lo permite directamente.
describe('gestionarReportePago — notificación al tutor (R2/R3/R4/R5, D4/D5 design.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (agregarMovimiento as jest.Mock).mockResolvedValue(undefined);
  });

  it('al aprobar, escribe PagoAprobado con estudianteId real, canal InApp, el monto y destinatario/tutorNombre desde Estudiante.tutor', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({
      saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 's1',
      tutor: { nombres: 'Carlos', apellidos: 'Gómez', correo: 'carlos@correo.com' },
    });
    await gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin-1');

    expect(guardarNotificacionEnHistorial).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: reporte.tenantId,
      estudianteId: reporte.estudianteId,
      canal: 'InApp',
      tipo: TipoNotificacion.PagoAprobado,
      tutorNombre: 'Carlos Gómez',
      destinatario: 'carlos@correo.com',
      leida: false,
    }));
    const mensaje = (guardarNotificacionEnHistorial as jest.Mock).mock.calls[0][0].mensaje;
    expect(mensaje).toMatch(/40/); // reporte.montoInformado del fixture compartido
  });

  it('al aprobar sin Estudiante.tutor, cae a est.correo con tutorNombre vacío -- nunca queda sin destinatario', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({
      saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 's1',
      correo: 'fallback@correo.com',
    });
    await gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin-1');

    expect(guardarNotificacionEnHistorial).toHaveBeenCalledWith(expect.objectContaining({
      tutorNombre: '',
      destinatario: 'fallback@correo.com',
    }));
  });

  it('al rechazar, escribe PagoRechazado con el mensaje neutro fijo -- NUNCA usa observaciones', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ correo: 'ana@correo.com' });
    await gestionarReportePago(reporte, EstadoValidacion.Rechazado, 'admin-1', 'foto ilegible, rechazado');

    expect(guardarNotificacionEnHistorial).toHaveBeenCalledWith(expect.objectContaining({
      tipo: TipoNotificacion.PagoRechazado,
      mensaje: 'Tu comprobante no pudo validarse. Contactá a la academia para más información.',
    }));
    const mensaje = (guardarNotificacionEnHistorial as jest.Mock).mock.calls[0][0].mensaje;
    expect(mensaje).not.toMatch(/foto ilegible/);
  });

  it('un fallo al escribir la notificación NO tumba la operación de pago -- la aprobación sigue resolviendo', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({
      saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 's1',
    });
    (guardarNotificacionEnHistorial as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));

    await expect(gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin-1')).resolves.toBeUndefined();
    // el saldo/finanzas ya se habían confirmado ANTES del try/catch de notificación (D4) --
    // el fallo de notificación no debe revertirlos ni impedir que se hayan llamado.
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ saldoDeudor: 60 }));
    expect(agregarMovimiento).toHaveBeenCalled();
  });

  it('la aprobación NO hace una segunda lectura de estudiante para la notificación -- reutiliza la del paso 1 (D5)', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({
      saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 's1',
    });
    await gestionarReportePago(reporte, EstadoValidacion.Aprobado, 'admin-1');
    expect(obtenerEstudiantePorId).toHaveBeenCalledTimes(1);
  });

  // El rechazo recorre una rama distinta a la aprobación (resuelve el estudiante DENTRO del
  // try/catch de notificación, no antes) -- que la aprobación tolere el fallo no prueba que
  // el rechazo también lo haga.
  it('un fallo al notificar tampoco tumba el RECHAZO -- el reporte igual queda marcado Rechazado', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({
      saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 's1',
    });
    (guardarNotificacionEnHistorial as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));

    await expect(gestionarReportePago(reporte, EstadoValidacion.Rechazado, 'admin-1')).resolves.toBeUndefined();
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      estado: EstadoValidacion.Rechazado,
    }));
  });

  // Frontera del lote: aprobarReportesEnLote usa Promise.allSettled, así que un throw que
  // escapara del try/catch de notificación marcaría ese reporte como fallido aunque el pago
  // sí se hubiera acreditado -- el admin vería un falso negativo y podría re-aprobarlo.
  it('un fallo al notificar no marca el reporte como fallido en la aprobación en lote', async () => {
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({
      saldoDeudor: 100, estadoPago: EstadoPago.Pendiente, historialPagos: [], sedeId: 's1',
    });
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    (guardarNotificacionEnHistorial as jest.Mock).mockRejectedValue(new Error('permission-denied'));

    const resultado = await aprobarReportesEnLote([reporte], 'admin-1');

    expect(resultado.exitosos).toEqual(['rep-1']);
    expect(resultado.fallidos).toEqual([]);
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
