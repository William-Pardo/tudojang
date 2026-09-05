// utils/navegacion/resolverTabInicial.ts
//
// Pura y reusable: valida el valor de `?tab=` (leido con useSearchParams) contra la lista
// de ids conocida de la vista y cae al fallback si es invalido o esta ausente -- nunca
// confia ciegamente en el query string (regla dura del plan "menu mobile acordeon unificado").
// Usada por vistas/Administracion.tsx, vistas/Configuracion.tsx, vistas/Estudiantes.tsx y
// vistas/CentroEstudios.tsx al inicializar su tab activo desde el deep-link que produce el
// nuevo acordeon mobile (ver components/navegacion/menuMobileHijos.tsx).
export function resolverTabInicial<T extends string>(
    idsValidos: readonly T[],
    tabQuery: string | null | undefined,
    fallback: T,
): T {
    if (tabQuery && (idsValidos as readonly string[]).includes(tabQuery)) {
        return tabQuery as T;
    }
    return fallback;
}
