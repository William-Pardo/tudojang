## Context

Actualmente, las URLs compartidas de los eventos (`#/evento/:id`) devuelven un error 404 porque no existe una ruta definida en el enrutador para el detalle público de los eventos. Las academias necesitan poder compartir sus eventos con competidores y estudiantes de otros clubes. Sin embargo, el modelo actual de `solicitudesInscripcion` requiere forzosamente un `Estudiante` registrado, lo que impide que usuarios externos se inscriban sin comprometer la integridad de los datos financieros y de membresía.

## Goals / Non-Goals

**Goals:**
- Implementar una ruta pública `/evento/:id` accesible sin autenticación.
- Crear una interfaz de "Landing Page" enfocada exclusivamente en vender la experiencia del evento.
- Capturar prospectos externos (Leads) de forma sencilla (Nombre, Email, WhatsApp, Club de origen).
- Redirigir al usuario externo a WhatsApp con un mensaje pre-redactado para facilitar el cierre de la inscripción por parte del administrador.
- Mantener el modelo de datos de `Estudiantes` aislado y seguro.

**Non-Goals:**
- No se creará un perfil completo de estudiante para los asistentes externos.
- No se procesarán pagos automatizados a través de la pasarela para usuarios que no sean miembros activos del club (el pago de externos se coordina por WhatsApp).

## Decisions

1. **Enrutamiento Público (`App.tsx`)**:
   - Se agregará `<ReactRouterDOM.Route path="/evento/:id" element={<EventoPublico />} />` dentro de `AppRoutes`, permitiendo acceso no autenticado.

2. **Modelo de Datos (`leadsEventos`)**:
   - Se creará una nueva colección `leadsEventos` en Firestore.
   - Documento sugerido: `{ tenantId, eventoId, nombre, whatsapp, email, clubOrigen, fechaRegistro, estado: 'Pendiente' }`.
   - *Rationale*: Evitamos ensuciar la colección `estudiantes` o `solicitudesInscripcion`. Es más limpio y fácil de depurar.

3. **Seguridad (Firestore Rules)**:
   - `match /leadsEventos/{leadId}`
   - `allow create: if true;` (Creación pública para permitir el registro).
   - `allow read, update, delete: if request.auth != null && firestore.get(/databases/(default)/documents/usuarios/$(request.auth.uid)).data.tenantId == resource.data.tenantId;` (Solo admins del tenant pueden leer y gestionar sus leads).

4. **Flujo de WhatsApp Precalentado**:
   - Una vez guardado el documento en Firestore, la UI generará un enlace `https://wa.me/<telefono-tenant>?text=<mensaje-encodeado>` y abrirá la pestaña para iniciar el chat con el club anfitrión.

## Risks / Trade-offs

- **[Risk] Spam o bots en la colección de leads públicos**: Al permitir `create: if true`, existe el riesgo de envíos automatizados falsos.
  - *Mitigation*: Validaciones estrictas en el frontend (campos requeridos, formato de email y teléfono). Si el spam se convierte en un problema real, se añadirá reCAPTCHA en una iteración futura.
- **[Risk] Confusión entre estudiantes propios y externos**: Estudiantes actuales podrían usar el formulario de externos.
  - *Mitigation*: El diseño debe tener un botón o enlace claro del tipo "¿Sos parte de la academia? Iniciá sesión acá" para desviar a los estudiantes activos al flujo correcto de `PasarelaInscripcion`.
