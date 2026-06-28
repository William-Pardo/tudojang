// models/academico/index.ts
// Tipos base del módulo de estudio académico de Tudojang.
// Estos enums y tipos son compartidos por servicios, hooks y componentes del módulo.

// ---------------------------------------------------------------------------
// Roles académicos
// ---------------------------------------------------------------------------

/**
 * Rol de acceso académico.
 * - Estudiante: consume materiales y presenta actividades.
 * - Tutor: padre/acudiente con acceso de solo lectura (progreso, notificaciones).
 *
 * Se mapea al campo `rol` del custom claim de Firebase Auth junto con RolUsuario.
 */
export type RolAcademico = 'Estudiante' | 'Tutor';

// ---------------------------------------------------------------------------
// Estados de jornada de instrucción
// ---------------------------------------------------------------------------

/**
 * Ciclo de vida completo de una JornadaInstruccion.
 * Las transiciones principales son lineales:
 *   borrador → pendiente_confirmacion → confirmada → en_curso
 *   → pendiente_cierre → cerrada
 *
 * Alternativos: cancelada | reprogramada | parcial | pendiente_sustitucion
 */
export type EstadoJornada =
  | 'borrador'
  | 'pendiente_confirmacion'
  | 'confirmada'
  | 'en_curso'
  | 'pendiente_cierre'
  | 'cerrada'
  | 'cancelada'
  | 'reprogramada'
  | 'parcial'
  | 'pendiente_sustitucion';

// ---------------------------------------------------------------------------
// Estados de progreso del estudiante en una asignación
// ---------------------------------------------------------------------------

/**
 * Estado del progreso de un estudiante en una AsignacionAcademica.
 *
 * Flujo normal: bloqueado → disponible → iniciado → en_progreso → completado
 * Flujos alternativos: pendiente_revision → aprobado | requiere_refuerzo
 * Estado terminal negativo: vencido
 */
export type EstadoProgreso =
  | 'bloqueado'
  | 'disponible'
  | 'iniciado'
  | 'en_progreso'
  | 'completado'
  | 'pendiente_revision'
  | 'aprobado'
  | 'requiere_refuerzo'
  | 'vencido';

// ---------------------------------------------------------------------------
// Tipos de recurso académico
// ---------------------------------------------------------------------------

/** Tipo de archivo o actividad en la biblioteca académica. */
export type TipoRecurso = 'pdf' | 'video' | 'imagen' | 'presentacion' | 'enlace' | 'quiz' | 'actividad_practica';

// ---------------------------------------------------------------------------
// Uso académico de un recurso
// ---------------------------------------------------------------------------

/**
 * Para qué se usa el recurso dentro del contexto pedagógico.
 * Un recurso puede tener múltiples usos.
 */
export type UsoAcademico = 'estudio' | 'preparacion' | 'refuerzo' | 'consulta' | 'evaluacion';

// ---------------------------------------------------------------------------
// Momento pedagógico de una asignación
// ---------------------------------------------------------------------------

/** En qué momento del ciclo se asigna el recurso al estudiante. */
export type MomentoAsignacion = 'preparacion' | 'durante' | 'refuerzo_posterior';

// ---------------------------------------------------------------------------
// Estado de un recurso en la biblioteca
// ---------------------------------------------------------------------------

/**
 * Estado del RecursoAcademico en el ciclo de vida de la biblioteca.
 *
 * borrador → pendiente (revisión admin) → aprobado → archivado
 * Inaccesible: el archivo fue eliminado o perdió permisos en Drive.
 */
export type EstadoRecurso = 'borrador' | 'pendiente' | 'aprobado' | 'archivado' | 'inaccesible';

// ---------------------------------------------------------------------------
// Estado de invitación de usuario académico
// ---------------------------------------------------------------------------

/** Estado del ciclo de vida de una InvitacionUsuario. */
export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'vencida' | 'revocada';

// ---------------------------------------------------------------------------
// Proveedor de almacenamiento externo
// ---------------------------------------------------------------------------

/** Proveedor de almacenamiento de archivos institucionales. */
export type ProveedorStorage = 'google_drive'; // Extensible: 'onedrive' | 'dropbox'
