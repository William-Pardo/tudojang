# Verify Report: centro-recursos-clasificacion-manual

**Change**: centro-recursos-clasificacion-manual
**Verified**: 2026-07-05 (fresh execution, not trusting implementer self-reports)
**Spec version**: `openspec/changes/centro-recursos-clasificacion-manual/specs/academico-biblioteca/spec.md` (delta spec; no main spec exists yet at `openspec/specs/academico-biblioteca/` — this change is the origin of that domain)

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 20 |
| Tasks complete | 20 |
| Tasks incomplete | 0 |

All 20 tasks in `tasks.md` are marked `[x]` (Phase 1: 4, Phase 2: 4, Phase 3: 7, Phase 4: 3, Phase 5: 2). Verified by direct grep of the checkbox lines — zero `- [ ]` remain.

**Note**: the launch brief stated "all 37 tasks should show `[x]`" — the actual file contains 20 numbered tasks, not 37. This is a discrepancy in the brief's premise, not a defect in the implementation; flagging it so it doesn't get silently carried forward. All 20 that exist are done.

---

### Build & Tests Execution (real, fresh run)

**Build** (`npm run build`): ✅ Passed — exit code 0, `✓ built in 59.84s`. Only pre-existing warnings (framer-motion "use client" directives ignored by Rollup, dynamic/static import chunking notices, >500kB chunk-size notice) — no errors, no new warnings attributable to this change.

**Tests** (`npm test -- --runInBand`, full suite, output redirected to a log file and read directly — not piped through `tee`): 
```
Test Suites: 6 failed, 105 passed, 111 total
Tests:       25 failed, 3 skipped, 857 passed, 885 total
Snapshots:   0 total
Time:        157.19 s
```
✅ Matches the implementers' self-reported 857/885 exactly.

**The 6 failing suites**, individually inspected (not just counted):
- `components/ModalImportacionMasiva.test.tsx`
- `App.routing.test.ts` — fails because `App_1.obtenerRutaInicioUsuario` / `App_1.construirUrlCallbackDrive` are "not a function" (missing exports on `App.tsx`, which is dirty in this worktree from unrelated concurrent WIP), plus a jsdom `HTMLCanvasElement.getContext` limitation via `jspdf`/`FilaEstudiante`/`Estudiantes.tsx` import chain
- `components/FilaEstudiante.test.tsx`
- `components/ModalRegistrarPago.test.tsx`
- `components/academico/ProgresoResumenCard.test.tsx` — fails on a text-mismatch (`expected "Asignaciones", DOM shows "Material publicado"`), in a component not listed in this change's File Changes table and not touched by any of the 20 tasks
- `servicios/pagosApi.complementaria.test.ts`

None of these six touch `BibliotecaView`, `AsignacionesView`, `CentroEstudios`, `recurso.ts`, or `bibliotecaService.ts` — confirmed by reading each failure's stack trace and asserted text, not just by filename. All are payments/routing/PDF-export/student-row modules, consistent with the proposal's documented risk of a dirty worktree carrying unrelated concurrent (Codex/Antigravity) WIP. **Verdict: pre-existing, unrelated. Confirmed, not just repeated from the implementers' claim.**

**This change's own suites, individually confirmed PASS in the fresh run**: `vistas/admin/AsignacionesView.test.tsx`, `vistas/admin/BibliotecaView.test.tsx`, `vistas/CentroEstudios.test.tsx`, `servicios/academico/bibliotecaService.test.ts`, `hooks/useCentroEstudios.test.ts`.

**Type check** (`npx tsc --noEmit`, informational — not a configured verify gate; `coverage_threshold: 0` and no `type_checker` gate in `rules.verify`): project-wide 2013 pre-existing errors (dirty worktree). Scoped to the 3 touched view files, cross-checked against the implementers' task-5.2 claim:
- `BibliotecaView.tsx`: 0 errors — matches claim.
- `AsignacionesView.tsx`: exactly 1 error, line 920 (`estudiantes` vs `estudianteIds` on `DestinatarioAsignacion`, inside `editarAsignacionPublicada`, untouched by this batch) — matches claim exactly.
- `CentroEstudios.tsx`: exactly 3 errors (`.ts` import-extension warning at line 10, two Firestore `doc`/`setDoc` generic-typing mismatches at lines 119-120) — matches claim exactly.
- `models/academico/recurso.ts`, `servicios/academico/bibliotecaService.ts`: 0 errors.

