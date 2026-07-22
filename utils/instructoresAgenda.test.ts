import { RolUsuario, type Usuario } from '../tipos';
import { esInstructorAgenda, obtenerInstructoresAgenda } from './instructoresAgenda';

const usuario = (id: string, rol: RolUsuario, deletedAt?: string): Usuario => ({
    id,
    rol,
    deletedAt,
    email: `${id}@test.com`,
    nombreUsuario: id,
    numeroIdentificacion: id,
    whatsapp: '3000000000',
    tenantId: 'tenant-1'
});

// Regla canonica de roles (CIERRE CENTRO DE ESTUDIOS.md 14.9): Tutor = padre/acudiente,
// NUNCA un instructor. El rol docente es Maestro. Editor/Asistente conservan su acceso
// operativo a la Agenda (planificacion), pero un Tutor jamas planifica bloques.
describe('instructoresAgenda', () => {
    it.each([
        RolUsuario.Admin,
        RolUsuario.Editor,
        RolUsuario.Asistente,
        RolUsuario.Maestro
    ])('habilita el rol %s para planificar bloques', rol => {
        expect(esInstructorAgenda(usuario(rol, rol))).toBe(true);
    });

    it('excluye Tutor (padre/acudiente): regla canonica 14.9, supersede la inclusion previa', () => {
        expect(esInstructorAgenda(usuario('acudiente', RolUsuario.Tutor))).toBe(false);
    });

    it('excluye SuperAdmin y perfiles eliminados', () => {
        expect(esInstructorAgenda(usuario('master', RolUsuario.SuperAdmin))).toBe(false);
        expect(esInstructorAgenda(usuario('retirado', RolUsuario.Maestro, '2026-06-23'))).toBe(false);
    });

    it('devuelve únicamente instructores habilitados sin mutar el arreglo', () => {
        const usuarios = [
            usuario('maestro', RolUsuario.Maestro),
            usuario('tutor', RolUsuario.Tutor),
            usuario('master', RolUsuario.SuperAdmin),
            usuario('admin', RolUsuario.Admin)
        ];

        expect(obtenerInstructoresAgenda(usuarios).map(item => item.id)).toEqual(['maestro', 'admin']);
        expect(usuarios).toHaveLength(4);
    });
});
