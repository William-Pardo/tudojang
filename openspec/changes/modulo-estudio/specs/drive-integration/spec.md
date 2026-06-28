## ADDED Requirements

### Requirement: Tenant conecta Google Drive institucional
El sistema SHALL permitir al admin del tenant conectar una cuenta de Google Drive institucional mediante OAuth 2.0. La conexión SHALL ser procesada exclusivamente por una Cloud Function; el frontend nunca SHALL recibir ni almacenar tokens de Drive.

#### Scenario: Conexión OAuth exitosa
- **WHEN** el admin inicia el flujo OAuth desde la configuración del tenant
- **THEN** el sistema abre el flujo OAuth de Google en una ventana controlada, y al completarse, la Cloud Function cifra y almacena los tokens en Firestore bajo `tenants/{tenantId}/driveConnections/{connId}`

#### Scenario: Token expirado renovado automáticamente
- **WHEN** un usuario intenta acceder a un recurso y el access_token de Drive está expirado
- **THEN** la Cloud Function SHALL renovar el token silenciosamente usando el refresh_token cifrado antes de servir el archivo; el usuario no SHALL percibir la interrupción

#### Scenario: Revocación de permisos detectada
- **WHEN** Google Drive notifica via webhook o el polling detecta que el token fue revocado
- **THEN** el sistema SHALL marcar la conexión como `revocada`, bloquear todas las asignaciones que dependan de esa conexión y notificar al admin del tenant con lista de recursos afectados

### Requirement: Admin selecciona carpeta raíz institucional
El sistema SHALL permitir al admin del tenant seleccionar una carpeta raíz de Google Drive como biblioteca institucional. Solo los archivos dentro de esa carpeta (y sus subcarpetas) SHALL poder importarse a la biblioteca académica.

#### Scenario: Selección de carpeta raíz
- **WHEN** el admin ha completado la conexión OAuth y elige una carpeta en el selector
- **THEN** el sistema SHALL guardar el `folderId` en la configuración de la conexión y presentar el árbol de esa carpeta para importación

### Requirement: Acceso temporal a archivos de Drive
El sistema SHALL servir archivos de Drive a través de URLs temporales (máximo 15 minutos) generadas por Cloud Functions. El frontend nunca SHALL acceder directamente a la API de Google con credenciales de la academia.

#### Scenario: Estudiante solicita acceso a un recurso asignado
- **WHEN** el estudiante intenta abrir un recurso dentro de una asignación vigente
- **THEN** la Cloud Function SHALL validar rol, `tenantId`, existencia de asignación activa y devolver una URL temporal firmada; si la asignación está vencida o bloqueada, SHALL retornar error 403

#### Scenario: Archivo eliminado de Drive
- **WHEN** la Cloud Function intenta generar URL para un archivo que ya no existe en Drive
- **THEN** el sistema SHALL marcar el recurso como `inaccesible`, bloquear la asignación relacionada y emitir alerta al admin del tenant
