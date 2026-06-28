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
  asignacion: AsignacionAcademica;
}

export interface PublicarAsignacionResponse {
  ok: boolean;
  id: string;
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
