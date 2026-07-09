# Proposal: Asignación de materiales a clases (Camino A)

## Intent

Hoy `AsignacionAcademica` no tiene `jornadaId` de primera clase — la vista de asignación (`AsignacionesView.tsx`) reimplementa un modelo paralelo de jornadas falsas y solo permite publicar **un material por acción por clase**. Backlog propio (D7/D8) ya pedía filtro por tags y asignación bulk, sin implementar. Esto hace que asignar materiales a un programa con muchas clases sea repetitivo y propenso a error.

## Scope

### In Scope
- Agregar `jornadaId`/`jornadaIds[]` real a `AsignacionAcademica` (dual-write, sin tocar semántica de `destinatario` grupo/grado/estudiante).
- Eliminar el modelo paralelo `ProgramaAcademicoAsignacion` en `AsignacionesView.tsx`; consumir `JornadaInstruccion` real vía `jornadaService.ts`.
- Endpoint/variante batch en `asignacionService.ts` para publicar N materiales × M clases en una operación.
- UI de multi-select (materiales × clases) con filtro por tag (resuelve D7 + D8).
- Firestore rules + tests para el campo nuevo.

### Out of Scope
- Herencia automática por unidad temática, taxonomía formal de tags, motor de override (Camino B — decisión ya registrada, pospuesta).
- Cambios a la semántica de `destinatario` para asignaciones no ligadas a jornada (individuales a estudiante).

## Approach

Migración incremental (Approach 1 de exploration.md): campo nuevo coexiste con el modelo actual, sin reemplazar `destinatario`. Auditar usos existentes de `destinatario` antes de escribir el campo nuevo.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `models/academico/asignacion.ts` | Modified | Agrega `jornadaId`/`jornadaIds[]` |
| `models/academico/asignacionService.types.ts` | Modified | Soporte multi-recurso/multi-jornada en request |
| `servicios/academico/asignacionService.ts` | Modified | Endpoint/variante batch |
| `vistas/admin/AsignacionesView.tsx` | Modified | Elimina modelo paralelo; UI multi-select + filtro tag |
| `servicios/academico/jornadaService.ts` | Modified | Expone listado real de jornadas de programa |
| `firestore.rules` | Modified | Reglas para campo nuevo |

## Impact en Tests

- **Cobertura actual**: `functions/test/firestore-rules.security.test.js`, `firestore-rules.behavior.test.js`, `vistas/CentroEstudios.test.tsx` cubren el modelo existente; no hay tests de `asignacionService.ts` para flujo batch (no existe aún).
- **Cobertura esperada**: tests nuevos para dual-write de `jornadaId`, batch publish, y reglas de seguridad del campo — TDD estricto (`strict_tdd: true`), RED→GREEN→REFACTOR por tarea.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ambigüedad si otro flujo ya infiere jornada de otra forma | Medium | Auditar todos los usos de `destinatario`/`jornadaId` antes de escribir |
| Rediseño de UI (multi-select) no es cosmético | Medium | Prototipar interacción antes de implementar |
| Paginación de jornadas reales distinta al modelo fake (60 preview) | Low | Validar con datos reales de un programa grande |

## Rollback Plan

Campo `jornadaId`/`jornadaIds[]` es aditivo — revertir = dejar de escribirlo/leerlo (feature flag o revert de commit), sin migración destructiva de datos existentes.

## Dependencies

Ninguna externa. Prerrequisito interno para evaluar Camino B más adelante.

## Success Criteria

- [ ] `AsignacionAcademica` persiste `jornadaId`/`jornadaIds[]` real
- [ ] `AsignacionesView.tsx` ya no usa `ProgramaAcademicoAsignacion` (modelo fake eliminado)
- [ ] Un usuario puede publicar N materiales a M clases en una sola acción, filtrando por tag
- [ ] Firestore rules + tests nuevos en verde
