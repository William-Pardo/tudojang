
// utils/censoInconsistencias.ts
import type { RegistroTemporal, Estudiante } from '../tipos';

const soloDigitos = (valor?: string): string => (valor || '').replace(/\D/g, '');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Compara un teléfono/email ya normalizados (del registro que se está evaluando) contra el
// contacto crudo de otro registro/estudiante. Se usa para los dos chequeos de duplicado
// (dentro del lote y contra la base de estudiantes) sin repetir la normalización dos veces.
const mismoContacto = (telefonoNormalizado: string, emailNormalizado: string | undefined, telefonoOtro?: string, emailOtro?: string): boolean =>
    (!!telefonoNormalizado && soloDigitos(telefonoOtro) === telefonoNormalizado) ||
    (!!emailNormalizado && emailOtro?.trim().toLowerCase() === emailNormalizado);

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
): string[] => {
    const { datos } = registro;
    const alertas: string[] = [];

    if (soloDigitos(datos.telefono).length !== 10) {
        alertas.push('Teléfono del aspirante no tiene 10 dígitos');
    }
    if (datos.email && !EMAIL_REGEX.test(datos.email)) {
        alertas.push('Email con formato inválido');
    }

    const edad = calcularEdad(datos.fechaNacimiento);
    if (edad === null || edad < 0 || edad > 100) {
        alertas.push('Fecha de nacimiento inválida');
    } else if (edad < 18 && !datos.tutorNombre?.trim()) {
        alertas.push('Menor de edad sin datos de tutor');
    }

    if (datos.tutorTelefono && soloDigitos(datos.tutorTelefono).length !== 10) {
        alertas.push('Teléfono del tutor no tiene 10 dígitos');
    }

    const telefonoDigitos = soloDigitos(datos.telefono);
    const emailNormalizado = datos.email?.trim().toLowerCase();

    const duplicadoEnLote = todosLosRegistros.some(r =>
        r.id !== registro.id && mismoContacto(telefonoDigitos, emailNormalizado, r.datos.telefono, r.datos.email)
    );
    if (duplicadoEnLote) {
        alertas.push('Posible duplicado: otro registro pendiente tiene el mismo teléfono o email');
    }

    const duplicadoEstudiante = estudiantesExistentes.some(e =>
        mismoContacto(telefonoDigitos, emailNormalizado, e.telefono, e.correo)
    );
    if (duplicadoEstudiante) {
        alertas.push('Posible duplicado: ya existe un estudiante con este teléfono o email');
    }

    return alertas;
};
