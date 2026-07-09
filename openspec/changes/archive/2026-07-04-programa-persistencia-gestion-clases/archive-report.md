# Archive Report

**Change**: programa-persistencia-gestion-clases
**Project**: tudojang
**Archived**: 2026-07-04
**Archived to**: `openspec/changes/archive/2026-07-04-programa-persistencia-gestion-clases/`
**Artifact store mode**: hybrid (Engram + filesystem, both persisted)

---

## Verification Gate

Per `sdd-archive` rules, a change with CRITICAL issues open must never be archived. This change cleared that gate:

- First `sdd-verify` pass: **FAIL** — 2 CRITICAL issues (regression in `vistas/CentroEstudios.test.tsx`; broken "Cerrar" action in `vistas/admin/MisClasesView.tsx`, which threw on every click because `asistenciaRegistrada`/`objetivosImpartidos` were never set before calling `cerrarJornada`).
- Phase 6 fix-up applied (TDD): rewrote the 2 stale `CentroEstudios.test.tsx` assertions to check the real batch-publish flow; fixed `MisClasesView.tsx` by reusing `JornadasView.tsx`'s proven attendance-gated close pattern (`marcarPendienteCierre` → `cerrarJornada`), adding 2 new regression tests.
- Re-verify pass (this session's input, `verify-report.md`, 2026-07-04): **PASS WITH WARNINGS**, 0 CRITICAL. Fresh execution evidence: targeted 8-suite run (66/66 passed), full suite (878 tests: 850 passed, 25 failed — all 25 pre-existing/unrelated to this change, reconciling exactly against the prior FAIL run's numbers), and a clean `npm run build`.

Archival is authorized: zero CRITICAL issues remain.

---

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `academico-programa` | **Created** (no prior main spec existed) | Delta spec copied verbatim as the new source of truth — 5 requirements, 9 scenarios: Persistencia real del Programa Académico (2 scenarios), Persistencia real de la Ejecución del Programa (1), Listado de programas reales al abrir la vista (1), Gestión de clases generadas (2), Publicación de material unificada (2). 0 modified, 0 removed (nothing pre-existing to merge against). |

Written to: `openspec/specs/academico-programa/spec.md`

---

## Archive Contents

- `exploration.md` ✅
- `proposal.md` ✅
- `specs/academico-programa/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (18/18 checklist lines complete across 6 phases, including the Phase 6 fix-up added after the first verify pass)
- `verify-report.md` ✅ (final re-verify: PASS WITH WARNINGS)
- `archive-report.md` ✅ (this file)

Active changes directory no longer contains this change — confirmed via directory listing after the move.

---

## Source of Truth Updated

The following spec now reflects the new behavior for all future changes to reference:
- `openspec/specs/academico-programa/spec.md`

---

## Engram Lineage (observation IDs read for this archive)

All artifacts were retrieved via the mandatory two-step protocol (`mem_search` → `mem_get_observation`) — full content was read for every one, not just the truncated search previews:

| Artifact | Engram ID | Topic key |
|---|---|---|
| Proposal | #144 | `sdd/programa-persistencia-gestion-clases/proposal` |
| Spec | #145 | `sdd/programa-persistencia-gestion-clases/spec` |
| Design | #146 | `sdd/programa-persistencia-gestion-clases/design` |
| Tasks | #147 | `sdd/programa-persistencia-gestion-clases/tasks` |
| Apply progress | #148 | `sdd/programa-persistencia-gestion-clases/apply-progress` |
| Verify report | #149 | `sdd/programa-persistencia-gestion-clases/verify-report` |

This archive report itself is persisted under topic key `sdd/programa-persistencia-gestion-clases/archive-report` (upsertable).

---

## Known Follow-Up Items (WARNINGs carried forward, non-blocking)

These were deliberately left open by the verify pass and are recorded here so they are not lost now that the change is archived:

1. **Orphaned colliding repository**: `servicios/academico/programaAcademicoRepository.ts` has zero production callers and writes a differently-shaped `ProgramaAcademico` (from `tipos.ts`) to the same Firestore path (`tenants/{tenantId}/programasAcademicos/{id}`) that this change's new `programaRepository.ts` (using `models/academico/programa.ts`'s type) now targets. Harmless today; recommend removing the orphan or reconciling the two shapes in a future change.
2. **No Firestore rules tests** for `programasAcademicos` / `ejecucionesPrograma` / `jornadas` collections in `functions/test/firestore-rules.*.test.js`.
3. **No single chained integration test** proves "programa persists across a real remount" end-to-end — currently proven only by composing 3 separately-mocked tests in `AsignacionesView.test.tsx` + `programaRepository.test.ts`.
4. **`design.md`'s Data Flow diagram has a stale line**: it claims `MisClasesView` reuses `agendaAcademicaService` for material resolution; the code actually calls `listarAsignacionesPorTenant` directly and filters by `jornadaId` itself. Phase 6 fixed the close-flow portion of the diagram but not this pre-existing line. Documentation-only gap.
5. **`MisClasesView`'s "iniciar" transition (confirmada→en_curso) has no component-level test** in `MisClasesView.test.tsx`. The underlying pure function `iniciarJornada()` is unit-tested in `jornadaService.test.ts`, and the code path is structurally simpler than the two sibling branches (`borrador`, `en_curso`) already proven at the component level. Low risk; recommend adding one test for completeness.
6. **Accepted scope limitation, documented and verified accurate**: closing a jornada from "Mis clases" does not advance the program's curriculum cycle (`EjecucionPrograma.objetivosCompletados` / `unidadActualId` via `advanceCiclo()`), unlike closing from `JornadasView.tsx` (which calls `cerrarJornadaConPrograma()`). This is because `jornadaRepository.ts` has no getter for a single `EjecucionPrograma`/`ProgramaAcademico` by id, and `MisClasesView` only receives `programaId: string`. A future change would need to add that getter and thread the full objects into `MisClasesView` before this can be closed.

None of these block the archive; they are recommended as candidates for a future change's proposal.

---

## SDD Cycle Complete

The change `programa-persistencia-gestion-clases` has been fully planned (proposal, spec, design, tasks), implemented (6 phases including a verify-driven fix-up), verified (PASS WITH WARNINGS, 0 CRITICAL), and archived. `openspec/specs/academico-programa/spec.md` is now the source of truth for this domain. Ready for the next change.
