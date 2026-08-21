
// utils/censoInconsistencias.ts
import type { RegistroTemporal, Estudiante } from '../tipos';

export interface AlertaCenso {
    // Nombre del campo de RegistroTemporal['datos'] al que apunta la alerta -- permite que
    // ModalEditarRegistroCenso resalte el input exacto en vez de que el tenant tenga que
    // adivinar cuál de los ~15 campos está mal (en mobile no hay hover para el tooltip del
    // badge, así que el campo señalado es la única forma real de guiarlo hasta el error).
    campo: keyof RegistroTemporal['datos'];
    mensaje: string;
}

const soloDigitos = (valor?: string): string => (valor || '').replace(/\D/g, '');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hayTelefonoDuplicado = (telefonoNormalizado: string, candidatos: (string | undefined)[]): boolean =>
    !!telefonoNormalizado && candidatos.some(c => soloDigitos(c) === telefonoNormalizado);

const hayEmailDuplicado = (emailNormalizado: string | undefined, candidatos: (string | undefined)[]): boolean =>
    !!emailNormalizado && candidatos.some(c => c?.trim().toLowerCase() === emailNormalizado);

// Misma fórmula de edad que CensoPublico.tsx (calcularEdad) -- no se reutiliza esa porque es
// local al componente, y esta vive en utils/ para no acoplar el detector a un componente.
const calcularEdad = (fechaNacimiento: string): number | null => {
    const fecha = new Date(fechaNacimiento);
    if (isNaN(fecha.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const mes = hoy.getMonth() - fecha.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) edad--;
    return edad;
};

/**
 * Heurísticas livianas sobre un RegistroTemporal para señalarle al tenant "esto puede estar
 * mal" antes de aprobarlo -- no bloquea nada, es solo la "miga de pan": el tenant decide si
 * lo corrige (ModalEditarRegistroCenso) o lo aprueba/rechaza tal cual. Todo se calcula al
 * vuelo sobre datos ya cargados en MisionKicho.tsx (el resto de registros del lote +
 * estudiantes existentes del tenant) -- no agrega lecturas ni campos nuevos en Firestore.
 */
export const detectarInconsistencias = (
    registro: RegistroTemporal,
    todosLosRegistros: RegistroTemporal[],
    estudiantesExistentes: Estudiante[]
): AlertaCenso[] => {
    const { datos } = registro;
    const alertas: AlertaCenso[] = [];

    if (soloDigitos(datos.telefono).length !== 10) {
        alertas.push({ campo: 'telefono', mensaje: 'Teléfono del aspirante no tiene 10 dígitos' });
    }
    if (datos.email && !EMAIL_REGEX.test(datos.email)) {
        alertas.push({ campo: 'email', mensaje: 'Email con formato inválido' });
    }

    const edad = calcularEdad(datos.fechaNacimiento);
    if (edad === null || edad < 0 || edad > 100) {
        alertas.push({ campo: 'fechaNacimiento', mensaje: 'Fecha de nacimiento inválida' });
    } else if (edad < 18 && !datos.tutorNombre?.trim()) {
        alertas.push({ campo: 'tutorNombre', mensaje: 'Menor de edad sin datos de tutor' });
    }

    if (datos.tutorTelefono && soloDigitos(datos.tutorTelefono).length !== 10) {
        alertas.push({ campo: 'tutorTelefono', mensaje: 'Teléfono del tutor no tiene 10 dígitos' });
    }

    const telefonoDigitos = soloDigitos(datos.telefono);
    const emailNormalizado = datos.email?.trim().toLowerCase();
    const otrosDelLote = todosLosRegistros.filter(r => r.id !== registro.id);

    if (hayTelefonoDuplicado(telefonoDigitos, otrosDelLote.map(r => r.datos.telefono))) {
        alertas.push({ campo: 'telefono', mensaje: 'Posible duplicado: otro registro pendiente tiene el mismo teléfono' });
    }
    if (hayEmailDuplicado(emailNormalizado, otrosDelLote.map(r => r.datos.email))) {
        alertas.push({ campo: 'email', mensaje: 'Posible duplicado: otro registro pendiente tiene el mismo email' });
    }
    if (hayTelefonoDuplicado(telefonoDigitos, estudiantesExistentes.map(e => e.telefono))) {
        alertas.push({ campo: 'telefono', mensaje: 'Posible duplicado: ya existe un estudiante con este teléfono' });
    }
    if (hayEmailDuplicado(emailNormalizado, estudiantesExistentes.map(e => e.correo))) {
        alertas.push({ campo: 'email', mensaje: 'Posible duplicado: ya existe un estudiante con este email' });
    }

    return alertas;
};
