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
 * Helper para llamar a las funciones a través del proxy de Hosting (/api/...)
 */
const callApi = async (functionName: string, data: any) => {
    try {
        const response = await fetch(`/api/${functionName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error?.message || result.message || 'Error en el servidor');
        }
        return result.data;
    } catch (error: any) {
        console.error(`Error llamando a ${functionName}:`, error);
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
