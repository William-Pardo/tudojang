## ADDED Requirements

### Requirement: Acceso a la vista pública del evento
El sistema SHALL permitir a usuarios no autenticados acceder a la ruta `/evento/:id`.

#### Scenario: Usuario accede a la ruta
- **WHEN** un usuario externo navega a `/evento/:id`
- **THEN** el sistema carga y muestra los detalles del evento correspondiente sin exigir inicio de sesión ni redirigir al landing principal.

### Requirement: Diseño orientado a la conversión
La vista pública del evento SHALL mostrar la información del evento (flyer, fecha, ubicación) junto con elementos que incentiven la participación (ej. "Lead Magnet").

#### Scenario: Visualización de información atractiva
- **WHEN** la vista del evento se carga exitosamente
- **THEN** el prospecto puede identificar fácilmente de qué trata el evento y encontrar el llamado a la acción para registrarse.
