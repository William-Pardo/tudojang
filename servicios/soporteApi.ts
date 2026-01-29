
// servicios/soporteApi.ts
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import { type TicketSoporte, EtapaSoporte } from '../tipos';

const ticketsCollection = collection(db, 'tickets_soporte');

export const crearTicketSoporte = async (datos: Omit<TicketSoporte, 'id' | 'fechaCreacion' | 'estado' | 'etapa'>): Promise<TicketSoporte> => {
    const nuevoTicket = {
        ...datos,
        estado: 'abierto',
        etapa: EtapaSoporte.Recibido,
        fechaCreacion: new Date().toISOString(),
        salaVideoUrl: null
    };

    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Ticket creado localmente.");
        return { id: `tk-${Date.now()}`, ...nuevoTicket } as TicketSoporte;
    }

    const docRef = await addDoc(ticketsCollection, nuevoTicket);
    return { id: docRef.id, ...nuevoTicket } as TicketSoporte;
};

export const actualizarTicket = async (id: string, cambios: Partial<TicketSoporte>): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'tickets_soporte', id);
    await updateDoc(docRef, cambios);
};

export const escucharTicketsActivos = (callback: (tickets: TicketSoporte[]) => void) => {
    if (!isFirebaseConfigured) {
        callback([]);
        return () => { };
    }

    const q = query(ticketsCollection, where("estado", "!=", "resuelto"), orderBy("fechaCreacion", "desc"));
    return onSnapshot(q, (snapshot) => {
        const tickets = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TicketSoporte));
        callback(tickets);
    });
};

export const escucharMiTicketActivo = (userId: string, callback: (ticket: TicketSoporte | null) => void) => {
    if (!isFirebaseConfigured) {
        callback(null);
        return () => { };
    }

    const q = query(ticketsCollection, where("userId", "==", userId), where("estado", "!=", "resuelto"));
    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) callback(null);
        else callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as TicketSoporte);
    });
};
