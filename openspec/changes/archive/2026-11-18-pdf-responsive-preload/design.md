# Design: Escala Responsiva de PDF y Preload de Recursos

## 1. Eliminación de Doble Scroll en `MaterialPreviewModal.tsx` y `PdfViewer.tsx`
- En `MaterialPreviewModal.tsx`:
  - En lugar de forzar un contenedor con scroll interno genérico `max-h-[75vh] overflow-y-auto`, estructurar el modal con flex layout (`flex flex-col h-[90vh] max-h-[900px] w-full max-w-4xl`).
  - El header permanece arriba, los controles abajo y el área de visualización ocupa `flex-1 min-h-0` para que el visor de PDF llene el espacio disponible exactamente.
- En `PdfViewer.tsx`:
  - `contenedorRef` mide el contenedor en ancho y alto disponible.
  - Para `<Page />`:
    - En `react-pdf`, se puede proporcionar `width` y/o `height` o calcular la escala en base a las dimensiones de la página y el aspect ratio del contenedor:
      `escala = Math.min(contenedorAncho / anchoPaginaOriginal, contenedorAlto / altoPaginaOriginal)`
    - O pasar `width={anchoEfectivo}` y `height={altoEfectivo}` limitando el desborde con `object-contain`.
    - Eliminar `overflow-auto` del contenedor de la página para erradicar el scroll vertical interno, de modo que toda la diapositiva/página esté 100% visible sin barras de desplazamiento.

## 2. Preload de Recursos Académicos
- En `MaterialPreviewModal.tsx` o en la lista de asignaciones:
  - Disparar `driveService.obtenerUrlTemporal` o prefetch de blobs en cuanto las asignaciones visibles están disponibles o en hover/mouseEnter / prefetch automático del primer material de la lista.
  - En `MaterialPreviewModal`, si la URL temporal o el recurso ya se solicitó, reutilizar la promesa cacheada sin re-ejecutar el round-trip a Cloud Functions.
