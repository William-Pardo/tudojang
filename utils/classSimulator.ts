
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { registrarEntrada } from '../servicios/asistenciaApi';
import { registrarAsistenciaClase } from '../servicios/academico/asistenciaClaseService';

/**
 * Simula la entrada de 5 alumnos a guardería (Misión Kicho).
 * Selecciona alumnos existentes en la base de datos para garantizar que
 * la interfaz muestre nombres y grados reales.
 */
export const simularAsistenciasMasivas = async (sedeId: string, tenantId: string) => {
    try {
        const estudiantesRef = collection(db, 'estudiantes');
        const snap = await getDocs(query(estudiantesRef, where('tenantId', '==', tenantId), limit(10)));

        if (snap.empty) {
            throw new Error("No hay alumnos registrados para simular asistencia. Genera primero alumnos en Misión Kicho.");
        }

        const alumnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const seleccionados = alumnos.sort(() => 0.5 - Math.random()).slice(0, 5);

        // Guardiería: escribe directo a asistenciaApi
        for (const alumno of seleccionados) {
            await registrarEntrada(alumno.id, sedeId);
        }

        return seleccionados.length;
    } catch (error) {
        console.error("Error en simulador de guardería:", error);
        throw error;
    }
};

/**
 * Simula la entrada de 5 estudiantes a Clase en Vivo.
 * WS-1: Usa registrarAsistenciaClase (callable) que respeta reglas de Firestore.
 */
export const simularAsistenciasClaseEnVivo = async (jornadaId: string, tenantId: string) => {
    try {
        const estudiantesRef = collection(db, 'estudiantes');
        const snap = await getDocs(query(estudiantesRef, where('tenantId', '==', tenantId), limit(10)));

        if (snap.empty) {
            throw new Error("No hay estudiantes registrados para simular asistencia.");
        }

        const alumnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const seleccionados = alumnos.sort(() => 0.5 - Math.random()).slice(0, 5);

        // Clase en Vivo: usa callable que valida permisos
        for (const alumno of seleccionados) {
            await registrarAsistenciaClase({ tenantId, jornadaId, estudianteId: alumno.id });
        }

        return seleccionados.length;
    } catch (error) {
        console.error("Error en simulador de clase en vivo:", error);
        throw error;
    }
};
