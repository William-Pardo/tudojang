// servicios/pushService.ts
import { getToken } from 'firebase/messaging';
import { messaging } from '../firebase/config';
import { guardarTokenNotificacionUsuario } from './usuariosApi';
import type { Usuario } from '../tipos';

const VAPID_KEY = process.env.VAPID_KEY;

export const solicitarPermisoYGuardarToken = async (usuario: Usuario): Promise<void> => {
    if (!messaging || !VAPID_KEY) {
        throw new Error("La configuración de Firebase Messaging no está completa.");
    }

    console.log("Solicitando permiso para notificaciones...");
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
        console.log("Permiso concedido. Obteniendo token...");
        try {
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (currentToken) {
                console.log("Token FCM obtenido:", currentToken);
                await guardarTokenNotificacionUsuario(usuario.id, currentToken);
                console.log("Token guardado en el perfil del usuario.");
            } else {
                throw new Error("No se pudo obtener el token de registro. Se necesita permiso para mostrar notificaciones.");
            }
        } catch (err) {
            console.error("Ocurrió un error al obtener el token.", err);
            throw new Error("No se pudo obtener el token de notificación. Revisa la consola para más detalles.");
        }
    } else {
        console.warn("Permiso de notificación no concedido.");
        throw new Error("No has concedido permiso para recibir notificaciones.");
    }
};
