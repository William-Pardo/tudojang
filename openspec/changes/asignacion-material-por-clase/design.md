# Design: Asignación de materiales a clases (Camino A)

## Technical Approach

Confirmado leyendo el código real: el Cloud Function `publishAsignacion` (`functions/academico/asignaciones.js:83-95`) **ya escribe `jornadaId` en el documento Firestore** (`payload = { ...asignacion, jornadaId, ... }`). El gap NO es de datos en runtime — es que el tipo `AsignacionAcademica` no lo declara, y el cliente publica un recurso→una jornada por acción, sin bulk ni filtro por tag. La UI (`AsignacionesView.tsx`) además genera jornadas falsas (`ProgramaAcademicoAsignacion`) en vez de usar `JornadaInstruccion` reales. El diseño formaliza el campo, agrega un callable batch, y reemplaza el modelo de jornada falso por el real.

## Architecture Decisions

| Decisión | Elegido | Alternativa descartada | Por qué |
|---|---|---|---|
| `jornadaId` singular por doc de `AsignacionAcademica` | Un doc = una jornada (como ya hace el backend hoy) | Campo `jornadaIds[]` en un solo doc | El backend ya crea un doc por jornada; batch = N×M docs, no un doc con array. Mantiene las reglas de Firestore actuales (tenant+rol, sin nada nuevo) y las queries `where('jornadaId', '==', ...)` simples |
| Batch resuelto server-side en un solo callable | Nuevo callable `publishAsignacionesBatch` que itera N×M internamente | Cliente hace N×M llamadas individuales a `publishAsignacion` | Evita condiciones de carrera parciales y N cold-starts de function; una sola pasada de validación/dedup es la fuente de verdad |
| Reusar `crearClavePublicacionAsignacion` para dedup | Extender la función existente (`AsignacionesView.tsx:233`) para batch | Inventar una clave de dedup nueva | Ya codifica recursoId+jornadaId+destinatario+momento+criterio — misma semántica que necesita el batch; evita dos nociones de "duplicado" |
| Retirar `ProgramaAcademicoAsignacion`/`generarJornadasLocalesPrograma` | Usar `JornadaInstruccion` real vía `jornadaService` | Mantener el modelo falso y agregar multi-select encima | El modelo falso topea en 60 previews y sus IDs no corresponden a docs persistidos — seleccionar sobre IDs falsos crearía asignaciones apuntando a jornadas inexistentes |

## Data Flow

```
UI: selecciona N recursos (con filtro tag) + M jornadas reales
        │
        ▼
publicarLote() — arma combos, descarta duplicados conocidos (UX, best-effort)
        │
        ▼
asignacionService.publicarAsignacionesBatch(request)
        │
        ▼
Cloud Function publishAsignacionesBatch
    ├── valida tenant/rol (igual que hoy)
    ├── por combo: valida recurso aprobado + jornada existe
    ├── dedup real: query por recursoId+jornadaId antes de escribir
    └── firestore.batch().set(...) por combo no-duplicado
        │
        ▼
Response { created: string[], skipped: [{recursoId, jornadaId, reason}] }
        │
        ▼
UI muestra resumen (creadas vs. saltadas)
```

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `models/academico/asignacion.ts` | Modificar | Agregar `jornadaId?: string` a `AsignacionAcademica` (formaliza lo que el backend ya escribe) |
| `models/academico/asignacionService.types.ts` | Modificar | Agregar `PublicarAsignacionesBatchRequest`/`Response` |
| `servicios/academico/asignacionService.ts` | Modificar | Nueva `publicarAsignacionesBatch()`; `publicarAsignacion()` singular queda intacta |
| `functions/academico/asignaciones.js` | Modificar | Nueva `crearServicioPublishAsignacionesBatch` |
| `functions/index.js` | Modificar | Registrar el nuevo callable |
| `vistas/admin/AsignacionesView.tsx` | Modificar | Retirar modelo de jornada falso; multi-select recurso+jornada; filtro por tag; `publicarLote()` |
| `firestore.rules` | Sin cambio | La regla `tenants/{tenantId}/asignaciones/{id}` (tenant+`isInstructor()`) ya cubre `jornadaId` como campo — verificado, no es segmento de path |

## Interfaces / Contracts

```typescript
export interface PublicarAsignacionesBatchRequest {
  tenantId: string;
  recursoIds: string[];
  jornadaIds: string[];
  asignacionBase: Omit<AsignacionAcademica, 'id' | 'recursoId' | 'jornadaId'>;
}

export interface PublicarAsignacionesBatchResponse {
  ok: boolean;
  created: string[];
  skipped: Array<{ recursoId: string; jornadaId: string; reason: 'duplicado' | 'recurso_no_aprobado' | 'jornada_no_encontrada' }>;
}
```

## Testing Strategy

| Capa | Qué testear | Enfoque |
|---|---|---|
| Unit | `publishAsignacionesBatch`: creados, saltados por duplicado, validación por combo | `functions/academico/asignaciones.test.js`, mocks de Firestore existentes |
| Unit | `publicarAsignacionesBatch()` cliente: happy path + error de red | `servicios/academico/asignacionService.test.ts` |
| Integración | Regresión: escritura multi-doc respeta reglas tenant/rol (sin cambio de reglas esperado) | `functions/test/firestore-rules.behavior.test.js` / `security.test.js` |
| Componente | Multi-select recurso+jornada, filtro por tag, `publicarLote()` | `vistas/CentroEstudios.test.tsx` |

## Migration / Rollout

No requiere migración de datos — `jornadaId` ya se persiste en runtime por el Cloud Function actual; este cambio solo formaliza el tipo y agrega la capacidad batch. Deploy backend-first (nuevo callable, aditivo) y luego frontend; `publishAsignacion`/`publicarAsignacion` singular quedan sin tocar para no romper otros consumidores.

## Open Questions

- [ ] Límite de `firestore.batch()` es 500 operaciones — confirmar que N×M realista (biblioteca de un programa × sus jornadas) no lo excede; si puede, trocear en múltiples batches.
- [ ] Verificar cómo mockea Firestore `functions/academico/asignaciones.test.js` hoy para simular `batch()` antes de implementar (no bloquea el diseño, sí la tarea de apply).
