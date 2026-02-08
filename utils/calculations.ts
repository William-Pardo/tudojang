
// utils/calculations.ts
import { Estudiante, Programa, ConfiguracionClub, Sede, TipoCobroPrograma } from '../tipos';

/**
 * Calcula el valor base de la mensualidad para un estudiante
 * Prioriza la tarifa de la sede sobre la tarifa global del club
 */
export const calcularTarifaBaseEstudiante = (estudiante: Estudiante, configClub: ConfiguracionClub, sedes: Sede[]): number => {
    const sede = sedes.find(s => s.id === estudiante.sedeId);
    return (sede?.valorMensualidad && sede.valorMensualidad > 0) 
        ? sede.valorMensualidad 
        : configClub.valorMensualidad;
};

/**
 * Calcula la suma de todos los programas recurrentes inscritos
 */
export const calcularSumaProgramasRecurrentes = (estudiante: Estudiante, programas: Programa[]): number => {
    if (!estudiante.programasInscritos) return 0;
    
    return estudiante.programasInscritos.reduce((acc, inscripcion) => {
        const programa = programas.find(p => p.id === inscripcion.idPrograma);
        // Solo sumamos si es recurrente (membresía extra)
        if (programa && programa.tipoCobro === TipoCobroPrograma.Recurrente) {
            return acc + programa.valor;
        }
        return acc;
    }, 0);
};

/**
 * Retorna el valor TOTAL que el estudiante debe pagar cada mes
 */
export const calcularTotalMensualidadEstudiante = (
    estudiante: Estudiante, 
    configClub: ConfiguracionClub, 
    sedes: Sede[], 
    programas: Programa[]
): number => {
    const base = calcularTarifaBaseEstudiante(estudiante, configClub, sedes);
    const extras = calcularSumaProgramasRecurrentes(estudiante, programas);
    return base + extras;
};
