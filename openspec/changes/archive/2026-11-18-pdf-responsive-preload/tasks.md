# Tasks: Visor PDF Adaptativo y Preload

- [x] 1. Rediseñar layout de `MaterialPreviewModal.tsx` y `PdfViewer.tsx` para eliminar scrolls verticales y adaptar a móviles
  - [x] 1.1 Configurar el modal como flexbox `h-[90vh]` / responsivo móvil con área de visor `flex-1 min-h-0`.
  - [x] 1.2 Adaptar `PdfViewer.tsx` para calcular ancho y alto óptimo ajustado al contenedor sin barras de scroll.
- [x] 2. Implementar caché/preload en `driveService` y `MaterialPreviewModal` para acelerar la apertura de recursos
- [x] 3. Validar con tests unitarios e integración que pasen los casos de uso.
