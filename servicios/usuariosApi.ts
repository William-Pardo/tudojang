import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateCurrentUser,
} from 'firebase/auth';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { Usuario } from '../tipos';
import { RolUsuario } from '../tipos';
import {
  authenticateLocalUser,
  buildRecoveryUser,
  buildUpdateData,
  buildUserData,
  createUser as createUserWithRepository,
  getUser as getUserWithRepository,
  isUserDeleted,
  listActiveUsers,
  updateLocalUser,
  type UsuarioContrasena,
  type UsuariosRepository,
} from '../services/usuariosService';

const MAX_PROFILE_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;

let usuariosMock: UsuarioContrasena[] = [
  {
    id: 'master-aliant', email: 'aliantlab@gmail.com', nombreUsuario: 'Aliant Master Control',
    numeroIdentificacion: '00000000', whatsapp: '3000000000', rol: RolUsuario.SuperAdmin,
    tenantId: 'aliant-global', contrasena: 'admin123',
  },
  {
    id: 'admin-001', email: 'admin@test.com', nombreUsuario: 'Director General (Admin)',
    numeroIdentificacion: '1020304050', whatsapp: '3001234567', rol: RolUsuario.Admin,
    tenantId: 'escuela-gajog-001', contrasena: 'admin123',
  },
  {
    id: 'editor-001', email: 'editor@test.com', nombreUsuario: 'Secretaría (Editor)',
    numeroIdentificacion: '1020304051', whatsapp: '3101234567', rol: RolUsuario.Editor,
    tenantId: 'escuela-gajog-001', contrasena: 'editor123',
  },
  {
    id: 'asistente-001', email: 'asistente@test.com', nombreUsuario: 'Apoyo Sede (Asistente)',
    numeroIdentificacion: '1020304052', whatsapp: '3201234567', rol: RolUsuario.Asistente,
    tenantId: 'escuela-gajog-001', sedeId: '1', contrasena: 'asistente123',
  },
  {
    id: 'estudiante-001', email: 'juan@test.com', nombreUsuario: 'Juan Pérez (Estudiante)',
    numeroIdentificacion: '10101', whatsapp: '3001234568', rol: RolUsuario.Estudiante,
    tenantId: 'escuela-gajog-001', contrasena: 'juan123',
  },
  {
    id: 'estudiante-002', email: 'maria@test.com', nombreUsuario: 'Maria Lopez (Estudiante)',
    numeroIdentificacion: '20202', whatsapp: '3001234569', rol: RolUsuario.Estudiante,
    tenantId: 'escuela-gajog-001', contrasena: 'maria123',
  }
];

export const esperar = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const firestoreRepository: UsuariosRepository = {
  async getById(id) {
    const snapshot = await getDoc(doc(db, 'usuarios', id));
    return snapshot.exists() ? ({ id: snapshot.id || id, ...snapshot.data() } as Usuario) : null;
  },
  async getByEmail(email) {
    const snapshot = await getDocs(query(collection(db, 'usuarios'), where('email', '==', email)));
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Usuario;
  },
  async create(id, usuario) {
    await setDoc(doc(db, 'usuarios', id), usuario);
  },
  async list() {
    const snapshot = await getDocs(collection(db, 'usuarios'));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Usuario));
  },
  async update(id, cambios) {
    const reference = doc(db, 'usuarios', id);
    await updateDoc(reference, cambios);
    const snapshot = await getDoc(reference);
    return { id: snapshot.id || id, ...snapshot.data() } as Usuario;
  },
  async softDelete(id, deletedAt) {
    await updateDoc(doc(db, 'usuarios', id), { deletedAt });
  },
  async appendNotificationToken(id, token) {
    await updateDoc(doc(db, 'usuarios', id), { fcmTokens: arrayUnion(token) });
  },
};

export const getUser = (id: string): Promise<Usuario | null> =>
  getUserWithRepository(firestoreRepository, id);

