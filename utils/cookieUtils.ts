
// utils/cookieUtils.ts

/**
 * Guarda un valor en las cookies.
 * @param nombre Nombre de la cookie.
 * @param valor Valor a guardar (se convertirá a JSON si es objeto).
 * @param dias Días de expiración.
 */
export const guardarCookie = (nombre: string, valor: any, dias: number = 7) => {
    const fecha = new Date();
    fecha.setTime(fecha.getTime() + (dias * 24 * 60 * 60 * 1000));
    const expiracion = "expires=" + fecha.toUTCString();
    const stringValor = typeof valor === 'object' ? JSON.stringify(valor) : valor;
    document.cookie = `${nombre}=${encodeURIComponent(stringValor)}; ${expiracion}; path=/`;
};

/**
 * Obtiene un valor de las cookies.
 * @param nombre Nombre de la cookie.
 */
export const obtenerCookie = (nombre: string): any => {
    const nombreEQ = nombre + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nombreEQ) === 0) {
            const valor = decodeURIComponent(c.substring(nombreEQ.length, c.length));
            try {
                return JSON.parse(valor);
            } catch (e) {
                return valor;
            }
        }
    }
    return null;
};

/**
 * Borra una cookie.
 * @param nombre Nombre de la cookie.
 */
export const borrarCookie = (nombre: string) => {
    document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};
