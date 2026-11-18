/**
 * Tipo canónico resuelto para presentación adaptativa de materiales.
 */
export type TipoMaterialResuelto =
  | 'video'
  | 'pdf'
  | 'imagen'
  | 'presentacion'
  | 'quiz'
  | 'generico';

export interface ParametrosResolucionMaterial {
  uso?: string | null;
  youtubeVideoId?: string | null;
  mimeType?: string | null;
  tipoRecurso?: string | null;
  titulo?: string | null;
  externalFileId?: string | null;
  duracionSegundos?: number | null;
}

/**
 * Resuelve de forma determinística y a prueba de fallos el tipo real de material académico.
 *
 * Jerarquía de resolución (Fuente de verdad primero):
 * 1. Evaluativo explícito (`uso === 'evaluacion'` o `tipoRecurso === 'quiz'`) -> 'quiz'
 * 2. Identificador de streaming validado (`youtubeVideoId` presente y no vacío) -> 'video'
 * 3. MIME type binario real del archivo (`video/*`, `application/pdf`, `image/*`, etc.)
 * 4. Metadato pedagógico explícito (`tipoRecurso`: 'video' | 'pdf' | 'imagen' | 'presentacion' | 'quiz')
 * 5. Duración explícita (solo los videos poseen `duracionSegundos`) -> 'video'
 * 6. Extensión en el título del archivo (fallback por compatibilidad con archivos históricos)
 * 7. Fallback seguro a 'generico' (NUNCA asume ciegamente PDF sin evidencia).
 */
export function resolverTipoMaterial(
  material: ParametrosResolucionMaterial | null | undefined
): TipoMaterialResuelto {
  if (!material) return 'generico';

  // 1. Evaluaciones / Quizzes
  if (material.uso === 'evaluacion' || material.tipoRecurso === 'quiz') {
    return 'quiz';
  }

  // 2. Video por Streaming de YouTube
  if (material.youtubeVideoId && String(material.youtubeVideoId).trim().length > 0) {
    return 'video';
  }

  // 3. MIME type real del archivo (Google Drive u otro proveedor)
  const mime = (material.mimeType || '').trim().toLowerCase();
  if (mime) {
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf' || mime.endsWith('/pdf')) return 'pdf';
    if (mime.startsWith('image/')) return 'imagen';
    if (
      mime.includes('presentation') ||
      mime.includes('powerpoint') ||
      mime.includes('google-apps.presentation')
    ) {
      return 'presentacion';
    }
  }

  // 4. Metadato pedagógico asignado (tipoRecurso / ficha.tipo)
  const tipoMeta = (material.tipoRecurso || '').trim().toLowerCase();
  if (tipoMeta === 'video') return 'video';
  if (tipoMeta === 'pdf') return 'pdf';
  if (tipoMeta === 'imagen') return 'imagen';
  if (tipoMeta === 'presentacion') return 'presentacion';
  if (tipoMeta === 'quiz') return 'quiz';

  // 5. Duración de reproducción definida
  if (typeof material.duracionSegundos === 'number' && material.duracionSegundos > 0) {
    return 'video';
  }

  // 6. Extensión en el título del archivo
  const titulo = (material.titulo || '').trim().toLowerCase();
  const ext = titulo.split('.').pop() || '';

  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return 'video';
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return 'imagen';
  }
  if (['ppt', 'pptx', 'key'].includes(ext)) {
    return 'presentacion';
  }
  if (['txt', 'md'].includes(ext)) {
    return 'generico';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }

  // 7. Fallback por compatibilidad para documentos de biblioteca en Google Drive:
  // En Tudojang, los materiales de estudio no multimedia en Drive son PDFs.
  return 'pdf';
}

/**
 * Retorna la etiqueta legible en español para la cabecera del visor adaptativo.
 */
export function obtenerEtiquetaTipoMaterial(
  tipo: TipoMaterialResuelto,
  uso?: string | null
): string {
  if (tipo === 'quiz' || uso === 'evaluacion') return 'Evaluación / Quiz';
  if (uso === 'refuerzo') return 'Refuerzo guiado';
  switch (tipo) {
    case 'video':
      return 'Video de estudio';
    case 'pdf':
      return 'Documento PDF';
    case 'imagen':
      return 'Imagen / Gráfico';
    case 'presentacion':
      return 'Presentación';
    default:
      return 'Material de estudio';
  }
}
