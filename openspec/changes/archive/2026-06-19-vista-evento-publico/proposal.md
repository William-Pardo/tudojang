## Why

Actualmente, al compartir el enlace de un evento (`/evento/:id`), los usuarios externos e invitados de otras academias se encuentran con un error 404 o son redirigidos a la página principal. Esto representa una pérdida de oportunidades comerciales y de participación. Es necesario implementar una vista pública atractiva que funcione como una "Landing Page" del evento para capturar la atención de competidores de otros clubes, permitiendo registrar su interés de manera ágil sin obligarlos a crear una solicitud de inscripción atada al sistema financiero interno (saldos deudores). El enfoque debe ser 100% en vender la experiencia del evento y no la academia, respetando la afiliación original del prospecto.

## What Changes

- Creación de una nueva vista pública `EventoPublico` accesible a través de la ruta `/evento/:id`.
- Implementación de un diseño de alta conversión (flyer, fecha, ubicación con mapa, agenda/razones para participar).
- Inclusión de un Lead Magnet (ej. "Asegurá acceso prioritario al pesaje") para incentivar el registro.
- Implementación de un formulario de captura de leads ultra-simple (Nombre, WhatsApp, Email, Club de origen).
- Creación de un flujo de "WhatsApp Precalentado" que se activa tras el registro, redirigiendo al prospecto a WhatsApp con un mensaje pre-redactado y enfocado exclusivamente en la inscripción al evento.
- Almacenamiento seguro de estos registros en una nueva colección de Firestore (`leadsEventos`) para que el administrador pueda dar seguimiento sin alterar la base de datos de estudiantes regulares.

## Capabilities

### New Capabilities
- `evento-landing-publica`: Interfaz y diseño de la vista pública del evento, optimizada para conversión de prospectos externos.
- `evento-lead-capture`: Lógica de captura de leads (prospectos), almacenamiento en la colección `leadsEventos` y generación del flujo de WhatsApp precalentado.

### Modified Capabilities


## Impact

- **Routing (App.tsx)**: Se agregará una nueva ruta pública para `/evento/:id`.
- **Firestore**: Nueva colección `leadsEventos` con reglas de seguridad específicas (solo escritura para externos, lectura/escritura para admins del tenant).
- **Formatters**: Posible ajuste en `generarUrlAbsoluta` para garantizar rutas limpias al compartir.
- **Vistas y Componentes**: Creación de nuevos componentes de UI para el Landing del evento y el formulario de captura.
