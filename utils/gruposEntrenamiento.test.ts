import {
    agregarGrupoAlCatalogo,
    renombrarGrupoEnCatalogo,
    quitarGrupoDelCatalogo,
    resolverGrupoEntrenamiento,
    nombreGrupoEntrenamiento,
    pasaFiltroGrupoEntrenamiento,
    contarEstudiantesEnGrupo,
    generarIdGrupoEntrenamiento,
    FILTRO_SIN_GRUPO_ENTRENAMIENTO,
    ETIQUETA_SIN_GRUPO,
} from './gruposEntrenamiento';
import type { GrupoEntrenamiento } from '../tipos';

const catalogo: GrupoEntrenamiento[] = [
    { id: 'grp-a', nombre: 'Infantil' },
    { id: 'grp-b', nombre: 'Avanzados' },
];

describe('catálogo de grupos de entrenamiento', () => {
    it('crea un grupo con id generado y nombre normalizado, sin mutar el catálogo original', () => {
        const nuevo = agregarGrupoAlCatalogo(catalogo, '  Junior   y Mayores ', () => 'grp-nuevo');
        expect(nuevo).toEqual([...catalogo, { id: 'grp-nuevo', nombre: 'Junior y Mayores' }]);
        expect(catalogo).toHaveLength(2);
    });

    it('crea el primer grupo cuando el club aún no tiene catálogo', () => {
        expect(agregarGrupoAlCatalogo(undefined, 'Infantil', () => 'grp-1')).toEqual([{ id: 'grp-1', nombre: 'Infantil' }]);
    });

    it('rechaza nombres vacíos y duplicados (sin distinguir mayúsculas)', () => {
        expect(() => agregarGrupoAlCatalogo(catalogo, '   ')).toThrow('El nombre del grupo es obligatorio.');
        expect(() => agregarGrupoAlCatalogo(catalogo, 'avanzados')).toThrow('Ya existe un grupo llamado "avanzados".');
    });

    it('renombra conservando el id (los alumnos asignados no quedan huérfanos)', () => {
        const renombrado = renombrarGrupoEnCatalogo(catalogo, 'grp-b', 'Avanzados Élite');
        expect(renombrado).toEqual([{ id: 'grp-a', nombre: 'Infantil' }, { id: 'grp-b', nombre: 'Avanzados Élite' }]);
        expect(resolverGrupoEntrenamiento({ grupoEntrenamientoId: 'grp-b' }, renombrado)?.nombre).toBe('Avanzados Élite');
    });

    it('permite renombrar un grupo a sí mismo pero no al nombre de otro', () => {
        expect(renombrarGrupoEnCatalogo(catalogo, 'grp-b', 'AVANZADOS')[1].nombre).toBe('AVANZADOS');
        expect(() => renombrarGrupoEnCatalogo(catalogo, 'grp-b', 'infantil')).toThrow(/Ya existe/);
        expect(() => renombrarGrupoEnCatalogo(catalogo, 'no-existe', 'X')).toThrow('El grupo ya no existe.');
    });

    it('elimina solo del catálogo', () => {
        expect(quitarGrupoDelCatalogo(catalogo, 'grp-a')).toEqual([{ id: 'grp-b', nombre: 'Avanzados' }]);
    });

    it('genera ids con prefijo grp- que no chocan con el valor del filtro "sin grupo"', () => {
        const id = generarIdGrupoEntrenamiento();
        expect(id).toMatch(/^grp-/);
        expect(id).not.toBe(FILTRO_SIN_GRUPO_ENTRENAMIENTO);
        expect(generarIdGrupoEntrenamiento()).not.toBe(id);
    });
});

describe('resolución y filtro de grupo de entrenamiento por estudiante', () => {
    it('un id huérfano (grupo eliminado), vacío o ausente se muestra como "Sin grupo"', () => {
        expect(nombreGrupoEntrenamiento({ grupoEntrenamientoId: 'grp-borrado' }, catalogo)).toBe(ETIQUETA_SIN_GRUPO);
        expect(nombreGrupoEntrenamiento({ grupoEntrenamientoId: '' }, catalogo)).toBe(ETIQUETA_SIN_GRUPO);
        expect(nombreGrupoEntrenamiento({}, catalogo)).toBe(ETIQUETA_SIN_GRUPO);
        expect(nombreGrupoEntrenamiento({ grupoEntrenamientoId: 'grp-a' }, undefined)).toBe(ETIQUETA_SIN_GRUPO);
        expect(nombreGrupoEntrenamiento({ grupoEntrenamientoId: 'grp-a' }, catalogo)).toBe('Infantil');
    });

    it('filtra por grupo, por "sin grupo" (incluye huérfanos) y "todos"', () => {
        const estudiantes = [
            { id: '1', grupoEntrenamientoId: 'grp-a' },
            { id: '2', grupoEntrenamientoId: 'grp-b' },
            { id: '3' },
            { id: '4', grupoEntrenamientoId: 'grp-borrado' },
        ];
        const filtrar = (filtro: string) => estudiantes.filter(e => pasaFiltroGrupoEntrenamiento(e, filtro, catalogo)).map(e => e.id);

        expect(filtrar('grp-a')).toEqual(['1']);
        expect(filtrar(FILTRO_SIN_GRUPO_ENTRENAMIENTO)).toEqual(['3', '4']);
        expect(filtrar('todos')).toEqual(['1', '2', '3', '4']);
        // Un filtro que apunta a un id huérfano no matchea a nadie (el grupo ya no existe).
        expect(filtrar('grp-borrado')).toEqual([]);
    });

    it('cuenta los alumnos asignados a un grupo', () => {
        expect(contarEstudiantesEnGrupo([{ grupoEntrenamientoId: 'grp-a' }, { grupoEntrenamientoId: 'grp-a' }, {}], 'grp-a')).toBe(2);
    });
});
