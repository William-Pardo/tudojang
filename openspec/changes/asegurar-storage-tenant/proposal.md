## Why

Actualmente, las imágenes de los eventos se suben directamente a la ruta raíz global `eventos/{eventId}/imagen` en Firebase Storage. Esta estructura carece de aislamiento por escuela (tenant), lo que impide aplicar reglas de seguridad granulares y provoca errores de autorización (`storage/unauthorized`) debido a la falta de namespaces por cliente. Es necesario implementar un aislamiento de almacenamiento robusto y seguro por tenant que pueda ser controlado mediante reglas de seguridad de Firebase Storage trackeadas en Git.

## What Changes

- Redirección del almacenamiento de imágenes de eventos a una ruta con namespace por tenant: `tenants/{tenantId}/eventos/{eventId}/{imageName}`.
- Creación de un archivo `storage.rules` en el repositorio para el control de versiones de las reglas de Storage.
- Configuración de `firebase.json` para desplegar automáticamente las reglas de `storage.rules` durante el despliegue de Firebase.
- Restricción de permisos de escritura (`write`) y eliminación (`delete`) en Firebase Storage únicamente al propietario/miembros del tenant correspondiente.
- Permiso de lectura (`read`) para todos los usuarios autenticados para que puedan visualizar los banners de los eventos.

## Capabilities

### New Capabilities
- `tenant-storage-isolation`: Aislamiento y seguridad en Firebase Storage usando namespaces basados en el identificador del tenant en la ruta, restringiendo la escritura/edición de archivos al tenant de la sesión actual.

### Modified Capabilities
<!-- Ninguna -->

## Impact

- **Firebase Config**: Modificación en [firebase.json](file:///e:/Apps/Tudojang/firebase.json) para enlazar y desplegar las reglas locales de Storage.
- **Nuevos Archivos**: Creación de `storage.rules` en la raíz del proyecto.
- **Frontend**: Modificación en el componente de subida de imágenes de eventos (en los componentes de vistas del dojang) para actualizar la ruta de almacenamiento con el prefijo `/tenants/{tenantId}/`.
