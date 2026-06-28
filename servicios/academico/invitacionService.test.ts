import {
  createInvitation,
  listInvitations,
  resendInvitation,
  clearMockInvitations,
  getMockInvitations
} from './invitacionService';
import { getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn()
}));

const mockHttpsCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => mockHttpsCallable)
}));

jest.mock('../../firebase/config', () => ({
  db: {},
  isFirebaseConfigured: true
}));

describe('invitacionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMockInvitations();
    // Reset config to true by default
    (require('../../firebase/config') as any).isFirebaseConfigured = true;
  });

  describe('modo mock (isFirebaseConfigured = false)', () => {
    beforeEach(() => {
      (require('../../firebase/config') as any).isFirebaseConfigured = false;
    });

    it('createInvitation agrega una invitacion al mock', async () => {
      const inv = await createInvitation('tenant-123', 'test@test.com', 'Estudiante');
      expect(inv.email).toBe('test@test.com');
      expect(inv.rol).toBe('Estudiante');
      expect(inv.estado).toBe('pendiente');
      expect(getMockInvitations().length).toBe(1);
    });

    it('listInvitations filtra por tenantId', async () => {
      await createInvitation('tenant-123', 'test1@test.com', 'Estudiante');
      await createInvitation('tenant-456', 'test2@test.com', 'Tutor');

      const list1 = await listInvitations('tenant-123');
      expect(list1.length).toBe(1);
      expect(list1[0].email).toBe('test1@test.com');

      const list2 = await listInvitations('tenant-456');
      expect(list2.length).toBe(1);
      expect(list2[0].email).toBe('test2@test.com');
    });

    it('resendInvitation actualiza expiracion', async () => {
      const inv = await createInvitation('tenant-123', 'test@test.com', 'Estudiante');
      const oldExp = inv.expiraEn;
      await resendInvitation('tenant-123', inv.id);
      expect(inv.expiraEn).not.toBe(oldExp);
    });
  });

  describe('modo real (isFirebaseConfigured = true)', () => {
    it('createInvitation llama a inviteUser y obtiene el documento', async () => {
      mockHttpsCallable.mockResolvedValueOnce({
        data: { ok: true, invitacionId: 'inv-real-123', expiraEn: '2026-07-02T00:00:00Z' }
      });
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        id: 'inv-real-123',
        data: () => ({
          email: 'real@test.com',
          rol: 'Estudiante',
          tenantId: 'tenant-123',
          estado: 'pendiente'
        })
      });

      const inv = await createInvitation('tenant-123', 'real@test.com', 'Estudiante');
      expect(httpsCallable).toHaveBeenCalledWith(expect.any(Object), 'inviteUser');
      expect(mockHttpsCallable).toHaveBeenCalledWith({
        email: 'real@test.com',
        rol: 'Estudiante',
        tenantId: 'tenant-123'
      });
      expect(inv.id).toBe('inv-real-123');
      expect(inv.email).toBe('real@test.com');
    });

    it('listInvitations obtiene documentos de Firestore', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            id: 'inv-1',
            data: () => ({ email: 'test1@test.com', tenantId: 'tenant-123' })
          }
        ]
      });

      const res = await listInvitations('tenant-123');
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('inv-1');
    });

    it('resendInvitation llama a inviteUser y marca la anterior como revocada', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          email: 'real@test.com',
          rol: 'Estudiante',
          tenantId: 'tenant-123'
        })
      });
      mockHttpsCallable.mockResolvedValueOnce({
        data: { ok: true, invitacionId: 'inv-new-123', expiraEn: '2026-07-02T00:00:00Z' }
      });

      await resendInvitation('tenant-123', 'inv-old-123');
      expect(updateDoc).toHaveBeenCalledWith(expect.any(Object), { estado: 'revocada' });
      expect(mockHttpsCallable).toHaveBeenCalledWith({
        email: 'real@test.com',
        rol: 'Estudiante',
        tenantId: 'tenant-123'
      });
    });
  });
});
