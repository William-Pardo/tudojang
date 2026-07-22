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

  /**
   * Etiquetas reutilizables para busqueda futura en biblioteca.
   * Se agregan al preparar asignaciones sin duplicar el recurso original.
   */
  tags?: string[];
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

  /**
   * ID de 11 caracteres de un video de YouTube (ver `utils/academico/youtubeUrl.ts`).
   * SOLO aplica a recursos de video (`ficha.tipo === 'video'`). Campo ADICIONAL a
   * `externalFileId`/Drive -- no lo reemplaza, para no romper videos ya cargados en Drive
   * antes de este cambio ni el flujo de PDF (que sigue siendo 100% Drive).
   *
   * Motivo (decisión de producto, 2026-07): el material de video no genera ingreso
   * directo para Tudojang, asi que no se justifica pagar por servirlo protegido.
   * `proxyDriveMedia` (functions/academico/drive.js) no tiene Cache-Control/ETag, asi que
   * cada reproduccion redescarga el archivo completo de Drive -- costoso y sin
   * visibilidad real de si el alumno miro el video. Cuando este campo esta presente, el
   * reproductor usa la YouTube IFrame Player API (costo $0 de hosting + eventos reales de
   * reproduccion) en vez del proxy de Drive. `null`/`undefined` = seguir usando Drive.
   */
  youtubeVideoId?: string | null;

  /** Nombre actual del archivo (sincronizado desde Drive). */
  nombre: string;

  /**
   * Título curado visible para estudiantes, capturado al clasificar el recurso.
   * Distinto del nombre del archivo en Drive; cuando falta, la UI muestra `nombre` como respaldo.
   */
  tituloVisible?: string;

  /** Nombre normalizado para detectar duplicados de biblioteca. */
  nombreNormalizado?: string;

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

  /**
   * Estado operativo de la fuente Drive.
   * No controla el ciclo de vida del recurso; solo informa si el archivo fuente puede verificarse.
   */
  fuenteDriveEstado?: 'verificada' | 'no_verificada' | 'fuera_carpeta_activa' | 'requiere_reconexion' | 'archivo_no_encontrado';

  /** Carpeta Drive desde la que fue indexado originalmente, cuando se conoce. */
  carpetaOrigenDriveId?: string;

  /** Fecha de la ultima verificacion positiva de acceso a Drive. */
  ultimaVerificacionDrive?: string;

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
