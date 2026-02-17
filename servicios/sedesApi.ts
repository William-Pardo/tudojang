
// servicios/sedesApi.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
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
    if (!id) throw new Error("ID de sede inválido para actualización");
    await updateDoc(doc(db, 'sedes', id), data);
    return sede;
};

export const eliminarSede = async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn("[sedesApi] Firebase no configurado. Eliminación simulada localmente.");
        return;
    }
    if (!id) {
        console.warn("[sedesApi] Intento de eliminar sede sin ID. Probablemente una sede local no guardada.");
        throw new Error("ID de sede inválido para eliminación");
    }
    try {
        await deleteDoc(doc(db, 'sedes', id));
        console.log(`[sedesApi] Sede ${id} eliminada correctamente de Firestore`);
    } catch (error) {
        console.error("[sedesApi] Error al eliminar sede de Firestore:", error);
        throw error;
    }
};
