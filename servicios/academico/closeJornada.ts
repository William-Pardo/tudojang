import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { EjecucionPrograma, ProgramaAcademico } from '../../models/academico/programa';
import { cerrarJornada } from './jornadaService';
import { advanceCiclo } from './programaService';

interface CerrarJornadaConProgramaInput {
  jornada: JornadaInstruccion;
  programa: ProgramaAcademico;
  ejecucion: EjecucionPrograma;
}

export interface CerrarJornadaConProgramaResult {
  jornada: JornadaInstruccion;
  ejecucion: EjecucionPrograma;
  refuerzoRequerido: boolean;
  objetivosPendientesRefuerzo: string[];
}

export function cerrarJornadaConPrograma({
  jornada,
  programa,
  ejecucion,
}: CerrarJornadaConProgramaInput): CerrarJornadaConProgramaResult {
  const jornadaCerrada = cerrarJornada(jornada);
  const ejecucionActualizada = advanceCiclo(programa, ejecucion, jornada.objetivosImpartidos);
  const objetivosPendientesRefuerzo = jornada.objetivosPlaneados.filter(
    (objetivoId) => !jornada.objetivosImpartidos.includes(objetivoId)
  );

  return {
    jornada: jornadaCerrada,
    ejecucion: ejecucionActualizada,
    refuerzoRequerido: objetivosPendientesRefuerzo.length > 0,
    objetivosPendientesRefuerzo,
  };
}
