// servicios/notificacionesApi.ts
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
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
// ERR-0011: obtenerHistorialNotificaciones() leia la coleccion COMPLETA sin filtro de
// tenant -- cualquier staff autenticado veia el buzon de notificaciones de TODOS los
// tenants. Requiere que cada doc tenga `tenantId` (ver tipos.ts::NotificacionHistorial
// y los puntos de escritura actualizados junto con este fix).
export const obtenerHistorialNotificaciones = async (tenantId?: string): Promise<NotificacionHistorial[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo historial de notificaciones de prueba.");
        return [
            {
                id: '2',
                tenantId: 'escuela-gajog-001',
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
                tenantId: 'escuela-gajog-001',
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
    const q = tenantId
        ? query(historialCollection, where('tenantId', '==', tenantId), orderBy('fecha', 'desc'))
        : query(historialCollection, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificacionHistorial));
};

/**
 * Buzón del consultor (Tutor/Estudiante): notificaciones de un conjunto de estudiantes.
 * Query por `estudianteId in [...]` (se trocea de a 10 por el límite de Firestore) y se
 * ordena por fecha desc en cliente para evitar índice compuesto.
 *
 * ERR-0011: se agrega `where('tenantId', '==', tenantId)` -- la regla de Firestore para
 * `historialNotificaciones` ahora exige `resource.data.tenantId == currentTenantId()`, y
 * para un `list` ese campo debe formar parte del filtro de la query o Firestore rechaza
 * la lectura completa (no puede probar la condición documento a documento). `in` + `==`
 * sobre campos distintos sigue sin requerir índice compuesto (ambos son equality).
 */
export const obtenerNotificacionesPorEstudiantes = async (
  estudianteIds: string[],
  tenantId: string
): Promise<NotificacionHistorial[]> => {
  const idsUnicos = Array.from(new Set(estudianteIds.filter(Boolean)));
  if (idsUnicos.length === 0 || !tenantId) return [];

  if (!isFirebaseConfigured) {
    const todas = await obtenerHistorialNotificaciones();
    return todas.filter(n => idsUnicos.includes(n.estudianteId));
  }

  // Firestore limita el operador `in` a 10 valores -> troceamos.
  const lotes: string[][] = [];
  for (let i = 0; i < idsUnicos.length; i += 10) {
    lotes.push(idsUnicos.slice(i, i + 10));
  }

  const resultados = await Promise.all(
    lotes.map(async (lote) => {
      const q = query(
        historialCollection,
        where('tenantId', '==', tenantId),
        where('estudianteId', 'in', lote)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NotificacionHistorial));
    })
  );

  return resultados
    .flat()
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
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
export const marcarTodasComoLeidas = async (tenantId?: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Marcando todas las notificaciones como leídas.");
        return;
    }
    const q = tenantId
        ? query(historialCollection, where('tenantId', '==', tenantId), where('leida', '==', false))
        : query(historialCollection, where('leida', '==', false));
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