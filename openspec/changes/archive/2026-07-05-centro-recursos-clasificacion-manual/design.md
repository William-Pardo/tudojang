# Design: Centro de recursos — clasificación manual real

## Technical Approach

Approach 1 on every exploration fork: extend the model additively, reuse `BibliotecaView.tsx`'s already-tested but never-rendered `disciplina`/`tipo`/`uso`/`tagsTexto` state and `guardarClasificacion`/`aprobar` handlers behind a real modal, move the "Recursos aprobados" grid + "Preparar asignación" modal verbatim from `AsignacionesView.tsx` into `BibliotecaView.tsx` (minus two deletions), and bridge the two components with a new prop/state pair that mirrors the existing `onRecursoAprobado`/`refreshTrigger` seam. No service-layer state-machine changes: `updateFicha` (→`pendiente`) and `approveRecurso` (→`aprobado`) already enforce the right guards and are already independently tested.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| `tituloVisible` placement | Top-level on `RecursoAcademico`, sibling to `nombre` | Nested in `FichaAcademica` | Mirrors `nombre`'s raw/curated pairing; `ficha` is pedagogical metadata, not identity/display |
| Classification UI | Adapt existing dead state/handlers + new modal JSX | Fresh `<ClasificarRecursoModal>` component | Existing fields already match `FichaAcademica`'s shape and are indirectly tested; only the JSX and `tituloVisible` are missing |
| Auto-classify code path | Retire `aprobarRecursoDetectado`/`construirFichaAutomatica`/`indexarArchivo` entirely | Keep as fallback | Spec hard-requires no synthetic ficha without human review; nothing else depends on them |
| "Reutilizar" tab | Delete outright | Replace with real reuse-history feature | Backing state (`asignacionesPublicadas`) is local-only, never fetched — structurally dead across reloads |
| `tituloVisible` backfill | None; lazy fallback to `nombre` | One-off migration script | Fallback is byte-identical to today's only behavior; migration would write a value equal to what it replaces |
| Cross-component bridge | New `onRecursoParaLote` callback + `recursoIdsParaLote` prop, merged via `useEffect` | Lift all state to `CentroEstudios`; React Context | Mirrors the proven `onRecursoAprobado`/`refreshTrigger` pattern already in this file; avoids a new state-sharing mechanism for one value |
| `updateFicha` signature | New 4th optional positional param `tituloVisible?: string` | Options-object param | Matches this file's existing all-positional style (`importFromDrive`, `approveRecurso`) |

## Data Flow

**Classification + approval (within `BibliotecaView.tsx`):**
```
Click archivo (borrador/unindexed)
  → abrirClasificacion(archivo): ensure indexed (importFromDrive if new)
    → setRecursoSeleccionadoId + open modalClasificacion
Edit disciplina/tipo/uso/tags/tituloVisible → "Guardar clasificación"
  → guardarClasificacion(): updateFicha(tenant, id, ficha, tituloVisible) → estado=pendiente → close modal
Click "Aprobar" (separate action, only enabled for pendiente)
  → aprobar(): approveRecurso(tenant, id, uid) → estado=aprobado → onRecursoAprobado() fires
```

**Batch-selection bridge (cross-component, new):**
```
BibliotecaView "Recursos aprobados" grid → "Preparar asignación" modal → "Asignar"
  → onRecursoParaLote?.(recursoId)                              [new callback prop]
CentroEstudios: setRecursosParaLote(prev => [...prev, id])       [new bridging state]
  → <AsignacionesView recursoIdsParaLote={recursosParaLote} .../>
AsignacionesView: useEffect unions incoming ids into recursosLoteIds Set (merge, not replace)
  → existing publicarLote/jornada-batch flow unchanged from here
```

## File Changes

