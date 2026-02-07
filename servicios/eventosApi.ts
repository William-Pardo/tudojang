
// servicios/eventosApi.ts
import {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    orderBy
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, isFirebaseConfigured } from '@/src/config';
import { EstadoPago, EstadoSolicitud } from '../tipos';
import type { Estudiante, Evento, SolicitudInscripcion } from '../tipos';
import { obtenerEstudiantePorId, obtenerEstudiantePorNumIdentificacion } from './estudiantesApi';

const eventosCollection = collection(db, 'eventos');
const solicitudesCollection = collection(db, 'solicitudesInscripcion');
const storage = getStorage();

const procesarImagenEvento = async (imagenUrl: string | undefined, eventoId: string): Promise<string> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Saltando subida de imagen de evento.");
        return imagenUrl || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }
    if (imagenUrl && imagenUrl.startsWith('data:image')) {
        const storageRef = ref(storage, `eventos/${eventoId}/imagen_${Date.now()}`);
        const snapshot = await uploadString(storageRef, imagenUrl, 'data_url');
        return await getDownloadURL(snapshot.ref);
    }
    return imagenUrl || '';
};

export const obtenerEventos = async (tenantId: string): Promise<Evento[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo lista de eventos vacía.");
        return [];
    }
    const q = query(
        eventosCollection,
        where('tenantId', '==', tenantId),
        orderBy('fechaEvento', 'desc')
    );

    // Para las solicitudes pendientes, lo ideal sería filtrar por tenantId también si existe, 
    // pero por ahora filtramos el mapa después de obtenerlas o por eventoId.
    const [eventosSnap, solicitudesSnap] = await Promise.all([
        getDocs(q),
        getDocs(query(solicitudesCollection, where('estado', '==', EstadoSolicitud.Pendiente)))
    ]);

    const solicitudesPendientesMap = new Map<string, number>();
    solicitudesSnap.forEach(doc => {
        const solicitud = doc.data() as SolicitudInscripcion;
        solicitudesPendientesMap.set(solicitud.eventoId, (solicitudesPendientesMap.get(solicitud.eventoId) || 0) + 1);
    });

    return eventosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        solicitudesPendientes: solicitudesPendientesMap.get(doc.id) || 0,
    } as Evento));
};

export const obtenerEventoPorId = async (idEvento: string): Promise<Evento> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo evento mock.");
        // Added fix: Include required 'tenantId' property in mock event.
        return {
            id: idEvento,
            tenantId: 'escuela-gajog-001',
            nombre: 'Evento Simulado',
            lugar: 'Lugar Simulado',
            fechaEvento: '2099-12-31',
            fechaInicioInscripcion: '2099-12-01',
            fechaFinInscripcion: '2099-12-15',
            valor: 50000,
            solicitudesPendientes: 0,
            descripcion: 'Esta es una descripción de un evento simulado porque la aplicación no está conectada a Firebase.',
            requisitos: 'Ser un usuario de prueba.',
        };
    }
    const docRef = doc(db, 'eventos', idEvento);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Evento;
    } else {
        throw new Error("Evento no encontrado.");
    }
};

export const agregarEvento = async (nuevoEventoData: Omit<Evento, 'id'>): Promise<Evento> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Agregando evento.");
        return { id: `mock-evt-${Date.now()}`, ...nuevoEventoData } as Evento;
    }
    const dataToSave = { ...nuevoEventoData, imagenUrl: '' };
    const docRef = await addDoc(eventosCollection, dataToSave);
    const imageUrl = await procesarImagenEvento(nuevoEventoData.imagenUrl, docRef.id);
    await updateDoc(docRef, { imagenUrl: imageUrl });
    return { id: docRef.id, ...nuevoEventoData, imagenUrl: imageUrl } as Evento;
};

export const actualizarEvento = async (eventoActualizado: Evento): Promise<Evento> => {
    if (!isFirebaseConfigured) {
        return eventoActualizado;
    }
    const { id, ...data } = eventoActualizado;
    const docRef = doc(db, 'eventos', id);
    const imageUrl = await procesarImagenEvento(data.imagenUrl, id);
    const dataToUpdate = { ...data, imagenUrl: imageUrl };
    await updateDoc(docRef, dataToUpdate);
    return { id, ...dataToUpdate } as Evento;
};

