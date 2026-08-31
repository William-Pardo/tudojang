
// utils/validacionAsistencial.ts
// Heurísticas puras de "preguntar y confirmar" para reducir errores de digitación en los
// formularios de captación de alumnos (FormularioEstudiante.tsx e interno, CensoPublico.tsx
// público -- mismo componente para "Misión Kicho" y el link permanente de captación). NUNCA
// bloquean nada por sí solas -- solo generan mensajes que el llamador muestra en un
// ModalConfirmacion antes de dejar seguir. Sin acceso a Firestore: reciben `edad` ya calculada
// por el llamador (calcularEdadYGrupo en FormularioEstudiante.tsx, calcularEdad local en
// CensoPublico.tsx) para no agregar una CUARTA función de cálculo de edad al proyecto.

/**
 * Umbral de CONFIRMACIÓN blanda (no una regla de negocio que prohíba alumnos adultos) para
 * detectar el typo más común en fecha de nacimiento: tipear el año de nacimiento del padre/
 * tutor en vez del hijo (ej. un aspirante de 8 años queda registrado con 38 por invertir el
 * año). Un adulto real de esta edad entrenando Taekwondo es perfectamente válido -- por eso
 * esto solo pide confirmar, nunca rechaza. Distinto del umbral `edad > 100` de
 * censoInconsistencias.ts, que sí marca datos claramente rotos (nadie llena un formulario de
 * inscripción real a esa edad).
 */
export const EDAD_INUSUAL_MINIMA = 33;

// Colapsa espacios repetidos (no solo trim en los extremos) -- necesario porque esta función
// concatena nombres/apellidos con un espacio de por medio, y cualquiera de los dos lados
// pudo venir con espacios sueltos desde el formulario.
const normalizarNombre = (valor?: string): string => (valor || '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Compara el nombre completo del alumno contra el del tutor -- caso típico de "tipeé el
 * nombre del papá en el campo del hijo" (o viceversa) al llenar el formulario a las apuradas.
 * Comparación por trim+lowercase; nunca marca coincidencia si a cualquiera de los dos lados
 * le falta el nombre completo (evita falsos positivos por campos vacíos).
 */
export const nombreCoincideConTutor = (
    nombres: string,
    apellidos: string,
    tutorNombres?: string,
    tutorApellidos?: string
): boolean => {
    const nombreAlumno = normalizarNombre(`${nombres || ''} ${apellidos || ''}`);
    const nombreTutor = normalizarNombre(`${tutorNombres || ''} ${tutorApellidos || ''}`);
    return !!nombreAlumno && !!nombreTutor && nombreAlumno === nombreTutor;
};

interface DatosAlertaAsistencial {
    edad: number | null;
    nombres: string;
    apellidos: string;
    tutorNombres?: string;
    tutorApellidos?: string;
}

/**
 * Genera mensajes de advertencia en español para el patrón "preguntar y confirmar" -- array
 * vacío si no hay nada raro. El llamador decide cómo mostrarlos (ModalConfirmacion vía
 * componentes/ModalConfirmacion.tsx, ya usado en el resto del proyecto); esta función nunca
 * bloquea ni lanza excepciones.
 */
export const generarAlertasAsistenciales = ({
    edad,
    nombres,
    apellidos,
    tutorNombres,
    tutorApellidos
}: DatosAlertaAsistencial): string[] => {
    const alertas: string[] = [];

    if (edad !== null && (edad > 100 || edad < 0)) {
        alertas.push('La fecha de nacimiento parece incorrecta (la edad calculada no es plausible). Revisa el día, mes y año antes de continuar.');
    } else if (edad !== null && edad >= EDAD_INUSUAL_MINIMA) {
        alertas.push(`La edad calculada (${edad} años) es inusual para este registro. Confirma que la fecha de nacimiento corresponde al alumno y no a un familiar.`);
    }

    if (nombreCoincideConTutor(nombres, apellidos, tutorNombres, tutorApellidos)) {
        alertas.push('El nombre del alumno es idéntico al del tutor. Verifica que no se hayan cruzado los campos.');
    }

    return alertas;
};
