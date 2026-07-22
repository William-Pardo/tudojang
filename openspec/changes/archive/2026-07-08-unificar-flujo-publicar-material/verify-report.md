# Verification Report

**Change**: unificar-flujo-publicar-material
**Version**: N/A (no version tag in artifacts)
**Verified**: 2026-07-07/08, by sdd-verify sub-agent (fresh pass; no fixes applied)

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 50 |
| Tasks complete | 50 |
| Tasks incomplete | 0 |

All tasks across Phases 1, 2, 3, 3.5, 3.6, 3.7, 4, 5, and 5.1 are marked `[x]`. No incomplete tasks found.

---

### Build & Tests Execution

**Build**: ✅ Passed
```
npm run build → vite build
✓ 1464 modules transformed, ✓ built in 1m 28s
Only warnings: "use client" directives ignored (framer-motion/react-router, pre-existing
node_modules noise), dynamic-import/static-import chunking notices, chunk-size warning
(3.47 MB main bundle). Zero build errors.
```

**tsc --noEmit**: ⚠️ Errors present, but limited to files this change does not own
```
Filtered to production (non-.test.*) files only. In files touched by this change:
- servicios/academico/asignacionService.ts(24,76): TS5097 (.ts-extension import) —
  pre-existing pattern, also present in centroEstudiosRepository.ts, vistas/CentroEstudios.tsx,
  vistas/tutor/TutorDashboardView.tsx (3 other files, exactly as documented in tasks.md 5.2).
- servicios/academico/jornadaRepository.ts(188,42): TS2698 (spread of `unknown` in
  existeConflictoHorario) — same function documented as pre-existing/untouched in tasks.md 5.2
  (line shifted from 185→188, consistent with a separately-reported revert of two `where()`
  filters that had been dropped from this same function; independently re-read after that
  report and confirmed sedeId/espacioId/fecha are all three present — see Issues below).
Zero new errors in AsignacionesView.tsx, AsignarMaterialWizard.tsx, MisClasesView.tsx,
models/academico/jornada.ts, or components/Iconos.tsx (production).
All other tsc errors (App.tsx MisionKicho, FormularioEstudiante.tsx, useProgresoRepository.ts,
Login.tsx, centroEstudiosRepository.ts, programaRepository.ts, asistenciaApi.ts, plantillas.ts,
CentroEstudios.tsx, ClaseEnVivoView.tsx, MasterAccess.tsx, TutorDashboardView.tsx) are in files
outside this change's File Changes table (design.md) — unrelated pre-existing debt.
Test-file-only errors (`toBeInTheDocument`/`toBe`/`toHaveLength`/etc. "does not exist on type
Assertion/ExpectStatic") are the documented jest-dom-vs-chai typing noise, present across the
whole test suite, not introduced by this change.
```

**Tests — focused set** (`npx jest --runInBand --testPathPattern "AsignacionesView|AsignarMaterialWizard|MisClasesView|jornadaRepository|asignacionService|jornadaContextService|Iconos"`):
```
Run consistently green across 3 separate invocations of the full 8-suite pattern (91/91),
plus additional isolated reruns of individual suites:
- AsignacionesView.test.tsx: 22/22, reproduced 3x in isolation
- AsignarMaterialWizard.test.tsx: reproduced 2x clean in the 8-suite pattern
- AsignacionesView.instructorSeleccion.test.tsx, AsignacionesView.claseActivaHeader.test.tsx: green
- MisClasesView.test.tsx: 14/14, reproduced 4x in isolation
- jornadaRepository.test.ts, jornadaContextService.test.ts, asignacionService.test.ts: green

Test Suites: 8 passed, 8 total (majority of runs) | Tests: 91 passed, 91 total
One of five total invocations of this pattern showed "1 failed, 7 passed" (2 tests failed);
could not pin the exact failing test name before it scrolled off a truncated capture, and it
did not reproduce in 4 subsequent identical invocations plus 7 additional isolated single-suite
reruns — treated as an unreproduced, uncaptured flake (see Issues, WARNING).
```

**Tests — Firestore rules (emulator)** (`npm run test:firestore-rules`):
```
First attempt: emulator failed to bind port 8080 within 60s (cold-start timeout) — no test
output, not a code issue.
Second attempt: succeeded. 20/20 node:test assertions passed, including the two added for
this change:
✔ instructor (Editor) can delete an academic assignment in their own tenant (333.8ms)
✔ instructor (Editor) from another tenant cannot delete an academic assignment (296.8ms)
```