export const eliminarEvento = async (idEvento: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Eliminando evento.");
        return;
    }
    const docRef = doc(db, 'eventos', idEvento);
    await deleteDoc(docRef);
};

export const crearSolicitudInscripcion = async (idEvento: string, numIdentificacion: string): Promise<SolicitudInscripcion> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Creando solicitud de inscripción.");
        const estudiante = await obtenerEstudiantePorNumIdentificacion(numIdentificacion);
        return {
            id: `mock-si-${Date.now()}`,
            tenantId: 'escuela-gajog-001',
            eventoId: idEvento,
            estudiante: {
                id: estudiante.id,
                nombres: estudiante.nombres,
                apellidos: estudiante.apellidos,
            },
            fechaSolicitud: new Date().toISOString(),
            estado: EstadoSolicitud.Pendiente
        };
    }
    const estudiante = await obtenerEstudiantePorNumIdentificacion(numIdentificacion);

    const q = query(solicitudesCollection, where("eventoId", "==", idEvento), where("estudiante.id", "==", estudiante.id));
    const existing = await getDocs(q);
    if (!existing.empty) {
        throw new Error("Ya existe una solicitud para este estudiante en este evento.");
    }

    const nuevaSolicitudData = {
        eventoId: idEvento,
        estudiante: {
            id: estudiante.id,
            nombres: estudiante.nombres,
            apellidos: estudiante.apellidos,
        },
        fechaSolicitud: new Date().toISOString(),
        estado: EstadoSolicitud.Pendiente,
    };

    const docRef = await addDoc(solicitudesCollection, nuevaSolicitudData);
    return { id: docRef.id, ...nuevaSolicitudData } as unknown as SolicitudInscripcion;
};

export const obtenerSolicitudesPorEvento = async (idEvento: string): Promise<SolicitudInscripcion[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo lista de solicitudes vacía.");
        return [];
    }
    const q = query(solicitudesCollection, where("eventoId", "==", idEvento), where("estado", "==", EstadoSolicitud.Pendiente));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SolicitudInscripcion));
};

export const gestionarSolicitud = async (idSolicitud: string, nuevoEstado: EstadoSolicitud): Promise<Estudiante | null> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Gestionando solicitud de inscripción.");
        if (nuevoEstado === EstadoSolicitud.Aprobada) {
            return await obtenerEstudiantePorId('mock-id');
        }
        return null;
    }
    const solicitudDocRef = doc(db, 'solicitudesInscripcion', idSolicitud);
    const solicitudSnap = await getDoc(solicitudDocRef);
    if (!solicitudSnap.exists()) {
        throw new Error("Solicitud no encontrada.");
    }

    const solicitud = solicitudSnap.data() as SolicitudInscripcion;

    const batch = writeBatch(db);
    batch.update(solicitudDocRef, { estado: nuevoEstado });

    if (nuevoEstado === EstadoSolicitud.Aprobada) {
        const [evento, estudiante] = await Promise.all([
            obtenerEventoPorId(solicitud.eventoId),
            obtenerEstudiantePorId(solicitud.estudiante.id)
        ]);

        const estudianteDocRef = doc(db, 'estudiantes', solicitud.estudiante.id);
        const nuevoSaldo = estudiante.saldoDeudor + evento.valor;
        const nuevoEstadoPago = (estudiante.estadoPago === EstadoPago.AlDia && evento.valor > 0)
            ? EstadoPago.Pendiente
            : estudiante.estadoPago;

        batch.update(estudianteDocRef, {
            saldoDeudor: nuevoSaldo,
            estadoPago: nuevoEstadoPago,
        });

        await batch.commit();
        return { ...estudiante, saldoDeudor: nuevoSaldo, estadoPago: nuevoEstadoPago };
    } else {
        await batch.commit();
        return null;
    }
};
