import { RolUsuario, type Usuario } from '../tipos';

// Regla canonica de roles (CIERRE CENTRO DE ESTUDIOS.md 14.9): Tutor = padre/acudiente,
// NUNCA instructor; el rol docente es Maestro. Editor/Asistente conservan su acceso
// operativo de Agenda (planificacion de bloques), distinto del selector de instructor
// de Programa (jornadaContextService), que es mas restrictivo.
const ROLES_INSTRUCTOR_AGENDA = new Set<RolUsuario>([
    RolUsuario.Admin,
    RolUsuario.Editor,
    RolUsuario.Asistente,
    RolUsuario.Maestro
]);

export const esInstructorAgenda = (usuario: Usuario): boolean =>
    !usuario.deletedAt && ROLES_INSTRUCTOR_AGENDA.has(usuario.rol);

export const obtenerInstructoresAgenda = (usuarios: Usuario[]): Usuario[] =>
    usuarios.filter(esInstructorAgenda);
