
// servicios/sedesApi.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import type { Sede } from '../tipos';

const sedesCollection = collection(db, 'sedes');

export const obtenerSedes = async (): Promise<Sede[]> => {
    if (!isFirebaseConfigured) {
        return [
            { id: '1', tenantId: 'escuela-gajog-001', nombre: 'Sede Central', direccion: 'Calle 10 # 5-20', ciudad: 'Bogotá', telefono: '3001112233', valorMensualidad: 0 },
            { id: '2', tenantId: 'escuela-gajog-001', nombre: 'Sede Premium Norte', direccion: 'Av. Siempre Viva 123', ciudad: 'Bogotá', telefono: '3004445566', valorMensualidad: 220000 }
        ];
    }
    const snapshot = await getDocs(sedesCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
};

export const agregarSede = async (sede: Omit<Sede, 'id'>): Promise<Sede> => {
    if (!isFirebaseConfigured) return { id: `mock-sede-${Date.now()}`, ...sede } as Sede;
    const docRef = await addDoc(sedesCollection, sede);
    return { id: docRef.id, ...sede } as Sede;
};

export const actualizarSede = async (sede: Sede): Promise<Sede> => {
    if (!isFirebaseConfigured) return sede;
    const { id, ...data } = sede;
    await updateDoc(doc(db, 'sedes', id), data);
    return sede;
};

export const eliminarSede = async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, 'sedes', id));
};
