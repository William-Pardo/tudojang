## ADDED Requirements

### Requirement: Admin importa y clasifica recursos académicos
El sistema SHALL permitir al admin del tenant importar archivos desde la carpeta raíz de Google Drive y clasificarlos con una ficha académica (disciplina, nivel, tipo, uso, estado). Los archivos SHALL permanecer en Drive; Tudojang SHALL almacenar solo referencias y metadatos.

#### Scenario: Importación de archivo desde Drive
- **WHEN** el admin selecciona un archivo en el explorador de Drive y confirma la importación
- **THEN** el sistema SHALL registrar en Firestore: proveedor, `externalFileId`, nombre, MIME, tamaño, versión, fecha de modificación, ruta informativa y estado inicial `borrador`

#### Scenario: Clasificación de recurso importado
- **WHEN** el admin completa la ficha académica del recurso (disciplina, nivel mínimo/máximo, tipo, usos, duración estimada, autor)
- **THEN** el sistema SHALL actualizar el documento del recurso y cambiar el estado a `pendiente` hasta aprobación

#### Scenario: Aprobación de recurso por el admin
- **WHEN** el admin aprueba un recurso pendiente
- **THEN** el sistema SHALL cambiar el estado a `aprobado` y el recurso SHALL estar disponible para que los maestros lo publiquen en asignaciones

### Requirement: Recurso mantiene relación aunque el archivo se renombre o mueva en Drive
El sistema SHALL identificar los recursos por su `externalFileId` de Drive, no por nombre ni ruta. Si un archivo se renombra o mueve dentro de la carpeta institucional, la relación con la biblioteca SHALL mantenerse.

#### Scenario: Archivo renombrado en Drive detectado
- **WHEN** la sincronización periódica o el webhook de Drive detecta que el nombre de un archivo cambió
- **THEN** el sistema SHALL actualizar el campo `nombre` en el documento del recurso sin romper ninguna asignación existente

#### Scenario: Archivo eliminado de Drive
- **WHEN** la sincronización detecta que el `externalFileId` ya no existe en Drive
- **THEN** el sistema SHALL marcar el recurso como `inaccesible`, bloquear todas las asignaciones asociadas y emitir alerta al admin del tenant con lista de afectados

### Requirement: Aporte de recursos por maestro requiere revisión
El sistema SHALL permitir que los maestros aporten recursos nuevos a la biblioteca, pero dichos recursos SHALL quedar en estado `pendiente` hasta que el admin del tenant los revise y apruebe. Solo recursos en estado `aprobado` SHALL poder publicarse en asignaciones.

#### Scenario: Maestro aporta un recurso nuevo
- **WHEN** el maestro selecciona un archivo de Drive no existente en la biblioteca y lo propone
- **THEN** el sistema SHALL crear el recurso en estado `pendiente` y notificar al admin del tenant para revisión

#### Scenario: Intento de asignar recurso no aprobado
- **WHEN** un maestro intenta publicar en una asignación un recurso que no está en estado `aprobado`
- **THEN** el sistema SHALL rechazar la operación con error descriptivo indicando el estado actual del recurso
