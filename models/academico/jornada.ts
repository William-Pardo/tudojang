import type { EstadoJornada } from './index';

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
