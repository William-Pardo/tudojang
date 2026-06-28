import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  arrayUnion,
  query,
  where
} from 'firebase/firestore';
jest.setTimeout(20000);
import {
  autenticarUsuario,
  agregarUsuario,
  cerrarSesion,
  obtenerUsuarios,
  actualizarUsuario,
  eliminarUsuario,
  enviarCorreoRecuperacion,
  guardarTokenNotificacionUsuario,
  getUser,
  createUser,
} from './usuariosApi';
import { RolUsuario } from '../tipos';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args) => ({ args })), addDoc: jest.fn(),
  query: jest.fn((...args) => ({ args })), where: jest.fn(),
  getDocs: jest.fn(), getDoc: jest.fn(), updateDoc: jest.fn(),
  deleteDoc: jest.fn(), setDoc: jest.fn(),
  doc: jest.fn((...args) => ({ args })), Timestamp: {},
  orderBy: jest.fn(), limit: jest.fn(), onSnapshot: jest.fn(),
  arrayUnion: jest.fn((value) => ({ __op: 'arrayUnion', value })),
}));

const mockAuthSignOut = jest.fn();

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' }, signOut: mockAuthSignOut })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  updateCurrentUser: jest.fn(),
}));

jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

describe('usuariosApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require('../firebase/config') as any).isFirebaseConfigured = true;
    // Mock window.location.hostname for obtenerConfiguracionClub
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'localhost',
      },
      writable: true,
    });
    (getAuth as jest.Mock).mockReturnValue({
      currentUser: { uid: 'test-uid' },
      signOut: mockAuthSignOut,
    });
  });

  describe('autenticarUsuario', () => {
    it('deberÃ­a autenticar un usuario existente y retornar sus datos', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({ user: { uid: 'user123' } });
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ email: 'test@test.com', rol: RolUsuario.Admin }),
      });

      const user = await autenticarUsuario('test@test.com', 'password123');
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.any(Object), 'test@test.com', 'password123');
      expect(doc).toHaveBeenCalledWith(expect.any(Object), 'usuarios', 'user123');
      expect(user).toEqual({ id: 'user123', email: 'test@test.com', rol: RolUsuario.Admin });
    });

    it('deberÃ­a lanzar un error si el usuario no existe en Firestore', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({ user: { uid: 'user123' } });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });
      (getDocs as jest.Mock).mockResolvedValue({ empty: true });

      await expect(autenticarUsuario('test@test.com', 'password123')).rejects.toThrow(/perfil no existe o no se ha sincronizado correctamente/i);
    });

    it('deberÃ­a lanzar un error si la cuenta ha sido eliminada (soft delete)', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({ user: { uid: 'user123' } });
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ email: 'test@test.com', rol: RolUsuario.Admin, deletedAt: new Date().toISOString() }),
      });

      await expect(autenticarUsuario('test@test.com', 'password123')).rejects.toThrow(/cuenta ha sido eliminada/i);
    });

    it('deberÃ­a usar el modo mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      const user = await autenticarUsuario('admin@test.com', 'admin123');
      expect(user).toEqual(expect.objectContaining({ email: 'admin@test.com' }));
    });

    it('deberÃ­a lanzar un error en modo mock con credenciales incorrectas', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      await expect(autenticarUsuario('admin@test.com', 'wrongpass')).rejects.toThrow(/correo electr.*nico o contrase.*a incorrectos/i);
    });
  });

  describe('agregarUsuario', () => {
    it('deberÃ­a crear un nuevo usuario y guardar sus datos en Firestore', async () => {
      const mockUserCredential = { user: { uid: 'new-user-uid' } };
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValueOnce(mockUserCredential);
      (setDoc as jest.Mock).mockResolvedValueOnce(undefined);
      (signOut as jest.Mock).mockResolvedValueOnce(undefined);

      const datosUsuario = {
        email: 'new@user.com',
        contrasena: 'pass123',
        nombreUsuario: 'New User',
        rol: RolUsuario.Asistente,
        tenantId: 'tenant123',
      };

      const newUser = await agregarUsuario(datosUsuario);

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.any(Object), datosUsuario.email, datosUsuario.contrasena);
      expect(setDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          email: datosUsuario.email,
          rol: datosUsuario.rol,
        })
      );
      expect(signOut).toHaveBeenCalledWith(expect.any(Object));
      expect(newUser).toEqual(expect.objectContaining({ id: 'new-user-uid', email: datosUsuario.email }));
    });

    it('deberÃ­a usar el modo mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      const newUser = await agregarUsuario({
        email: 'mock@user.com',
        contrasena: 'mockpass',
        nombreUsuario: 'Mock User',
        rol: RolUsuario.Asistente,
        tenantId: 'mocktenant',
      });
      expect(newUser).toEqual(expect.objectContaining({ email: 'mock@user.com' }));
    });
  });

  describe('cerrarSesion', () => {
    it('deberÃ­a cerrar la sesiÃ³n del usuario', async () => {
      await cerrarSesion();
      expect(signOut).toHaveBeenCalled();
    });

    it('no deberÃ­a hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      await cerrarSesion();
      expect(signOut).not.toHaveBeenCalled();
    });
  });

  describe('obtenerUsuarios', () => {
    it('deberÃ­a retornar una lista de usuarios de Firestore', async () => {
      const mockUsers = [
        { id: 'u1', email: 'u1@test.com' },
        { id: 'u2', email: 'u2@test.com' },
      ];
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: mockUsers.map(u => ({ id: u.id, data: () => u })),
      });

      const users = await obtenerUsuarios();
      expect(collection).toHaveBeenCalledWith(expect.any(Object), 'usuarios');
      expect(users).toEqual(mockUsers);
    });

    it('deberÃ­a filtrar usuarios con deletedAt', async () => {
      const mockUsers = [
        { id: 'u1', email: 'u1@test.com' },
        { id: 'u2', email: 'u2@test.com', deletedAt: new Date().toISOString() },
      ];
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: mockUsers.map(u => ({ id: u.id, data: () => u })),
      });

      const users = await obtenerUsuarios();
      expect(users).toEqual([{ id: 'u1', email: 'u1@test.com' }]);
    });

    it('deberÃ­a usar el modo mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      const users = await obtenerUsuarios();
      expect(users.length).toBeGreaterThan(0);
      expect(users[0]).not.toHaveProperty('contrasena');
    });
  });

  describe('actualizarUsuario', () => {
    it('usa el id solicitado si el snapshot actualizado no lo incluye', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        id: '',
        data: () => ({ email: 'fallback@test.com' }),
      });
      await expect(actualizarUsuario({ nombreUsuario: 'Fallback' }, 'fallback-id')).resolves.toEqual(
        expect.objectContaining({ id: 'fallback-id' }),
      );
    });

    it('deberÃ­a actualizar un usuario existente en Firestore', async () => {
      const datosActualizados = { nombreUsuario: 'Usuario Editado' };
      const mockUser = { id: 'user123', email: 'test@test.com', ...datosActualizados };
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      (getDoc as jest.Mock).mockResolvedValueOnce({
        id: 'user123',
        data: () => mockUser,
      });

      const updatedUser = await actualizarUsuario(datosActualizados, 'user123');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        datosActualizados
      );
      expect(updatedUser).toEqual(mockUser);
    });

    it('deberÃ­a manejar campos de contrato anidados', async () => {
      const datosActualizados = {
        sueldoBase: 1000,
        duracionContratoMeses: 12,
        tipoVinculacion: 'Fijo',
        fechaInicio: '2023-01-01',
        lugarEjecucion: 'Oficina',
      };
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      (getDoc as jest.Mock).mockResolvedValueOnce({
        id: 'user123',
        data: () => ({ email: 'test@test.com', contrato: { sueldoBase: 1000 } }),
      });

      await actualizarUsuario(datosActualizados, 'user123');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          contrato: {
            sueldoBase: 1000,
            duracionMeses: 12,
            tipoVinculacion: 'Fijo',
            fechaInicio: '2023-01-01',
            lugarEjecucion: 'Oficina',
          },
        })
      );
      expect(updateDoc).not.toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ sueldoBase: expect.any(Number) })
      );
    });

    it('deberÃ­a usar el modo mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      const updatedUser = await actualizarUsuario({ nombreUsuario: 'Mock Update' }, 'admin-001');
      expect(updatedUser).toEqual(expect.objectContaining({ nombreUsuario: 'Mock Update' }));
    });

    it('deberÃ­a lanzar un error en modo mock si el usuario no es encontrado', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      await expect(actualizarUsuario({ nombreUsuario: 'Mock Update' }, 'non-existent')).rejects.toThrow("Usuario no encontrado.");
    });
  });

  describe('eliminarUsuario', () => {
    it('deberÃ­a marcar un usuario como eliminado (soft delete) en Firestore', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await eliminarUsuario('user123');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ deletedAt: expect.any(String) })
      );
    });

    it('deberÃ­a lanzar un error si el ID de usuario es invÃ¡lido', async () => {
      await expect(eliminarUsuario('')).rejects.toThrow(/ID de usuario inv.*lido para eliminaci.*n/i);
    });

    it('deberÃ­a usar el modo mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      const initialUsersLength = (await obtenerUsuarios()).length;
      await eliminarUsuario('admin-001');
      const updatedUsersLength = (await obtenerUsuarios()).length;
      expect(updatedUsersLength).toBe(initialUsersLength - 1);
    });
  });

  describe('enviarCorreoRecuperacion', () => {
    it('deberÃ­a enviar un correo de recuperaciÃ³n de contraseÃ±a', async () => {
      await enviarCorreoRecuperacion('test@test.com');
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.any(Object), 'test@test.com');
    });

    it('no deberÃ­a hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      await enviarCorreoRecuperacion('test@test.com');
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('guardarTokenNotificacionUsuario', () => {
    it('deberÃ­a guardar el token de notificaciÃ³n del usuario', async () => {
      await guardarTokenNotificacionUsuario('user123', 'token456');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { fcmTokens: arrayUnion('token456') }
      );
    });

    it('no deberÃ­a hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as any).isFirebaseConfigured = false;
      await guardarTokenNotificacionUsuario('user123', 'token456');
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('aliases CRUD', () => {
    it('getUser retorna null o el documento existente', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
      await expect(getUser('missing')).resolves.toBeNull();
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        id: '',
        data: () => ({ email: 'alias@test.com' }),
      });
      await expect(getUser('alias')).resolves.toEqual({ id: 'alias', email: 'alias@test.com' });
    });

    it('createUser persiste y devuelve el mismo usuario', async () => {
      const usuario: any = { id: 'alias', email: 'alias@test.com', nombreUsuario: 'Alias' };
      await expect(createUser(usuario)).resolves.toEqual(usuario);
      expect(setDoc).toHaveBeenCalled();
    });
  });
});

