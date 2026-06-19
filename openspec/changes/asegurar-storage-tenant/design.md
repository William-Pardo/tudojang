## Context

El sistema Tudojang permite el registro de eventos en el dojang por escuela (tenant). Actualmente, al cargar la imagen de un evento, el frontend intenta subir el archivo directamente a la ruta raíz `/eventos/{eventId}/{nombre_archivo}` en Firebase Storage.

Dado que las Reglas de Seguridad por defecto de Firebase Storage bloquean la escritura en la raíz (o no están configuradas localmente para permitirlo), la subida de imágenes falla con un error `storage/unauthorized`.

## Goals / Non-Goals

**Goals:**
- Estructurar el almacenamiento en Firebase Storage separándolo lógicamente por tenant: `/tenants/{tenantId}/eventos/{eventId}/{imageName}`.
- Crear y versionar un archivo de reglas `storage.rules` en el repositorio, vinculándolo en `firebase.json`.
- Restringir la escritura y eliminación de recursos en Storage únicamente a los usuarios autenticados que pertenezcan al tenant propietario de la ruta.
- Permitir la lectura de imágenes de eventos para todos los usuarios autenticados.

**Non-Goals:**
- Migrar de forma retroactiva las imágenes antiguas (los eventos creados previamente no requieren migración para esta fase, pero sí los nuevos).

## Decisions

### Decisión 1: Estructura de namespaces en Firebase Storage
Utilizar la estructura `/tenants/{tenantId}/eventos/{eventId}/{imageName}` en lugar de carpetas globales.
- **Razón**: Permite validar de forma sencilla y eficiente los permisos de acceso directamente desde las reglas de Storage analizando el segmento de ruta `{tenantId}`.
- **Alternativas consideradas**: Guardar en `/eventos/{tenantId}/{eventId}/{imageName}`. Se eligió la primera porque facilita extender el aislamiento a otros tipos de archivos (ej. comprobantes de pago o fotos de perfil) bajo la carpeta del tenant `/tenants/{tenantId}/...`.

### Decisión 2: Versionado local de Storage Rules
Crear `storage.rules` en la raíz del proyecto y configurarlo en [firebase.json](file:///e:/Apps/Tudojang/firebase.json).
- **Razón**: Permite asegurar que los entornos de desarrollo local, staging y producción compartan las mismas reglas exactas de seguridad y estén bajo control de versiones.
- **Alternativas consideradas**: Gestionar las reglas de Storage únicamente desde la consola de Firebase. Esto es propenso a errores humanos y desincronizaciones entre entornos.

### Decisión 3: Método de validación del Tenant en las Reglas
Mapear el acceso validando el `tenantId` del usuario autenticado.
- **Enfoque A (Preferido si se usan Custom Claims)**:
  `request.auth.token.tenantId == tenantId`
- **Enfoque B (Si se almacena en el documento del usuario en Firestore)**:
  Usar una lectura de base de datos desde Storage rules:
  `firestore.get(/databases/(default)/documents/usuarios/$(request.auth.uid)).data.tenantId == tenantId`
- **Razón**: El diseño contempla ambas opciones. Durante la implementación, el sub-agente comprobará si el perfil de autenticación incluye custom claims del tenant, de lo contrario usará la lectura de Firestore.

## Risks / Trade-offs

- **[Riesgo: Costo de Firestore]** → Si se usa la lectura de Firestore (`firestore.get(...)`) en cada subida de archivo para validar el tenant, incrementará levemente el costo de lecturas de Firestore.
  - *Mitigación*: La subida de imágenes de eventos es un evento de baja frecuencia (los dojangs no crean decenas de eventos por segundo). Además, se priorizará el uso de custom claims si ya están implementadas en la autenticación.
