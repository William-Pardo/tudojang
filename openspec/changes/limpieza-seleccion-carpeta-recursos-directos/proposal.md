# Proposal: Selección fluida de carpetas Drive y discriminación de recursos directos

## Contexto y Problema
1. En `BibliotecaView.tsx`, al seleccionar una carpeta mediante el modal selector, la función `validarCarpetaDrivePorId` ejecuta `confirmarCambioCarpetaDrive`, disparando un `window.confirm` que confunde y bloquea al usuario. Cambiar de carpeta en Drive es una operación de navegación y no destruye recursos en Firestore.
2. `recursosDirectos` se calculaba de forma laxa como cualquier recurso aprobado cuyo `externalFileId` no estuviera en `archivosDriveIds`. Esto causaba que los archivos de Drive indexados de otras carpetas se mostraran erróneamente en el listado de recursos directos o sufrieran marcas de `fuera_carpeta_activa`.
3. Un recurso directo es estrictamente un recurso generado por enlace/video directo (`youtubeVideoId` o `externalFileId` con prefijo `video-`).

## Solución Propuesta
1. Retirar el `window.confirm` innecesario en la selección de carpetas, permitiendo una navegación ágil e inmediata entre carpetas.
2. Definir `recursosDirectos` de forma precisa: solo recursos aprobados con `youtubeVideoId` o `externalFileId.startsWith('video-')`.
3. Evitar degradar el estado `fuenteDriveEstado` a advertencias cuando se navega entre subcarpetas de la cuenta conectada.
