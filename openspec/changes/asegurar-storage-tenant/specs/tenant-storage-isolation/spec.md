## ADDED Requirements

### Requirement: Tenant storage isolation for events
El sistema DEBE aislar físicamente el almacenamiento de las imágenes de los eventos de cada escuela (tenant) bajo un namespace específico en la ruta de Firebase Storage.
El sistema DEBE denegar cualquier intento de escritura (creación, edición o eliminación) sobre los archivos de un tenant si el usuario autenticado no pertenece a dicho tenant.
El sistema DEBE permitir el acceso de lectura a las imágenes de los eventos a cualquier usuario autenticado en la plataforma.

#### Scenario: Successful upload by owner tenant
- **WHEN** un usuario con `tenantId` igual a `escuela-gajog-001` sube la imagen de un evento para su escuela
- **THEN** el sistema guarda la imagen de forma exitosa bajo la ruta `/tenants/escuela-gajog-001/eventos/{eventId}/{imageName}`

#### Scenario: Blocked upload by other tenant
- **WHEN** un usuario con `tenantId` igual a `escuela-otra-999` intenta escribir en la ruta de Storage del tenant `/tenants/escuela-gajog-001/eventos/{eventId}/{imageName}`
- **THEN** Firebase Storage rechaza la operación retornando un error de no autorizado (`storage/unauthorized`)

#### Scenario: Blocked write by unauthenticated user
- **WHEN** un usuario no autenticado intenta escribir en la ruta `/tenants/escuela-gajog-001/eventos/{eventId}/{imageName}`
- **THEN** Firebase Storage rechaza la operación de forma inmediata con un error de no autorizado (`storage/unauthorized`)

#### Scenario: Read access for authenticated users
- **WHEN** cualquier usuario autenticado en la plataforma intenta visualizar la imagen en `/tenants/escuela-gajog-001/eventos/{eventId}/{imageName}`
- **THEN** Firebase Storage permite la lectura y descarga del recurso
