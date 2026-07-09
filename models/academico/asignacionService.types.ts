// models/academico/asignacionService.types.ts
// Contratos del servicio de asignaciones académicas.
// Este archivo NO contiene lógica.
// Solo define las interfaces utilizadas por el servicio.

import type { AsignacionAcademica } from './asignacion';
import type { EstadoProgreso } from './index';

export type UrgenciaAsignacion = 'vencida' | 'alta' | 'media' | 'baja' | 'sin_fecha';

export interface AsignacionCentroEstudios extends AsignacionAcademica {
  estadoProgreso: EstadoProgreso;
  porcentajeProgreso: number;
  urgencia: UrgenciaAsignacion;
}

export interface ObtenerAsignacionesRequest {
  tenantId: string;
  estudianteId: string;
}

export interface ObtenerAsignacionesResponse {
  asignaciones: AsignacionCentroEstudios[];
}

export interface PublicarAsignacionRequest {
  tenantId: string;
  jornadaId: string;
  asignacion: AsignacionAcademica;
}

export interface PublicarAsignacionResponse {
  ok: boolean;
  id: string;
}

export type MotivoAsignacionSalteada = 'duplicado' | 'recurso_no_aprobado' | 'jornada_no_encontrada';

export interface PublicarAsignacionesBatchRequest {
  tenantId: string;
  recursoIds: string[];
  jornadaIds: string[];
  asignacionBase: Omit<AsignacionAcademica, 'id' | 'recursoId' | 'jornadaId'>;
}

export interface AsignacionSalteada {
  recursoId: string;
  jornadaId: string;
  reason: MotivoAsignacionSalteada;
}

export interface PublicarAsignacionesBatchResponse {
  ok: boolean;
  created: string[];
  skipped: AsignacionSalteada[];
}

export interface EliminarAsignacionRequest {
  tenantId: string;
  asignacionId: string;
}

export interface EliminarAsignacionResponse {
  ok: boolean;
}

export interface ActualizarAsignacionRequest {
  asignacion: AsignacionAcademica;
}

export interface ActualizarAsignacionResponse {
  ok: boolean;
}
