import { RolUsuario, type Usuario } from '../tipos';

const ROLES_INSTRUCTOR_AGENDA = new Set<RolUsuario>([
    RolUsuario.Admin,
    RolUsuario.Editor,
    RolUsuario.Asistente,
    RolUsuario.Tutor
]);

export const esInstructorAgenda = (usuario: Usuario): boolean =>
    !usuario.deletedAt && ROLES_INSTRUCTOR_AGENDA.has(usuario.rol);

export const obtenerInstructoresAgenda = (usuarios: Usuario[]): Usuario[] =>
    usuarios.filter(esInstructorAgenda);
