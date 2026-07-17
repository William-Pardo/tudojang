import {
  linkTutorEstudiante,
  unlinkTutorEstudiante,
  getEstudiantesByTutor,
  listVinculos,
  clearMockVinculos,
  getMockVinculos
} from './vinculoService';
import { getDocs, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(() => ({})),
  where: jest.fn()
}));

jest.mock('../../firebase/config', () => ({
  db: {},
  isFirebaseConfigured: true
}));

describe('vinculoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMockVinculos();
    (require('../../firebase/config') as any).isFirebaseConfigured = true;
  });

  describe('modo mock (isFirebaseConfigured = false)', () => {
    beforeEach(() => {
      (require('../../firebase/config') as any).isFirebaseConfigured = false;
    });

    it('linkTutorEstudiante agrega un vinculo al mock', async () => {
      const id = await linkTutorEstudiante('tenant-123', 'tutor@test.com', 'est-123');
      expect(id).toBe('tutor@test.com_est-123');
      expect(getMockVinculos().length).toBe(1);
    });

    it('getEstudiantesByTutor filtra por tutorEmail y tenantId', async () => {
      await linkTutorEstudiante('tenant-123', 'tutor1@test.com', 'est-1');
      await linkTutorEstudiante('tenant-123', 'tutor1@test.com', 'est-2');
      await linkTutorEstudiante('tenant-456', 'tutor1@test.com', 'est-3'); // otro tenant

      const ests = await getEstudiantesByTutor('tenant-123', 'tutor1@test.com');
      expect(ests).toEqual(['est-1', 'est-2']);
    });

    it('listVinculos lista todos los vinculos del tenant', async () => {
      await linkTutorEstudiante('tenant-123', 'tutor1@test.com', 'est-1');
      await linkTutorEstudiante('tenant-456', 'tutor2@test.com', 'est-2');

      const res = await listVinculos('tenant-123');
      expect(res.length).toBe(1);
      expect(res[0].tutorEmail).toBe('tutor1@test.com');
    });

    it('unlinkTutorEstudiante remueve un vinculo del mock', async () => {
      await linkTutorEstudiante('tenant-123', 'tutor@test.com', 'est-123');
      expect(getMockVinculos().length).toBe(1);
      
      await unlinkTutorEstudiante('tenant-123', 'tutor@test.com', 'est-123');
      expect(getMockVinculos().length).toBe(0);
    });
  });

  describe('modo real (isFirebaseConfigured = true)', () => {
    it('linkTutorEstudiante escribe en Firestore', async () => {
      const id = await linkTutorEstudiante('tenant-123', 'tutor@test.com', 'est-123');
      expect(id).toBe('tutor@test.com_est-123');
      expect(setDoc).toHaveBeenCalledTimes(1);
    });

    it('unlinkTutorEstudiante borra de Firestore', async () => {
      await unlinkTutorEstudiante('tenant-123', 'tutor@test.com', 'est-123');
      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('getEstudiantesByTutor consulta Firestore', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            data: () => ({ estudianteId: 'est-1' })
          },
          {
            data: () => ({ estudianteId: 'est-2' })
          }
        ]
      });

      const ests = await getEstudiantesByTutor('tenant-123', 'tutor@test.com');
      expect(ests).toEqual(['est-1', 'est-2']);
    });

    it('listVinculos consulta todos los vinculos en Firestore', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            data: () => ({ id: '1', tutorEmail: 'tutor@test.com', estudianteId: 'est-1' })
          }
        ]
      });

      const res = await listVinculos('tenant-123');
      expect(res.length).toBe(1);
      expect(res[0].tutorEmail).toBe('tutor@test.com');
    });

    it('linkTutorEstudiante (FASE 4) incluye studentAuthUid al guardar el vinculos doc', async () => {
      const { getDoc: getDocMock } = require('firebase/firestore');
      const { setDoc: setDocMock } = require('firebase/firestore');

      // Mock del Estudiante doc que contiene authUid
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ authUid: 'auth-est-123' })
      });

      const id = await linkTutorEstudiante('tenant-123', 'tutor@test.com', 'est-123');

      expect(id).toBe('tutor@test.com_est-123');
      expect(setDocMock).toHaveBeenCalledTimes(1);

      // Verificar que el vinculos doc incluye studentAuthUid
      const callArgs = setDocMock.mock.calls[0][1];
      expect(callArgs.studentAuthUid).toBe('auth-est-123');
      expect(callArgs.tutorEmail).toBe('tutor@test.com');
      expect(callArgs.estudianteId).toBe('est-123');
    });

    it('linkTutorEstudiante maneja gracefully si Estudiante doc no existe', async () => {
      const { getDoc: getDocMock } = require('firebase/firestore');
      const { setDoc: setDocMock } = require('firebase/firestore');

      // Mock del caso donde Estudiante doc no existe
      getDocMock.mockResolvedValueOnce({
        exists: () => false
      });

      const id = await linkTutorEstudiante('tenant-123', 'tutor@test.com', 'est-123');

      expect(id).toBe('tutor@test.com_est-123');
      expect(setDocMock).toHaveBeenCalledTimes(1);

      // Verificar que se guarda sin studentAuthUid (undefined es OK)
      const callArgs = setDocMock.mock.calls[0][1];
      expect(callArgs.studentAuthUid).toBeUndefined();
    });

    it('linkTutorEstudiante maneja gracefully si Estudiante fetch falla', async () => {
      const { getDoc: getDocMock } = require('firebase/firestore');
      const { setDoc: setDocMock } = require('firebase/firestore');

      // Mock de error al leer Estudiante
      getDocMock.mockRejectedValueOnce(new Error('Firebase error'));

      const id = await linkTutorEstudiante('tenant-123', 'tutor@test.com', 'est-123');

      expect(id).toBe('tutor@test.com_est-123');
      expect(setDocMock).toHaveBeenCalledTimes(1);

      // Debe seguir adelante sin studentAuthUid
      const callArgs = setDocMock.mock.calls[0][1];
      expect(callArgs.studentAuthUid).toBeUndefined();
    });
  });
});
