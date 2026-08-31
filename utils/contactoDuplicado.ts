
// utils/contactoDuplicado.ts
import type { Estudiante } from '../tipos';

export interface AlertaContactoDuplicado {
    campo: 'telefono' | 'correo';
    mensaje: string;
}

/**
 * Señala en el Directorio (Estudiante ya aprobado, no RegistroTemporal -- para eso está
 * utils/censoInconsistencias.ts) cuando el teléfono o el correo coincide con el de otro
 * estudiante del mismo tenant. Caso real y esperado en esta academia: hermanos que comparten
 * el WhatsApp/correo del tutor porque el menor no tiene uno propio, o una persona que es
 * tutor de un hijo y a la vez alumno inscrito por su cuenta. No es un error a corregir por
 * default -- es información para que el tenant identifique el patrón y decida qué hacer con
 * cada caso, nunca bloquea nada.
 */
export const detectarContactoDuplicado = (
    estudiante: Estudiante,
    todosLosEstudiantes: Estudiante[]
): AlertaContactoDuplicado[] => {
    const alertas: AlertaContactoDuplicado[] = [];
    const otros = todosLosEstudiantes.filter(e => e.id !== estudiante.id);

    const soloDigitos = (valor?: string) => (valor || '').replace(/\D/g, '');
    const telefono = soloDigitos(estudiante.telefono);
    const correo = estudiante.correo?.trim().toLowerCase();

    if (telefono) {
        const coincidencias = otros.filter(e => soloDigitos(e.telefono) === telefono);
        if (coincidencias.length > 0) {
            const nombres = coincidencias.map(e => `${e.nombres} ${e.apellidos}`).join(', ');
            alertas.push({ campo: 'telefono', mensaje: `Mismo teléfono que: ${nombres}` });
        }
    }

    if (correo) {
        const coincidencias = otros.filter(e => e.correo?.trim().toLowerCase() === correo);
        if (coincidencias.length > 0) {
            const nombres = coincidencias.map(e => `${e.nombres} ${e.apellidos}`).join(', ');
            alertas.push({ campo: 'correo', mensaje: `Mismo correo que: ${nombres}` });
        }
    }

    return alertas;
};
