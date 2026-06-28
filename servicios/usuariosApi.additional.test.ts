import { autenticarUsuario } from './usuariosApi';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { RolUsuario } from '../tipos';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  signInWithEmailAndPassword: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  collection: jest.fn(),
  setDoc: jest.fn(),
}));

jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

// Mock esperar to resolve instantly
jest.mock('./usuariosApi', () => {
  const original = jest.requireActual('./usuariosApi');
  return {
    ...original,
    esperar: jest.fn(() => Promise.resolve()),
  };
});

describe('autenticarUsuario retry logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require('../firebase/config') as any).isFirebaseConfigured = true;
  });

  it('should succeed after retries when doc becomes available', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'user123' } });
    let callCount = 0;
    (getDoc as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({ exists: () => false });
      }
      return Promise.resolve({
        exists: () => true,
        data: () => ({ email: 'test@test.com', rol: RolUsuario.Admin }),
      });
    });
    (getDocs as jest.Mock).mockResolvedValue({ empty: true });
    const user = await autenticarUsuario('test@test.com', 'password123');
    expect(user).toEqual({ id: 'user123', email: 'test@test.com', rol: RolUsuario.Admin });
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('finds a profile by normalized email', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'user123' } });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    (getDocs as jest.Mock).mockResolvedValue({
      empty: false,
      docs: [{ id: 'email-id', data: () => ({ email: 'test@test.com', rol: RolUsuario.Admin }) }],
    });
    await expect(autenticarUsuario(' TEST@test.com ', 'password123')).resolves.toEqual(
      expect.objectContaining({ id: 'email-id' }),
    );
  });

  it('creates a recovery profile for tenant users', async () => {
    const { setDoc } = require('firebase/firestore');
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'tnt-school' } });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    (getDocs as jest.Mock).mockResolvedValue({ empty: true });
    setDoc.mockResolvedValue(undefined);
    await expect(autenticarUsuario('owner@test.com', 'password123')).resolves.toEqual(
      expect.objectContaining({ id: 'tnt-school', tenantId: 'tnt-school' }),
    );
  });

  it.each([
    [new Error('blocked-by-client')],
    [Object.assign(new Error('firestore'), { code: 'failed-precondition' })],
  ])('fails immediately when firestore is blocked', async (failure) => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'user123' } });
    (getDoc as jest.Mock).mockRejectedValue(failure);
    await expect(autenticarUsuario('test@test.com', 'password123')).rejects.toThrow(/bloqueado/i);
  });
});
