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
    // Detectar si estamos en local o producción
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Siempre intentamos usar el proxy /api para consistencia y evitar CORS
    const url = isLocal
        ? `https://us-central1-tudojang.cloudfunctions.net/${functionName}`
        : `/api/${functionName}`;

    try {
        console.log(`Llamando a API: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data })
        });

        // Manejo de respuesta no-JSON (ej: errores 404/403 de GFE)
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error("Respuesta inválida:", text);
            if (response.status === 403) {
                throw new Error("Permiso denegado por el servidor (403). Contacta a soporte.");
            }
            if (response.status === 404) {
                throw new Error("Servicio no encontrado (404). Posible error de despliegue.");
            }
            throw new Error(`Error de comunicación: ${response.status}`);
        }

        if (!response.ok) {
            const errorMsg = result.error?.message || result.message || `Error ${response.status}`;
            throw new Error(errorMsg);
        }

        return result.data;
    } catch (error: any) {
        console.error(`Error crítico en ${functionName}:`, error);
        if (error.message === 'Failed to fetch') {
            throw new Error("No se pudo conectar con el servidor. Verifica tu conexión.");
        }
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
