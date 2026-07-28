
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { registrarAsistenciaClase } from '../servicios/academico/asistenciaClaseService';

/**
 * Simula la entrada de 5 alumnos a la clase actual de forma aleatoria.
 * Selecciona alumnos existentes en la base de datos para garantizar que
 * la interfaz muestre nombres y grados reales.
 *
 * WS-1: Usa registrarAsistenciaClase (callable) en lugar de guardería.
 */
export const simularAsistenciasMasivas = async (jornadaId: string, tenantId: string) => {
    try {
        // 1. Obtener una muestra de alumnos reales del tenant
        const estudiantesRef = collection(db, 'estudiantes');

        const snap = await getDocs(query(estudiantesRef, where('tenantId', '==', tenantId), limit(10)));

        if (snap.empty) {
            throw new Error("No hay alumnos registrados para simular asistencia. Genera primero alumnos en Misión Kicho.");
        }

        const alumnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Mezclar y tomar 5
        const seleccionados = alumnos
            .sort(() => 0.5 - Math.random())
            .slice(0, 5);

        // 2. Registrar entrada para cada uno via callable de Clase en Vivo
        for (const alumno of seleccionados) {
            await registrarAsistenciaClase({ tenantId, jornadaId, estudianteId: alumno.id });
        }

        return seleccionados.length;
    } catch (error) {
        console.error("Error en simulador de clase:", error);
        throw error;
    }
};
