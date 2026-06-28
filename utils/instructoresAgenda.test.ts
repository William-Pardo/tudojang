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

describe('instructoresAgenda', () => {
    it.each([
        RolUsuario.Admin,
        RolUsuario.Editor,
        RolUsuario.Asistente,
        RolUsuario.Tutor
    ])('habilita el rol %s para planificar bloques', rol => {
        expect(esInstructorAgenda(usuario(rol, rol))).toBe(true);
    });

    it('excluye SuperAdmin y perfiles eliminados', () => {
        expect(esInstructorAgenda(usuario('master', RolUsuario.SuperAdmin))).toBe(false);
        expect(esInstructorAgenda(usuario('retirado', RolUsuario.Tutor, '2026-06-23'))).toBe(false);
    });

    it('devuelve únicamente instructores habilitados sin mutar el arreglo', () => {
        const usuarios = [
            usuario('tutor', RolUsuario.Tutor),
            usuario('master', RolUsuario.SuperAdmin),
            usuario('admin', RolUsuario.Admin)
        ];

        expect(obtenerInstructoresAgenda(usuarios).map(item => item.id)).toEqual(['tutor', 'admin']);
        expect(usuarios).toHaveLength(3);
    });
});
