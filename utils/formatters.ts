
// utils/formatters.ts
// Funciones de utilidad para formatear datos como precios y fechas.

export const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(precio);
}

export const formatearFecha = (fecha: string) => {
    if (!fecha) return 'N/A';
    // Se añade T00:00:00 para asegurar que la fecha se interprete en la zona horaria local y no en UTC.
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
};

/**
 * Genera una URL absoluta para una ruta de la aplicación que utiliza HashRouter.
 * @param rutaApp La ruta interna de la aplicación (ej. "/contrato/123").
 * @returns La URL absoluta completa y funcional.
 */
export const generarUrlAbsoluta = (rutaApp: string): string => {
    // Obtenemos la base de la URL (protocolo + host + path inicial)
    const base = window.location.origin + window.location.pathname;
    // Limpiamos la ruta de entrada de slashes duplicados
    const cleanRoute = rutaApp.startsWith('/') ? rutaApp : `/${rutaApp}`;
    // Construimos la URL con el hash para que el Router lo reconozca al abrirse desde afuera
    return `${base}#${cleanRoute}`;
};
