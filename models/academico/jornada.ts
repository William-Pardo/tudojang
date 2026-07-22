import type { EstadoJornada } from './index';
import type { GradoTKD } from '../../tipos';

export interface JornadaInstruccion {
  id: string;
  tenantId: string;
  programaId: string;
  ejecucionProgramaId: string;
  grupoId: string;
  sedeId: string;
  espacioId: string;
  instructorId: string;
  bloqueRecurrenteId?: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoJornada;
  objetivosPlaneados: string[];
  objetivosImpartidos: string[];
  asistenciaRegistrada: boolean;
  motivoCancelacion?: string;
  tema?: string;
  /**
   * Grados excluidos de ESTA jornada puntual (matrícula automática por grado).
   * Ausente o vacío = cubre todos los grados del grupo (default). Sirve para
   * armar clases especiales para ciertos grados (ej. "solo avanzados") sin
   * romper la regla general de que todos los grados tienen su clase regular.
   */
  gradosExcluidos?: GradoTKD[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface BloqueRecurrente {
  id: string;
  tenantId: string;
  grupoId: string;
  sedeId: string;
  espacioId: string;
  instructorId: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}
