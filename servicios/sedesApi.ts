
// servicios/sedesApi.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { Sede } from '../tipos';

const sedesCollection = collection(db, 'sedes');

export const obtenerSedes = async (tenantId?: string): Promise<Sede[]> => {
    // En producción (Firebase configurado), SIEMPRE consultar Firestore
    // No retornar mocks porque causan problemas con IDs inválidos
    if (!isFirebaseConfigured) {
        console.warn("[sedesApi] Firebase no configurado. Retornando array vacío.");
        return [];
    }
    
    try {
        // Filtrar por tenantId si se proporciona
        const q = tenantId 
            ? query(sedesCollection, where('tenantId', '==', tenantId))
            : sedesCollection;
            
        const snapshot = await getDocs(q);
        const sedes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
        console.log(`[sedesApi] Obtenidas ${sedes.length} sedes de Firestore`);
        return sedes;
    } catch (error) {
        console.error("[sedesApi] Error al obtener sedes:", error);
        return [];
    }
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