export const createUser = (usuario: Usuario): Promise<Usuario> =>
  createUserWithRepository(firestoreRepository, usuario);

export const autenticarUsuario = async (email: string, contrasena: string): Promise<Usuario> => {
  if (!isFirebaseConfigured) return authenticateLocalUser(usuariosMock, email, contrasena);

  const auth = getAuth();
  const credential = await signInWithEmailAndPassword(auth, email, contrasena);
  const uid = credential.user.uid;

  for (let attempt = 0; attempt < MAX_PROFILE_ATTEMPTS; attempt++) {
    try {
      const byId = await firestoreRepository.getById(uid);
      const found = byId || await firestoreRepository.getByEmail(email.toLowerCase().trim());
      if (found) {
        if (isUserDeleted(found)) throw new Error('Esta cuenta ha sido eliminada. Contacta al administrador.');
        return found;
      }
      if (uid.startsWith('tnt-')) {
        const recovery = buildRecoveryUser(email, uid);
        await firestoreRepository.create(uid, (({ id, ...data }) => data)(recovery));
        return recovery;
      }
    } catch (error: any) {
      if (error?.message?.includes('cuenta ha sido eliminada')) throw error;
      if (error?.message?.includes('blocked-by-client') || error?.code === 'failed-precondition') {
        throw new Error('El acceso a la base de datos está siendo bloqueado por tu navegador.');
      }
    }
    if (attempt < MAX_PROFILE_ATTEMPTS - 1) await esperar(RETRY_DELAY_MS);
  }
  throw new Error('Tu perfil no existe o no se ha sincronizado correctamente.');
};

export const agregarUsuario = async (datos: any): Promise<Usuario> => {
  if (!isFirebaseConfigured) {
    const nuevo = { id: `user-${Date.now()}`, ...buildUserData(datos), contrasena: datos.contrasena };
    usuariosMock.push(nuevo as UsuarioContrasena);
    const { contrasena: _, ...usuario } = nuevo;
    return usuario as Usuario;
  }

  const auth = getAuth();
  const currentUser = auth.currentUser;
  const credential = await createUserWithEmailAndPassword(auth, datos.email, datos.contrasena);
  const usuario = { id: credential.user.uid, ...buildUserData(datos) } as Usuario;
  await createUser(usuario);
  await signOut(auth);
  if (currentUser) await updateCurrentUser(auth, currentUser);
  return usuario;
};

export const cerrarSesion = async (): Promise<void> => {
  if (isFirebaseConfigured) await signOut(getAuth());
};

export const obtenerUsuarios = async (): Promise<Usuario[]> => {
  if (!isFirebaseConfigured) {
    return usuariosMock.map(({ contrasena: _, ...usuario }) => usuario);
  }
  return listActiveUsers(await firestoreRepository.list());
};

export const actualizarUsuario = async (datos: any, id: string): Promise<Usuario> => {
  if (!isFirebaseConfigured) {
    const result = updateLocalUser(usuariosMock, id, datos);
    usuariosMock = result.usuarios;
    return result.usuario;
  }
  return firestoreRepository.update(id, buildUpdateData(datos));
};

export const eliminarUsuario = async (id: string): Promise<void> => {
  if (!id) throw new Error('ID de usuario inválido para eliminación');
  if (!isFirebaseConfigured) {
    usuariosMock = usuariosMock.filter(usuario => usuario.id !== id);
    return;
  }
  await firestoreRepository.softDelete(id, new Date().toISOString());
};

export const enviarCorreoRecuperacion = async (email: string): Promise<void> => {
  if (isFirebaseConfigured) await sendPasswordResetEmail(getAuth(), email);
};

export const guardarTokenNotificacionUsuario = async (idUsuario: string, token: string): Promise<void> => {
  if (isFirebaseConfigured) await firestoreRepository.appendNotificationToken(idUsuario, token);
};

export { isUserDeleted };

// Cambios: + delegación a usuariosService, + repositorio Firestore inyectable, + aliases getUser/createUser, + API pública preservada.
