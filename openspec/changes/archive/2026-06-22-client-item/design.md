## Context

El archivo `ClientItem.tsx` solo documenta que la funcionalidad SaaS no estaba incluida en la aplicación cliente. Se necesita una implementación presentacional pequeña, sin contexto global ni acceso a Firebase, para mantenerla desacoplada y fácil de probar.

## Goals / Non-Goals

**Goals**

- Crear un componente presentacional tipado y accesible.
- Manejar propiedades incompletas o nulas sin lanzar excepciones.
- Diferenciar visualmente clientes activos e inactivos.
- Notificar al consumidor cuando se solicita ver el detalle.

**Non-Goals**

- Consultar clientes desde Firebase.
- Abrir o implementar el modal de detalle.
- Gestionar edición, eliminación o paginación.

## Decisions

### Contrato local y tolerante a datos parciales

El componente aceptará `cliente` opcional y nullable con campos opcionales `id`, `nombre`, `email`, `fotoUrl` y `activo`. Los fallbacks visuales serán explícitos para evitar renderizados vacíos o errores.

### Componente puramente presentacional

Toda la información llegará mediante props. `onVerDetalle` será opcional y recibirá el ID normalizado, permitiendo que la vista contenedora decida la navegación o apertura del modal.

### Accesibilidad

El contenedor usará `role="listitem"`, la imagen tendrá texto alternativo y el botón tendrá nombre accesible “Ver detalle”.

### Estrategia de testing

Se usará React Testing Library para consultar roles y texto, y user-event para verificar el callback. No se usarán snapshots ni mocks de Firebase. Se triangularán datos completos, incompletos, activos e inactivos.

## Risks / Trade-offs

- El contrato puede requerir adaptación cuando se conecte a un modelo SaaS definitivo; mantenerlo local reduce acoplamiento prematuro.
- Un ID vacío en datos incompletos será entregado como cadena vacía si se pulsa la acción; esto conserva una ejecución segura y permite al contenedor decidir cómo tratarlo.

## Migration Plan

1. Sustituir el placeholder por el componente.
2. Reemplazar el test documental actual por pruebas funcionales.
3. Ejecutar cobertura dirigida y confirmar 100%.

## Open Questions

<!-- Ninguna -->
