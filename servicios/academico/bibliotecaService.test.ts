// servicios/academico/bibliotecaService.test.ts
// Tests unitarios para el servicio de biblioteca académica.
// Cubre transiciones de estado válidas e inválidas, e inyección de dependencias.

import {
  crearBibliotecaService,
  bibliotecaService,
  clearMockRecursos,
  getMockRecursos
} from './bibliotecaService';
import { doc, collection, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { FichaAcademica } from '../../models/academico/recurso';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({ id: 'mock-doc-id' })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn()
}));

jest.mock('../../firebase/config', () => ({
  db: {},
  isFirebaseConfigured: true
}));

describe('bibliotecaService', () => {
  const dummyFicha: FichaAcademica = {
    disciplina: 'Guitarra',
    nivelMinimo: 'Principiante',
    tipo: 'pdf',
    usos: ['estudio']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearMockRecursos();
    // Reiniciar configuración a true por defecto
    (require('../../firebase/config') as any).isFirebaseConfigured = true;
  });

  describe('modo mock (isFirebaseConfigured = false)', () => {
    beforeEach(() => {
      (require('../../firebase/config') as any).isFirebaseConfigured = false;
    });

    it('importFromDrive agrega recurso al mock en estado borrador', async () => {
      const recurso = await bibliotecaService.importFromDrive(
        'tenant-123',
        'file-drive-abc',
        'Acordes.pdf',
        'application/pdf',
        'user-111'
      );

      expect(recurso.nombre).toBe('Acordes.pdf');
      expect(recurso.estado).toBe('borrador');
      expect(recurso.ficha).toBeNull();
      expect(getMockRecursos().length).toBe(1);
    });

    it('updateFicha cambia estado a pendiente y actualiza ficha', async () => {
      const recurso = await bibliotecaService.importFromDrive(
        'tenant-123',
        'file-drive-abc',
        'Acordes.pdf',
        'application/pdf',
        'user-111'
      );

      await bibliotecaService.updateFicha('tenant-123', recurso.id, dummyFicha);

      const actualizados = getMockRecursos();
      expect(actualizados[0].estado).toBe('pendiente');
      expect(actualizados[0].ficha).toEqual(dummyFicha);
    });

    it('updateFicha lanza error si recurso no existe', async () => {
      await expect(
        bibliotecaService.updateFicha('tenant-123', 'non-existent', dummyFicha)
      ).rejects.toThrow('Recurso no encontrado');
    });

    it('approveRecurso cambia estado a aprobado', async () => {
      const recurso = await bibliotecaService.importFromDrive(
        'tenant-123',
        'file-drive-abc',
        'Acordes.pdf',
        'application/pdf',
        'user-111'
      );
      
      // Debe estar en pendiente para poder aprobarse
      await bibliotecaService.updateFicha('tenant-123', recurso.id, dummyFicha);

      await bibliotecaService.approveRecurso('tenant-123', recurso.id, 'admin-999');

      const actualizados = getMockRecursos();
      expect(actualizados[0].estado).toBe('aprobado');
      expect(actualizados[0].aprobadoPorUid).toBe('admin-999');
      expect(actualizados[0].aprobadoEn).toBeDefined();
    });

    it('approveRecurso lanza error si no esta en pendiente', async () => {
      const recurso = await bibliotecaService.importFromDrive(
        'tenant-123',
        'file-drive-abc',
        'Acordes.pdf',
        'application/pdf',
        'user-111'
      );

      // Estado actual es borrador, lo cual es inválido para aprobar
      await expect(
        bibliotecaService.approveRecurso('tenant-123', recurso.id, 'admin-999')
      ).rejects.toThrow('Transición inválida');
    });

    it('archiveRecurso cambia estado a archivado', async () => {
      const recurso = await bibliotecaService.importFromDrive(
        'tenant-123',
        'file-drive-abc',
        'Acordes.pdf',
        'application/pdf',
        'user-111'
      );

      await bibliotecaService.updateFicha('tenant-123', recurso.id, dummyFicha);
      await bibliotecaService.approveRecurso('tenant-123', recurso.id, 'admin-999');
      
      await bibliotecaService.archiveRecurso('tenant-123', recurso.id);

      const actualizados = getMockRecursos();
      expect(actualizados[0].estado).toBe('archivado');
    });

    it('archiveRecurso lanza error si no esta aprobado', async () => {
      const recurso = await bibliotecaService.importFromDrive(
        'tenant-123',
        'file-drive-abc',
        'Acordes.pdf',
        'application/pdf',
        'user-111'
      );

      // Estado actual es borrador, lo cual es inválido para archivar
      await expect(
        bibliotecaService.archiveRecurso('tenant-123', recurso.id)
      ).rejects.toThrow('Transición inválida');
    });
  });

  describe('modo real (isFirebaseConfigured = true)', () => {
    beforeEach(() => {
      (require('../../firebase/config') as any).isFirebaseConfigured = true;
    });

    it('importFromDrive guarda el documento en Firestore', async () => {
      const mockDocRef = { id: 'firestore-rec-id' };
      (doc as jest.Mock).mockReturnValueOnce(mockDocRef);

      const recurso = await bibliotecaService.importFromDrive(
        'tenant-123',
        'file-drive-abc',
        'Acordes.pdf',
        'application/pdf',
        'user-111'
      );

      expect(collection).toHaveBeenCalledWith(expect.any(Object), 'tenants', 'tenant-123', 'recursos');
      expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        id: 'firestore-rec-id',
        estado: 'borrador',
        externalFileId: 'file-drive-abc'
      }));
      expect(recurso.id).toBe('firestore-rec-id');
    });

    it('updateFicha actualiza en Firestore si el estado es valido', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'firestore-rec-id',
          estado: 'borrador',
          tenantId: 'tenant-123'
        })
      });

      await bibliotecaService.updateFicha('tenant-123', 'firestore-rec-id', dummyFicha);

      expect(updateDoc).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
        ficha: dummyFicha,
        estado: 'pendiente'
      }));
    });

    it('updateFicha lanza error si recurso no existe en Firestore', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false
      });

      await expect(
        bibliotecaService.updateFicha('tenant-123', 'non-existent', dummyFicha)
      ).rejects.toThrow('Recurso no encontrado');
    });

    it('updateFicha lanza error en transicion invalida en Firestore', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'firestore-rec-id',
          estado: 'aprobado',
          tenantId: 'tenant-123'
        })
      });

      await expect(
        bibliotecaService.updateFicha('tenant-123', 'firestore-rec-id', dummyFicha)
      ).rejects.toThrow('Transición inválida');
    });

    it('approveRecurso actualiza estado en Firestore', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'firestore-rec-id',
          estado: 'pendiente',
          tenantId: 'tenant-123'
        })
      });

      await bibliotecaService.approveRecurso('tenant-123', 'firestore-rec-id', 'admin-111');

      expect(updateDoc).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
        estado: 'aprobado',
        aprobadoPorUid: 'admin-111'
      }));
    });

    it('archiveRecurso actualiza estado en Firestore', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'firestore-rec-id',
          estado: 'aprobado',
          tenantId: 'tenant-123'
        })
      });

      await bibliotecaService.archiveRecurso('tenant-123', 'firestore-rec-id');

      expect(updateDoc).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
        estado: 'archivado'
      }));
    });
  });
});
