
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
        // Solo filtrar por tenantId si es válido (no temporal como PLATFORM_INIT_PENDING)
        const tenantIdValido = tenantId && !tenantId.includes('PLATFORM') && !tenantId.includes('PENDING');
        
        const q = tenantIdValido 
            ? query(sedesCollection, where('tenantId', '==', tenantId))
            : sedesCollection;
            
        const snapshot = await getDocs(q);
        // Filtrar sedes que no tengan deletedAt (soft delete)
        const sedes = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Sede))
            .filter(s => !s.deletedAt);
        console.log(`[sedesApi] Obtenidas ${sedes.length} sedes de Firestore (tenantId: ${tenantId || 'todos'})`);
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
        // SOFT DELETE: Marcar como eliminado en lugar de borrar el documento
        // Esto mantiene la consistencia y permite sincronización correcta
        const sedeDocRef = doc(db, 'sedes', id);
        await updateDoc(sedeDocRef, {
            deletedAt: new Date().toISOString()
        });
        console.log(`[sedesApi] Sede ${id} marcada como eliminada (soft delete)`);
    } catch (error) {
        console.error("[sedesApi] Error al eliminar sede de Firestore:", error);
        throw error;
    }
};