**Tests — full app suite** (`npm run test:app` = `jest --runInBand`), run twice:
```
Run A: Test Suites: 7 failed, 107 passed, 114 total | Tests: 28 failed, 3 skipped, 907 passed, 938 total
  Failing suites: vistas/CentroEstudios.test.tsx, App.routing.test.ts,
  components/ModalImportacionMasiva.test.tsx, components/FilaEstudiante.test.tsx,
  components/ModalRegistrarPago.test.tsx, servicios/pagosApi.complementaria.test.ts,
  servicios/academico/bibliotecaService.test.ts
  → EXACT match to the 7 suites documented as pre-existing/unrelated baseline in tasks.md 5.2.

Run B (same command, immediately after): Test Suites: 8 failed, 106 passed, 114 total |
  Tests: 28 failed, 3 skipped, 904 passed, 935 total
  Failing suites: same 6 of the above (bibliotecaService.test.ts passed this time) PLUS
  components/academico/AsignarMaterialWizard.test.tsx (1 test: "Todos los grados" ... 13
  variantes — timed out at 5000ms) and servicios/academico/jornadaContextService.test.ts
  (1 test: instructor list assertion missing a second entry).

Both of these two extra failures are inside this change's scope but did NOT reproduce in any
isolated/focused rerun (see above) — see Issues (WARNING) for the flakiness finding this
implies for the full-suite harness at 114-suite scale under --runInBand.
```

---

### Spec Compliance Matrix

**Spec: academico-programa**

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Publicación de material unificada (MODIFIED) | Un único punto de entrada por clase | `AsignacionesView.test.tsx > "el unico flujo para publicar material es '+ Agregar material', que abre el asistente"` | ✅ COMPLIANT |
| Priorización de materiales por tags (MODIFIED) | Badge de coincidencia y exclusión de duplicados | `AsignacionesView.test.tsx > "un material ya asignado a la clase activa no vuelve a ofrecerse en el Paso 1..."`, `"...su propio material actual no se excluye contra si mismo"`; `AsignarMaterialWizard.test.tsx > "muestra la cantidad de tags coincidentes con el programa por material"`, `"cada material coincidente muestra el badge..."` | ✅ COMPLIANT |
| Asistente de 3 pasos por clase (ADDED) | Cada paso exige su condición mínima antes de avanzar | `AsignarMaterialWizard.test.tsx > "deshabilita Continuar sin material seleccionado..."` (Paso1); `"...deshabilita Asignar sin ningun grado marcado..."` (Paso3) | ✅ COMPLIANT |
| Tema de la jornada persistido y editable en línea (ADDED) | Tema persiste y se edita sin abrir el asistente | `jornadaRepository.test.ts` (guard existencia); `AsignacionesView.test.tsx > describe "pildora de tema..." > "muestra el tema actual..."`, `"al perder el foco (blur), persiste..."`, `"al presionar Enter, tambien persiste..."` | ✅ COMPLIANT |
| Edición de asignación con verificación de cambios (ADDED) | Asignar solo se habilita con cambios reales | `AsignarMaterialWizard.test.tsx > describe "Modo editar" > "deshabilita Asignar hasta que algun campo difiera del snapshot inicial"`, `"persiste con el mismo id (upsert real)..."` | ✅ COMPLIANT |
| Fila de asignación con edición/eliminación reales (ADDED) | Eliminar persiste y las asignaciones sobreviven a un recargo | `AsignacionesView.test.tsx > describe "hidratacion real de asignaciones tras un reload" > "permite eliminar una asignacion hidratada real: llama eliminarAsignacionFn con su id real y la fila desaparece"`; `asignacionService.test.ts` (real `deleteDoc`) | ✅ COMPLIANT |
| Destinatario grupo con grados poblados (ADDED) | Destinatario tipo grupo con grados seleccionados | `AsignacionesView.test.tsx > "el draft siempre resuelve destinatario 'grupo' y persiste el grupo objetivo y los grados elegidos"` | ✅ COMPLIANT |
| Publicación en grupos independientes (REMOVED) | (removal, no scenario) | Structural: `grep GrupoPublicacion\|ResultadoGrupoPublicacion\|crearGrupoPublicacion` on `AsignacionesView.tsx` → no matches; no test in the rewritten `AsignacionesView.test.tsx` exercises it | ✅ COMPLIANT (removal confirmed) |

