# Proposal: Visor PDF Responsivo sin Desborde y Preload de Recursos

## Problemas Detectados

1. **Doble Scroll Vertical en Visor PDF**:
   - `MaterialPreviewModal` tiene un contenedor interior con `max-h-[75vh] overflow-y-auto`.
   - `PdfViewer` a su vez tiene una tarjeta `section` con padding y un viewport `overflow-auto`.
   - La página de `react-pdf` renderizada excede la altura disponible, forzando dos barras de scroll vertical paralelas (una en el modal y otra en el visor de página), impidiendo ver la diapositiva completa de un vistazo, especialmente crítico en dispositivos móviles.

2. **Demora en Inicio de Reproducción de Recursos**:
   - Los materiales comienzan a cargarse recién cuando el usuario hace clic para abrir el modal, generando una espera de varios segundos con pantallas en blanco o spinners.

## Solución Propuesta

1. **Ajuste de Escala Responsivo y Eliminación de Doble Scroll**:
   - En `MaterialPreviewModal`, cuando el tipo de material es `pdf`, adaptar el modal para que use la altura completa útil (`h-[92vh]` o modal maximizado en móviles) eliminando paddings redundantes.
   - En `PdfViewer`, medir dinámicamente tanto el ancho como el alto disponible del viewport (`max-h-[70vh]` / `h-full`), calculando la escala o pasando `height` además de `width` a `<Page />`, y utilizando `overflow-hidden` o ajuste `contain` para que toda la diapositiva encaje en la vista sin generar ningún scroll vertical.

2. **Preload de Materiales Académicos**:
   - Agregar mecanismo de precalentamiento / precarga (`preload`) de la URL y primeros chunks o metadata de los materiales activos visibles en la lista de asignaciones, reduciendo a milisegundos el tiempo de respuesta al abrir el visor.
