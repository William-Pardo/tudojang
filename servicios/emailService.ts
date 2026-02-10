// servicios/emailService.ts
import { getFunctions, httpsCallable } from 'firebase/functions';

interface EnviarBienvenidaParams {
    email: string;
    nombreClub: string;
    passwordTemporal: string;
    slug: string;
}

interface EnviarConfirmacionPagoParams {
    email: string;
    nombreClub: string;
    montoPagado: number; // En centavos
    referenciaPago?: string;
}

interface EnviarRecuperacionPasswordParams {
    email: string;
    nombreClub?: string;
    resetLink: string;
}

interface NotificarCambioPasswordParams {
    email: string;
    nombreClub?: string;
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

/**
 * Envía un email de confirmación de pago exitoso
 */
export const enviarEmailConfirmacionPago = async (params: EnviarConfirmacionPagoParams): Promise<void> => {
    try {
        await callApi('enviarConfirmacionPago', params);
    } catch (error) {
        console.error('Error al enviar confirmación de pago:', error);
    }
};

/**
 * Envía un email de recuperación de contraseña con enlace de reset
 */
export const enviarEmailRecuperacionPassword = async (params: EnviarRecuperacionPasswordParams): Promise<void> => {
    return callApi('enviarRecuperacionPassword', params);
};

/**
 * Notifica al usuario que su contraseña fue cambiada exitosamente
 */
export const notificarCambioPassword = async (params: NotificarCambioPasswordParams): Promise<void> => {
    try {
        await callApi('notificarCambioPassword', params);
    } catch (error) {
        console.error('Error al notificar cambio de password:', error);
    }
};
