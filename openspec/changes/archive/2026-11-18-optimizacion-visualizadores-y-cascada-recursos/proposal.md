# Proposal: Optimización de Visores Académicos y Cascada de Eliminación de Recursos

## Problemas Detectados

1. **Persistencia de material eliminado para estudiantes**: Al eliminar un recurso desde la vista administrativa/tenant, las asignaciones previamente creadas en `tenants/{tenantId}/asignaciones` quedan huérfanas y continúan visibles en el panel del estudiante.
2. **Descarga involuntaria de presentaciones**: Los archivos de presentación (`.pptx`, Google Slides) cargados en `<iframe src={blobUrl} />` son interpretados por los navegadores como descargas forzadas de binarios en lugar de reproducirse en pantalla.
3. **Carga lenta de imágenes (>40s)**: El pipeline de obtención de imágenes requiere un viaje completo por Cloud Functions, descarga íntegra a memoria del servidor, transporte binario por fetch autenticado y conversión a blob local, generando tiempos de espera inaceptables en conexiones estándar o imágenes pesadas.
4. **Desborde vertical y scroll en visor PDF**: `PdfViewer` utiliza un ancho estático forzado (`width={640}`) sin considerar el aspect ratio ni la altura disponible del contenedor modal, provocando barras de desplazamiento vertical y recortando la lectura.

## Solución Propuesta

1. **Eliminación en Cascada**:
   - Extender `eliminarRecurso` en `bibliotecaService` para que, en un batch de Firestore, localice y elimine todas las asignaciones vinculadas (`where('recursoId', '==', recursoId)`) y limpie sus registros de progreso.
2. **Visor Embebido de Presentaciones**:
   - Integrar visualizador interactivo con vista embebida (Google Docs Viewer / Google Drive preview URL o renderizado de slides) en lugar de exponer el blob binario raw a un iframe del navegador.
3. **Optimización de Carga de Imágenes**:
   - Renderizar la URL temporal del recurso con direct streaming y lazy-loading nativo, evitando el bloqueo síncrono del buffer en memoria.
4. **Escalado Responsivo de PDFs**:
   - Ajustar `PdfViewer.tsx` para medir el contenedor dinámicamente y aplicar escalado responsivo (`fit-to-page` / responsive container width) eliminando el scroll vertical y adaptando el documento al marco visible.
