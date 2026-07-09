# Archive Report: centro-recursos-clasificacion-manual

**Change**: centro-recursos-clasificacion-manual
**Archived**: 2026-07-05
**Archived to**: `openspec/changes/archive/2026-07-05-centro-recursos-clasificacion-manual/`
**Artifact store mode**: hybrid (filesystem + Engram)

---

## Pre-Archive Gate

**Verification verdict**: PASS WITH WARNINGS
**Critical issues**: 0 (none found — archiving is permitted per the archive skill's rule)

Warnings carried forward as documented, non-blocking follow-ups (not fixed as part of this archive step, since archiving is a file-move + spec-merge only):
1. Scenario "Recursos previos sin título visible no rompen la UI" (Requirement: Título visible curado por recurso) has no dedicated test asserting the fallback-to-`nombre` behavior explicitly — only incidentally exercised by an unrelated grid test.
2. `npx cypress run` could not be executed on this machine (pre-existing, disclosed environment issue) — no real E2E execution evidence for `cypress/e2e/modulo-estudio-cierre-jornada.cy.ts` / `cypress/e2e/onboarding.cy.ts`, only static/manual review confirming both are unaffected.
3. Grid column fractions (`[16fr_47fr_37fr]` in `CentroEstudios.tsx`) have not been visually QA'd in a real browser at the `xl` breakpoint.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `academico-biblioteca` | **Created** (no prior main spec existed) | Delta spec was written as a full spec since this change originated the domain. Copied verbatim from `openspec/changes/centro-recursos-clasificacion-manual/specs/academico-biblioteca/spec.md` to `openspec/specs/academico-biblioteca/spec.md`. 6 requirements, 11 scenarios, no merge/replace logic needed (nothing pre-existing to preserve). |

Requirements now in the main spec:
1. Clasificación manual de recursos detectados
2. Aprobación separada de la clasificación
3. Título visible curado por recurso
4. Selección de aprobados unificada en Centro de recursos
5. Eliminación de "Reutilizar" y "Aprobado para"
6. Pipeline de Centro de Estudios en 3 pasos

## Archive Contents

- `proposal.md` — present
- `exploration.md` — present (optional artifact, carried forward)
- `specs/academico-biblioteca/spec.md` — present
- `design.md` — present
- `tasks.md` — present (20/20 tasks complete: Phase 1: 4, Phase 2: 4, Phase 3: 7, Phase 4: 3, Phase 5: 2)
- `verify-report.md` — present (verdict: PASS WITH WARNINGS, 0 CRITICAL)
- `archive-report.md` — this file

Copy integrity: `diff -rq` between the original change folder and the archive destination returned no differences before the original was deleted (byte-identical copy verified prior to removal). Filesystem note: a direct `mv` of the folder failed with a Windows "Permission denied" (transient handle lock, no partial move occurred — source was untouched at that point); resolved via `cp -r` + `diff -rq` verification + `rm -rf` of the source, which is functionally equivalent to `mv` and was confirmed byte-identical before deletion.

## Active Changes Directory

Confirmed `openspec/changes/centro-recursos-clasificacion-manual/` no longer exists. Confirmed `openspec/changes/archive/2026-07-05-centro-recursos-clasificacion-manual/` contains all 6 original artifacts plus this report.

## Source of Truth Updated

The following spec now reflects the new behavior:
- `openspec/specs/academico-biblioteca/spec.md` (new domain spec)

## Engram Lineage (observation IDs)

| Artifact | Engram topic_key | Observation ID |
|----------|-------------------|-----------------|
| Exploration | `sdd/centro-recursos-clasificacion-manual/explore` | #153 |
| Proposal | `sdd/centro-recursos-clasificacion-manual/proposal` | #155 |
| Spec | `sdd/centro-recursos-clasificacion-manual/spec` | #156 |
| Design | `sdd/centro-recursos-clasificacion-manual/design` | #157 |
| Tasks | `sdd/centro-recursos-clasificacion-manual/tasks` | #158 |
| Apply progress | `sdd/centro-recursos-clasificacion-manual/apply-progress` | #159 |
| Verify report | `sdd/centro-recursos-clasificacion-manual/verify-report` | #160 |
| Archive report | `sdd/centro-recursos-clasificacion-manual/archive-report` | (this observation, saved after this file) |

## SDD Cycle Complete

The change `centro-recursos-clasificacion-manual` has been fully explored, proposed, specified, designed, implemented, verified, and archived. The `academico-biblioteca` domain now has a canonical main spec. Ready for the next change (e.g. `grupos-publicacion-material`, noted as depending on this one in the proposal's Dependencies section).
