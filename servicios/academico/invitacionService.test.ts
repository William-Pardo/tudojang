import {
  createInvitation,
  acceptInvitation,
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

    it('listInvitations ordena por creadoEn descendente (la mas reciente primero)', async () => {
      const vieja = await createInvitation('tenant-123', 'gisell@test.com', 'Tutor');
      vieja.creadoEn = '2026-09-01T17:22:57.415Z';
      const nueva = await createInvitation('tenant-123', 'gisell@test.com', 'Tutor');
      nueva.creadoEn = '2026-09-01T17:24:37.969Z';

      const lista = await listInvitations('tenant-123');
      expect(lista[0].creadoEn).toBe('2026-09-01T17:24:37.969Z');
      expect(lista[1].creadoEn).toBe('2026-09-01T17:22:57.415Z');
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

    it('listInvitations ordena por creadoEn desc aunque Firestore los devuelva en otro orden', async () => {
      // Reproduce el caso real: `resendInvitation` deja una `revocada` vieja y una
      // `pendiente` nueva para el mismo correo. Firestore no garantiza orden de insercion,
      // asi que el mock las devuelve deliberadamente vieja-primero.
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            id: 'inv-vieja-revocada',
            data: () => ({ email: 'gisell@test.com', estado: 'revocada', creadoEn: '2026-09-01T17:22:57.415Z' })
          },
          {
            id: 'inv-nueva-pendiente',
            data: () => ({ email: 'gisell@test.com', estado: 'pendiente', creadoEn: '2026-09-01T17:24:37.969Z' })
          }
        ]
      });

      const res = await listInvitations('tenant-123');
      expect(res[0].id).toBe('inv-nueva-pendiente');
      expect(res[1].id).toBe('inv-vieja-revocada');
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

    it('acceptInvitation llama a acceptInvitation con tenant, invitacion, token y password', async () => {
      mockHttpsCallable.mockResolvedValueOnce({
        data: { ok: true, uid: 'uid-estudiante' }
      });

      const res = await acceptInvitation('tenant-123', 'inv-123', 'token-seguro', 'ClaveSegura123');

      expect(httpsCallable).toHaveBeenCalledWith(expect.any(Object), 'acceptInvitation');
      expect(mockHttpsCallable).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        invitacionId: 'inv-123',
        token: 'token-seguro',
        password: 'ClaveSegura123'
      });
      expect(res.uid).toBe('uid-estudiante');
    });
  });
});
