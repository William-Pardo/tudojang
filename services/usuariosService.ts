import type { Usuario } from '../tipos';
import { RolUsuario } from '../tipos';

export interface UsuarioContrasena extends Usuario {
  contrasena: string;
}

export interface UsuariosRepository {
  getById(id: string): Promise<Usuario | null>;
  getByEmail(email: string): Promise<Usuario | null>;
  create(id: string, usuario: Omit<Usuario, 'id'>): Promise<void>;
  list(): Promise<Usuario[]>;
  update(id: string, cambios: Partial<Usuario>): Promise<Usuario>;
  softDelete(id: string, deletedAt: string): Promise<void>;
  appendNotificationToken(id: string, token: string): Promise<void>;
}

export const removeUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;

export const isUserDeleted = (usuario: Partial<Usuario> | null): boolean =>
  Boolean(usuario?.deletedAt);

export const getUser = async (
  repository: Pick<UsuariosRepository, 'getById'>,
  id: string,
): Promise<Usuario | null> => repository.getById(id);

export const createUser = async (
  repository: Pick<UsuariosRepository, 'create'>,
  usuario: Usuario,
): Promise<Usuario> => {
  const { id, ...data } = usuario;
  await repository.create(id, data);
  return usuario;
};

export const buildUserData = (datos: any): Omit<Usuario, 'id'> => removeUndefined({
  nombreUsuario: datos.nombreUsuario,
  email: datos.email,
  numeroIdentificacion: datos.numeroIdentificacion,
  whatsapp: datos.whatsapp,
  rol: datos.rol,
  tenantId: datos.tenantId,
  sedeId: datos.sedeId || '',
  contrato: {
    sueldoBase: datos.sueldoBase || 0,
    duracionMeses: datos.duracionContratoMeses || 0,
    tipoVinculacion: datos.tipoVinculacion || '',
    fechaInicio: datos.fechaInicio || '',
    lugarEjecucion: datos.lugarEjecucion || '',
    firmado: false,
  },
  fcmTokens: [],
} as unknown as Omit<Usuario, 'id'>);

export const buildUpdateData = (datos: any): Partial<Usuario> => {
  const updateData: any = { ...datos };
  if (datos.sueldoBase !== undefined || datos.duracionContratoMeses !== undefined) {
    updateData.contrato = removeUndefined({
      ...(updateData.contrato || {}),
      sueldoBase: datos.sueldoBase,
      duracionMeses: datos.duracionContratoMeses,
      tipoVinculacion: datos.tipoVinculacion,
      fechaInicio: datos.fechaInicio,
      lugarEjecucion: datos.lugarEjecucion,
    });
    ['sueldoBase', 'duracionContratoMeses', 'tipoVinculacion', 'fechaInicio', 'lugarEjecucion']
      .forEach(key => delete updateData[key]);
  }
  return removeUndefined(updateData);
};

export const buildRecoveryUser = (email: string, uid: string): Usuario => ({
  id: uid,
  nombreUsuario: email.split('@')[0].toUpperCase(),
  email: email.toLowerCase().trim(),
  numeroIdentificacion: 'PENDIENTE',
  whatsapp: '3000000000',
  rol: RolUsuario.Admin,
  tenantId: uid,
  sedeId: '',
  fcmTokens: [],
});

export const authenticateLocalUser = (
  usuarios: UsuarioContrasena[],
  email: string,
  contrasena: string,
): Usuario => {
  const found = usuarios.find(user => user.email.toLowerCase() === email.toLowerCase());
  if (!found || found.contrasena !== contrasena) {
    throw new Error('Correo electrónico o contraseña incorrectos.');
  }
  const { contrasena: _, ...usuario } = found;
  return usuario;
};

export const listActiveUsers = (usuarios: Usuario[]): Usuario[] =>
  usuarios.filter(usuario => !isUserDeleted(usuario));

export const updateLocalUser = (
  usuarios: UsuarioContrasena[],
  id: string,
  datos: Partial<UsuarioContrasena>,
): { usuarios: UsuarioContrasena[]; usuario: Usuario } => {
  const updated = usuarios.map(user => user.id === id ? { ...user, ...datos } : user);
  const found = updated.find(user => user.id === id);
  if (!found) throw new Error('Usuario no encontrado.');
  const { contrasena: _, ...usuario } = found;
  return { usuarios: updated, usuario };
};

// Cambios: + contratos de repositorio, + funciones puras de usuarios, + normalización de creación/actualización.
