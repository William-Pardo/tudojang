// servicios/emailService.ts
import { getFunctions, httpsCallable } from 'firebase/functions';

interface EnviarBienvenidaParams {
    email: string;
    nombreClub: string;
    passwordTemporal: string;
    slug: string;
}

/**
 * Helper para llamar a las funciones directamente (Evita problemas de Hosting/CORS)
 */
const callApi = async (functionName: string, data: any) => {
    // SOPORTE PARA MOCK MODE (Desarrollo sin Firebase configurado)
    const { isFirebaseConfigured } = await import('../firebase/config');
    if (!isFirebaseConfigured) {
        console.warn(`[MOCK MODE] Simulando llamada exitosa a: ${functionName}`);
        return { success: true, message: 'Operación simulada con éxito' };
    }

    // Usamos la URL directa de la función para mayor fiabilidad
    const baseUrl = `https://us-central1-tudojang.cloudfunctions.net`;
    const url = `${baseUrl}/${functionName}`;

    try {
        console.log(`Llamando a función: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors', // Aseguramos modo CORS
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data })
        });

        // Intentamos leer como texto primero por si el servidor devuelve algo no-JSON
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error("Respuesta no es JSON:", text);
            throw new Error(`Respuesta inválida del servidor: ${text.substring(0, 100)}`);
        }

        if (!response.ok) {
            throw new Error(result.error?.message || result.message || `Error ${response.status}: ${text}`);
        }
        return result.data;
    } catch (error: any) {
        console.error(`Error crítico en ${functionName}:`, error);
        throw error;
    }
};

/**
 * Crea el usuario en Auth y Firestore antes del pago para asegurar persistencia
 */
export const provisionarUsuarioOnboarding = async (params: any): Promise<any> => {
    return callApi('provisionarUsuarioOnboarding', params);
};

/**
 * Activa la suscripción manualmente si el webhook falla o tarda
 */
export const activarSuscripcionManual = async (params: any): Promise<any> => {
    return callApi('activarSuscripcionManual', params);
};

/**
 * Envía un email de bienvenida con las credenciales temporales
 */
export const enviarEmailBienvenida = async (params: EnviarBienvenidaParams): Promise<void> => {
    try {
        await callApi('enviarBienvenidaTudojang', params);
    } catch (error) {
        console.error('Error al enviar email de bienvenida:', error);
    }
};

