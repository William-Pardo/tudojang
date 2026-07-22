# Verification Report

**Change**: grupos-publicacion-material
**Project**: tudojang
**Date**: 2026-07-06
**Verified by**: sdd-verify (fresh execution — implementer self-reports NOT trusted)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

All tasks in `tasks.md` show `[x]`. (Note: the orchestrator briefing said "18 tasks"; the file actually contains 22 — 1.1-1.4, 2.1-2.4, 3.1-3.4, 4.1-4.5, 5.1-5.3, 6.1-6.2.)

---

## Build & Tests Execution (fresh, this session)

**Build** (`npm run build`): PASS — exit 0, `✓ built in 1m 9s`. Only the pre-existing chunk-size (>500 kB) warning.

**Full Jest suite** (`npm test -- --runInBand`, output read from log file, exit code 1):

```
Test Suites: 6 failed, 105 passed, 111 total
Tests:       25 failed, 3 skipped, 866 passed, 894 total
Time:        230.381 s
```

Failing suites — byte-for-byte the SAME six documented as pre-existing in the previous change's verify-report (`archive/2026-07-05-centro-recursos-clasificacion-manual`, which reported the identical 6 suites / 25 failed tests on 857/885):

- `components/ModalImportacionMasiva.test.tsx`
- `App.routing.test.ts`
- `components/FilaEstudiante.test.tsx`
- `components/ModalRegistrarPago.test.tsx`
- `servicios/pagosApi.complementaria.test.ts`
- `components/academico/ProgresoResumenCard.test.tsx`

Delta vs. prior baseline: +9 tests (885 → 894), all passing; failed count unchanged at 25. **No new failures introduced by this change.**

All change-relevant suites PASSED inside the full run: `vistas/admin/AsignacionesView.test.tsx`, `servicios/academico/programaService.test.ts`, `vistas/CentroEstudios.test.tsx`, `servicios/academico/bibliotecaService.test.ts`, `vistas/admin/BibliotecaView.test.tsx`, `servicios/academico/programaRepository.test.ts`, `components/academico/MaterialPreviewModal.test.tsx`.

**Functions suite** (`node --test functions/academico/asignaciones.test.js` — executed explicitly because it uses `node:test` and root `jest.config.js` ignores `functions/`, so a Jest run silently never touches it):

```
tests 8 / pass 8 / fail 0   (duration 363 ms)
```

Includes both server-fallback tests:
- `publishAsignacionesBatch usa tituloVisible del recurso, priorizado sobre nombre, cuando asignacionBase no trae titulo propio` — PASS
- `publishAsignacionesBatch usa el nombre de cada recurso como titulo cuando asignacionBase no trae uno propio` — PASS

**Coverage**: `coverage_threshold: 0` in `openspec/config.yaml` — trivially satisfied by any run; dedicated coverage run skipped (a 0% threshold gates nothing).

---

## Spec Compliance Matrix

Statuses derive from THIS session's execution results, not implementer claims.

### Delta: academico-programa

