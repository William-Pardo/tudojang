# Exploration: grupos de publicación (batch publish flexibility)

## Current State

`AsignacionesView.tsx` is rendered exclusively as `<AsignacionesView embedded ... />` from `vistas/CentroEstudios.tsx:170-175` — the standalone (`embedded=false`) render branch (`AsignacionesView.tsx:1840-2076`, including a `tipoDestinatario` `<select>` at lines 1925-1934) is **dead code in production**: no route mounts `AsignacionesView` without `embedded`. This is a stronger finding than the prior change's verify-report assumed — that report treated the 1925-1934 select as "fully rendered and functional," which is true only in isolated tests/standalone use, not in the live app. **Practical consequence: today, inside Centro de Estudios, there is no reachable UI to change `tipoDestinatario` away from its `'grupo'` default at all.**

Inside the `embedded` branch, one single `<article ref={bloqueJornadaRef}>` (`AsignacionesView.tsx:1188-1469`) renders, top to bottom: the Programa picker/editor (`1189-1254`), the "Clase activa" individual-publish/edit sub-flow (`1255-1401`, backs `editarAsignacionPublicada`/`publicar()`), and immediately below it the **"Publicación en lote"** batch section (`1403-1468`, backs `publicarLote()`, line `1011`). All of these consume **the same top-level `React.useState` variables**, declared once at the top of the component: `tipoDestinatario` (380), `grupo` (381), `grados` (382), `fechaApertura`/`fechaCierre` (383-384), `momento` (385), `criterio` (386). This is confirmed shared state, not per-section — the batch section's `publicarLote()` (line 1030) calls `crearDestinatario(tipoDestinatario, grupo || 'Infantil', grados)`, the exact same call the individual `publicar()` makes (line 762), from the exact same variables. This is bug #1 from the brief, confirmed structurally.

Batch-specific state (not shared, but flat/single instead of per-group): `recursosLoteIds: Set<string>` (526), `jornadasLoteIds: Set<string>` (527), `filtroTagLote: string` (528, a free-text filter over `recurso.ficha?.tags`, `recursosFiltradosPorTag` memo at 562-568). `publicarLote()` (1011-1100) does: resolve real jornada ids for each selected preview id (`asegurarJornadaParaPreview`), build ONE `destinatario` from the shared state, call `publicarAsignacionesBatchFn` **once** with `recursoIds: Array.from(recursosLoteIds)` and `jornadaIds: jornadaIdsReales` (the full Cartesian product is computed server-side), then reconcile the response into local `asignacionesPublicadas` state.

Client service (`servicios/academico/asignacionService.ts:290-309`, `publicarAsignacionesBatch`) is a thin `httpsCallable` wrapper around Cloud Function `publishAsignacionesBatch` — no business logic, just request passthrough + a non-Firebase-configured demo fallback.

Cloud Function (`functions/academico/asignaciones.js`, `crearServicioPublishAsignacionesBatch`, lines 104-181): takes `{ tenantId, recursoIds: string[], jornadaIds: string[], asignacionBase }`, does a **double loop** `for recursoId of recursoIds { for jornadaId of jornadaIds { ... } }`, and for **each** (recursoId, jornadaId) pair it already fetches the resource document fresh from Firestore (line 128-133: `recurso = await obtenerDocumento(tenant.collection('recursos').doc(recursoId), ...)`) to validate it's `aprobado` before writing. The write (line 159-170) sets `titulo: asignacionBase.titulo || recurso.nombre` — this is the exact bug #2 site. Since `recurso` here is already the full Firestore document (which carries `tituloVisible` once change 1's `updateFicha` has set it), **the fix requires zero client-side wiring** — it's a one-line server-side change: `titulo: asignacionBase.titulo || recurso.tituloVisible || recurso.nombre`. The client already passes `titulo: ''` (falsy) as `asignacionBase.titulo` (`AsignacionesView.tsx:1037`), so the existing `||` chain resolves correctly with no client changes needed. (Side note, out of the stated scope but directly analogous: the *individual*-publish path, `publicar()` at line 728, has the identical bug — `setTituloPersonalizado(recursoSeleccionado.nombre)` at line 723 never considers `tituloVisible` either. Worth a one-line fix in the same pass since it's the same root cause, but flagging as optional/adjacent, not required.)

`ProgramaAcademico` (persisted model, `models/academico/programa.ts:19-29`) has no `tags` field — confirmed, zero matches for `tagsAcademicos` anywhere and no `tags` property on the interface. The *local-only* UI type `ProgramaAcademicoAsignacion` (`AsignacionesView.tsx:194-208`) **does** have `tags: string[]`, and the create/edit-programa form (`programaEditando.tags`) blocks creation without at least one tag (`programaFormularioValido`, line 592: `programaEditando.tags.length > 0`). But `guardarPrograma()` (847-911) calls `createPrograma({ tenantId, nombre, descripcion, unidades })` (`servicios/academico/programaService.ts:59-73`, `CrearProgramaInput` has no `tags` field) — **tags are silently dropped** the moment a programa is actually persisted; they only survive in the client's local `programas` array for the current session. `programaRepository.guardarPrograma` (`servicios/academico/programaRepository.ts:56-64`) does a generic `setDoc(ref, programa, { merge: true })` with no field allowlist, so adding `tags` to the model + passing it through `createPrograma` is a fully additive, low-risk persistence change.

