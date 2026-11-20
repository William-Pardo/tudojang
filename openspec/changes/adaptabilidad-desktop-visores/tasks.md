# Tasks: Adaptabilidad Desktop de Visores de Material Académico

- [x] 1. Adaptar el reproductor de YouTube (`YoutubePlayer.tsx`) para ocupar el 100% del contenedor en PC
  - [x] 1.1 Declarar `width: '100%'` y `height: '100%'` en opciones de `new window.YT.Player`.
  - [x] 1.2 Forzar por CSS `w-full h-full [&_iframe]:w-full [&_iframe]:h-full` en el contenedor del player.
- [x] 2. Ajustar la altura y proporción del modal en desktop para Presentaciones (`MaterialPreviewModal.tsx`)
  - [x] 2.1 Configurar altura definida `sm:h-[88vh] sm:max-w-5xl` en modo desktop para presentaciones, manteniendo `h-full` intacto en mobile.
- [x] 3. Implementar adaptabilidad del modal según la relación de aspecto del PDF (`PdfViewer.tsx` y `MaterialPreviewModal.tsx`)
  - [x] 3.1 Emitir `onRatioCalculado` desde `PdfViewer.tsx` cuando carga la página.
  - [x] 3.2 Recibir el ratio en `MaterialPreviewModal.tsx` y alternar entre `sm:max-w-2xl` (vertical) y `sm:max-w-5xl` (apaisado) en desktop.
- [x] 4. Validar mediante tests unitarios (TDD) y verificar que no existan regresiones en mobile ni en desktop.
