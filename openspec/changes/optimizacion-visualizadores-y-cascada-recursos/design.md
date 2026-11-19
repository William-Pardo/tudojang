# Design: Arquitectura de Optimización de Visores y Limpieza de Recursos

## 1. Cascada de Eliminación en `bibliotecaService.eliminarRecurso`
- Al invocar `eliminarRecurso(tenantId, recursoId)`:
  1. Eliminar el documento `tenants/{tenantId}/recursos/{recursoId}`.
  2. Consultar `collection(db, 'tenants', tenantId, 'asignaciones')` filtrado por `recursoId == recursoId`.
  3. Ejecutar un `writeBatch` eliminando todas las asignaciones encontradas.
  4. Para cada asignación eliminada, purgar el documento de progreso en `tenants/{tenantId}/progreso`.

## 2. Visor Embebido de Presentaciones en `MaterialPreviewModal.tsx`
- Evitar pasar `blobUrl` a un `iframe` para tipos de archivo presentación (`.pptx`, `.ppt`, Google Slides).
- Si el archivo proviene de Drive (`externalFileId`), utilizar la URL oficial de previsualización incrustable:
  `https://drive.google.com/file/d/{externalFileId}/preview`
- Si no hay `externalFileId` pero hay URL temporal, utilizar Google Docs Viewer embebido seguro:
  `https://docs.google.com/viewer?url={encodeURIComponent(url)}&embedded=true`
- Esto garantiza que el navegador renderice la presentación interactiva con controles de diapositivas en lugar de gatillar el cuadro de diálogo de descarga del sistema operativo.

## 3. Aceleración de Carga de Imágenes
- En `MaterialPreviewModal.tsx`, para `tipoMaterial === 'imagen'`:
  - En lugar de esperar forzosamente la descarga completa por `obtenerBlobProtegido` (que retiene el buffer en memoria), permitir el renderizado progresivo a través de `accesoTemporal.url` o streaming optimizado con fallback al blob protegido.
  - Añadir feedback visual inmediato (spinner elegante de carga y placeholders de tamaño).

## 4. Visor PDF Adaptativo en `PdfViewer.tsx`
- Reemplazar el `width={640}` hardcodeado por un contenedor reactivo medido con `useRef` o un wrapper responsive (`scale` / `width` dinámico).
- Aplicar `max-h-[65vh]` con `object-fit: contain` / ajuste de escala para que las páginas apaisadas o con proporciones de presentación (como en la captura del usuario) no fuercen scroll vertical interno innecesario.
