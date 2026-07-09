# Verification Report

**Change**: programa-persistencia-gestion-clases
**Version**: N/A (no version field in artifacts)
**Verified**: 2026-07-04 (re-verify pass, fully fresh — supersedes the prior FAIL report). Real execution: targeted 8-suite run, full Jest suite (`npm test -- --runInBand`, not piped through `tee`), and `npm run build`.
**Context**: This is a re-verify. The first `sdd-verify` pass found 2 CRITICAL issues (regression in `CentroEstudios.test.tsx`, broken "Cerrar" action in `MisClasesView.tsx`). A Phase 6 fix-up was applied and is re-verified here from scratch — nothing from the prior report was taken on faith; every claim below was re-derived from source reads and fresh test/build runs in this session.

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total (checklist lines) | 18 |
| Tasks complete | 18 |
| Tasks incomplete | 0 |

All 6 phases in `tasks.md` are marked `[x]`, including the new **Phase 6** ("Correcciones de sdd-verify") added since the prior report, which contains 4 checklist lines (6.1–6.4) covering both CRITICAL fixes plus a regression run and a `design.md` update. Prior report counted 14 lines (Phases 1–5 only, before Phase 6 existed); with Phase 6 the total is 18, all complete.

---

### Build & Tests Execution

**Build**: ✅ Passed (`npm run build` → `vite build`, exit code explicitly captured as `0`, not inferred from a wrapper — `"built in 1m 25s"`)
```
✓ 1463 modules transformed.
(!) Some chunks are larger than 500 kB after minification. [...pre-existing chunk-size warning...]
framer-motion "use client" / react-router "use client" directive-ignored notices [...pre-existing third-party warnings, unchanged from prior run...]
```
No errors. All warnings are the identical pre-existing/third-party ones from the prior verify run — none newly introduced.

**Tests — targeted run first** (the 8 suites this change touches or that its two CRITICAL fixes depend on, run directly to get a fast, high-confidence signal before the full suite):
```
npx jest --runInBand vistas/CentroEstudios.test.tsx vistas/admin/MisClasesView.test.tsx \
  vistas/admin/AsignacionesView.test.tsx vistas/admin/JornadasView.test.tsx \
  servicios/academico/jornadaService.test.ts servicios/academico/closeJornada.test.ts \
  servicios/academico/programaRepository.test.ts servicios/academico/programaService.test.ts
```
**Test Suites: 8 passed, 8 total. Tests: 66 passed, 66 total. Time: 34.2s.**

Per-file breakdown (test counts independently confirmed by counting `it(` blocks in each file, which sum exactly to 66): `CentroEstudios.test.tsx` 9/9, `MisClasesView.test.tsx` 5/5, `AsignacionesView.test.tsx` 20/20, `JornadasView.test.tsx` 8/8, `jornadaService.test.ts` 8/8, `closeJornada.test.ts` 3/3, `programaRepository.test.ts` 4/4, `programaService.test.ts` 9/9. Zero failures anywhere in this set.

**Tests — full project suite, fresh execution** (`npm test -- --runInBand`, redirected directly to a log file with the shell exit code captured as a literal line inside the log — deliberately **not** piped through `tee`, per the prior report's own methodology warning that `tee` masks Jest's real exit code):

Jest's own printed summary (ground truth, read directly — not the background-runner wrapper's exit signal, which itself reported a misleading "completed (exit code 0)" here too, for the same reason as before: the wrapper's exit code is the trailing `echo`'s, not Jest's):

**Test Suites: 6 failed, 106 passed, 112 total**
**Tests: 25 failed, 3 skipped, 850 passed, 878 total**
**Time: 228.75s**
**Captured in-log: `JEST_EXIT_CODE=1`** (correctly non-zero — consistent with the real failures below, none of which belong to this change)

