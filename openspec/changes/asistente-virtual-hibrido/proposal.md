# Proposal: Asistente virtual híbrido

## Intent

Ofrecer soporte útil y económico sin exponer credenciales. El asistente responderá desde un catálogo verificable, usará IA solo ante baja confianza y escalará de forma segura.

## Scope

### In Scope
- Inventariar todas las funciones, rutas, acciones y permisos de los roles actuales.
- Crear un catálogo único y versionado, extensible a Estudiante/Tutor, con intención, módulo, roles, aliases, pasos, ruta, sensibilidad y escalamiento.
- Documentar cómo validar, agregar y mantener entradas.
- Aplicar matching determinista con umbral, aclaración y prioridad a la pregunta actual.
- Mover IA a Firebase autenticado; enviar fragmentos relevantes y devolver fuente, cuota y escalamiento tipados.
- Calcular el presupuesto desde fallback medido, tokens máximos y precio; aplicar límites transaccionales por usuario/tenant, techo global, alertas y degradación.
- Escalar por ticket interno y WhatsApp, con identidad derivada de Auth, datos mínimos y autorización Master.

### Out of Scope
- RAG/vector database, acciones automáticas y rediseño general.
- Fijar una cuota numérica antes de medir demanda, costo por consulta y calidad.

## Capabilities

### New Capabilities
- `catalogo-soporte`: inventario por rol y guía de extensión.
- `fallback-ia-controlado`: IA server-side, presupuesto, cuotas y respuesta trazable.
- `escalamiento-soporte`: ticket interno y WhatsApp con privacidad y autorización.

### Modified Capabilities
- None; las especificaciones actuales no cubren el asistente.

## Approach

Implementar en dos cortes: catálogo local canónico; después, frontera Firebase para IA y escalamiento. Rotar credenciales y asegurar soporte antes de habilitarla.

## Impact

| Area | Impact |
|---|---|
| `components/AsistenteVirtual.tsx`, `servicios/soporte*.ts`, `tipos.ts` | Modified |
| `functions/`, `firebase.json`, `firestore.rules` | New/Modified |
| `vistas/{Administracion,Estudiantes,Configuracion}.tsx`, `App.tsx` | Inventory source |
| Tests | Matching, roles, catálogo, cuotas, Auth/App Check, tickets, WhatsApp, redacción y errores |

Evidencia actual: `soporteService` 6/6; `AsistenteVirtual` 14/15 por timeout. Objetivo: 15/15 estable, 100% de ramas críticas de autorización/cuota y ≥90% de líneas en módulos nuevos.

## Risks

| Risk | Mitigation |
|---|---|
| Deriva o respuestas incorrectas | Catálogo único revisado contra rutas y roles |
| Sobrecosto o abuso | Presupuesto medido, límites, alertas y fallback sin IA |
| Exposición de datos | Redacción, retención, claims y reglas verificadas |

## Rollback Plan

Desactivar IA y WhatsApp, conservar catálogo local y tickets autorizados; revertir el endpoint sin perder el catálogo.

## Dependencies

- Rotación de credenciales, Secret Manager, Auth/App Check y reglas Firestore desplegables.

## Success Criteria

- [ ] Todas las funciones y roles están inventariados y tienen proceso documentado de ampliación.
- [ ] Ningún secreto ni cuota depende del navegador.
- [ ] El presupuesto se justifica con métricas y el servicio degrada sin interrumpir soporte.
- [ ] Ticket y WhatsApp funcionan con privacidad, tenant y privilegios verificados.
