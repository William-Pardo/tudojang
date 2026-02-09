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
 * Crea el usuario en Auth y Firestore antes del pago para asegurar persistencia
 */
export const provisionarUsuarioOnboarding = async (params: any): Promise<any> => {
    try {
        const functions = getFunctions();
        const provisionar = httpsCallable(functions, 'provisionarUsuarioOnboarding');
        const result = await provisionar(params);
        return result.data;
    } catch (error) {
        console.error('Error en provisionamiento:', error);
        throw error;
    }
};

/**
 * Activa la suscripción manualmente si el webhook falla o tarda
 */
export const activarSuscripcionManual = async (params: any): Promise<any> => {
    try {
        const functions = getFunctions();
        const activar = httpsCallable(functions, 'activarSuscripcionManual');
        const result = await activar(params);
        return result.data;
    } catch (error) {
        console.error('Error en activación manual:', error);
        throw error;
    }
};

/**
 * Envía un email de bienvenida con las credenciales temporales
 * usando Cloud Functions y Resend
 */
export const enviarEmailBienvenida = async (params: EnviarBienvenidaParams): Promise<void> => {
    try {
        const functions = getFunctions();
        const enviarBienvenida = httpsCallable(functions, 'enviarBienvenidaTudojang');

        const result = await enviarBienvenida(params);
        console.log('Email de bienvenida enviado:', result.data);
    } catch (error) {
        console.error('Error al enviar email de bienvenida:', error);
        // No lanzamos el error para no bloquear el flujo si falla el email
        // El usuario ya tiene la contraseña en pantalla
    }
};

/**
 * Envía un email de confirmación de pago exitoso
 */
export const enviarEmailConfirmacionPago = async (params: EnviarConfirmacionPagoParams): Promise<void> => {
    try {
        const functions = getFunctions();
        const enviarConfirmacion = httpsCallable(functions, 'enviarConfirmacionPago');

        const result = await enviarConfirmacion(params);
        console.log('Email de confirmación de pago enviado:', result.data);
    } catch (error) {
        console.error('Error al enviar confirmación de pago:', error);
    }
};

/**
 * Envía un email de recuperación de contraseña con enlace de reset
 */
export const enviarEmailRecuperacionPassword = async (params: EnviarRecuperacionPasswordParams): Promise<void> => {
    try {
        const functions = getFunctions();
        const enviarRecuperacion = httpsCallable(functions, 'enviarRecuperacionPassword');

        const result = await enviarRecuperacion(params);
        console.log('Email de recuperación enviado:', result.data);
    } catch (error) {
        console.error('Error al enviar email de recuperación:', error);
        throw error; // En este caso sí lanzamos el error porque el usuario necesita saber si falló
    }
};

/**
 * Notifica al usuario que su contraseña fue cambiada exitosamente
 */
export const notificarCambioPassword = async (params: NotificarCambioPasswordParams): Promise<void> => {
    try {
        const functions = getFunctions();
        const notificar = httpsCallable(functions, 'notificarCambioPassword');

        const result = await notificar(params);
        console.log('Notificación de cambio de password enviada:', result.data);
    } catch (error) {
        console.error('Error al notificar cambio de password:', error);
        // No bloqueamos el flujo si falla la notificación
    }
};
