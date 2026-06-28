// models/academico/recurso.ts
// Modelos de datos para los recursos académicos y fichas en la biblioteca de Tudojang.
// Los archivos viven en Google Drive; Firestore almacena solo referencias y metadatos.

import type {
  EstadoRecurso,
  TipoRecurso,
  UsoAcademico,
  ProveedorStorage,
} from './index';

// ---------------------------------------------------------------------------
// Ficha académica (metadatos pedagógicos del recurso)
// ---------------------------------------------------------------------------

/**
 * Metadatos pedagógicos que describen el propósito y contexto académico del recurso.
 * Se completan en el formulario de clasificación al importar desde Drive.
 */
export interface FichaAcademica {
  /** Disciplina o materia a la que corresponde el recurso (ej. "Guitarra", "Lenguaje Musical"). */
  disciplina: string;

  /**
   * Nivel mínimo de experiencia del estudiante para quien aplica el recurso.
   * Permite filtrar por etapa formativa.
   */
  nivelMinimo?: string;

  /**
   * Nivel máximo de experiencia del estudiante al que aplica el recurso.
   */
  nivelMaximo?: string;

  /** Tipo pedagógico del contenido: 'pdf', 'video', 'quiz', etc. */
  tipo: TipoRecurso;

  /**
   * Usos académicos del recurso: puede tener múltiples usos.
   * Ej. ['estudio', 'refuerzo']
   */
  usos: UsoAcademico[];

  /**
   * Duración estimada de consumo del recurso, en minutos.
   * Usado para planificar asignaciones.
   */
  duracionEstimadaMin?: number;

  /** Autor o fuente del contenido (opcional). */
  autor?: string;

  /** Notas internas del admin (no visibles para estudiantes). */
  notasInternas?: string;
}

// ---------------------------------------------------------------------------
// Recurso académico (referencia a archivo en Drive + metadatos)
// ---------------------------------------------------------------------------

/**
 * Documento en Firestore que representa un archivo académico de la biblioteca institucional.
 * Colección: `tenants/{tenantId}/recursos/{recursoId}`
 *
 * IMPORTANTE: Los archivos viven en Google Drive. Tudojang almacena solo:
 *   - El identificador del proveedor (`externalFileId`)
 *   - Los metadatos de Drive (nombre, MIME, tamaño)
 *   - La ficha académica (clasificación pedagógica)
 *   - El estado del ciclo de vida del recurso
 */
export interface RecursoAcademico {
  /** ID del documento en Firestore (generado automáticamente). */
  id: string;

  /** Tenant al que pertenece el recurso. */
  tenantId: string;

  // ---- Referencia al archivo en Drive ----

  /** Proveedor de almacenamiento. Actualmente solo 'google_drive'. */
  proveedor: ProveedorStorage;

  /**
   * Identificador único del archivo en Google Drive (`file.id`).
   * NUNCA cambia aunque el archivo se renombre o mueva; es la clave de relación.
   */
  externalFileId: string;

  /** Nombre actual del archivo (sincronizado desde Drive). */
  nombre: string;

  /** Tipo MIME del archivo (ej. 'application/pdf', 'video/mp4'). */
  mimeType: string;

  /** Tamaño del archivo en bytes (sincronizado desde Drive). */
  tamanoBytes?: number;

  /** Ruta informativa dentro de la carpeta institucional (ej. "/Módulo 1/Fundamentos/"). */
  rutaInformativa?: string;

  /** Versión del archivo en Drive (para detectar cambios). */
  version?: string;

  /** Fecha de última modificación en Drive (ISO 8601). */
  fechaModificacionDrive?: string;

  // ---- Ficha académica (clasificación pedagógica) ----

  /**
   * Ficha con metadatos pedagógicos del recurso.
   * Se completa durante la clasificación por parte del admin.
   * Es `null` mientras el recurso está en estado `borrador` sin clasificar.
   */
  ficha: FichaAcademica | null;

  // ---- Ciclo de vida ----

  /** Estado actual del recurso en la biblioteca. */
  estado: EstadoRecurso;

  /**
   * Si el recurso está inaccesible, describe el motivo.
   * Ej. 'archivo_eliminado_de_drive', 'archivo_en_papelera_de_drive'
   */
  motivoInaccesible?: string;

  /** UID del usuario que importó o aportó el recurso. */
  creadoPorUid: string;

  /** Fecha de creación del recurso en Firestore (ISO 8601). */
  creadoEn: string;

  /** Fecha de la última actualización del recurso (ISO 8601). */
  actualizadoEn: string;

  /**
   * UID del admin que aprobó el recurso (solo cuando `estado === 'aprobado'`).
   */
  aprobadoPorUid?: string;

  /** Fecha de aprobación del recurso (ISO 8601). */
  aprobadoEn?: string;
}
