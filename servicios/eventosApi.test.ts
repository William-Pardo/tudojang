import { addDoc, deleteDoc, doc, getDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, uploadString } from 'firebase/storage';
import { EstadoPago, EstadoSolicitud } from '../tipos';
import { obtenerEstudiantePorId, obtenerEstudiantePorNumIdentificacion } from './estudiantesApi';
import {
  actualizarEvento, agregarEvento, crearSolicitudInscripcion, eliminarEvento, gestionarSolicitud,
  obtenerEventoPorId, obtenerEventos, obtenerSolicitudesPorEvento,
} from './eventosApi';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args) => ({ args })), getDocs: jest.fn(), doc: jest.fn((...args) => ({ id: args.at(-1), args })),
  getDoc: jest.fn(), addDoc: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn(),
  query: jest.fn((...args) => ({ args })), where: jest.fn((...args) => ({ args })), writeBatch: jest.fn(), orderBy: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})), ref: jest.fn(() => 'storage-ref'), uploadString: jest.fn(),
  getDownloadURL: jest.fn(), deleteObject: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
jest.mock('./estudiantesApi', () => ({ obtenerEstudiantePorId: jest.fn(), obtenerEstudiantePorNumIdentificacion: jest.fn() }));

const evento: any = {
  tenantId: 't1', nombre: 'Torneo', lugar: 'Dojang', fechaEvento: '2026-08-01',
  fechaInicioInscripcion: '2026-06-01', fechaFinInscripcion: '2026-07-01', valor: 100, imagenUrl: '',
};
const batch = { update: jest.fn(), commit: jest.fn() };

