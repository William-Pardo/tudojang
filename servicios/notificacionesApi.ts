// servicios/notificacionesApi.ts
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import type { NotificacionHistorial } from '../tipos';
import { TipoNotificacion } from '../tipos';


/**
 * Simula el envío de una notificación (ej. por WhatsApp o Email).
 * @param canal - El canal de comunicación ('WhatsApp' o 'Email').
 * @param destinatario - Número de teléfono o dirección de correo.
 * @param mensaje - El contenido del mensaje.
 */
export const enviarNotificacion = (canal: 'WhatsApp' | 'Email', destinatario: string, mensaje: string): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(() => {
            console.log(`--- NOTIFICACIÓN SIMULADA ---`);
            console.log(`Canal: ${canal}`);
            console.log(`Destinatario: ${destinatario}`);
            console.log(`Mensaje: ${mensaje}`);
            console.log(`-----------------------------`);
            // En una app real, aquí se abriría una URL de WhatsApp o se llamaría a una API de email.
            if (canal === 'WhatsApp' && /^\d+$/.test(destinatario)) {
                const telefonoLimpio = destinatario.replace(/\s+/g, '');
                window.open(`https://wa.me/57${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
            } else if (canal === 'Email') {
                window.open(`mailto:${destinatario}?subject=Notificación de TaekwondoGa Jog&body=${encodeURIComponent(mensaje)}`, '_blank');
            }
            // La notificación al usuario (Toast) se maneja ahora en el componente que llama a esta función.
            resolve();
        }, 300);
    });
};

/**
 * PREMIUM: Envía los 3 links de legalización por WhatsApp tras la inscripción exitosa.
 */
export const dispararLegalizacionPrivada = async (telefono: string, nombreAlumno: string, registroId: string): Promise<void> => {
    const mensaje = `🥋 *BIENVENIDO A TUDOJANG*\n\nHola, hemos procesado la inscripción de *${nombreAlumno}*.\n\nPor favor, completa la firma de los 3 documentos legales obligatorios para finalizar el proceso técnico:\n\n1️⃣ *Contrato de Servicios:*\n${window.location.origin}/#/contrato/${registroId}\n\n2️⃣ *Consentimiento de Riesgos:*\n${window.location.origin}/#/firma/${registroId}\n\n3️⃣ *Autorización de Imagen:*\n${window.location.origin}/#/imagen/${registroId}\n\n_Este es un proceso automatizado de seguridad._`;
    await enviarNotificacion('WhatsApp', telefono, mensaje);
};


const historialCollection = collection(db, 'historialNotificaciones');

/**
 * Guarda un registro de una notificación enviada en la base de datos.
 * @param notificacion - El objeto de notificación a guardar.
 * @returns El objeto de notificación guardado con su nuevo ID.
 */
export const guardarNotificacionEnHistorial = async (notificacion: Omit<NotificacionHistorial, 'id'>): Promise<NotificacionHistorial> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Guardando notificación en historial.");
        const mockNotificacion: NotificacionHistorial = { id: `mock-notif-${Date.now()}`, ...notificacion };
        return mockNotificacion;
    }
    const docRef = await addDoc(historialCollection, notificacion);
    return { id: docRef.id, ...notificacion };
};

/**
 * Obtiene el historial de notificaciones enviadas.
 * @returns Una lista de notificaciones, ordenadas por fecha descendente.
 */
export const obtenerHistorialNotificaciones = async (): Promise<NotificacionHistorial[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo historial de notificaciones de prueba.");
        return [
            {
                id: '2',
                fecha: new Date().toISOString(),
                estudianteId: '2',
                estudianteNombre: 'Sofia Gómez',
                tutorNombre: 'Carlos Gómez',
                destinatario: 'carlos.gomez@email.com',
                canal: 'Email',
                tipo: TipoNotificacion.RecordatorioPago,
                mensaje: 'Hola Carlos, te recordamos amablemente que el pago de la mensualidad para Sofia por un valor de $180.000 está próximo a vencer. Agradecemos tu puntualidad. Equipo TaekwondoGa Jog.',
                leida: false,
            },
            {
                id: '1',
                fecha: new Date(Date.now() - 86400000).toISOString(),
                estudianteId: '1',
                estudianteNombre: 'Juan Pérez',
                tutorNombre: 'Ana Pérez',
                destinatario: '3001112233',
                canal: 'WhatsApp',
                tipo: TipoNotificacion.Bienvenida,
                mensaje: '¡Bienvenido a TaekwondoGa Jog, Juan! Estamos muy felices de tenerte con nosotros. Esperamos que disfrutes cada clase y aprendas mucho. ¡Nos vemos en el dojang!',
                leida: true,
            }
        ];
    }
    const q = query(historialCollection, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificacionHistorial));
};

/**
 * Marca una notificación específica como leída.
 * @param idNotificacion - El ID de la notificación a marcar.
 */
export const marcarNotificacionComoLeida = async (idNotificacion: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn(`MODO SIMULADO: Marcando notificación ${idNotificacion} como leída.`);
        return;
    }
    const docRef = doc(db, 'historialNotificaciones', idNotificacion);
    await updateDoc(docRef, { leida: true });
};

/**
 * Marca todas las notificaciones no leídas como leídas.
 */
export const marcarTodasComoLeidas = async (): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Marcando todas las notificaciones como leídas.");
        return;
    }
    const q = query(historialCollection, where('leida', '==', false));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { leida: true });
    });

    await batch.commit();
};