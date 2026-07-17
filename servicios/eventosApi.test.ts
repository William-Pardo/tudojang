import { addDoc, deleteDoc, doc, getDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, uploadString, ref, getStorage } from 'firebase/storage';
import { EstadoPago, EstadoSolicitud } from '../tipos';
import { obtenerEstudiantePorId, obtenerEstudiantePorNumIdentificacion } from './estudiantesApi';
import {
  actualizarEvento, agregarEvento, crearSolicitudInscripcion, eliminarEvento, gestionarSolicitud,
  obtenerEventoPorId, obtenerEventos, obtenerSolicitudesPorEvento,
} from './eventosApi';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadString: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
jest.mock('./estudiantesApi', () => ({ obtenerEstudiantePorId: jest.fn(), obtenerEstudiantePorNumIdentificacion: jest.fn() }));

const evento: any = {
  tenantId: 't1',
  nombre: 'Torneo',
  lugar: 'Dojang',
  fechaEvento: '2026-08-01',
  fechaInicioInscripcion: '2026-06-01',
  fechaFinInscripcion: '2026-07-01',
  valor: 100,
  imagenUrl: '',
};

const batch = { update: jest.fn(), commit: jest.fn() };

describe('eventosApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (writeBatch as jest.Mock).mockReturnValue(batch);
    batch.commit.mockResolvedValue(undefined);
  });

  describe('Operaciones Firestore', () => {
    it('obtiene eventos y cuenta solicitudes pendientes', async () => {
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [{ id: 'ev1', data: () => ({ nombre: 'Uno' }) }, { id: 'ev2', data: () => ({ nombre: 'Dos' }) }] })
        .mockResolvedValueOnce({ forEach: (cb: any) => [{ data: () => ({ eventoId: 'ev1' }) }, { data: () => ({ eventoId: 'ev1' }) }].forEach(cb) });
      await expect(obtenerEventos()).resolves.toEqual([
        { id: 'ev1', nombre: 'Uno', solicitudesPendientes: 2 },
        { id: 'ev2', nombre: 'Dos', solicitudesPendientes: 0 },
      ]);
    });

    it('regresión: si solicitudesInscripcion deniega permiso (Tutor/Estudiante), igual devuelve los eventos con solicitudesPendientes en 0', async () => {
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [{ id: 'ev1', data: () => ({ nombre: 'Uno' }) }] })
        .mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' }));

      await expect(obtenerEventos()).resolves.toEqual([
        { id: 'ev1', nombre: 'Uno', solicitudesPendientes: 0 },
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

  describe('Operaciones Storage', () => {
    it('sube imagen a la ruta correcta del tenant', async () => {
      const eventoConImagen = { ...evento, imagenUrl: 'data:image/png;base64,abc', tenantId: 'escuela-123' };
      
      (addDoc as jest.Mock).mockResolvedValue({ id: 'ev42' });
      
      (getStorage as jest.Mock).mockReturnValue({ id: 'mock-storage-instance' });
      (ref as jest.Mock).mockImplementation((storage, path) => ({
        fullPath: path,
        storage: storage,
      }));
      (uploadString as jest.Mock).mockResolvedValue({ ref: {} });
      (getDownloadURL as jest.Mock).mockResolvedValue('https://storage/ev42');
      
      await expect(agregarEvento(eventoConImagen)).resolves.toEqual(expect.objectContaining({ id: 'ev42', imagenUrl: 'https://storage/ev42' }));
      
      // Verificar que ref fue llamado con el storage mock y la ruta correcta
      expect(ref).toHaveBeenCalledWith(
        expect.anything(), 
        expect.stringMatching(/^tenants\/escuela-123\/eventos\/ev42\/imagen_\d+$/)
      );
    });
  });
});