describe('eventosApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    batch.commit.mockResolvedValue(undefined);
    (writeBatch as jest.Mock).mockReturnValue(batch);
  });

  it('obtiene eventos y cuenta solicitudes pendientes', async () => {
    (getDocs as jest.Mock)
      .mockResolvedValueOnce({ docs: [{ id: 'ev1', data: () => ({ nombre: 'Uno' }) }, { id: 'ev2', data: () => ({ nombre: 'Dos' }) }] })
      .mockResolvedValueOnce({ forEach: (cb: any) => [
        { data: () => ({ eventoId: 'ev1' }) }, { data: () => ({ eventoId: 'ev1' }) },
      ].forEach(cb) });
    await expect(obtenerEventos()).resolves.toEqual([
      { id: 'ev1', nombre: 'Uno', solicitudesPendientes: 2 },
      { id: 'ev2', nombre: 'Dos', solicitudesPendientes: 0 },
    ]);
  });

  it('obtiene evento por id y falla si no existe', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, id: 'ev1', data: () => ({ nombre: 'Uno' }) });
    await expect(obtenerEventoPorId('ev1')).resolves.toEqual({ id: 'ev1', nombre: 'Uno' });
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    await expect(obtenerEventoPorId('x')).rejects.toThrow('Evento no encontrado.');
  });

  it('rechaza fechas de inscripción invertidas al crear y actualizar', async () => {
    const invalido = { ...evento, fechaInicioInscripcion: '2026-07-02', fechaFinInscripcion: '2026-07-01' };
    await expect(agregarEvento(invalido)).rejects.toThrow('La fecha de fin');
    await expect(actualizarEvento({ id: 'ev1', ...invalido })).rejects.toThrow('La fecha de fin');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('crea evento sin imagen y con imagen base64', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 'ev1' });
    await expect(agregarEvento(evento)).resolves.toEqual(expect.objectContaining({ id: 'ev1', imagenUrl: '' }));
    (uploadString as jest.Mock).mockResolvedValue({ ref: 'snap' });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://imagen');
    await expect(agregarEvento({ ...evento, imagenUrl: 'data:image/png;base64,x' })).resolves.toEqual(expect.objectContaining({ imagenUrl: 'https://imagen' }));
  });

  it('hace rollback si falla imagen o actualización', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 'ev1' });
    (uploadString as jest.Mock).mockRejectedValueOnce(new Error('Storage falló'));
    (deleteDoc as jest.Mock).mockResolvedValue(undefined);
    await expect(agregarEvento({ ...evento, imagenUrl: 'data:image/png;base64,x' })).rejects.toThrow('Storage falló');
    expect(deleteDoc).toHaveBeenCalled();
    (uploadString as jest.Mock).mockRejectedValueOnce(new Error('otra'));
    (deleteDoc as jest.Mock).mockRejectedValueOnce(new Error('rollback'));
    await expect(agregarEvento({ ...evento, imagenUrl: 'data:image/png;base64,x' })).rejects.toThrow('otra');
  });

  it('actualiza y elimina eventos', async () => {
    await expect(actualizarEvento({ id: 'ev1', ...evento, imagenUrl: 'https://existente' })).resolves.toEqual({ id: 'ev1', ...evento, imagenUrl: 'https://existente' });
    expect(updateDoc).toHaveBeenCalled();
    await eliminarEvento('ev1');
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('crea solicitud y rechaza duplicados', async () => {
    (obtenerEstudiantePorNumIdentificacion as jest.Mock).mockResolvedValue({ id: 'e1', nombres: 'Ana', apellidos: 'P' });
    (getDocs as jest.Mock).mockResolvedValueOnce({ empty: false });
    await expect(crearSolicitudInscripcion('ev1', '123')).rejects.toThrow('Ya existe');
    (getDocs as jest.Mock).mockResolvedValueOnce({ empty: true });
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 's1' });
    await expect(crearSolicitudInscripcion('ev1', '123')).resolves.toEqual(expect.objectContaining({ id: 's1', estado: EstadoSolicitud.Pendiente }));
  });

  it('obtiene solicitudes por evento', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 's1', data: () => ({ eventoId: 'ev1' }) }] });
    await expect(obtenerSolicitudesPorEvento('ev1')).resolves.toEqual([{ id: 's1', eventoId: 'ev1' }]);
  });

  it('gestiona rechazo, aprobación y saldo/estado', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ eventoId: 'ev1', estudiante: { id: 'e1' } }) });
    await expect(gestionarSolicitud('s1', EstadoSolicitud.Rechazada)).resolves.toBeNull();
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ eventoId: 'ev1', estudiante: { id: 'e1' } }) })
      .mockResolvedValueOnce({ exists: () => true, id: 'ev1', data: () => ({ valor: 100 }) });
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ id: 'e1', saldoDeudor: 0, estadoPago: EstadoPago.AlDia });
    await expect(gestionarSolicitud('s1', EstadoSolicitud.Aprobada)).resolves.toEqual(expect.objectContaining({ saldoDeudor: 100, estadoPago: EstadoPago.Pendiente }));
  });

  it('preserva estado si evento gratuito/deudor y falla solicitud inexistente', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    await expect(gestionarSolicitud('x', EstadoSolicitud.Aprobada)).rejects.toThrow('Solicitud no encontrada.');
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ eventoId: 'ev0', estudiante: { id: 'e1' } }) })
      .mockResolvedValueOnce({ exists: () => true, id: 'ev0', data: () => ({ valor: 0 }) });
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ id: 'e1', saldoDeudor: 20, estadoPago: EstadoPago.Vencido });
    await expect(gestionarSolicitud('s', EstadoSolicitud.Aprobada)).resolves.toEqual(expect.objectContaining({ estadoPago: EstadoPago.Vencido }));
  });

  it('preserva Al día cuando evento gratuito y Pendiente cuando ya debía', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ eventoId: 'ev0', estudiante: { id: 'e1' } }) })
      .mockResolvedValueOnce({ exists: () => true, id: 'ev0', data: () => ({ valor: 0 }) });
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ id: 'e1', saldoDeudor: 0, estadoPago: EstadoPago.AlDia });
    await expect(gestionarSolicitud('s', EstadoSolicitud.Aprobada)).resolves.toEqual(expect.objectContaining({ estadoPago: EstadoPago.AlDia }));
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ eventoId: 'ev1', estudiante: { id: 'e1' } }) })
      .mockResolvedValueOnce({ exists: () => true, id: 'ev1', data: () => ({ valor: 10 }) });
    (obtenerEstudiantePorId as jest.Mock).mockResolvedValue({ id: 'e1', saldoDeudor: 20, estadoPago: EstadoPago.Pendiente });
    await expect(gestionarSolicitud('s', EstadoSolicitud.Aprobada)).resolves.toEqual(expect.objectContaining({ estadoPago: EstadoPago.Pendiente }));
  });
});

/* New tests for storage isolation */
describe('eventosApi storage isolation', () => {
  it('sube imagen a la ruta correcta del tenant', async () => {
    const eventoConImagen = { ...evento, imagenUrl: 'data:image/png;base64,abc', tenantId: 'escuela-123' };
    (addDoc as jest.Mock).mockResolvedValue({ id: 'ev42' });
    (uploadString as jest.Mock).mockResolvedValue({ ref: {} });
    (getDownloadURL as jest.Mock).mockResolvedValue('https://storage/ev42');
    await expect(agregarEvento(eventoConImagen)).resolves.toEqual(expect.objectContaining({ id: 'ev42', imagenUrl: 'https://storage/ev42' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), `tenants/${eventoConImagen.tenantId}/eventos/ev42/imagen_${expect.any(Number)}`);
  });
});
