// models/academico/actividad.ts
// Modelos para el registro de actividad académica por estudiante.
// Permite medir consumo real de materiales y resultados de evaluaciones.

// ---------------------------------------------------------------------------
// Tipo de actividad registrada
// ---------------------------------------------------------------------------

/**
 * Categoría de la interacción académica registrada.
 *
 * - video     : reproducción de video (se registra el % visto)
 * - pdf       : apertura/lectura de PDF (se registra páginas/tiempo)
 * - imagen    : apertura de imagen (jpg/png/gif)
 * - texto     : lectura de archivo .txt
 * - presentacion : apertura de presentación
 * - quiz      : evaluación completada (se registra score)
 * - apertura  : primera apertura de cualquier material (evento genérico)
 */
export type TipoActividad =
  | 'video'
  | 'pdf'
  | 'imagen'
  | 'texto'
  | 'presentacion'
  | 'quiz'
  | 'apertura';

// ---------------------------------------------------------------------------
// Metadatos específicos por tipo de actividad
// ---------------------------------------------------------------------------

/** Metadatos de reproducción de video. */
export interface MetadatosVideo {
  porcentajeVisto: number; // 0–100
  segundosTotales?: number;
  segundosVistos?: number;
  /** Checkpoints alcanzados: 25, 50, 75, 100 */
  checkpoints?: number[];
}

/** Metadatos de lectura de PDF. */
export interface MetadatosPdf {
  paginasVistas: number[];
  totalPaginas?: number;
  porcentajePaginas: number; // 0–100
}

/** Metadatos de evaluación (quiz/examen). */
export interface MetadatosQuiz {
  totalPreguntas: number;
  correctas: number;
  incorrectas: number;
  score: number; // 0–100 (porcentaje de acierto)
  tiempoSegundos?: number;
  respuestas?: Array<{
    preguntaId: string;
    seleccionada: string | number;
    correcta: boolean;
  }>;
}

/** Metadatos para imagen, texto y presentación (apertura genérica). */
export interface MetadatosGenerico {
  duracionSegundos?: number; // tiempo que el archivo estuvo abierto
}

/** Union de metadatos por tipo. */
export type MetadatosActividad =
  | MetadatosVideo
  | MetadatosPdf
  | MetadatosQuiz
  | MetadatosGenerico;

// ---------------------------------------------------------------------------
// Registro de actividad individual
// ---------------------------------------------------------------------------

/**
 * Documento en Firestore que captura una interacción académica.
 * Colección: `tenants/{tenantId}/actividadLogs/{logId}`
 *
 * Se crea cada vez que un estudiante interactúa con un material o completa
 * una evaluación. Los registros son inmutables (append-only); el cálculo
 * de métricas agregadas se hace a partir de estos documentos.
 */
export interface ActividadLog {
  /** ID generado automáticamente. */
  id: string;

  /** Tenant al que pertenece el registro. */
  tenantId: string;

  /** UID del estudiante que realizó la actividad. */
  estudianteId: string;

  /** Nombre del estudiante (snapshot para mostrar sin join). */
  estudianteNombre?: string;

  /** ID de la asignación asociada. */
  asignacionId: string;

  /** ID del recurso académico. */
  recursoId: string;

  /** Título del recurso (snapshot). */
  tituloRecurso?: string;

  /** Tipo de interacción registrada. */
  tipo: TipoActividad;

  /** Metadatos específicos del tipo de actividad. */
  metadata: MetadatosActividad;

  /** Marca de tiempo del momento exacto de la actividad (ISO 8601). */
  registradoEn: string;
}

// ---------------------------------------------------------------------------
// Métricas agregadas por estudiante
// ---------------------------------------------------------------------------

/** Resumen de avance de un estudiante en una asignación específica. */
export interface AvanceAsignacion {
  asignacionId: string;
  tituloRecurso: string;
  tipoRecurso: TipoActividad;
  /** Porcentaje de material consumido (0–100). */
  porcentajeConsumo: number;
  /** Score de la última evaluación (solo para quiz). */
  scoreUltimaEvaluacion?: number;
  /** Cuántas veces fue evaluado. */
  vecesEvaluado?: number;
  /** Fecha de primera apertura. */
  primeraAperturaEn?: string;
  /** Fecha de última actividad. */
  ultimaActividadEn?: string;
}

/** Nota mínima (sobre 100) para que un quiz cuente como asignación aprobada/completada. */
export const UMBRAL_APROBACION_QUIZ = 70;

/** Consumo mínimo (0–100) para que un material NO-quiz cuente como completado. */
export const UMBRAL_CONSUMO_COMPLETADO = 80;

/**
 * ¿El estudiante COMPLETÓ esta asignación?
 *
 * Fuente única de verdad para el rótulo "completada" que ve el acudiente. Decisión de
 * producto (2026-07-22):
 *   - quiz: contar como completada SOLO si aprobó (score >= 70). Intentar y reprobar NO es
 *     completar -- antes bastaba con haberlo intentado y un 0% figuraba como completado.
 *   - resto (video, pdf, etc.): consumió >= 80% del material, como hasta ahora.
 *
 * El consumo (`porcentajeConsumo`) y el score se siguen guardando aparte: esto solo cambia
 * cómo se CUENTA una asignación como completada, no la información registrada.
 */
export function avanceAsignacionCompletado(avance: AvanceAsignacion): boolean {
  if (avance.tipoRecurso === 'quiz') {
    return (avance.scoreUltimaEvaluacion ?? 0) >= UMBRAL_APROBACION_QUIZ;
  }
  return avance.porcentajeConsumo >= UMBRAL_CONSUMO_COMPLETADO;
}

/**
 * Documento en Firestore con las métricas agregadas de un estudiante.
 * Colección: `tenants/{tenantId}/metricasEstudiante/{estudianteId}`
 *
 * Se recalcula cada vez que se registra una nueva ActividadLog.
 */
export interface MetricasEstudiante {
  /** UID del estudiante. */
  estudianteId: string;

  /** Tenant al que pertenece. */
  tenantId: string;

  /** Nombre del estudiante (snapshot). */
  estudianteNombre?: string;

  /** Porcentaje global de material consumido (promedio entre asignaciones). */
  porcentajeGlobalConsumo: number;

  /** Promedio de scores en todas las evaluaciones realizadas. */
  promedioScoreEvaluaciones: number;

  /** Total de asignaciones que tiene. */
  totalAsignaciones: number;

  /** Asignaciones que comenzó (al menos una apertura). */
  asignacionesIniciadas: number;

  /** Asignaciones completadas (>= 80% consumo o evaluación aprobada). */
  asignacionesCompletadas: number;

  /** Desglose de avance por asignación. */
  avancePorAsignacion: AvanceAsignacion[];

  /** Total de evaluaciones realizadas. */
  totalEvaluacionesRealizadas: number;

  /** Última actividad registrada. */
  ultimaActividadEn?: string;

  /** Fecha de última actualización de las métricas. */
  actualizadoEn: string;
}
