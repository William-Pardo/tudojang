## 1. Reglas de Seguridad (Firestore)

- [x] 1.1 Configurar reglas de seguridad en Firestore para la colección `leadsEventos` (permitir `create` público y lectura/actualización solo al tenant propietario).

## 2. Enrutamiento y Estructura Base

- [x] 2.1 Modificar `App.tsx` para agregar la ruta pública `<ReactRouterDOM.Route path="/evento/:id" element={<EventoPublico />} />` dentro de `AppRoutes`.
- [x] 2.2 Crear el archivo base `vistas/EventoPublico.tsx`.

## 3. Interfaz de Landing del Evento

- [x] 3.1 Implementar la consulta a Firestore para obtener los detalles del evento por `eventId` sin requerir autenticación.
- [x] 3.2 Diseñar la UI mostrando el flyer del evento, nombre, fecha y ubicación.
- [x] 3.3 Agregar el copy promocional ("Lead Magnet") enfocado en vender la experiencia del evento a escuelas invitadas.

## 4. Formulario de Captura de Prospectos (Leads)

- [x] 4.1 Implementar formulario con los campos requeridos: Nombre, WhatsApp, Email y Club de origen.
- [x] 4.2 Integrar lógica de guardado en la colección `leadsEventos` con `tenantId`, `eventoId` y estado 'Pendiente'.

## 5. Flujo de WhatsApp Precalentado

- [x] 5.1 Crear la lógica para generar el enlace a `https://wa.me/` con el texto pre-redactado ("Quiero asegurar mi participación... asisto con el club...").
- [x] 5.2 Implementar redirección automática o despliegue de botón hacia WhatsApp inmediatamente después del registro exitoso.