Diff against the prior verify run's fresh full-suite numbers (7 failed / 105 passed / 112 total suites; 27 failed / 3 skipped / 846 passed / 876 total tests) reconciles exactly:
- Total suites unchanged (112); total tests **+2** (876→878 = the 2 new `MisClasesView` "cerrar" tests added in Phase 6)
- Failed suites **7→6** (−1 = `CentroEstudios.test.tsx`, now fully passing)
- Failed tests **27→25** (−2 = exactly the 2 previously-broken `CentroEstudios.test.tsx` assertions)
- Passed tests **846→850** (+4 = the 2 new `MisClasesView` tests + the 2 now-fixed `CentroEstudios` tests)

This exact arithmetic match is strong evidence the Phase 6 fix changed nothing else in the suite.

The 6 still-failing suites (deduplicated from Jest's streamed `FAIL` lines + its end-of-run "Summary of all failing tests" section, which lists each failing suite twice):

| Failing suite | Attributable to this change? | Evidence |
|---|---|---|
| `components/ModalImportacionMasiva.test.tsx` | No | Unrelated bulk-import/audit text-matching failure |
| `App.routing.test.ts` (untracked WIP file per `git status`) | No | `TypeError`s on routing/OAuth-callback helpers, unrelated to programa/jornada |
| `components/FilaEstudiante.test.tsx` | No | Fails on "Registrar Pago en Efectivo" (finance domain) |
| `components/ModalRegistrarPago.test.tsx` | No | Payment-registration modal, unrelated domain |
| `components/academico/ProgresoResumenCard.test.tsx` | No | Text/encoding mismatch (`"Asignaciones"` not found in rendered output) |
| `servicios/pagosApi.complementaria.test.ts` | No | Payments API, unrelated domain |

Re-confirmed by a fresh grep (not by trusting the prior report's attribution): none of these 6 files reference `programaRepository`, `MisClasesView`, `jornadaService`, `closeJornada`, `AsignacionesView`, `CentroEstudios`, or `jornadaRepository` anywhere in their source.

**Coverage**: Configured (`coverage_threshold: 0` in `openspec/config.yaml`) → ➖ Not a real gate (0% always passes). Not re-run with `--coverage` instrumentation, same reasoning as the prior report (would re-execute a multi-minute suite for a number that cannot fail the gate).

---

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Persistencia real del Programa Académico | Programa persiste tras recargar | `AsignacionesView.test.tsx > al confirmar el programa genera y persiste jornadas reales para su horario` (save) + `> al montar, lee los programas reales del tenant...` (read) + `programaRepository.test.ts` round-trip test | ⚠️ PARTIAL — all 3 contributing tests PASS (re-confirmed), but still no single test chains save→remount→reread in one execution; re-confirmed via fresh grep that no test in `AsignacionesView.test.tsx` does a remount/"recargar" cycle |
| Persistencia real del Programa Académico | Tenant sin programas previos | Default-mock rendering paths in `AsignacionesView.test.tsx` | ✅ COMPLIANT |
| Persistencia real de la Ejecución del Programa | Ejecución persiste junto al programa | `AsignacionesView.test.tsx > al confirmar el programa genera y persiste jornadas reales para su horario` | ✅ COMPLIANT — `repositoryJornada.guardarEjecucion(ejecucion)` re-confirmed wired at `AsignacionesView.tsx:915` |
| Listado de programas reales al abrir la vista | Programas existentes se listan al entrar | `AsignacionesView.test.tsx > al montar, lee los programas reales del tenant en vez de sembrar solo el demo` | ✅ COMPLIANT |
| Gestión de clases generadas | Ver clases generadas de un programa | `MisClasesView.test.tsx > lista las clases del programa...` + `> muestra el material asignado por clase` | ✅ COMPLIANT |
| Gestión de clases generadas | Transicionar el estado de una clase (spec's literal scenario: borrador→confirmada) | `MisClasesView.test.tsx > confirma una clase en borrador y persiste el cambio` | ✅ COMPLIANT |
| Gestión de clases generadas | *(prose also promises "iniciar")* | none — no test clicks "Iniciar" in `MisClasesView.test.tsx` | ⚠️ UNTESTED at component level, but low risk — see WARNING-5 |
| Gestión de clases generadas | *(prose also promises "cerrar")* — **previously CRITICAL, provably broken** | `MisClasesView.test.tsx > cierra una clase en curso solo tras registrar asistencia y objetivos, igual que JornadasView` (happy path) + `> muestra error si intenta cerrar una clase en curso sin registrar asistencia` (guard path) | ✅ **NOW COMPLIANT** — both tests re-run fresh and PASS; assertions check the real final state (`estado: 'cerrada'`, `asistenciaRegistrada: true`, `objetivosImpartidos: ['obj-1']`) and the real guard error message, not a relaxed/trivial check |
| Publicación de material unificada | Publicar un solo material a una sola clase con el flujo unificado | `AsignacionesView.test.tsx > no crea una jornada nueva al publicar material embebido...` + `> publica en lote seleccionando multiples materiales y clases` | ✅ COMPLIANT |
| Publicación de material unificada | El flujo antiguo de un-solo-material ya no existe por separado | `AsignacionesView.test.tsx > en modo embebido el unico flujo para crear una publicacion es Publicar en lote` — **and, previously the site of the regression,** `CentroEstudios.test.tsx > integra plan y cierre de clase para admin dentro del Centro de Estudios` + `> habilita publicar en lote cuando hay material y clase seleccionados` | ✅ **NOW COMPLIANT end-to-end** — the `CentroEstudios.test.tsx` pair was rewritten to assert the real batch flow (recurso checkbox becomes `checked`, "Publicar en lote" flips from disabled to enabled), not merely relaxed to stop failing; both PASS fresh |

**Compliance summary**: 8/9 rows fully COMPLIANT (up from 6/9), 1/9 PARTIAL (unchanged, non-blocking), 1/9 UNTESTED-but-low-risk (down from UNTESTED-and-provably-broken). **Both previously-CRITICAL rows are now COMPLIANT with real passing tests.**

---

### Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Persistencia real del Programa Académico | ✅ Implemented | Unchanged from prior verify, re-confirmed: `programaRepository.ts` wired into `guardarPrograma()` (`AsignacionesView.tsx:914`) |
| Persistencia real de la Ejecución del Programa | ✅ Implemented | Re-confirmed: `repositoryJornada.guardarEjecucion(ejecucion)` at `AsignacionesView.tsx:915` |
| Listado de programas reales al abrir la vista | ✅ Implemented | Re-confirmed: mount `useEffect` at `AsignacionesView.tsx:443-467` |
| Gestión de clases generadas | ✅ Implemented (was ⚠️ Partial) | List + material resolution + confirmar/iniciar/cerrar all present. "Cerrar" now correctly gated behind `marcarPendienteCierre()` (per-row asistencia/objetivos checkboxes) before `cerrarJornada()`, mirroring `JornadasView.tsx`'s own proven pattern — verified by reading `jornadaService.ts`'s `transicionesPermitidas` table (`en_curso → pendiente_cierre → cerrada` is a valid chain) and `cerrarJornada()`'s precondition checks, both of which now line up with what `MisClasesView.tsx` calls |
| Publicación de material unificada | ✅ Implemented | Re-confirmed exactly 2 remaining `onClick={publicar}` occurrences in `AsignacionesView.tsx` (line 1675, gated by `asignacionEditandoId &&`, edit-only; line 2354, standalone-only) — unchanged from prior verify, and now the one sibling consumer test that had drifted (`CentroEstudios.test.tsx`) is fixed too |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Conectar `repositoryJornada.guardarEjecucion()` ya existente | ✅ Yes | Unchanged, re-confirmed at `AsignacionesView.tsx:915` |
| Nuevo `programaRepository.ts`, mismo patrón que `jornadaRepository.ts` | ✅ Yes, but ⚠️ | Same orphaned-collision caveat as before still stands — see WARNING-1 |
| Colección/reglas de Firestore ya existen, sin cambios necesarios | ✅ Yes (rule exists) but ⚠️ | `firestore.rules:230-235` re-confirmed unchanged and correct; rules-test coverage gap still open — see WARNING-2 |
| Vista "Mis clases": componente nuevo, no extender `JornadasView.tsx` | ✅ Yes | Unchanged |
| Fusión de flujos de publicar (envolver "Paso 3B" en `{!embedded && ...}`) | ✅ Yes, functionally | Same as before — mechanism is two disjoint early-return branches, not a literal `{!embedded && (...)}` wrapper, but outcome matches intent. **The regression this decision previously caused in `CentroEstudios.test.tsx` is now fixed and re-verified passing.** |
| "Cerrar" reusa el patrón de `JornadasView.tsx` (`marcarPendienteCierre` → `cerrarJornada`) — Phase 6 decision | ✅ Yes | Re-confirmed by direct source comparison: `MisClasesView.tsx:82-86` calls the identical two functions from `jornadaService.ts` that `JornadasView.tsx:217-220` calls, with per-row checkbox state instead of single-jornada state. Correct adaptation for a list-based component. |
| Deliberate scope limit: do NOT call `cerrarJornadaConPrograma()`/`advanceCiclo()` from `MisClasesView` (Phase 6) | ✅ Honestly documented, and verified accurate | Independently confirmed via source, not taken on faith: `JornadaRepository` interface (`jornadaRepository.ts:38-45`) exposes `guardarJornada`, `guardarEjecucion`, `registrarAuditoria`, `existeConflictoHorario`, `listarJornadasPorTenant`, `guardarJornadasEnLote` — **no getter for a single `EjecucionPrograma`/`ProgramaAcademico` by id exists anywhere in the codebase**, and `closeJornada.ts`'s `cerrarJornadaConPrograma()` genuinely requires the full `ProgramaAcademico` + `EjecucionPrograma` objects to call `advanceCiclo()`. `MisClasesView` only receives `programaId: string`. The design's claim is factually correct, not a hand-wave. **Also verified: this is not a scope violation.** An exhaustive grep of `proposal.md` and `spec.md` for `avanceCiclo`/`advanceCiclo`/`unidadActualId`/`objetivosCompletados`/`cerrarJornadaConPrograma` returns zero hits in either file — those terms appear only inside `design.md`/`tasks.md`'s own write-up of this decision. Spec's "gestionar su ciclo de vida (confirmar, iniciar, cerrar)" and the proposal's matching Success Criterion both refer to the **jornada's own state machine**, not the program's curriculum-cycle progression (a distinct concept/data structure). The limitation is real, correctly scoped out, and honestly labeled — see WARNING-6 for why it's still worth tracking as future work |
| `MisClasesView` reusa lógica de `agendaAcademicaService.ts` for material resolution (per design.md's Data Flow) | ⚠️ Still deviated, still undocumented in the diagram itself | Unchanged from prior verify: code calls `listarAsignacionesPorTenant` directly and filters per-jornada itself (`MisClasesView.tsx:40-52`); `design.md`'s Data Flow prose still literally says "(reusa lógica de agendaAcademicaService)" even after being edited in Phase 6 for the close-flow portion — see WARNING-4 |

---

### Issues Found

**CRITICAL (must fix before archive)**: None. Both previously-CRITICAL issues are verified fixed with real, fresh execution evidence (see Spec Compliance Matrix and Build & Tests sections above) — not just re-reading the prior report's claims.

**WARNING (should fix)**:

1. **Orphaned, colliding repository** (carried over, re-confirmed unchanged): `servicios/academico/programaAcademicoRepository.ts` still exists, still has zero production callers (confirmed via fresh repo-wide grep — only its own test file references it), and still writes a differently-shaped `ProgramaAcademico` (from `tipos.ts`) to the same Firestore path (`tenants/{tenantId}/programasAcademicos/{id}`) that the new `programaRepository.ts` (using `models/academico/programa.ts`'s type) now also targets. Harmless today, still a landmine.
2. **No Firestore rules tests for `programasAcademicos`/`ejecucionesPrograma`/`jornadas`** (carried over, re-confirmed unchanged): fresh grep of `functions/test/firestore-rules.*.test.js` still returns zero references to any of these collections.
3. **"Programa persiste tras recargar" still lacks a single dedicated integration test** (carried over, re-confirmed unchanged): fresh grep for remount/"recargar"-style patterns in `AsignacionesView.test.tsx` returns nothing; the behavior is still proven only by composing 3 independently-mocked tests.
4. **`design.md`'s Data Flow diagram is still partially stale** (carried over, re-confirmed): Phase 6 correctly updated the "cerrar" portion of the diagram, but the material-resolution line still claims `MisClasesView` "reusa lógica de agendaAcademicaService," which the code does not do (verified: it calls `listarAsignacionesPorTenant` directly with its own filter). Documentation-only gap.
5. **NEW (surfaced by this re-verify): "iniciar" (confirmada→en_curso) has zero test coverage at the component/behavioral level.** No test in `MisClasesView.test.tsx` clicks the "Iniciar" button. This scenario was previously bundled inside the same compliance-matrix row as "cerrar" and inherited that row's CRITICAL severity from cerrar's proven breakage; now that cerrar is fixed and independently proven, "iniciar" should be assessed on its own. Assessed risk is **low, not CRITICAL**, because: (a) the underlying pure function `iniciarJornada()` is unit-tested directly in `jornadaService.test.ts`; (b) `MisClasesView.tsx`'s `confirmada` branch is a plain `transicionar(jornada, 'en_curso')` call with no extra precondition or async step, structurally simpler than the `borrador` branch (has an async conflict check) and the `en_curso` branch (has the checkbox-state logic) — both of which ARE proven working at the component level via the identical code pattern. Recommend adding one test for completeness, not blocking archive.
6. **The documented curriculum-cycle limitation is real and should be tracked, even though it's correctly out of this change's scope.** Closing a class from "Mis clases" does not advance `EjecucionPrograma.objetivosCompletados`/`unidadActualId` (only closing from `JornadasView.tsx` does, via `cerrarJornadaConPrograma`/`advanceCiclo`). Verified as accurately documented and not a spec violation (see Coherence table). Flagging here only so it doesn't get lost as "future work" — the fix would require adding an `EjecucionPrograma`-by-id getter to `jornadaRepository.ts` and threading the full `ProgramaAcademico`/`EjecucionPrograma` into `MisClasesView`.

**SUGGESTION (nice to have)**:

1. (carried over, unchanged) `AsignacionesView.test.tsx` never calls `clearMockProgramas()`/`clearMockJornadas()` in `beforeEach` for tests using the default singleton repositories. Currently harmless.
2. (carried over, unchanged) `guardarPrograma()`'s try/catch (`AsignacionesView.tsx:888-921`) swallows Firestore write failures into an error banner but still optimistically updates local state and closes the modal. Not a spec violation, worth hardening later.

---

### Verdict

**PASS WITH WARNINGS**

Both CRITICAL issues from the prior verify pass are fixed and independently re-proven in this session with fresh execution: `CentroEstudios.test.tsx`'s 2 previously-failing assertions now pass and assert the real batch-publish behavior (not a relaxed/trivial check), and `MisClasesView.tsx`'s "Cerrar" action now works end-to-end (proven by a passing happy-path test asserting the exact final jornada state, plus a passing guard-path test). The full, fresh 878-test suite shows the fix changed nothing else — the before/after numbers reconcile exactly (−1 failing suite, −2 failing tests, +2 total tests, all attributable to this change's own fix, with the same 6 pre-existing unrelated failures untouched). The build passes cleanly. The one deliberately-accepted scope limitation (curriculum-cycle advancement not wired into the new view's close action) was independently verified to be technically accurate and outside what the spec ever promised — it's an honest, correctly-scoped limitation, not a dodge. Remaining WARNINGs (an orphaned colliding repository, missing Firestore rules tests, a missing single-chain persistence integration test, a stale line in the design doc, and now-explicit missing coverage for the "iniciar" button) are all pre-existing or low-risk and do not block archiving this change.
