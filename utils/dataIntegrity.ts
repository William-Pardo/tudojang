
// utils/dataIntegrity.ts
import { Sede, ConfiguracionClub } from '../tipos';
import { db } from '../firebase/config';
import { doc, deleteDoc } from 'firebase/firestore';

/**
 * REGLA DE GESTIÓN DE SEDES:
 * 1. La Sede Principal SIEMPRE proviene de ConfiguracionClub.direccionClub
 * 2. Las Sedes Adicionales se almacenan en la colección 'sedes' y están limitadas por el plan
 * 3. NINGÚN componente debe usar directamente la lista 'sedes' para mostrar opciones
 * 4. TODOS los componentes deben usar 'sedesVisibles' del hook useSedes()
 * 5. El contador de licencia debe incluir SIEMPRE: 1 (Principal) + N (Adicionales activas)
 * 6. Si una sede adicional se elimina (deletedAt), deja de ser visible en TODA la app
 */

/**
 * Obtiene la lista de sedes visibles para el usuario.
 * Combina la Sede Principal (de ConfiguracionClub) con las Sedes Adicionales activas.
 * 
 * @param configClub Configuración del club (contiene la dirección principal)
 * @param sedes Lista de sedes adicionales de Firestore
 * @returns Lista de sedes visibles (Principal + Adicionales activas)
 */
export const getSedesVisibles = (
    configClub: ConfiguracionClub | null,
    sedes: Sede[]
): Sede[] => {
    // 1. Crear Sede Principal desde configClub.direccionClub
    const sedePrincipal: Sede = {
        id: 'principal',
        tenantId: configClub?.tenantId || '',
        nombre: configClub?.nombreClub || 'Sede Principal',
        direccion: configClub?.direccionClub || '',
        ciudad: '',
        telefono: ''
    };

    // 2. Filtrar sedes adicionales activas (sin deletedAt)
    // Regla: Se excluyen sedes que tengan el mismo nombre y dirección que la principal (duplicados de onboarding)
    const sedesAdicionales = sedes.filter(s =>
        !s.deletedAt &&
        !(s.nombre?.trim().toLowerCase() === configClub?.nombreClub?.trim().toLowerCase() &&
            s.direccion?.trim().toLowerCase() === configClub?.direccionClub?.trim().toLowerCase())
    );

    // 3. Retornar combinación: Principal + Adicionales
    return [sedePrincipal, ...sedesAdicionales];
};

/**
 * Calcula el total de sedes activas para el contador de licencia.
 * Siempre incluye la Sede Principal (1) + las sedes adicionales activas.
 * 
 * @param configClub Configuración del club
 * @param sedes Lista de sedes adicionales de Firestore
 * @returns Total de sedes activas (mínimo 1)
 */
export const getTotalSedesActivas = (configClub: ConfiguracionClub | null, sedes: Sede[]): number => {
    // Filtrar sedes adicionales activas (sin deletedAt) y que no sean duplicados de la principal
    const sedesAdicionalesActivas = sedes.filter(s =>
        !s.deletedAt &&
        !(s.nombre?.trim().toLowerCase() === configClub?.nombreClub?.trim().toLowerCase() &&
            s.direccion?.trim().toLowerCase() === configClub?.direccionClub?.trim().toLowerCase())
    );
    // Siempre: 1 (Principal) + N (Adicionales activas)
    return 1 + sedesAdicionalesActivas.length;
};

/**
 * Función de autocuración de datos.
 * Detecta y elimina registros corruptos de Sedes para evitar conflictos de "Sedes Fantasma".
 * También filtra sedes con soft delete (deletedAt).
 * 
 * @param sedes Lista de sedes obtenidas de Firestore
 * @returns Lista de sedes limpias y válidas (sin deletedAt)
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
        } else if (!sede.deletedAt) {
            // Solo incluir sedes que NO tengan soft delete
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