**Coverage**: Not configured (`coverage_threshold: 0`) — skipped per config.

---

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Clasificación manual de recursos detectados | Clasificar abre el modal en vez de auto-aprobar | `BibliotecaView.test.tsx > "renderiza explorador de Drive y permite importar, clasificar y aprobar un recurso"` (lines 38-85) | ✅ COMPLIANT |
| Clasificación manual de recursos detectados | Guardar la clasificación deja el recurso en pendiente | same test (lines 68-76) + `bibliotecaService.test.ts` (RED/GREEN cases) | ✅ COMPLIANT |
| Aprobación separada de la clasificación | Aprobar un recurso ya clasificado | same test (lines 78-84) + `"abre clasificacion de un recurso pendiente sin reimportar y lo aprueba por separado sin repetir updateFicha"` (line 500) | ✅ COMPLIANT |
| Aprobación separada de la clasificación | Un recurso sin clasificar no puede aprobarse | `"un borrador sin ficha no puede aprobarse directamente: exige clasificarlo primero"` (line 394) | ✅ COMPLIANT |
| Título visible curado por recurso | El título visible se persiste al clasificar | `bibliotecaService.test.ts` (lines 87, 103, 233, 252) + `BibliotecaView.test.tsx:76` | ✅ COMPLIANT |
| Título visible curado por recurso | Recursos previos sin título visible no rompen la UI | `BibliotecaView.test.tsx:611` grid test (recurso without `tituloVisible` renders/queries correctly by `nombre`) | ⚠️ PARTIAL — behavior is exercised and passes, but no test explicitly asserts the fallback-vs-explicit-title contrast; coverage is incidental, not purposeful |
| Selección de aprobados unificada en Centro de recursos | Los aprobados se listan en Centro de recursos | `BibliotecaView.test.tsx:611` + `CentroEstudios.test.tsx:200` | ✅ COMPLIANT |
| Selección de aprobados unificada en Centro de recursos | La selección llega a Asignaciones sin grid propio | `CentroEstudios.test.tsx:200,226` (full cross-component bridge, real render) + `AsignacionesView.test.tsx:192` (`recursoIdsParaLote` union) | ✅ COMPLIANT |
| Eliminación de "Reutilizar" y "Aprobado para" | Reutilizar y "Aprobado para" ya no existen | `AsignacionesView.test.tsx:69` (`"ya no mantiene un grid propio..."`) | ✅ COMPLIANT |
| Pipeline de Centro de Estudios en 3 pasos | El stepper muestra 3 pasos | `CentroEstudios.test.tsx:242` | ✅ COMPLIANT |
| Pipeline de Centro de Estudios en 3 pasos | El estado del paso 2 refleja clasificación y aprobación combinadas | `CentroEstudios.test.tsx:256` | ✅ COMPLIANT |

**Compliance summary**: 10/11 scenarios fully compliant with dedicated, passing tests; 1/11 (título-visible fallback) compliant in behavior but only incidentally tested — WARNING, not a functional gap.

---

### Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|---|---|---|
| `RecursoAcademico.tituloVisible?: string` | ✅ Implemented | `models/academico/recurso.ts:102`, sibling to `nombre` as designed |
| `updateFicha` widened, 4th param | ✅ Implemented | `bibliotecaService.ts:134-174`; writes `tituloVisible` only when non-empty (trimmed), both mock and Firestore paths |
| 3-way click routing (clasificar/aprobar/retirar) | ✅ Implemented | `BibliotecaView.tsx:938-960` — `aprobado`→retirar, `pendiente`→aprobar, else→clasificar |
| Auto-approve path retired | ✅ Implemented | `aprobarRecursoDetectado`/`construirFichaAutomatica`/`indexarArchivo`/`estaArchivoAprobado` — zero remaining references anywhere in the tree (grep confirmed) |
| "Recursos aprobados" grid moved to `BibliotecaView.tsx` | ✅ Implemented | `BibliotecaView.tsx:999-1062`, checkbox multi-select + `agregarSeleccionAlLote` → `onRecursoParaLote` |
| "Reutilizar" tab + "Aprobado para" toggle deleted | ✅ Implemented | Zero remaining references to `tabRecursosAprobados`, "Reutilizar", "Aprobado para", "Preparar asignacion" in `AsignacionesView.tsx` (grep + read confirmed) |
| Cross-component bridge (`onRecursoParaLote`/`recursoIdsParaLote`) | ✅ Implemented | `CentroEstudios.tsx:88-90,167,174` wiring `BibliotecaView`→`AsignacionesView`; `AsignacionesView.tsx:995-1001` unions (not replaces) into `recursosLoteIds` via `useEffect` |
| `CentroEstudios.tsx` 4→3 steps | ✅ Implemented | `pasosCentroEstudios` array has exactly 3 entries (`CentroEstudios.tsx:16-32`); grid `[16fr_47fr_37fr]` in both stepper `<ol>` and embedded `<section>` |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| `tituloVisible` top-level, sibling to `nombre` | ✅ Yes | |
| Adapt existing state/handlers vs. new component | ✅ Yes | `guardarClasificacion`/`aprobar` reused, wrapped in new modal JSX |
| Retire auto-classify path entirely | ✅ Yes | Confirmed via grep, no remnants |
| Delete "Reutilizar" tab outright (no replacement) | ✅ Yes | |
| No `tituloVisible` backfill | ✅ Yes | Lazy fallback to `nombre` at render time only |
| Move "Preparar asignación" modal verbatim | ⚠️ Deviated (documented) | Task 3.2 explicitly logs this: the modal was dropped entirely rather than moved, replaced by a plain checkbox-grid + single confirm button, since none of its captured fields (`tituloPersonalizado`/`tagsAsignacion`/`tipoDestinatario`) migrate per the design's own scope cuts. This is a reasonable, self-disclosed simplification, not a silent scope cut — verified the deleted fields truly aren't needed elsewhere (see functional-gap check below). |
| `updateFicha` 4th positional param (not options object) | ✅ Yes | Matches file's existing all-positional style |

---

### Functional-Gap Check: destinatario after "Aprobado para" removal

Specifically investigated per the launch brief: does removing the "Aprobado para" (`tipoDestinatario`) toggle from the deleted "Preparar asignación" modal leave `publicarLote()` (or the batch Cloud Function) without a way to set `destinatario`?

