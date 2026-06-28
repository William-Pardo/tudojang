// models/academico/asignacion.ts
// Modelo mínimo de asignaciones académicas para el Centro de Estudios.
// Este archivo NO conecta con Firebase directamente.
// Solo define tipos reutilizables por servicios, vistas y tests.

import type {
  EstadoProgreso,
  MomentoAsignacion,
  UsoAcademico,
} from './index';

export type EstadoAsignacionAcademica = 'borrador' | 'publicada' | 'cerrada' | 'vencida';

export type TipoDestinatarioAsignacion = 'grupo' | 'grado' | 'estudiante';

export interface DestinatarioAsignacion {
  tipo: TipoDestinatarioAsignacion;

  /**
   * Grupo destinatario.
   * Ejemplo: Infantil, Cadetes, Adultos.
   */
  grupo?: string;

  /**
   * Grados específicos dentro del grupo.
   * Ejemplo: ['Blanco', 'Amarillo'].
   */
  grados?: string[];

  /**
   * Estudiantes específicos cuando la asignación no es para todo el grupo.
   */
  estudianteIds?: string[];
}

export interface AsignacionAcademica {
  id: string;
  tenantId: string;

  /**
   * Recurso académico aprobado en biblioteca.
   */
  recursoId: string;

  titulo: string;
  descripcion?: string;

  destinatario: DestinatarioAsignacion;

  uso: UsoAcademico;
  momento: MomentoAsignacion;

  obligatoria: boolean;

  fechaApertura: string;
  fechaCierre?: string;

  estado: EstadoAsignacionAcademica;

  creadoPorUid: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProgresoAsignacion {
  id: string;
  tenantId: string;

  estudianteId: string;
  asignacionId: string;
  recursoId: string;

  estado: EstadoProgreso;
  porcentaje: number;

  ultimaActividadEn?: string;
  completadoEn?: string;
}
