import { AsistenciaJornada } from '../tipos';

/**
 * Procesa el arreglo final de asistencias de una clase cerrada y genera el progreso individual.
 * Suma los minutos reales asistidos y levanta alertas de refuerzo para:
 *   - Ausencia total: el alumno nunca se presentó.
 *   - Asistencia parcial < 50%: estuvo menos de la mitad de la clase.
 *
 * @param params.asistenciasFinales Array de AsistenciaJornada del cierre administrativo
 * @param params.claseDuracionMinutos Duración total de la clase en minutos
 * @param params.recursosJornada IDs de recursos vistos en la jornada (opcionales)
 * @returns Progreso actualizado por alumno y recursos vinculados
 */
export async function procesarProgresoYRefuerzo(params: any): Promise<any> {
    const { asistenciasFinales, claseDuracionMinutos, recursosJornada } = params;

    const progresosActualizados = (asistenciasFinales || []).map((asis: AsistenciaJornada) => {
        let alertaRefuerzo = false;
        let motivoRefuerzo = null;

        if (asis.estado === 'ausente') {
            alertaRefuerzo = true;
            motivoRefuerzo = 'Ausencia total';
        } else if (asis.estado === 'presente') {
            const porcentajeAsistencia = asis.minutosAsistidos / claseDuracionMinutos;
            if (porcentajeAsistencia < 0.5) {
                alertaRefuerzo = true;
                motivoRefuerzo = 'Asistencia menor al 50%';
            }
        }

        return {
            estudianteId: asis.estudianteId,
            minutosSumados: asis.minutosAsistidos || 0,
            alertaRefuerzo,
            motivoRefuerzo
        };
    });

    return {
        exito: true,
        progresosActualizados,
        recursosVinculados: recursosJornada || []
    };
}
