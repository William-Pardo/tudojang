# Design: Adaptabilidad Desktop de Visores de Material Académico

## 1. Reproductor de YouTube (`YoutubePlayer.tsx`)
- Al invocar `new window.YT.Player(elementId, { ... })`:
  - Declarar `width: '100%'` y `height: '100%'`.
- En el JSX del contenedor:
  - Aplicar `w-full h-full aspect-video [&_iframe]:w-full [&_iframe]:h-full [&>div]:w-full [&>div]:h-full`.
  - Asegurar que al estar en modo fullscreen (`esFullscreen`), el contenedor ocupe la máxima altura/ancho sin barras negras artificiales.

## 2. Modal y Visor de Presentaciones (`MaterialPreviewModal.tsx`)
- En `MaterialPreviewModal.tsx`:
  - Para `tipoMaterial === 'presentacion'` o cuando el modal esté en desktop (`sm:`):
    - Reemplazar `sm:h-auto` por una altura de lienzo definida: `sm:h-[88vh] sm:max-w-5xl`.
    - Mantener en mobile (`<640px`) las clases `h-full rounded-none` que funcionan perfectamente.
  - El iframe contenedor de la presentación mantendrá `w-full h-full flex-1` llenando la ventana 16:9 con espacio garantizado.

## 3. Visor de PDF Adaptativo (`PdfViewer.tsx` y `MaterialPreviewModal.tsx`)
- En `PdfViewer.tsx`:
  - Cuando `react-pdf` carga la primera página (`onLoadSuccess` en `<Page />`), calcula el `pageRatio = origW / origH`.
  - Exponer un prop opcional `onRatioCalculado?: (ratio: number) => void`.
- En `MaterialPreviewModal.tsx`:
  - Almacenar el `ratioPdf` recibido.
  - Si `tipoMaterial === 'pdf'`:
    - Si `ratioPdf && ratioPdf < 0.85` (formato vertical tipo 9:16 o A4 portrait): aplicar clase `sm:max-w-xl` o `sm:max-w-2xl` y `sm:h-[90vh]`.
    - Si `ratioPdf >= 0.85` (formato horizontal o cuadrado): aplicar clase `sm:max-w-5xl` y `sm:h-[90vh]`.
  - En móviles (`<sm:`), el modal siempre mantiene `h-full rounded-none`, por lo que la experiencia móvil no sufre ninguna alteración.
