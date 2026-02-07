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
    // TODAS LAS NOTIFICACIONES SE MANEJAN AHORA EN EL SERVIDOR (FIREBASE FUNCTIONS)
    // ESTA FUNCIÓN QUEDA COMO PROMISE SILENCIOSA EN EL FRONTEND PARA EVITAR POPUPS.
    return new Promise(resolve => {
        setTimeout(() => {
            console.log(`[NOTIFICACIÓN SILENCIOSA] ${canal} a ${destinatario}: ${mensaje}`);
            resolve();
        }, 100);
    });
};

/**
 * PREMIUM: Envía los 3 links de legalización por WhatsApp tras la inscripción exitosa.
 */
export const dispararLegalizacionPrivada = async (telefono: string, nombreAlumno: string, registroId: string): Promise<void> => {
    const mensaje = `🥋 *BIENVENIDO A TUDOJANG*\n\nHola, hemos procesado la inscripción de *${nombreAlumno}*.\n\nPor favor, completa la firma de los 3 documentos legales obligatorios para finalizar el proceso técnico:\n\n1️⃣ *Contrato de Servicios:*\n${window.location.origin}/#/contrato/${registroId}\n\n2️⃣ *Consentimiento de Riesgos:*\n${window.location.origin}/#/firma/${registroId}\n\n3️⃣ *Autorización de Imagen:*\n${window.location.origin}/#/imagen/${registroId}\n\n_Este es un proceso automatizado de seguridad._`;
    await enviarNotificacion('WhatsApp', telefono, mensaje);
};

/**
 * PREMIUM: Envía notificación formal de apertura de suscripción con el nuevo slug.
 */
export const dispararNotificacionNuevaEscuela = async (email: string, slug: string, nombreClub: string): Promise<void> => {
    const mensaje = `
🥋 *¡BIENVENIDO A LA ÉLITE DIGITAL, ${nombreClub.toUpperCase()}!*

Es un honor confirmar que tu ecosistema de gestión de artes marciales ha sido desplegado con éxito.

*Detalles de tu nueva membresía:*
🌐 *Dominio Adquirido:* https://${slug}.tudojang.com
👤 *Nombre de la Escuela:* ${nombreClub}
🚀 *Estado:* Activo (Periodo de Lanzamiento)

Desde este momento, tienes el control total de tu academia en la palma de tu mano. Tu legado ahora cuenta con una infraestructura de clase mundial.

*Próximos pasos:*
1. Ingresa a tu nuevo portal.
2. Configura tus sedes y programas.
3. Comienza a registrar a tus alumnos.

¡El camino a la excelencia digital comienza hoy!

Atentamente,
*Equipo de Expansión Tudojang*
    `.trim();
    await enviarNotificacion('Email', email, mensaje);
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
export const obtenerHistorialNotificaciones = async (tenantId: string): Promise<NotificacionHistorial[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo historial de notificaciones de prueba.");
        return [
            // ... (mocks shortened for brevity)
        ];
    }
    const q = query(
        historialCollection,
        where('tenantId', '==', tenantId),
        orderBy('fecha', 'desc')
    );
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
export const marcarTodasComoLeidas = async (tenantId: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Marcando todas las notificaciones como leídas.");
        return;
    }
    const q = query(
        historialCollection,
        where('tenantId', '==', tenantId),
        where('leida', '==', false)
    );
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