**Spec: academico-biblioteca**

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Selección de aprobados unificada (MODIFIED) | La selección llega al Paso 1 de la clase activa | `AsignacionesView.test.tsx > describe "bridge con Biblioteca..." > "al recibir recursoIdsParaLote, abre el asistente en el Paso 1 con ese material ya seleccionado"`, `"el resto del material sigue disponible y seleccionable..."` | ✅ COMPLIANT |

**Design decision covered by a rules test, not a spec scenario, but load-bearing for this change:**

| Item | Test | Result |
|------|------|--------|
| `firestore.rules` — Editor (`isInstructor()`) can delete own-tenant asignación; other-tenant denied | `firestore-rules.behavior.test.js > "instructor (Editor) can delete an academic assignment in their own tenant"`, `"...from another tenant cannot delete..."` | ✅ COMPLIANT (real emulator run, 2/2 pass) |

**Compliance summary**: 8/8 spec scenarios compliant (100%), plus the rules-level delete-permission behavior independently confirmed via emulator.

---

### Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Único asistente modal de 3 pasos | ✅ Implemented | `AsignarMaterialWizard.tsx` — StepBar/Step1/Step2/Step3, all inline in one file per design |
| `tema?: string` en `JornadaInstruccion` + persistencia | ✅ Implemented | `models/academico/jornada.ts:21`; `jornadaRepository.ts.actualizarTemaJornada` with `getDoc`-guard before `setDoc(merge:true)` |
| `eliminarAsignacion` real | ✅ Implemented | `asignacionService.ts:327-340` — real `deleteDoc(doc(db,'tenants',tenantId,'asignaciones',asignacionId))`, `ok:false` guard on missing ids |
| `actualizarAsignacion` delega en `publicarAsignacion` | ✅ Implemented | `asignacionService.ts:311-325` — same `id`/`jornadaId`, `ok:false` guard |
| `firestore.rules` delete: `isAdmin()`→`isInstructor()` | ✅ Implemented | `firestore.rules:285-286`; verified via real emulator, not just static read |
| Dead code removal (Clase activa / Publicación en lote / `GrupoPublicacion`) | ✅ Implemented | No matches for `GrupoPublicacion`/`ResultadoGrupoPublicacion`/`crearGrupoPublicacion`/`agregarGrupo`/`quitarGrupo`/`publicarTodo` in `AsignacionesView.tsx` |
| `crearDestinatario` poblando `grados` para `tipo==='grupo'` | ✅ Implemented | `AsignacionesView.tsx:96-102` — merged branch for `'grado'`/`'grupo'` |
| Exclusión de duplicados en Paso 1 (incl. auto-exclusión al editar) | ✅ Implemented | `AsignacionesView.tsx:1101-1108` `materialesDisponiblesWizard` excludes `asignacionEditandoWizard?.id` from the excluded-ids set (Fase 4 fix) |
| Header "Clase activa" icono-only, sin línea Instructor/Grupo | ✅ Implemented | `AsignacionesView.tsx:1433-1459` — `IconoFlechaIzquierda`/`IconoFlechaDerecha` icon-only buttons, centered "Clase N de M", no Instructor/Grupo `<p>` |
| `MisClasesView.tsx` grilla 3x3 paginada | ✅ Implemented | `paginaActual` state, `porPagina = 9`, page-reset on `cargar()` |
| Resiliencia `MisClasesView.cargar()` (Fase 5.1) | ✅ Implemented | jornadas fetched independently of the nested, `.catch`-guarded asignaciones fetch (lines 93-122) |
| Destinatario selector removido del wizard (Fix 2) | ✅ Implemented | `AsignarMaterialWizard.tsx` Step2 — no `<select>` for destinatario; forced to `'grupo'` in `useState` init |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Wizard as new `components/academico/AsignarMaterialWizard.tsx` (not `vistas/admin/`) | ✅ Yes | Matches `MaterialPreviewModal.tsx` precedent |
| Destinatario options: `grupo\|estudiante` only, grados always in Step 3 | ✅ Yes | Then further reduced by Fix 2 (destinatario control removed entirely from UI, forced to `'grupo'`) — documented deviation-by-explicit-user-request in tasks.md 3.5.4-3.5.6, not an unauthorized drift |
| `crearDestinatario()` grados for `'grupo'` | ✅ Yes | |
| Grado family color derivation (13→6) | ✅ Yes | `familiaDeGrado()` splits on first word; `PALETA_FAMILIAS_GRADO` 6-entry map |
| Edit opens at Step 2, Step 1 unreachable | ✅ Yes | `useState(modo === 'editar' ? 2 : 1)` |
| Dirty-check mirrors `serializarProgramaParaCambios` pattern | ✅ Yes | `serializarDraftParaCambios` in wizard |
| `actualizarAsignacion` delegates to `publicarAsignacion` | ✅ Yes | |
| `eliminarAsignacion` plain-style `deleteDoc`, not factory-with-deps | ✅ Yes | Matches file's existing style |
| `firestore.rules` widening `isAdmin()`→`isInstructor()` | ✅ Yes | Strict widening confirmed, Admin unaffected; verified via emulator |
| `asignacionesPublicadas` real hydration on mount | ✅ Yes | `listarAsignacionesPorTenant(tenantId)` effect, merged with optimistic local state |
| `tema` persistence with existence guard | ✅ Yes | `getDoc`-check before `setDoc`; throws if jornada not found |
| Biblioteca bridge repurposed (not deleted) | ✅ Yes | `recursoIdsParaLote` effect auto-opens wizard Step1 with first id preselected |

