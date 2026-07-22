
// servicios/sedesApi.ts
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { Sede } from '../tipos';

const sedesCollection = collection(db, 'sedes');

// Fix 2026-07-16 (bug real: puerta trasera del limite de sedes del plan -- crear/editar
// sedes escribia DIRECTO a Firestore desde el cliente, sin ningun chequeo server-side de
// cantidad ni de nombres duplicados; firestore.rules solo pedia "sos Admin", nada mas.
// Ahora create/update/delete pasan por Cloud Functions que re-validan limite de plan y
// unicidad de nombre -- ver functions/academico/sedes.js). Solo la LECTURA (obtenerSedes)
// sigue siendo un query directo, porque leer no necesita esa validacion.

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
        // El ID real del documento SIEMPRE debe ganar sobre cualquier campo `id` que pueda
        // venir dentro de la data guardada (legacy/corrupto) -- por eso `...doc.data()` va
        // ANTES de `id: doc.id`, no despues. El orden inverso (bug real encontrado 2026-07-16,
        // ver [AgendaView][diag] en consola: "10 de 11 sedes corruptas (ID: N/A)") dejaba que
        // un campo `id` vacio/viejo dentro de la data pisara el doc.id real, produciendo sedes
        // sin ID valido -- eso hacia fallar `resolverSedeIdPorNombre` (AsignacionesView.tsx) al
        // guardar un Programa academico, que caia siempre al fallback de slug en vez del ID
        // real, y por eso las jornadas nunca calzaban con `estudiante.sedeId` en Agenda
        // (Tutor/Estudiante) sin importar cuantas veces se reguardara el programa.
        const sedes = snapshot.docs
            .map(doc => ({ ...doc.data(), id: doc.id } as Sede))
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
    const callable = httpsCallable<{ tenantId: string; nombre: string; [key: string]: unknown }, Sede>(
        getFunctions(), 'createSede'
    );
    const resultado = await callable({ ...sede, tenantId: sede.tenantId });
    return resultado.data;
};

export const actualizarSede = async (sede: Sede): Promise<Sede> => {
    if (!isFirebaseConfigured) return sede;
    const { id, tenantId, ...cambios } = sede;
    if (!id) throw new Error("ID de sede inválido para actualización");
    const callable = httpsCallable<{ tenantId: string; sedeId: string; cambios: Partial<Sede> }, Sede>(
        getFunctions(), 'updateSede'
    );
    const resultado = await callable({ tenantId, sedeId: id, cambios });
    return resultado.data;
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
        // SOFT DELETE server-side (functions/academico/sedes.js): marca deletedAt en vez
        // de borrar el documento -- misma semantica que antes, ahora re-validada por el
        // servidor (tenantId se deriva del propio documento, no hace falta mandarlo).
        const callable = httpsCallable<{ sedeId: string }, { ok: boolean; id: string }>(
            getFunctions(), 'deleteSede'
        );
        await callable({ sedeId: id });
        console.log(`[sedesApi] Sede ${id} marcada como eliminada (soft delete)`);
    } catch (error) {
        console.error("[sedesApi] Error al eliminar sede de Firestore:", error);
        throw error;
    }
};
