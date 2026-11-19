# Tasks: Optimización de Visores y Cascada de Recursos

- [ ] 1. Cascada de eliminación de asignaciones en `bibliotecaService.eliminarRecurso`
  - [ ] 1.1 Escribir test unitario en `bibliotecaService.test.ts` verificando que `eliminarRecurso` elimina las asignaciones huérfanas asociadas.
  - [ ] 1.2 Implementar en `bibliotecaService.ts` la eliminación en cascada de asignaciones en Firestore y limpieza de mock local.
- [ ] 2. Visor embebido interactivo para presentaciones en `MaterialPreviewModal.tsx`
  - [ ] 2.1 Escribir test en `MaterialPreviewModal.test.tsx` verificando que para `tipoMaterial === 'presentacion'` se use el preview embebido interactivo y no un `iframe` con `blobUrl` descargable.
  - [ ] 2.2 Reemplazar la renderización del iframe por la URL de preview de Google Drive / Docs viewer embebido.
- [ ] 3. Optimización y fluidez en la carga de imágenes
  - [ ] 3.1 Añadir loader visual y streaming/fallback directo en el visor de imágenes.
- [ ] 4. Ajuste responsivo y escala adaptativa en `PdfViewer.tsx`
  - [ ] 4.1 Modificar `PdfViewer.tsx` para permitir que el tamaño del render de `Page` sea responsivo al ancho y alto del contenedor disponible sin scroll vertical forzado.
  - [ ] 4.2 Validar con tests de renderizado que la página no use un ancho estático rígido si el contenedor es diferente.