**No gap found.** `tipoDestinatario` is (and, per `exploration.md`, always was) a single React state (`AsignacionesView.tsx:380`, default `'grupo'`) shared across the individual-publish form ("Programa y publicación", `xl:col-span-3` article) and the batch/lote flow (`publicarLote`, line 1030: `crearDestinatario(tipoDestinatario, grupo || 'Infantil', grados)`). The deleted toggle was one of *two* UI surfaces that could set this same state — the other, a `<select id="asignacion-destinatario">` in the still-present individual-publish section (`AsignacionesView.tsx:1925-1934`), remains fully rendered and functional. Even if a user never touches it, `crearDestinatario` has sane non-throwing defaults (`'grupo'` type, `'Infantil'` group fallback) — confirmed in `crearDestinatario` (line 72-92) and the Cloud Function `publishAsignacionesBatch` (`functions/academico/asignaciones.js:159-170`), which does no server-side validation of `destinatario` at all. This sharing pattern pre-dates this change (per `exploration.md`'s own finding that the deleted toggle was "bound to the *same* state the publish/lote section uses") — this change did not introduce or worsen it. Scoping `destinatario`/grupos-de-publicación properly is confirmed to be the explicitly out-of-scope job of the next change (`grupos-publicacion-material`), and nothing here creates a dangling requirement in the meantime.

One real (pre-existing, out-of-scope, already-documented) caveat carried forward unchanged by this change: `publicarLote` still hardcodes `titulo: ''` and drops `tags`, so batch-published assignments fall back to the raw Drive filename — this bug was introduced by the prior `asignacion-material-por-clase` change (2026-07-04) and is explicitly scoped to the *next* change per this change's own proposal ("Out of Scope: Bug preexistente de `publicarLote` (título/tags) — change 2"). Not a regression introduced here.

---

### Regression-Fix Verification (mid-implementation bug)

The implementers reported catching and fixing a stray `setTabRecursosAprobados('reutilizar')` call left behind after deleting `tabRecursosAprobados` state, which would have thrown a `ReferenceError` silently swallowed by a `try/catch` in `publicar()`'s success path.

**Confirmed fixed.** Grepped the entire tree (excluding `openspec/`) for `tabRecursosAprobados`, `recursosAprobadosReutilizables`, `popupMatchVisible`, `abrirModalRecurso`, `asignarRecursoSeleccionado`, `mostrarHistorialRecurso`, `cancelarSeleccionRecurso`, `recursosAprobadosListos`, `recursosVisiblesPorTab`, `claseListadoRecursos`, `claseFilaRecurso`, `claseIconoAccionRecurso`, `inferirGrupoObjetivoDesdeGrupoOperativo`, `aprobarRecursoDetectado`, `construirFichaAutomatica`, `estaArchivoAprobado` — **zero matches anywhere in the codebase.** All dead identifiers are fully gone, not just the one that crashed. `tipoDestinatario`/`tituloPersonalizado`/`tagsAsignacion` remain (correctly — see above), used only by the still-live individual-publish sub-flow.

---

### Cypress E2E Specs — Claim Verified

Read both specs in full, independent of the implementers' grep-based claim:
- `cypress/e2e/modulo-estudio-cierre-jornada.cy.ts`: drives `/#/centro-estudios` as an Admin, but exclusively exercises "Plan y cierre de clase" (`MisClasesView`'s jornada confirm/start/close panel) — zero references to Drive, Biblioteca, Asignaciones, or the stepper. Confirmed unaffected.
- `cypress/e2e/onboarding.cy.ts`: drives signup/payment/activation (`/registro-escuela`, Wompi checkout, login) — never visits `/centro-estudios`. Confirmed unaffected.

`npx cypress run` was not executed (implementers noted the Cypress binary is broken on this machine, pre-existing environment issue) — this verification pass also did not run it, for the same reason. This remains a real, disclosed gap: no E2E execution evidence exists for this change, only structural/manual review that the flow is untouched. Recommend a human run Cypress before merge, as already flagged in `tasks.md` 4.3.

---

### Issues Found

**CRITICAL** (must fix before archive): None.

**WARNING** (should fix):
- Scenario "Recursos previos sin título visible no rompen la UI" has no dedicated test asserting the fallback-to-`nombre` behavior explicitly (it's only incidentally exercised by an unrelated grid test). A one-line addition (e.g., assert `recurso.tituloVisible || recurso.nombre` renders `nombre` when the field is `undefined`, contrasted with a case where it IS set) would close this gap cheaply.
- `npx cypress run` still cannot be executed on this machine (pre-existing, disclosed) — no real E2E execution evidence backs the "unaffected" conclusion for either spec, only manual/static review. Low risk given the grep/read evidence, but worth a human's real Cypress pass before merge, as tasks.md 5.1/4.3 already flag.
- Grid column fractions (`[16fr_47fr_37fr]`) have not been visually QA'd in a real browser at the `xl` breakpoint (self-disclosed in tasks.md 5.1) — the middle column now stacks two cards that previously had separate columns.

**SUGGESTION** (nice to have):
- The launch brief's premise of "37 tasks" doesn't match the actual `tasks.md` (20 tasks) — worth reconciling with whoever tracks task counts across sessions so future verify runs aren't second-guessing a stale number.
- Consider a one-line code comment near `tipoDestinatario`'s declaration noting it's intentionally shared between the individual-publish and batch-publish sub-flows — this sharing is easy to miss on a future read and was the crux of the "no functional gap" finding above.

---

### Verdict

**PASS WITH WARNINGS**

All 20 tasks complete, build green, full-suite tests green apart from 6 pre-existing/unrelated failing suites (confirmed unrelated by reading each failure, not just by name), 10/11 spec scenarios fully and explicitly test-covered, the one mid-implementation regression (stray `setTabRecursosAprobados` call) is confirmed fully fixed with zero dead-identifier remnants anywhere in the tree, and the specific destinatario/"Aprobado para" functional-gap concern raised in the brief is confirmed a non-issue (pre-existing shared-state design, sane defaults, no throw, next change's scope untouched). The only gaps are a thin test-coverage warning (fallback title scenario) and the already-known missing Cypress execution — neither blocks archiving, both are worth a follow-up.
