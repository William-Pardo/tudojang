# Archive Report

**Change**: grupos-publicacion-material
**Project**: tudojang
**Archived**: 2026-07-06
**Archived to**: `openspec/changes/archive/2026-07-06-grupos-publicacion-material/`
**Store mode**: hybrid (openspec files + Engram)

---

## Verification Basis

- `sdd-verify` verdict: **PASS WITH WARNINGS, 0 CRITICAL** (verify-report.md, 2026-07-06).
- Post-verify Fix-up Phase 7 resolved ALL 5 warnings with strict TDD (7 RED tests, all confirmed failing pre-fix, all green post-fix). Evidence: focused Jest 9 suites / 108 tests green; `node --test functions/academico/asignaciones.test.js` 8/8; `npm run build` exit 0. Documented in tasks.md Phase 7 (10 tasks, all `[x]`) and in the verify-report.md addendum.
- WARNING 6 disclosure carried forward: 6 pre-existing failing Jest suites / 25 tests (identical set to the prior change's baseline) make the FULL suite exit 1 — unrelated to and unchanged by this change.
- Tasks: 32/32 complete (22 original + 10 Phase 7).

## Pre-Archive Amendments (documentation only, applied before the folder move)

1. `design.md` — "Post-Verify Amendment (Fix-up Phase 7, 2026-07-06) — Grupo activo pointer": records that `quitarGrupo()` now also reassigns `grupoActivoId` (fallback to the last remaining group) when the active group is removed, closing the dangling-pointer path that silently discarded Biblioteca selections. Original decision table preserved as history.
2. `verify-report.md` — "Addendum — Fix-up Phase 7 (post-verify)": factual record that all 5 warnings were resolved with TDD evidence, including that the WARNING 5 AND-clause test turned RED pre-fix (exposing WARNING 1's other face, not a mere coverage gap).

## Specs Synced (delta → main)

| Domain | Action | Details |
|--------|--------|---------|
| academico-programa | Updated `openspec/specs/academico-programa/spec.md` | 3 ADDED (Persistencia de tags del programa; Publicación en grupos independientes; Priorización de materiales por tags del programa) + 1 MODIFIED (Publicación de material unificada — replaced). 4 untouched requirements preserved. Now 8 requirements total. |
| academico-biblioteca | Updated `openspec/specs/academico-biblioteca/spec.md` | 2 MODIFIED (Título visible curado por recurso; Selección de aprobados unificada en Centro de recursos — both replaced). 4 untouched requirements preserved. Now 6 requirements total. |

Merge notes:

- "(Previously: ...)" delta annotations stripped — main specs read as current truth.
- The delta's "(ver arriba)" cross-reference was adjusted to "(ver Requirement: Publicación en grupos independientes)" since the added requirement lands after the modified one in the main spec.
- Per MODIFIED-replaces-wholesale semantics, the delta versions superseded these prior scenarios (disclosed per the config's "warn before merging destructive deltas" rule):
  - academico-programa / Publicación de material unificada: "Publicar un solo material a una sola clase con el flujo unificado" and "El flujo antiguo de un-solo-material ya no existe por separado" (single-entry-point intent now covered by "Grupos múltiples no cuentan como un segundo flujo"; the individual flow still exists inside the unified flow and remains covered by the requirement text).
  - academico-biblioteca / Título visible curado por recurso: "Recursos previos sin título visible no rompen la UI" (nombre-fallback/no-backfill intent now covered by the batch scenario's AND clause).
  - academico-biblioteca / Selección de aprobados unificada: "Los aprobados se listan en Centro de recursos" and "La selección llega a Asignaciones sin grid propio" (grid location is now requirement text; callback/no-grid is the new scenario's AND clause).

## Archive Contents (verified post-move)

- exploration.md
- proposal.md
- specs/academico-programa/spec.md (delta)
- specs/academico-biblioteca/spec.md (delta)
- design.md (with post-verify amendment)
- tasks.md (32/32 `[x]`)
- verify-report.md (with Phase 7 addendum)
- archive-report.md (this file)

Folder move verification: `mv` failed with the known transient Windows "Permission denied"; the established workaround was applied — `cp -r`, `diff -rq` reported the copy byte-identical, then `rm -rf` of the source. `openspec/changes/` no longer contains `grupos-publicacion-material`.

## Engram Lineage (project: tudojang)

| Artifact | Topic key | Observation ID |
|----------|-----------|----------------|
| Exploration | `sdd/grupos-publicacion-material/explore` | #162 |
| Proposal | `sdd/grupos-publicacion-material/proposal` | #163 |
| Spec (both deltas) | `sdd/grupos-publicacion-material/spec` | #164 |
| Design | `sdd/grupos-publicacion-material/design` | #165 |
| Tasks | `sdd/grupos-publicacion-material/tasks` | #166 |
| Apply progress (Phase 7) | `sdd/grupos-publicacion-material/apply-progress` | #167 |
| Verify report | `sdd/grupos-publicacion-material/verify-report` | #168 |
| Archive report | `sdd/grupos-publicacion-material/archive-report` | (this document, saved via mem_save upsert) |

## SDD Cycle Complete

The change was planned (explore → propose → spec → design → tasks), implemented with strict TDD, verified (PASS WITH WARNINGS), fixed up (Phase 7, all warnings resolved), and archived. No production source code was modified during archiving. The main specs are now the source of truth for grupos de publicación, tags de programa y tituloVisible.
