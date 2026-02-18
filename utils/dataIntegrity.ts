
// utils/dataIntegrity.ts
import { Sede } from '../tipos';
import { db } from '../firebase/config';
import { doc, deleteDoc } from 'firebase/firestore';

/**
 * Función de autocuración de datos.
 * Detecta y elimina registros corruptos de Sedes para evitar conflictos de "Sedes Fantasma".
 * 
 * @param sedes Lista de sedes obtenidas de Firestore
 * @returns Lista de sedes limpias y válidas
 */
export const sanearSedes = async (sedes: Sede[]): Promise<Sede[]> => {
    if (!sedes || sedes.length === 0) return [];

    const sedesValidas: Sede[] = [];
    const promesasLimpieza = [];

    for (const sede of sedes) {
        // Regla de Integridad: Una sede debe tener ID y Nombre válido.
        // Se considera corrupta si:
        // 1. No tiene nombre o es string vacío
        // 2. No tiene ID
        // 3. Su nombre es "undefined" o "null" como texto
        const esCorrupta = !sede.id || !sede.nombre || sede.nombre.trim() === '' || sede.nombre === 'undefined';

        if (esCorrupta) {
            console.warn(`[DataIntegrity] Detectada sede corrupta (ID: ${sede.id || 'N/A'}). Eliminando...`);
            if (sede.id) {
                // Auto-curación: Eliminar el documento corrupto silenciosamente
                promesasLimpieza.push(deleteDoc(doc(db, 'sedes', sede.id)).catch(err =>
                    console.error("[DataIntegrity] Error eliminando sede corrupta:", err)
                ));
            }
        } else {
            sedesValidas.push(sede);
        }
    }

    // Ejecutar limpieza en background sin bloquear la UI
    if (promesasLimpieza.length > 0) {
        Promise.allSettled(promesasLimpieza).then(() => {
            console.log(`[DataIntegrity] Limpieza completada. ${promesasLimpieza.length} registros eliminados.`);
        });
    }

    return sedesValidas;
};