The standardized tag vocabulary (`TAGS_ACADEMICOS_ESTANDAR`, `AsignacionesView.tsx:135-168`) is shared UI between `ficha.tags` (resource tags) and `programaEditando.tags` (programa tags) — both are plain `string[]`, so a case-insensitive intersection is a valid, low-effort match strategy regardless of whether tags came from the standardized selector or free text (`BibliotecaView.tsx` uses free-text `tagsTexto` for `ficha.tags`, not the standardized selector — so exact-string matching should be case-insensitive/trimmed, not exact-vocabulary-only).

The "Match alto" popup and `tabRecursosAprobados`/"Reutilizar" — confirmed fully gone (grepped whole tree excluding `openspec/`, zero hits outside the archived verify-report itself). No cleanup needed here; change 1 already did it.

`publicarAsignacionesBatch`/`PublicarAsignacionesBatchRequest`/`PublicarAsignacionesBatchResponse` and the `publishAsignacionesBatch` Cloud Function are used **only** by this batch-publish flow (grepped: 13 hits, all either this flow's own files or unrelated `openspec/changes/*` docs) — safe, contained blast radius for either approach below.

## Affected Areas

- `vistas/admin/AsignacionesView.tsx` — replace flat `recursosLoteIds`/`jornadasLoteIds`/`filtroTagLote` + shared `tipoDestinatario`/`grupo`/`grados`/`momento`/`criterio`/`fechaApertura`/`fechaCierre` (as consumed by the batch section only) with an array of per-group state; rewrite `publicarLote()`; rework the "Publicación en lote" JSX (`1403-1468`) into a repeatable group block + "+ Agregar grupo" + one "Publicar todo"; thread `recursoIdsParaLote` bridge into a specific group (open question, see Risks); replace `filtroTagLote` input with `programaSeleccionado.tags`-based match/priority over `recursosDisponibles`.
- `functions/academico/asignaciones.js` — one-line `tituloVisible` fallback fix (both approaches); if Approach B is chosen, also restructure `crearServicioPublishAsignacionesBatch` to accept/loop over `grupos[]`.
- `servicios/academico/asignacionService.ts` — no change for Approach A (call `publicarAsignacionesBatchFn` N times from the view); request/response type change + call-site change for Approach B.
- `models/academico/asignacionService.types.ts` — unchanged for Approach A; `PublicarAsignacionesBatchRequest` reshaped for Approach B.
- `models/academico/programa.ts` — add `tags?: string[]` to `ProgramaAcademico`.
- `servicios/academico/programaService.ts` — thread `tags` through `CrearProgramaInput`/`createPrograma`.
- `vistas/admin/AsignacionesView.tsx:429-450` — programa-rehydration `useEffect` also needs `tags: real.tags ?? []` when mapping persisted `ProgramaAcademico` back into local `ProgramaAcademicoAsignacion`.
- Tests: `vistas/admin/AsignacionesView.test.tsx` (currently asserts `publicarAsignacionesBatchFn` called exactly once — needs new multi-group assertions), `functions/academico/asignaciones.test.js` (tituloVisible case; multi-group cases only if Approach B), `servicios/academico/asignacionService.test.ts`, `servicios/academico/programaService.test.ts` (tags threading).

## Approaches (batch publish shape)

1. **N sequential/parallel client-side calls to the existing (unmodified, except tituloVisible) `crearServicioPublishAsignacionesBatch`** — "Publicar todo" loops over `gruposPublicacion`, calling `publicarAsignacionesBatchFn` once per group with that group's own `recursoIds`/`jornadaIds`/`asignacionBase`, then concatenates `created`/`skipped` client-side for one combined result.
   - Pros: Zero Cloud Function contract changes (beyond the already-required one-line `tituloVisible` fix); reuses the fully-tested, already-audited per-pair validation/dedup/batch-commit logic untouched; existing `functions/academico/asignaciones.test.js` and `asignacionService.test.ts` suites stay valid as-is; the existing test pattern (`toHaveBeenCalledTimes(1)`) extends naturally to `toHaveBeenCalledTimes(N)` for N groups; matches the file's existing style of client-orchestrated multi-step flows (e.g. `publicarLote` already resolves jornada ids in a client-side loop before calling the batch function).
   - Cons: No atomicity across groups (a later group's call can fail after an earlier group's already committed) — but this is not a new risk: the *current* single-batch call already has no cross-pair atomicity (each resource/jornada pair independently validates and can be `skipped`; only the pairs that pass get committed together in one `batch.commit()`). N round-trips instead of 1 — immaterial given realistic group counts (a handful per publish action).
   - Effort: **Low**.

2. **One extended multi-group request, Cloud Function restructured to loop over `grupos[]`** — change `PublicarAsignacionesBatchRequest` to `{ tenantId, grupos: Array<{ recursoIds, jornadaIds, asignacionBase }> }`; `crearServicioPublishAsignacionesBatch` gains a third nesting level and commits **one** shared `firestore.batch()` across every group.
   - Pros: True atomicity across the entire "Publicar todo" action; a single round-trip.
   - Cons: New request/response TypeScript contract (`asignacionService.types.ts`), rewritten Cloud Function loop needing new test coverage for nested-group scenarios (partial skip within one group, cross-group dedup, etc.), new client call-site — larger blast radius for a feature (group-level UI convenience) that doesn't functionally need cross-group atomicity; also compounds Firestore's 500-writes-per-batch ceiling risk since more groups now share one commit instead of each being independently batched.
   - Effort: **Medium-High**.

## Recommendation

**Approach 1 (N calls to the unmodified batch function).** The "grupos de publicación" concept is a client-side UI convenience for expressing several independent publish intents in one action — it does not need, and the current design never assumed, cross-pair atomicity (the existing single-call batch already tolerates partial per-pair failure via `skipped`). Reusing the untouched, already-verified Cloud Function keeps this change scoped to the view layer plus the one-line `tituloVisible` fix, minimizes new test surface right after a change that was just archived with a `PASS WITH WARNINGS` verdict, and follows the file's existing pattern of client-orchestrated sequential steps.

## Data Shape (proposed, for sdd-design to finalize)

```ts
interface GrupoPublicacion {
  id: string; // stable client id (e.g. `grupo-${index}` or a counter), for React keys + "Agregar grupo"/remove
  recursoIds: Set<string>;
  jornadaIds: Set<string>;
  tipoDestinatario: DestinatarioAsignacion['tipo'];
  grupo: string;   // grupo objetivo text, or comma-separated estudiante ids when tipoDestinatario === 'estudiante'
  grados: string;  // only read when tipoDestinatario === 'grado'
  momento: MomentoAsignacion;
  criterio: 'estudio' | 'repaso' | 'refuerzo' | 'evaluacion' | 'quiz';
  fechaApertura: string;
  fechaCierre: string;
}
// Replaces: recursosLoteIds, jornadasLoteIds, filtroTagLote (as batch-section state).
// Does NOT replace the top-level tipoDestinatario/grupo/grados/momento/criterio/fechaApertura/fechaCierre —
// those remain as-is, still owned by the individual-publish/"Clase activa" edit sub-flow (publicar()/editarAsignacionPublicada()).
```

`ProgramaAcademico` addition:
```ts
export interface ProgramaAcademico {
  // ...unchanged
  tags?: string[]; // NEW — mirrors ProgramaAcademicoAsignacion.tags, now persisted
}
```

## Risks

- **Open UI question**: `recursoIdsParaLote` (the bridge from `BibliotecaView`'s "Recursos aprobados" grid) currently unions into one flat `recursosLoteIds` Set. With N groups, it must union into a specific group — simplest options are "always the last/most-recently-added group" or an explicit "grupo activo" pointer. Not resolved here; needs a decision in sdd-design since it affects the group-add/remove UX.
- Tag-based material filter: hard-filtering `recursosDisponibles` to only tags that intersect `programaSeleccionado.tags` risks hiding valid materials whose tags don't happen to overlap (classification tags are free text in `BibliotecaView.tsx`, not guaranteed to align with programa tags). Recommend "prioritize/sort matches first, don't hard-hide" per the brief's own "show/prioritize" wording — needs explicit confirmation in the proposal/design, not just inferred.
- `programaSeleccionado.tags` can be `undefined` for programs persisted before this change (no backfill planned, consistent with change 1's precedent for `tituloVisible`) — matching logic must treat missing tags as "no match signal," not throw or hide everything.
- The dead `embedded=false` branch (`AsignacionesView.tsx:1840-2076`) will keep sharing `tipoDestinatario`/etc. with the new per-group state's *initial values* only if the design pulls defaults from the same source — worth explicitly deciding whether that branch is touched at all (recommend: no, out of scope, it's unreachable in production and none of the three planned changes in this sequence target it for deletion).
- `npx cypress run` is still broken on this machine per the just-completed change's verify-report — E2E coverage for this change will again rely on static/manual review only, a pre-existing environment gap, not something this change can fix.

## Ready for Proposal

**Yes.** Current state, exact file/line locations (re-verified fresh, not reused from the prior change's now-possibly-stale line numbers), the two batch-shape approaches with a clear recommendation, the `tituloVisible` server-only fix (confirmed zero client wiring needed), and the `ProgramaAcademico.tags` persistence gap are all confirmed against live code. The one open item (which group absorbs the `recursoIdsParaLote` bridge) should be decided explicitly in sdd-propose or sdd-design rather than left implicit.
