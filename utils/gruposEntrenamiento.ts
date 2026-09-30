// utils/gruposEntrenamiento.ts
// Helpers puros del catálogo de grupos de entrenamiento por club (ConfiguracionClub.
// gruposEntrenamiento). Sin Firestore acá: la persistencia del catálogo reusa
// guardarConfiguraciones (vistas/Configuracion.tsx) y la asignación a estudiantes vive en
// servicios/estudiantesApi.ts (writes parciales de un solo campo).
import type { Estudiante, GrupoEntrenamiento } from '../tipos';

export const ETIQUETA_SIN_GRUPO = 'Sin grupo';

// Valor del filtro del Directorio para "estudiantes sin grupo" (ausente, '' o id huérfano).
// No puede chocar con un id real: generarIdGrupoEntrenamiento siempre empieza con "grp-".
export const FILTRO_SIN_GRUPO_ENTRENAMIENTO = '__sin_grupo__';

export const generarIdGrupoEntrenamiento = (): string =>
    `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Grupo del catálogo al que pertenece el estudiante, o null si no tiene uno válido. Un id que
 * ya no existe en el catálogo (grupo eliminado) cuenta como "sin grupo" -- al borrar un grupo
 * NO se limpian los estudiantes en masa, solo se deja de resolver acá.
 */
export const resolverGrupoEntrenamiento = (
    estudiante: Pick<Estudiante, 'grupoEntrenamientoId'>,
    catalogo: GrupoEntrenamiento[] | undefined
): GrupoEntrenamiento | null => {
    const id = estudiante.grupoEntrenamientoId;
    if (!id) return null;
    return (catalogo || []).find(g => g.id === id) || null;
};

export const nombreGrupoEntrenamiento = (
    estudiante: Pick<Estudiante, 'grupoEntrenamientoId'>,
    catalogo: GrupoEntrenamiento[] | undefined
): string => resolverGrupoEntrenamiento(estudiante, catalogo)?.nombre ?? ETIQUETA_SIN_GRUPO;

export const pasaFiltroGrupoEntrenamiento = (
    estudiante: Pick<Estudiante, 'grupoEntrenamientoId'>,
    filtro: string,
    catalogo: GrupoEntrenamiento[] | undefined
): boolean => {
    if (filtro === 'todos') return true;
    const grupo = resolverGrupoEntrenamiento(estudiante, catalogo);
    if (filtro === FILTRO_SIN_GRUPO_ENTRENAMIENTO) return grupo === null;
    return grupo?.id === filtro;
};

export const contarEstudiantesEnGrupo = (
    estudiantes: Pick<Estudiante, 'grupoEntrenamientoId'>[],
    grupoId: string
): number => estudiantes.filter(e => e.grupoEntrenamientoId === grupoId).length;

const normalizarNombre = (nombre: string) => nombre.trim().replace(/\s+/g, ' ');

const validarNombre = (catalogo: GrupoEntrenamiento[], nombre: string, idExcluido?: string): string => {
    const limpio = normalizarNombre(nombre);
    if (!limpio) throw new Error('El nombre del grupo es obligatorio.');
    const duplicado = catalogo.some(g => g.id !== idExcluido && g.nombre.trim().toLowerCase() === limpio.toLowerCase());
    if (duplicado) throw new Error(`Ya existe un grupo llamado "${limpio}".`);
    return limpio;
};

export const agregarGrupoAlCatalogo = (
    catalogo: GrupoEntrenamiento[] | undefined,
    nombre: string,
    generarId: () => string = generarIdGrupoEntrenamiento
): GrupoEntrenamiento[] => {
    const actual = catalogo || [];
    return [...actual, { id: generarId(), nombre: validarNombre(actual, nombre) }];
};

export const renombrarGrupoEnCatalogo = (
    catalogo: GrupoEntrenamiento[] | undefined,
    id: string,
    nombre: string
): GrupoEntrenamiento[] => {
    const actual = catalogo || [];
    if (!actual.some(g => g.id === id)) throw new Error('El grupo ya no existe.');
    const limpio = validarNombre(actual, nombre, id);
    return actual.map(g => (g.id === id ? { ...g, nombre: limpio } : g));
};

export const quitarGrupoDelCatalogo = (
    catalogo: GrupoEntrenamiento[] | undefined,
    id: string
): GrupoEntrenamiento[] => (catalogo || []).filter(g => g.id !== id);