| File | Action | Description |
|---|---|---|
| `models/academico/recurso.ts` | Modify | Add `tituloVisible?: string`, sibling to `nombre` |
| `servicios/academico/bibliotecaService.ts` | Modify | `updateFicha` gains 4th optional param; writes `tituloVisible` only when a non-empty string is passed (avoids clobbering on unrelated re-saves) |
| `vistas/admin/BibliotecaView.tsx` | Modify | New classification modal (state: `modalClasificacionAbierto`, `tituloVisible`); 3-way click routing (clasificar / aprobar / retirar) replacing `indexarArchivo`+`aprobarRecursoDetectado`+`construirFichaAutomatica` (deleted); absorbs "Recursos aprobados" grid + "Preparar asignación" modal from `AsignacionesView.tsx` (minus "Reutilizar" tab + "Aprobado para" toggle); new `onRecursoParaLote` callback prop |
| `vistas/admin/AsignacionesView.tsx` | Modify | Delete embedded "Recursos aprobados" JSX (lines ~1239-1443: grid, tabs, modal) and now-dead `abrirModalRecurso`/`asignarRecursoSeleccionado`/`tabRecursosAprobados`/tab-filter derivations; new `recursoIdsParaLote?: string[]` prop merged into `recursosLoteIds`; `recursosDisponibles`/`recursoId`/`tituloPersonalizado`/`tagsAsignacion`/`tipoDestinatario` and the standalone (non-embedded) render path are unaffected — still used by "Programa y publicación"'s individual-publish sub-flow |
| `vistas/CentroEstudios.tsx` | Modify | `pasosCentroEstudios` 4→3 entries; grid fractions 4→3 columns (proposed `[16fr_47fr_37fr]`, needs visual QA); new `recursosParaLote` state bridging `onRecursoParaLote`→`recursoIdsParaLote`; `pasosConEstado` step-2 derivation folds in old step-3's `recursosAprobados` condition |

## Interfaces / Contracts

```typescript
// models/academico/recurso.ts
interface RecursoAcademico {
  // ...unchanged
  nombre: string;
  tituloVisible?: string;   // NEW — curated display title, set at classification time
}

// servicios/academico/bibliotecaService.ts
updateFicha(
  tenantId: string, recursoId: string, ficha: FichaAcademica,
  tituloVisible?: string,               // NEW — persisted alongside ficha when non-empty
): Promise<void>;

// vistas/admin/BibliotecaView.tsx
onRecursoParaLote?: (recursoId: string) => void;   // NEW

// vistas/admin/AsignacionesView.tsx
recursoIdsParaLote?: string[];                     // NEW — unioned into recursosLoteIds
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `updateFicha` persists `tituloVisible` (new + existing guard cases untouched) | Jest, existing mock-storage pattern in `bibliotecaService.test.ts` |
| Integration | Modal opens on `borrador` click, saves to `pendiente`, separate approve to `aprobado`; moved grid renders in `BibliotecaView`; deleted grid/tab/toggle absent from `AsignacionesView`; `recursoIdsParaLote` merges into batch | Testing Library + prop-injected service mocks (`Pick<...>` doubles), same DI pattern already used per `BibliotecaViewProps`/`AsignacionesViewProps` |
| Integration | 3-step stepper renders, step-2 status reflects combined borrador/pendiente/aprobado counts | Testing Library on `CentroEstudios.tsx` |
| E2E | Full admin flow: connect Drive → classify → approve → select for lote → publish | Cypress; `modulo-estudio-cierre-jornada.cy.ts` and `onboarding.cy.ts` (already mid-edit per git status) need selector updates for the 3-step flow |

## Migration / Rollout

No migration required. `tituloVisible` is optional and additive; existing `aprobado` resources render with `nombre` as fallback, matching current behavior exactly.

## Open Questions

- [ ] Confirm no other embedded-path consumer of `recursoSeleccionado`/`recursoId`/`abrirModalRecurso` exists in `AsignacionesView.tsx` before deleting them (appears scoped to the removed block, not exhaustively traced line-by-line)
- [ ] Grid column fractions (`[16fr_47fr_37fr]`) are a starting proposal — needs visual QA in-browser, not derived from a spec
