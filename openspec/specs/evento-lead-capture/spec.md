## ADDED Requirements

### Requirement: Formulario de captura de prospectos externos
El sistema SHALL proveer un formulario de registro simplificado en la vista pública del evento que capture Nombre, Email, WhatsApp y Club de origen.

#### Scenario: Envío exitoso del formulario
- **WHEN** un usuario externo completa los campos requeridos y envía el formulario
- **THEN** el sistema guarda un nuevo documento en la colección `leadsEventos` con los datos proporcionados y el estado 'Pendiente'.

### Requirement: Flujo de WhatsApp Precalentado
El sistema SHALL facilitar la comunicación instantánea entre el prospecto y el club anfitrión utilizando WhatsApp, focalizado exclusivamente en la inscripción al evento.

#### Scenario: Redirección a WhatsApp
- **WHEN** el lead se guarda correctamente en Firestore
- **THEN** se genera y presenta (o abre automáticamente) un enlace a la API de WhatsApp con un texto pre-redactado indicando el interés del prospecto en asistir al evento.
