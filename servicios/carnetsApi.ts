import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../firebase/config';
import { getAppFunctions } from '../firebase/functions';
import type { SolicitudCarnet } from '../tipos';

const solicitudesCollection = collection(db, 'solicitudes_carnets');

interface SolicitarFabricacionCarnetsResultado {
    id: string;
    cantidad: number;
}

// La cantidad y el lote de estudiantes se recalculan server-side (functions/academico/carnets.js)
// contra `estudiantes` del propio tenant -- nunca se confía en un conteo hecho en el cliente.
// Ver la nota de la Cloud Function para el detalle de por qué esto no puede resolverse solo
// con firestore.rules.
export const solicitarFabricacionCarnets = async (
    tenantId: string,
    sedeNombre: string
): Promise<SolicitarFabricacionCarnetsResultado> => {
    if (!isFirebaseConfigured) {
        return { id: `sol-${Date.now()}`, cantidad: 0 };
    }
    const callable = httpsCallable<
        { tenantId: string; sedeNombre: string },
        SolicitarFabricacionCarnetsResultado
    >(getAppFunctions(), 'solicitarFabricacionCarnets');
    const response = await callable({ tenantId, sedeNombre });
    return response.data;
};

const normalizarSolicitud = (id: string, data: Record<string, any>): SolicitudCarnet => ({
    id,
    tenantId: data.tenantId ?? '',
    nombreClub: data.nombreClub ?? '',
    cantidad: data.cantidad ?? 0,
    sedeNombre: data.sedeNombre ?? 'Principal',
    fechaSolicitud: data.fechaSolicitud ?? '',
    estado: data.estado ?? 'pendiente',
});

// `onError` es opcional pero importante: sin un segundo callback, el SDK de Firestore
// traga un error del listener (p.ej. permission-denied por un token de custom claims
// todavía no propagado) en la consola del navegador -- `solicitudesCarnets` se queda
// congelado en `[]` para siempre y la bandeja parece simplemente "vacía", sin ninguna
// señal de que el feed está roto.
export const escucharSolicitudesCarnets = (
    callback: (solicitudes: SolicitudCarnet[]) => void,
    onError?: (error: Error) => void
) => {
    if (!isFirebaseConfigured) {
        callback([]);
        return () => {};
    }

    const q = query(solicitudesCollection, orderBy('fechaSolicitud', 'desc'));
    return onSnapshot(
        q,
        (snapshot) => callback(snapshot.docs.map((s) => normalizarSolicitud(s.id, s.data()))),
        (error) => {
            console.error('[carnetsApi] Error escuchando solicitudes_carnets:', error);
            onError?.(error);
        }
    );
};

// La solicitud nunca se borra ni se edita directo desde el cliente (firestore.rules bloquea
// `update` sin excepción): avanzar o rechazar pasa por esta Cloud Function porque rechazar
// implica revertir `carnetGenerado:false` en cada estudiante del lote, en la MISMA
// transacción que cambia el estado -- ver functions/academico/carnets.js.
export const actualizarEstadoSolicitudCarnet = async (
    solicitudId: string,
    nuevoEstado: SolicitudCarnet['estado']
): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const callable = httpsCallable<
        { solicitudId: string; nuevoEstado: SolicitudCarnet['estado'] },
        { id: string; estado: SolicitudCarnet['estado'] }
    >(getAppFunctions(), 'actualizarEstadoSolicitudCarnets');
    await callable({ solicitudId, nuevoEstado });
};
