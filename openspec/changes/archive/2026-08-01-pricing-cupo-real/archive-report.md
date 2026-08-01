# Archive Report: Pricing por cupo real (metered)

**Archive Date**: 2026-08-01  
**Change Name**: pricing-cupo-real  
**Status**: Complete and Closed

## Executive Summary

The pricing-cupo-real SDD change has been fully implemented, verified, and merged to main. All 4 phases completed successfully with full test coverage. The change replaced the fixed plan-based billing model with a metered billing system based on actual active student count, organized into 4 new specification domains that are now part of the main specs repository.

## Change Archive Details

**Previous Location**: `openspec/changes/pricing-cupo-real/`  
**Archived Location**: `openspec/changes/archive/2026-08-01-pricing-cupo-real/`

### Archive Contents

The complete SDD change has been moved to archive, containing all decision artifacts:

- **proposal.md** - Business case, scope, risks, success criteria
- **design.md** - Technical architecture, 8 architecture decisions, interfaces, data flow, testing strategy
- **tasks.md** - 15 implementation tasks across 4 phases, all marked complete [x]
- **specs/** - 4 new domain specifications (see Specs Synced section below)

## Specs Synced to Main Repository

The delta specifications from the change have been merged into the main specs repository. Four new specification domains were created:

| Domain | Location | Action | Details |
|--------|----------|--------|---------|
| facturacion-metered | `openspec/specs/facturacion-metered/spec.md` | Created | Metered billing: marginal tier calculation, extras summation, snapshot billing cutoff, unique shared calculation |
| matricula-estado-estudiante | `openspec/specs/matricula-estado-estudiante/spec.md` | Created | Enrollment state field on Estudiante (activo/retirado), soft retirement without data loss, definition of billable |
| precio-publico-calculadora | `openspec/specs/precio-publico-calculadora/spec.md` | Created | Public calculator tied to backend billing function, inputs for students/seats/team, replacement of fixed plan grid |
| capacidad-tenant | `openspec/specs/capacidad-tenant/spec.md` | Created | Post-plan capacity model (1 sede + 3 seats included, paid extras, permanent growth bonus), unified capacity reader, guardrail for anomalous growth |

All specifications are now part of the permanent source of truth in `openspec/specs/` and reflect the production implementation.

## Implementation Summary

**Implementation Status**: Complete - all code merged to main (PR #44)  
**Verification Status**: Passed - sdd-verify completed with 0 CRITICAL, 2 WARNING (resolved), 2 SUGGESTION (resolved)

### Phases Completed

1. **Phase 1**: `estadoMatricula` + backfill (PR #35)
   - Added enrollment state field to Estudiante type
   - Implemented retire/reactivate operations
   - Idempotent backfill for existing records
   
2. **Phase 2**: Shared calculation contract (PR #36)
   - Created `functions/facturacion-config.json` (single source of billing prices/tiers)
   - Created `functions/facturacion-vectores.json` (cross-runtime parity contract)
   - Implemented `calcularFacturacionMensual`, `calcularCapacidad`, `esFacturable` in both CJS and TS
   
3. **Phase 3**: Backend consumers + firestore.rules (PR #37, split 3a/3b)
   - Created `capacidad.js` callable for managing extras purchases
   - Implemented guardrail monitoring (`vigilanciaFacturacion.js`) for anomalous growth detection
   - Updated billing cron to use metered calculation
   - Protected billing fields in firestore.rules
   
4. **Phase 4**: Frontend + public calculator (PR #38)
   - Created `PrecioCalculadora` component (presentational only, shares billing math)
   - Updated PublicLanding to use calculator instead of plan grid
   - Replaced Configuracion plan/addon cards with usage + extras panel
   - Removed all references to fixed plans from frontend

### Test Coverage

- All implementation tasks mark as complete [x]
- 407/407 node:test green (functions)
- 1780/1783 jest tests green (app) - 3 skipped
- 70/70 node:test green (scripts)
- `npm run build` succeeded
- Full typecheck passing (`npm run typecheck` 0 errors)
- No `starter`/`growth`/`pro` references remain in production code

### Validation

The implementation satisfies all proposal success criteria:

- No plan-based references in production code
- Tier math is marginal and continuous at all boundaries (50→51: +$3.400, 150→151: +$3.000, 350→351: +$2.600)
- Public calculator and billing cron produce identical amounts from same function
- Growth bonus (70 students → +1 free sede) granted exactly once and persists
- Single capacity reader across all code paths
- Retired students excluded from billing without record deletion

## Active Change Directory Status

The directory `openspec/changes/pricing-cupo-real/` has been moved to archive and no longer exists as an active change.

**Confirmation**: `openspec/changes/pricing-cupo-real/` ✓ No longer present in active changes

## Migration & Rollback Readiness

Per design.md Migration/Rollout section:

- Legacy tenant fields (`plan`, `limite*`, `cupos*`) left in production documents, unread by new code
- New fields (`sedeBonusOtorgada`, enrollment state, extras fields) are additive and optional
- Firestore.rules and Cloud Functions deployed together with frontend
- `scripts/backfillEstadoMatricula.js` run on deployment to materialize enrollment state
- Zero clubs onboarded - no pricing grandfathering required

## SDD Cycle Closure

This change represents a complete SDD cycle:

1. ✅ Proposal: Defined intent, scope, open questions, risks
2. ✅ Spec: 4 domain specifications capturing all requirements
3. ✅ Design: Technical approach, 8 architecture decisions, testing strategy
4. ✅ Tasks: 15 implementation tasks across 4 phases
5. ✅ Apply: All tasks completed, code merged to main
6. ✅ Verify: Verification passed, all assertions hold
7. ✅ Archive: Change closed, specs synced, archived

## Dependencies & Related Changes

**No blocking dependencies**: Adjacent unarchived changes (`asegurar-storage-tenant`, `asistente-virtual-hibrido`) do not touch pricing or capacity logic.

**Resolved implicit issues**:
- ERR-0013 (paid sedes not honored): eliminated by construction through single capacity reader
- Four divergent capacity calculations: unified into one `calcularCapacidad` function

## Notes

- Archive date follows repository convention: `YYYY-MM-DD-{change-name}` format
- All decisions logged in design.md with explicit rationale per D1-D8 markers
- 4 new specification domains are permanent and form source of truth going forward
- Testing strategy documented includes strict TDD confirmation at every phase boundary
- Change is safe to reference for future architectural decisions on billing/capacity logic
