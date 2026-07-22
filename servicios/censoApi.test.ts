import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, increment, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  crearMisionKicho,
  obtenerMisiones,
  obtenerMisionActivaTenant,
  registrarAspirantePublico,
  validarRegistroTemporal,
  legalizarLoteKicho,
  inyectarEstudiantesKicho,
  obtenerRegistrosMision,
} from './censoApi';
import type { MisionKicho, RegistroTemporal, Estudiante } from '../tipos';
import { GradoTKD, GrupoEdad, EstadoPago } from '../tipos';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ args: [db, name] })), addDoc: jest.fn(),
  query: jest.fn((...args) => ({ args })), where: jest.fn(),
  getDocs: jest.fn(), getDoc: jest.fn(), updateDoc: jest.fn(),
  deleteDoc: jest.fn(), setDoc: jest.fn(),
  doc: jest.fn((db, name, id) => ({ args: [db, name, id] })), Timestamp: {},
  orderBy: jest.fn(), limit: jest.fn(), onSnapshot: jest.fn(),
  increment: jest.fn(value => ({ _methodName: 'FieldValue.increment', operand: value })),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn(),
  })),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

describe('censoApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
        (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = true;
  });

  describe('crearMisionKicho', () => {
    it('debería crear una nueva misión Kicho en Firestore', async () => {
      const mockMisionData: Omit<MisionKicho, 'id' | 'registrosRecibidos' | 'estadoLote' | 'activa'> = {
        tenantId: 'tenant123',
        nombreMision: 'Mision de Prueba',
        fechaExpiracion: '2024-12-31',
      };

      await crearMisionKicho(mockMisionData);

      expect(addDoc).toHaveBeenCalledWith(
        collection(db, 'misiones_kicho'),
        expect.objectContaining({
          ...mockMisionData,
          activa: true,
          registrosRecibidos: 0,
          estadoLote: 'captura',
        })
      );
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      await crearMisionKicho({
        tenantId: 'tenant123',
        nombreMision: 'Mision de Prueba',
        fechaExpiracion: '2024-12-31',
      });
      expect(addDoc).not.toHaveBeenCalled();
    });
  });

  describe('obtenerMisiones', () => {
    it('debería retornar todas las misiones de Firestore', async () => {
      const mockMisiones: MisionKicho[] = [
        { id: 'm1', tenantId: 't1', nombreMision: 'Mision 1', activa: true, registrosRecibidos: 0, estadoLote: 'captura', fechaExpiracion: '2024-12-31' },
        { id: 'm2', tenantId: 't2', nombreMision: 'Mision 2', activa: true, registrosRecibidos: 0, estadoLote: 'captura', fechaExpiracion: '2024-12-31' },
      ];
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: mockMisiones.map(m => ({ id: m.id, data: () => m })),
      });

      const misiones = await obtenerMisiones();
      expect(getDocs).toHaveBeenCalledWith(collection(db, 'misiones_kicho'));
      expect(misiones).toEqual(mockMisiones);
    });

    it('debería retornar un array vacío si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const misiones = await obtenerMisiones();
      expect(misiones).toEqual([]);
    });
  });

  describe('obtenerMisionActivaTenant', () => {
    it('debería retornar la misión activa para un tenant', async () => {
      const mockMision: MisionKicho = { id: 'm1', tenantId: 't1', nombreMision: 'Mision Activa', activa: true, registrosRecibidos: 0, estadoLote: 'captura', fechaExpiracion: '2024-12-31' };
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: mockMision.id, data: () => mockMision }],
      });

      const mision = await obtenerMisionActivaTenant('t1');
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('tenantId', '==', 't1');
      expect(where).toHaveBeenCalledWith('activa', '==', true);
      expect(mision).toEqual(mockMision);
    });

    it('debería retornar null si no hay misión activa para el tenant', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: true,
      });

      const mision = await obtenerMisionActivaTenant('t1');
      expect(mision).toBeNull();
    });

    it('debería usar el modo mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const mision = await obtenerMisionActivaTenant('mockTenant');
      expect(mision).toEqual(expect.objectContaining({ id: 'm-mock-1', tenantId: 'mockTenant' }));
    });
  });

  describe('registrarAspirantePublico', () => {
    it('debería registrar un aspirante y actualizar el contador de la misión', async () => {
      const mockDatosAspirante = { nombres: 'Juan', apellidos: 'Perez' };
      (addDoc as jest.Mock).mockResolvedValueOnce(undefined);
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await registrarAspirantePublico('mision123', 'tenant123', mockDatosAspirante);

      expect(addDoc).toHaveBeenCalledWith(
        collection(db, 'registros_temporales'),
        expect.objectContaining({
          misionId: 'mision123',
          tenantId: 'tenant123',
          estado: 'pendiente',
          datos: mockDatosAspirante,
        })
      );
      expect(updateDoc).toHaveBeenCalledWith(
        doc(db, 'misiones_kicho', 'mision123'),
        { registrosRecibidos: increment(1) }
      );
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      await registrarAspirantePublico('mision123', 'tenant123', {});
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('validarRegistroTemporal', () => {
    it('debería actualizar el estado de un registro temporal', async () => {
      await validarRegistroTemporal('reg123', 'verificado');
      expect(updateDoc).toHaveBeenCalledWith(
        doc(db, 'registros_temporales', 'reg123'),
        { estado: 'verificado' }
      );
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      await validarRegistroTemporal('reg123', 'verificado');
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('legalizarLoteKicho', () => {
    it('debería legalizar un lote Kicho', async () => {
      await legalizarLoteKicho('mision123', 'firmaBase64');
      expect(updateDoc).toHaveBeenCalledWith(
        doc(db, 'misiones_kicho', 'mision123'),
        expect.objectContaining({
          estadoLote: 'legalizado',
          activa: false,
          firmaLegalizacion: 'firmaBase64',
          fechaLegalizacion: expect.any(String),
        })
      );
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      await legalizarLoteKicho('mision123', 'firmaBase64');
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('inyectarEstudiantesKicho', () => {
    it('debería inyectar estudiantes y actualizar la misión y registros', async () => {
      const mockMision: MisionKicho = { id: 'm1', tenantId: 't1', nombreMision: 'Mision Activa', activa: true, registrosRecibidos: 0, estadoLote: 'captura', fechaExpiracion: '2024-12-31', sedeId: 's1' };
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockMision,
      });

      const mockRegistros: RegistroTemporal[] = [
        { id: 'reg1', misionId: 'm1', tenantId: 't1', estado: 'pendiente', fechaRegistro: 'hoy', datos: { nombres: 'Estudiante1', apellidos: 'Apellido1', telefono: '123', email: 'e1@test.com', fechaNacimiento: '2010-01-01' } },
        { id: 'reg2', misionId: 'm1', tenantId: 't1', estado: 'pendiente', fechaRegistro: 'hoy', datos: { nombres: 'Estudiante2', apellidos: 'Apellido2', telefono: '456', email: 'e2@test.com', fechaNacimiento: '2011-02-02' } },
      ];

      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn(),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await inyectarEstudiantesKicho('m1', mockRegistros);

      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.update).toHaveBeenCalledTimes(3); // 2 registros + 1 misión
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          nombres: 'ESTUDIANTE1',
          tenantId: 't1',
          sedeId: 's1',
          numeroIdentificacion: '123',
        })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(doc(db, 'registros_temporales', 'reg1'), { estado: 'procesado' });
      expect(mockBatch.update).toHaveBeenCalledWith(doc(db, 'registros_temporales', 'reg2'), { estado: 'procesado' });
      expect(mockBatch.update).toHaveBeenCalledWith(doc(db, 'misiones_kicho', 'm1'), { estadoLote: 'procesado' });
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      await inyectarEstudiantesKicho('m1', []);
      expect(writeBatch).not.toHaveBeenCalled();
    });
  });

  describe('obtenerRegistrosMision', () => {
    it('debería retornar los registros de una misión', async () => {
      const mockRegistros: RegistroTemporal[] = [
        { id: 'reg1', misionId: 'm1', tenantId: 't1', estado: 'pendiente', fechaRegistro: 'hoy', datos: { nombres: '', apellidos: '', email: '', telefono: '', fechaNacimiento: '' } },
      ];
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: mockRegistros.map(r => ({ id: r.id, data: () => r })),
      });

      const registros = await obtenerRegistrosMision('m1');
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('misionId', '==', 'm1');
      expect(registros).toEqual(mockRegistros);
    });

    it('debería retornar un array vacío si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const registros = await obtenerRegistrosMision('m1');
      expect(registros).toEqual([]);
    });
  });
});
