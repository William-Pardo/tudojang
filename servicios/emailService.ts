// servicios/emailService.ts
import { getFunctions, httpsCallable } from 'firebase/functions';

interface EnviarBienvenidaParams {
    email: string;
    nombreClub: string;
    passwordTemporal: string;
    slug: string;
}

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
