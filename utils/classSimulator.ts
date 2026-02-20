
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { registrarEntrada } from '../servicios/asistenciaApi';

/**
 * Simula la entrada de 5 alumnos a la clase actual de forma aleatoria.
 * Selecciona alumnos existentes en la base de datos para garantizar que
 * la interfaz muestre nombres y grados reales.
 */
export const simularAsistenciasMasivas = async (sedeId: string, tenantId: string) => {
    try {
        // 1. Obtener una muestra de alumnos reales del tenant
        const estudiantesRef = collection(db, 'estudiantes');
        const q = query(
            estudiantesRef,
            where('tenantId', '==', tenantId),
            orderBy('nombres', 'asc'),
            limit(20)
        );

        // Usamos una consulta simple si el tenant tiene pocos alumnos o hay problemas de índice
        const snap = await getDocs(query(estudiantesRef, where('tenantId', '==', tenantId), limit(10)));

        if (snap.empty) {
            throw new Error("No hay alumnos registrados para simular asistencia. Genera primero alumnos en Misión Kicho.");
        }

        const alumnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Mezclar y tomar 5
        const seleccionados = alumnos
            .sort(() => 0.5 - Math.random())
            .slice(0, 5);

        // 2. Registrar entrada para cada uno
        for (const alumno of seleccionados) {
            await registrarEntrada(alumno.id, sedeId);
        }

        return seleccionados.length;
    } catch (error) {
        console.error("Error en simulador de clase:", error);
        throw error;
    }
};
