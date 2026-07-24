import type { EstadoJornada } from './index';
import type { GradoTKD } from '../../tipos';

/**
 * Observación GRUPAL rápida al cierre de la clase (WS-5, `Módulo Clase en Vivo.txt` §10).
 * Categorías fijas (flujo guiado, igual criterio que el checkpoint de materiales) + nota corta
 * OPCIONAL -- §10 es explícito: nunca exigir nota por alumno, esto es una observación de grupo.
 */
export type CategoriaObservacionClase =
  | 'buena_energia'
  | 'baja_energia'
  | 'requiere_refuerzo'
  | 'buen_avance'
  | 'dificultad'
  | 'interrumpida'
  | 'material_insuficiente'
  | 'excelente_participacion';

/** Límite de caracteres de la nota corta de observación (mismo criterio que §9.2). */
export const LIMITE_NOTA_OBSERVACION_CLASE = 280;

export interface ObservacionClase {
  categorias: CategoriaObservacionClase[];
  notaCorta?: string;
  registradoPorUid: string;
  actualizadoEn: string;
}

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
  /**
   * Oculta esta jornada de la parrilla de Agenda SIN borrarla ni cambiar su estado
   * (2026-07-22). Salida para clases ya operadas (cerrada/parcial/pendiente_cierre) que no se
   * pueden eliminar —tienen historial— ni cancelar —la máquina de estados no lo permite—.
   * Ausente o `false` = visible (default: ninguna jornada existente se ve afectada). El
   * historial, la asistencia y los reportes siguen viéndola: es solo visibilidad de Agenda.
   */
  archivada?: boolean;
  /**
   * Flag idempotente (WS-3b): `true` una vez que el cron avisó a los acudientes de RECOGIDA
   * que la clase estaba por terminar. Evita reenviar el aviso en cada tick del cron. Ausente
   * = todavía no se avisó.
   */
  avisoRecogidaEnviado?: boolean;
  /** WS-5 (§10): observación grupal rápida registrada al cierre. Ausente = no se registró. */
  observacionClase?: ObservacionClase;
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
