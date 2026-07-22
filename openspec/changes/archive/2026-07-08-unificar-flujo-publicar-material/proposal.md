# Proposal: Unificar flujo de publicar material

## Intent

`AsignacionesView.tsx` has two publishing flows: "Clase activa" (vestigial — only submit is edit-mode-only, unreachable per `AsignacionesView.test.tsx:61-69`) and "Publicación en lote" (`GrupoPublicacion[]`, the real path). Replace both with ONE 3-step modal (Material → Configurar → Grados) per class, per the validated Figma Make mockup, making `tema`, edit, and delete real (currently unpersisted/stub).

## Scope

**In**: delete "Clase activa" body (1374-1520) + "Publicación en lote" (1522-1694) + dead Editar block (1928-1963); new StepBar/Step1/Step2/Step3 modal reusing existing CFs; `AssignmentRow` "Editar" button, dirty-gated `Asignar` (snapshot+serialize, mirrors `serializarProgramaParaCambios`); Step1 excludes materials already assigned to the active class; add `JornadaInstruccion.tema?: string` + persistence, inline-editable from the class pill; real `eliminarAsignacion` (`deleteDoc`) and `actualizarAsignacion` (route through `publicarAsignacionFn` upsert, same `id`); real `listarAsignacionesPorTenant` hydration so "Materiales asignados" survives reload; tag match-count badge (extend `coincideTagsConPrograma`).

**Out**: 5th bullet color for cancelada/reprogramada (needs `estado` threaded through preview mapping); per-category tag chip coloring (the grouping already exists — `TAGS_ACADEMICOS_ESTANDAR`, 8 groups — reuse flat matching, defer color-by-category as new visual surface); Cypress beyond unavoidable; `MisClasesView.tsx` untouched.

## Reconciliations (resolved)

- **Grados**: real `GradoTKD` (13 values) — mockup's invented "Naranja" rejected.
- **Grupo objetivo**: reuse existing `gruposObjetivo` constant — mockup's invented "Juvenil" rejected.
- **Momento/Criterio**: real `MomentoAsignacion`/inline `criterio` union already match mockup labels via `mapearCriterioAUso()` — no new enum.
- **Destinatario/grados**: `DestinatarioAsignacion.grados?` is already independent of `tipo` — no model change. Adopt mockup's split (destinatario = grupo|estudiante; grados always separate); fix `crearDestinatario()` to populate `grados` for `tipo==='grupo'` too (today only `'grado'` does).
- **Tema**: new field `tema` (matches dead `temaDiaActivo`/`programaInicial.tema` naming).

## Approach

Zero Cloud Function changes: batch CF (create) and single CF upsert (edit, same deterministic id) already fit. Dirty-check reuses the proven `programaSnapshotAlAbrir` pattern.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `vistas/admin/AsignacionesView.tsx` | Modified | Delete 2 flows, add unified modal + tema + real fetch/delete |
| `vistas/admin/AsignacionesView.test.tsx` | Modified | Substantial rewrite (1017 lines) |
| `servicios/academico/asignacionService.ts` | Modified | Real `eliminarAsignacion`/`actualizarAsignacion` |
| `models/academico/jornada.ts`, `jornadaRepository.ts` | New field | Additive `tema?: string` |
| `functions/academico/asignaciones.js` | None expected | Confirm at design |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `tema` underestimated as cosmetic | Med | Treated as new persisted field + write path |
| Test rewrite scope | High | Budgeted explicitly, not incremental |
| Cypress broken locally | High | Manual verification only |

## Rollback Plan

Revert commits; `tema` is additive/optional (no backfill); CF contracts unchanged; no Firestore migration.

## Dependencies

Adjacent unarchived `asignacion-material-por-clase` occupies related territory (no merged `academico-asignacion` spec) — note only.

## Success Criteria

- [ ] Modal is the sole entry point; no `GrupoPublicacion`/Clase-activa dead code remains
- [ ] `tema` persists across reload; Editar pre-fills, `Asignar` disabled until dirty
- [ ] Duplicate material blocked at UI for same class
- [ ] `eliminarAsignacion`/`actualizarAsignacion` write real Firestore
- [ ] `npm test -- --runInBand` passes