---

### Issues Found

**CRITICAL** (must fix before archive):
None.

**WARNING** (should fix):
1. **Full-suite (`npm run test:app`) flakiness at scale.** Two consecutive full runs of the 114-suite project produced different failure sets (7 vs 8 failing suites; 28 failed tests both times but not the same 28). The 2 "extra" failures in run B — `AsignarMaterialWizard.test.tsx` ("Todos los grados" ... 13 variantes, 5000ms timeout) and `jornadaContextService.test.ts` (instructor-list assertion missing an entry) — are both in this change's scope, but neither reproduced across 6+ isolated/focused reruns (which were 100% green every time, including 2 of the exact 8-suite focused pattern). A third, uncaptured "2 failed" result also occurred once in the focused-pattern run itself, never reproduced in 4 follow-up runs. This points to test-isolation/resource-contention flakiness in the overall harness at full scale (shared timers, or CPU contention triggering the 5000ms timeout under `--runInBand` with 114 suites back-to-back), not a functional regression introduced by this change. Recommend treating the "exactly 7 known-failing suites" baseline claim in tasks.md 5.2 as "true in the common case, not guaranteed on every invocation," and separately investigating jest test-isolation at full-suite scale.
2. **Firestore emulator cold-start.** `npm run test:firestore-rules` failed on its first invocation (60s timeout waiting for port 8080) and succeeded cleanly on the second attempt (20/20 pass, including both new Editor-delete scenarios). Environment/tooling flakiness, not a code defect, but relevant if this command gates CI.
3. **Out-of-band file change reported mid-verification.** Partway through this verification, I was told `jornadaRepository.ts`'s `existeConflictoHorario` had briefly lost its `sedeId`/`espacioId` `where()` filters (down to `fecha` only) and had already been reverted back to the original 3 filters before I read the file. I independently re-read the function after that report and confirmed all three filters (`sedeId`, `espacioId`, `fecha`) are present, consistent with the pre-existing TS2698 error's line number (188) being 3 lines higher than the historically-documented 185 — i.e., consistent with exactly 2 lines having been restored. I made no edits to this or any other source file (verify-only mandate). Flagging this because it indicates the working tree was touched by a process outside this verification pass while it was in progress; whoever owns the apply/fix side should confirm no other unintended edits occurred in the same window.

**SUGGESTION** (nice to have):
- Given the full-suite flakiness above, consider auditing for shared mutable module-level state (e.g., the `mockJornadas`/`mockEjecuciones` arrays in `jornadaRepository.ts` and similar patterns in sibling repositories) that could behave differently depending on suite execution order, even though Jest normally provides a fresh module registry per test file.

---

### Verdict
**PASS WITH WARNINGS**

All 50 tasks complete; all 8 spec scenarios (both delta specs) are COMPLIANT with passing-test evidence, including a real Firestore-emulator run of the rules change; build is clean; the only tsc errors touching this change's files are the two pre-documented, unrelated-to-this-change's-actual-work items already called out in tasks.md 5.2. The warnings are about full-suite test-harness flakiness at 114-suite scale and one emulator cold-start — neither reproduces when the change's own suites are run in isolation (which they were, repeatedly, 100% green), so none of them block archiving this change, but they're worth a look before relying on `npm run test:app`'s exact failing-suite count as a stable CI gate.
