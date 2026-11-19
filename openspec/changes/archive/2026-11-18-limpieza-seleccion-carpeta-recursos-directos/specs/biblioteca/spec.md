# Spec: Selección fluida de carpetas y recursos directos

## Requirements

### Requirement: Cambio de carpeta sin confirmaciones bloqueantes
`BibliotecaView` MUST cambiar la carpeta activa de Drive inmediatamente sin mostrar diálogos `window.confirm`.

#### Scenario: Cambiar carpeta en el selector actualiza la lista sin confirmar
- GIVEN un usuario con Google Drive conectado y recursos ya aprobados
- WHEN el usuario abre el selector y elige "Usar esta carpeta"
- THEN no se muestra ningún diálogo `window.confirm`
- AND la carpeta activa y los archivos listados se actualizan con la nueva selección

### Requirement: Aislamiento estricto de recursos directos
`recursosDirectos` MUST incluir únicamente recursos que contengan un `youtubeVideoId` o cuyo `externalFileId` comience con `video-`.

#### Scenario: Archivos de Drive de otras carpetas no aparecen como directos
- GIVEN un recurso de Drive previamente aprobado de otra carpeta
- WHEN el usuario navega a una carpeta vacía
- THEN ese recurso de Drive no aparece en la sección de enlaces directos de video