| Requirement | Scenario / clause | Test evidence | Result |
|---|---|---|---|
| Persistencia de tags del programa | Tags persisten tras recargar | `programaService.test.ts > crea programa con tags cuando se proveen y los conserva tal cual` (PASS); `programaRepository.guardarPrograma` passes whole object via `setDoc(..., {merge:true})`, `listarProgramasPorTenant` spreads doc data back | ⚠️ PARTIAL — service/repository layer proven; the VIEW flow drops tags end-to-end (see WARNING 1) |
| Persistencia de tags del programa | AND: programa previo sin tags = "sin tags", sin error/backfill | `programaService.test.ts > crea programa sin tags cuando no se proveen, sin romper` (PASS); `recursosPriorizadosPorTag` treats `undefined` as `[]` | ✅ COMPLIANT |
| Publicación en grupos independientes | Agregar un segundo grupo con destinatario distinto | `AsignacionesView.test.tsx > permite 2 grupos con destinatario y momento distintos, sin pisarse entre si` (PASS); `> la seccion de publicacion en lote arranca con un unico "Grupo 1" y permite agregar mas grupos` (PASS) | ✅ COMPLIANT |
| Publicación en grupos independientes | Publicar todo dispara una llamada por grupo | `AsignacionesView.test.tsx > "Publicar todo" llama publicarAsignacionesBatchFn una vez por grupo, en secuencia, y muestra resultado combinado` (PASS — asserts 2 calls, per-group payloads, per-group result text) | ✅ COMPLIANT |
| Publicación en grupos independientes | AND: fallo en un grupo no invalida los previos | `AsignacionesView.test.tsx > si falla el grupo 1, el grupo 2 igual se publica y ambos resultados quedan visibles (sin rollback)` (PASS) | ✅ COMPLIANT |
| Priorización de materiales por tags | Materiales con tag coincidente aparecen primero (case-insensitive/trim), resto visible | `AsignacionesView.test.tsx > prioriza en la lista de materiales los que coinciden (case-insensitive/trim) con los tags del programa, sin ocultar el resto` (PASS — uses `' Patada Frontal '` vs `patada frontal`); `> mantiene el orden por defecto sin romper cuando ningun material coincide` (PASS) | ✅ COMPLIANT |
| Priorización de materiales por tags | AND: `tags` undefined/vacío ⇒ orden por defecto, sin error | Structural only: `AsignacionesView.tsx:627-628` (`tagsPrograma.length === 0 → return recursosDisponibles`). No test renders a programa WITHOUT tags (the seed always has them); the passing "no match" test exercises non-intersection, not absence | ⚠️ PARTIAL |
| Publicación de material unificada (MODIFIED) | Grupos múltiples no cuentan como un segundo flujo | `AsignacionesView.test.tsx > en modo embebido el unico flujo para crear una publicacion es Publicar todo` (PASS — asserts no individual button, no "Publicar en lote", single "Publicar todo"); multi-group tests render groups as fieldsets inside the same single section | ✅ COMPLIANT (note: test's GIVEN uses 1 group, not the literal 3; entry-point uniqueness is group-count-independent) |

### Delta: academico-biblioteca

| Requirement | Scenario / clause | Test evidence | Result |
|---|---|---|---|
| Título visible curado por recurso (MODIFIED) | El título visible se persiste al clasificar | `bibliotecaService.test.ts > updateFicha persiste tituloVisible cuando se pasa un valor no vacio`, `> updateFicha conserva tituloVisible existente cuando se omite o va vacio`, `> updateFicha escribe tituloVisible en Firestore solo cuando va no vacio`, `> updateFicha omite la clave tituloVisible en Firestore cuando no se pasa` (all PASS in full run) | ✅ COMPLIANT |
| Título visible curado por recurso (MODIFIED) | Publicación en lote respeta tituloVisible | `functions/academico/asignaciones.test.js > publishAsignacionesBatch usa tituloVisible del recurso, priorizado sobre nombre...` — PASS via explicit `node --test` (NOT reachable via Jest). Source: `functions/academico/asignaciones.js:165` = `titulo: asignacionBase.titulo \|\| recurso.tituloVisible \|\| recurso.nombre` | ✅ COMPLIANT |
| Título visible curado por recurso (MODIFIED) | AND: recurso sin tituloVisible usa nombre, sin backfill | Same node:test file, fixture `recurso-2` without `tituloVisible` titled `Refuerzo patada frontal`; plus `> ...usa el nombre de cada recurso como titulo` — PASS | ✅ COMPLIANT |
| Selección de aprobados unificada (MODIFIED) | La selección llega al grupo activo | `AsignacionesView.test.tsx > recursoIdsParaLote con 2 grupos existentes se une solo al grupo activo (el ultimo agregado)` (PASS — asserts Grupo 2 checked, Grupo 1 untouched); `> une recursoIdsParaLote recibido por prop en el grupo activo, sin reemplazar la seleccion manual` (PASS); `> ya no mantiene un grid propio de Recursos aprobados` (PASS) | ✅ COMPLIANT |

**Compliance summary**: 7/8 scenarios fully COMPLIANT, 1 PARTIAL ("Tags persisten tras recargar"), plus 1 PARTIAL AND-clause (tags undefined untested) and 1 requirement-text gap (individual-flow tituloVisible, no scenario attached — see WARNING 2).

---

## Correctness (Static — Structural Evidence)

| Claim (from implementer batches) | Status | Evidence |
|---|---|---|
| `ProgramaAcademico.tags?: string[]` | ✅ Implemented | `models/academico/programa.ts:35` with docstring |
| `tags` threaded through `createPrograma()` | ✅ Implemented | `servicios/academico/programaService.ts:15` (`CrearProgramaInput.tags?`), `:73` (`...(input.tags ? { tags: input.tags } : {})`) |
| `guardarPrograma` needs no change | ✅ Confirmed | `servicios/academico/programaRepository.ts:63` — `setDoc(ref, programa, { merge: true })` passes whole object; `:76` rehydrates via spread |
| Server `tituloVisible` fallback | ✅ Implemented | `functions/academico/asignaciones.js:165`, exact insert-not-replace order per design |
| Tag-priority sort replaces hard filter | ✅ Implemented | `AsignacionesView.tsx:626-635` — stable comparator (returns 0 on ties), never hides; `filtroTagLote`/`recursosFiltradosPorTag` grep = 0 hits |
| `gruposPublicacion: GrupoPublicacion[]` per-group state | ✅ Implemented | Interface `:244-255` (matches design contract field-for-field), state `:578`, seed 1 group; `agregarGrupo` `:1051`, `quitarGrupo` `:1061` (keeps ≥1), per-group `<fieldset aria-label={`Grupo ${indexGrupo+1}`}>` `:1526-1528` |
| `grupoActivoId` + ref bridge | ✅ Implemented | `:585-589` (state+ref), `setGrupoActivoId` called ONLY in `agregarGrupo` (`:1058`) exactly per design; bridge effect `:1085-1092` merges (union, not replace) into active group only, deps `[recursoIdsParaLote]` |
| `publicarTodo()` sequential, per-group try/catch, incremental commit, no rollback | ✅ Implemented | `:1103-1213` — `for` loop, per-group validation entry, try/catch appends `{ok:false,error}` and continues, `setAsignacionesPublicadas` inside loop per success, `resultadosLote` rendered per-group `:1659-1665`; button "Publicar todo" `:1685`, old name absent from source and tests |
| Bonus bugfix `editarAsignacionPublicada` | ✅ Implemented | `:987` uses `destinatario.estudianteIds` (model field); regression test `> editar una publicacion con destinatario estudiante conserva los estudianteIds` PASS, asserts `estudianteIds: ['estudiante-9']` reaches `publicarAsignacionFn` and button enabled |
| Task 5.1 CentroEstudios.test.tsx updates | ✅ Confirmed | `vistas/CentroEstudios.test.tsx:221,232,239` reference `/^publicar todo$/i`; zero remaining "publicar en lote" button references; suite PASS |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Sequential `for` loop, one call per group (not `Promise.all`) | ✅ Yes | `:1108` |
| Per-group try/catch, incremental commit, no rollback | ✅ Yes | `:1120-1208`, comment cites the spec clause |
| "Clase activa" decoupling as structural side effect | ✅ Yes | `GrupoPublicacion` carries independent copies; top-level vars serve only `publicar()`/`editarAsignacionPublicada()`; comment `:238-243` documents it |
| `grupoActivoId` set only in `agregarGrupo()` + ref pattern | ✅ Yes | Ref code matches design snippet almost verbatim |
| Stable sort, never hide, shared across groups | ✅ Yes | One shared `recursosPriorizadosPorTag` memo used by all groups' fieldsets |
| `tituloVisible` insert-not-replace fallback | ✅ Yes | Exact expression from design |
| File Changes: `procesarPublicacionGrupo()` | ⚠️ Deviated (minor) | Function named in design's File Changes table does not exist; its logic is inlined in `publicarTodo()`'s loop body. Behaviorally equivalent |
| File Changes: "tags threading in programa create/rehydrate" (AsignacionesView) | ❌ Not followed | See WARNING 1 — neither the view's create path nor its rehydrate path threads tags |
| Cloud Function contract unchanged | ✅ Yes | Request shape untouched; only the titulo line changed |

---

## Issues Found

### CRITICAL (must fix before archive)

None.

### WARNING (should fix)

1. **Tags do not survive a real page reload through the UI flow** — the delta scenario "Tags persisten tras recargar" only holds at the service/repository layer. In `vistas/admin/AsignacionesView.tsx`:
   - Create: `guardarPrograma()` (view) calls `createPrograma({tenantId, nombre, descripcion, unidades})` at `:930-944` WITHOUT `tags: programaNormalizado.tags` — the persisted `ProgramaAcademico` never receives the UI-entered tags (which are normalized right above at `:923`).
   - Rehydrate: the mount effect `:487-494` maps loaded programas as `{...programaInicial, id, nombre, observaciones}` — ignoring `real.tags` and silently inheriting the demo seed's hardcoded `['infantil', 'iniciación', 'patada frontal']`.
   Net effect: a teacher's tags vanish on reload and tag-prioritization runs against the seed's tags. Design's File Changes table explicitly promised "tags threading in programa create/rehydrate" for this file. Two one-line fixes (`tags: programaNormalizado.tags` in the `createPrograma` input; `tags: real.tags ?? programaInicial.tags` — or `?? []` — in the rehydrate map) plus tests. Not marked CRITICAL because the requirement's stated mechanism (`createPrograma()`/`guardarPrograma()`) is itself correctly implemented and unit-proven, and the view rehydrate path has documented pre-existing gaps (horario/sede/instructor, comment `:484-486`); but this is the closest thing to a blocker here and SHOULD be fixed before archive since the delta will merge a scenario the UI cannot currently honor.

2. **Modified requirement text says "todo flujo que titule una asignación publicada (individual o en lote) MUST priorizar tituloVisible"** — only the batch flow complies. The individual flow pre-fills `tituloPersonalizado` with `recursoSeleccionado.nombre` (`:790`) and falls back to `recurso.nombre` (`:836`); `tituloVisible` appears nowhere in `AsignacionesView.tsx`. No delta scenario covers the individual case (both scenarios are classify-persist and batch), so the matrix doesn't fail — but the requirement sentence as written is broader than the implementation. Either thread `tituloVisible` into the individual pre-fill or narrow the requirement wording before `sdd-archive` merges it into the main spec.

3. **Optimistic local title after batch publish uses `nombre`, not `tituloVisible`** — `publicarTodo()` builds the local `AsignacionPublicadaLocal` with `titulo: recursoEncontrado?.nombre ?? recursoIdSeleccionado` (`:1163`) while the server persists the `tituloVisible`-based title. The on-screen list shows a different title than the stored asignación until a refetch. Cosmetic inconsistency, same one-line fix pattern as the server.

4. **`quitarGrupo` can leave `grupoActivoId` dangling** — removing the active group (`:1061-1065`) does not reassign `grupoActivoId`; the Biblioteca bridge (`:1085-1092`) then matches no group and incoming `recursoIdsParaLote` selections are silently discarded. Unspecified by the spec (which only requires "default = last added"), but a real interaction path: add Grupo 2 → quit Grupo 2 → send selection from Biblioteca → nothing happens.

5. **R3 AND-clause untested** — "si `programaSeleccionado.tags` es undefined/vacío ⇒ orden por defecto sin error" is only structurally evidenced (`:627-628`); every test renders the seed programa which always has tags. Task 2.3's RED description claimed "`tags` undefined no rompe" coverage that does not exist as a distinct test.

6. **Full-suite exit code is 1** — solely due to the 6 pre-existing failing suites (identical set and identical 25 failed tests as the previous change's verify-report; dirty-worktree issue documented across this session's changes). Not attributable to this change, but `sdd-archive` should keep disclosing it.

### SUGGESTION (nice to have)

1. Extract the loop body of `publicarTodo()` into the `procesarPublicacionGrupo()` named in the design, or amend the design — currently a silent structural deviation.
2. Add a "3 groups rendered, still one entry point" assertion to match the modified requirement's literal GIVEN.
3. Orchestrator records said "18 tasks"; tasks.md has 22. Cosmetic bookkeeping mismatch only.

---

## Verdict

**PASS WITH WARNINGS**

All 22 tasks complete; build green; functions suite 8/8 green via explicit `node --test`; full Jest run shows zero new failures (+9 new tests, all passing) with the same 6 pre-existing broken suites as the prior baseline; 7/8 delta scenarios behaviorally proven by passing tests. The one PARTIAL — tags lost across reload in the actual view flow (create + rehydrate not threaded, contrary to the design's File Changes) — plus the individual-flow `tituloVisible` wording gap should be resolved (code fix or spec rewording) before `sdd-archive` merges these deltas into the main specs.

---

## Addendum — Fix-up Phase 7 (post-verify)

After the verdict above, a fix-up phase (tasks 7.1-7.10 in `tasks.md`) resolved ALL 5 warnings with strict TDD — 7 RED tests written first, each confirmed failing pre-fix, all green post-fix:

1. **WARNING 1 (tags lost across reload)** — RESOLVED. The view's `guardarPrograma` now threads `tags: programaNormalizado.tags` into `createPrograma`, and the rehydrate map sets `tags: real.tags ?? []` instead of inheriting the demo seed's tags. Tasks 7.1-7.2.
2. **WARNING 2 (individual flow ignores `tituloVisible`)** — RESOLVED. The individual flow now pre-fills the title with `tituloVisible || nombre` (~line 790) and applies the same fallback in `publicar()` (~line 836). Tasks 7.3-7.4.
3. **WARNING 3 (optimistic batch title used `nombre`)** — RESOLVED. `publicarTodo()`'s optimistic local title now uses `tituloVisible || nombre`, aligned with the server's persistence chain. Tasks 7.5-7.6.
4. **WARNING 4 (`quitarGrupo` dangling active pointer)** — RESOLVED. Removing the active group reassigns `grupoActivoId` (and its ref) to the last remaining group; incoming Biblioteca selections are no longer silently discarded. Tasks 7.7-7.8. Recorded in `design.md` as a post-verify amendment to the "grupo activo pointer" decision.
5. **WARNING 5 (R3 AND-clause untested)** — RESOLVED. Test added: programa sin tags ⇒ default material order, no error. It turned RED before fix 7.2 — the tag-less programa inherited the demo's tags and mis-prioritized — i.e., it exposed WARNING 1's other face rather than being a mere coverage gap. Task 7.9.

**Regression evidence (task 7.10)**: focused Jest run (AsignacionesView | programaService | CentroEstudios | BibliotecaView | bibliotecaService) 9 suites / 108 tests green (AsignacionesView grew 29 → 36 tests); `node --test functions/academico/asignaciones.test.js` 8/8; `npm run build` exit 0 (only the pre-existing >500 kB chunk warning).

WARNING 6 (6 pre-existing failing suites / 25 tests, full-suite exit 1) remains an environment/baseline disclosure — unrelated to this change and unchanged by Phase 7. With warnings 1-5 resolved, the change is clear to archive.
