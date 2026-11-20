# Proposal: Adaptabilidad Desktop de Visores de Material Académico

## Contexto y Estado Actual

La visualización en dispositivos móviles (`<640px`) funciona de manera óptima tras la integración del portal superior (`z-[9999]`), escalado móvil y automatización de la sincronización en segundo plano. Sin embargo, en pantallas de escritorio (PC / breakpoints `sm:` en adelante) se identificaron tres problemas de visualización:

1. **Video de YouTube no se expande al ancho del contenedor**:
   - Al maximizar el modal, el reproductor de YouTube inyecta un `iframe` con dimensiones fijas por defecto (640x360px), quedando confinado en la esquina superior izquierda sobre un fondo negro masivo.
2. **Presentaciones (Google Slides / Drive) aplastadas verticalmente**:
   - En desktop, el modal utiliza `sm:h-auto`. Los contenedores flex hijos con `flex-1 min-h-0` colapsan a su altura intrínseca (~60-150px) al no tener una altura definida en el contenedor padre, mostrando solo los bordes superior e inferior de la diapositiva.
3. **Modal de PDF rígido y desproporcionado respecto a la relación de aspecto**:
   - El modal en PC tiene un ancho fijo (`sm:max-w-4xl` = 896px). Al abrir un PDF en formato vertical (p. ej. 9:16 o A4 vertical), el visor escala la página para que quepa en el alto de la pantalla, dejando enormes espacios vacíos laterales; si el PDF es apaisado (16:9), la caja no aprovecha el ancho completo.

## Solución Propuesta

Mantener estrictamente intacta la configuración móvil base (sin prefijo en Tailwind) y optimizar únicamente los estilos de escritorio (`sm:` / `md:`):

1. **Expansión total de Video YouTube**:
   - Configurar `width: '100%'` y `height: '100%'` en el constructor de la API de YouTube y forzar por CSS que tanto el contenedor como el iframe hijo llenen el 100% del área disponible (`w-full h-full aspect-video`).
2. **Altura y formato óptimo para Presentaciones**:
   - Asignar una altura fija y proporcional en desktop (`sm:h-[88vh]` o `sm:max-w-5xl aspect-video`) para que el `iframe` de Google Slides disponga de espacio real y se visualice completo de borde a borde en formato 16:9.
3. **Modal de PDF adaptable al Aspect Ratio**:
   - Detectar la relación de aspecto (`pageRatio = ancho / alto`) de la página del PDF en `PdfViewer` y ajustar dinámicamente el `max-w` del modal en desktop:
     - Formato vertical (`pageRatio < 1`): ancho compacto (`sm:max-w-xl` o `sm:max-w-2xl`) que abraza el documento verticalmente sin franjas muertas.
     - Formato horizontal (`pageRatio >= 1`): ancho extendido (`sm:max-w-5xl` o `sm:max-w-6xl`).
