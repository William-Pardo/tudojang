# Proposal: Pricing por cupo real (metered)

## Intent

Charging is capacity-based (3 fixed plans + block addons), not usage-based. Three problems make it worth replacing **now**:

1. **Cliffs.** Student 51 costs a club $36.000 (a `+10 Alumnos` block) for one enrollment. Growth is punished at every tope.
2. **The plans sell nothing real.** Grep confirms no `plan === 'pro'` (or equivalent) gate exists anywhere: "Soporte Sabonim AI", "Analíticas Avanzadas" and "Exportación Pro" are marketing strings in `constantes.ts:100-122` with zero enforcement. Removing the plans deactivates no feature.
3. **Capacity semantics already diverged into a live bug** (see Risks) — four readers disagree on what a tenant's limit is.

Zero clubs are onboarded (pre-launch). There is no migration, no grandfathering, and no prior price expectation to protect. This is the cheapest moment this change will ever have.

## Scope

### In Scope

- Remove `starter`/`growth`/`pro`. One system for every tenant. `functions/planes-config.json` reshaped to `{ incluido, tramosEstudiantes, extras }`.
- **Included at no cost**: 1 sede, 3 equipo técnico seats (owner counted inside the 3).
- **Metered students**, charged monthly on the real active-enrolled count, marginal/progressive per tier (each student billed at *their own* tier's rate; prior students are never re-priced), no cap:

  | Tramo | Tarifa/estudiante/mes |
  |---|---|
  | 1-50 | $3.800 |
  | 51-150 | $3.400 |
  | 151-350 | $3.000 |
  | 351+ | $2.600 |

- **Extra sede**: $89.900/mes c/u beyond the included one. **Extra equipo técnico**: $36.000/mes c/u beyond the included 3. Both prices reused unchanged, no discount (hiring is an active, already-costly decision; student growth is a passive signal — only the latter is subsidized).
- **Growth bonus**: the first time a tenant crosses 70 enrolled students it gains +1 free sede, **permanently**. Persisted as a tenant flag (`sedeBonusOtorgada: boolean`), never recomputed against the live count.
- **One billing function**, consumed by both `wompiCobroAutomatico.js` (the real charge) and the public calculator. The landing page must never hold a second formula.
- **Enrollment state on `Estudiante`** — required, does not exist today (see Risks).
- Collapse the four divergent capacity readers into one.

### Out of Scope

- Any capture/processing of parent or student money (mensualidad, tienda, eventos). Rejected on legal/fiscal (contrato de mandato DIAN) and payment-leak grounds. Watch for scope creep here.
- Any change to the parent/student experience.
- ERR-0011 / ERR-0012 — unrelated, other branch.
- A billing ceiling for very large clubs — explicitly deferred.
- Proration of mid-cycle student changes — resolved as out of scope; see "Open Questions (Resolved)" below (billing snapshot at each tenant's own cutoff date, no proration).

## Open Questions (Resolved)

- **What makes a student billable**: enrolled and not explicitly withdrawn (`estadoMatricula: 'activo'`), regardless of payment or attendance history. Requires adding enrollment state to `Estudiante` (`tipos.ts:173-217` today only has `estadoPago`) — in scope, not optional.
- **Replacement for the hard cap** (removed from `crearEstudiante` after the 12-unauthorized-sedes incident): alert/guardrail to the SuperAdmin role on anomalous growth, never a hard block — the club keeps operating. Threshold is configurable; default >100 new active enrollments in a rolling 7-day window.
- **Billing count cutoff**: snapshot at each tenant's own billing date — the same day `wompiCobroAutomatico.js`'s cron already uses. No proration.
- **Onboarding without plans**: keeps the existing 7-day demo/gracia period (`estadoSuscripcion: 'demo'`, `hooks/useEstadoLicencia.ts`) with no plan selection at signup. After day 7, metered billing starts normally — 0 enrolled students means $0 until the club enrolls someone.
- **Growth bonus timing** (70 students, permanent +1 sede): granted at the moment of the enrollment that crosses the threshold, immediately visible to the club — not at the billing cutoff. Persisted flag (`sedeBonusOtorgada: true`), write-once, never revoked.

## Capabilities

### New Capabilities

- `facturacion-metered`: monthly amount from tiered student count + paid extras; single shared calculation consumed by Cloud Function and frontend.
- `capacidad-tenant`: post-plan allowance model (1 sede + 3 seats included, paid extras, permanent bonus sede) and unification of limit enforcement.
- `matricula-estado-estudiante`: enrollment lifecycle (`activo` / `retirado`) that makes "active student" a persisted fact rather than "row exists".
- `precio-publico-calculadora`: public calculator bound to the shared billing function.

### Modified Capabilities

None — no existing `openspec/specs/` capability covers billing or capacity.

## Approach

Invert the billing input: today `calcularMontoMensualPesos` (`functions/wompiCobroAutomatico.js:80-101`) **infers purchased addons by diffing `tenant.limite*` against the plan base**. New model reads the actual active-student count plus explicit extra counts — no inference, no plan.

The shared unit must be requireable from `functions/` (plain CJS — it cannot import root TS, per the comment at `wompiCobroAutomatico.js:13-15`) *and* importable by Vite/TS. The existing precedent is `constantes.ts:4` importing `./functions/planes-config.json`, so a sibling `.js` module is the natural shape; `allowJs` viability is a design-phase call.

## Impact (tests)

| Test | Expected impact |
|---|---|
| `functions/planes-config.test.js` | Rewritten — asserts the exact 3-plan/3-addon shape being deleted |
| `functions/wompiCobroAutomatico.test.js` | Rewritten billing assertions (tiers, extras, bonus) |
| `functions/academico/sedes.test.js` | Fixture `{ plan: 'starter', cuposSedesAdicionales: 1 }` (line 132) invalid |
| `functions/academico/estudiantes.test.js` | Hard-cap-on-create behavior changes |
| `servicios/configuracionApi.test.ts` | `actualizarPlanClub` / `actualizarCapacidadClub` contracts change |
| `vistas/Configuracion.test.tsx` | Plan and addon cards removed |
| `vistas/Estudiantes.test.tsx`, `servicios/estudiantesApi.test.ts`, `components/ModalImportacionMasiva.test.tsx` | Limit-blocked paths |
| `cypress/e2e/onboarding.cy.ts` | Signup no longer selects a plan |
| New | Tier math (boundaries 50/51, 150/151, 350/351), bonus idempotency, calculator↔billing parity |

Coverage evidence: `coverage_threshold: 0` in `openspec/config.yaml`; no per-file baseline is enforced today. Target: the new shared billing function reaches full branch coverage on tier boundaries and bonus transitions — it is the one unit where an error bills a real customer wrongly.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `functions/planes-config.json` | Rewritten | New shape; 4 consumers must follow |
| `functions/wompiCobroAutomatico.js` | Modified | Metered calculation replaces addon inference |
| `functions/academico/estudiantes.js` | Modified | Hard cap on `create` no longer valid under metered |
| `functions/academico/sedes.js` | Modified | Limit = 1 + bonus + paid extras |
| `constantes.ts` | Modified | Delete `PLANES_SAAS`, reshape `COSTOS_ADICIONALES` |
| `utils/limitesSaas.ts` | Rewritten | Plan-derived limits disappear |
| `servicios/configuracionApi.ts` | Modified | Drop `actualizarPlanClub`; redefine `actualizarCapacidadClub` |
| `vistas/Configuracion.tsx` | Modified | Plan cards (~1182) and addon cards (~1260) → usage + extras panel |
| `vistas/PublicLanding.tsx` | Modified | Plan grid (~164) → calculator |
| `vistas/PasarelaPagos.tsx`, `vistas/RegistroEscuela.tsx` | Modified | Plan selection removed from signup/checkout |
| `vistas/Estudiantes.tsx` | Modified | Direct plan-limit read (line 85) removed |
| `tipos.ts` | Modified | `ConfiguracionClub.plan` removed; `Estudiante` gains enrollment state |
| `firestore.rules`, `utils/userSeeder.ts`, `vistas/MasterDashboard.tsx`, `hooks/useEstadoLicencia.ts`, `hooks/useGestionEstudiantes.ts`, `hooks/useGestionConfiguracion.ts` | Modified | Plan/limit references |
| `vistas/LicenciaSuspendida.tsx`, `servicios/wompiApi.ts` | Review | Suspension/checkout copy references plans |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **`Estudiante` has no enrollment state** (`tipos.ts:173-217` has only `estadoPago`). "Active students" is not data today — the only proxy is "document exists". A club would pay forever for withdrawn students, and the only way to lower the bill would be hard-deleting records (destroying `historialPagos`, progreso, asistencia). Direct perverse incentive to lose data. | High | Promoted into scope as `matricula-estado-estudiante` (soft-retire). **Blocks metered billing — cannot ship without it.** |
| **Pre-existing bug found: paid sede addons are not honored.** `actualizarCapacidadClub` (`servicios/configuracionApi.ts:117-127`) increments `limiteSedes`, but `obtenerLimiteSedes` (`functions/academico/sedes.js:71-77`) reads `PLANES_SAAS[plan].limiteSedes + cuposSedesAdicionales` — and `cuposSedesAdicionales` is **written nowhere** in production code (only read in `sedes.js`, `utils/limitesSaas.ts`, and one test fixture). A club pays $89.900 and is still blocked from creating the sede. Billing (which diffs `limiteSedes`) does charge for it. | High (already live) | This change deletes the divergence by construction. Flagged so it is fixed deliberately, not silently. |
| **Four disagreeing limit readers**: `sedes.js` (plan+cupos), `estudiantes.js:77-84` (consolidated `limiteEstudiantes`), `utils/limitesSaas.ts:25-31` (plan+cupos), `vistas/Estudiantes.tsx:85` (raw plan). | High (already live) | Single reader is an explicit deliverable, not a side effect. |
| **Uncapped metered + no hard cap = unbounded invoice.** Removing the `crearEstudiante` server-side block (the anti-abuse control added 2026-07 after 12 unauthorized sedes appeared) leaves nothing between a scripted import and a six-figure bill. | Med | Resolved — see "Open Questions (Resolved)": guardrail/alert to the SuperAdmin role on anomalous growth (configurable threshold, default >100 new active enrollments in a rolling 7-day window). No hard block; the club keeps operating. |
| **Removing plans removes the marketing ladder.** No "popular" tier, no upsell anchor on the landing. | Med | The calculator becomes the conversion surface; accepted deliberately. |
| Blast radius (~20 production files + 9 test suites) exceeds a 400-line PR. | High | Flag at `sdd-tasks`; `delivery_strategy: ask-on-risk` will decide chaining. |
| `estadoSuscripcion`/`fechaVencimiento` suspension flow (`hooks/useEstadoLicencia.ts`, `vistas/LicenciaSuspendida.tsx`) is plan-agnostic. | Low | Expected untouched; confirm at design. |

## Rollback Plan

Revert the commit(s). No Firestore migration is required to roll back: `plan` and `limite*` fields are left in place on tenant docs (unread by the new code, still valid for the old code), and the new `sedeBonusOtorgada` / enrollment-state fields are additive and optional. The Wompi payment source, webhook contract and reference format are untouched, so recurring charges keep working on either side of the revert. Practical constraint: any charge already issued under the metered amount is a real transaction and is not undone by a code revert.

## Dependencies

- None blocking. Adjacent unarchived changes (`asegurar-storage-tenant`, `asistente-virtual-hibrido`) do not touch pricing or capacity.

## Success Criteria

- [ ] No `starter`/`growth`/`pro` reference remains in production code (test fixtures included).
- [ ] Tier math is marginal and continuous: student 50→51 adds exactly $3.400, 150→151 adds $3.000, 350→351 adds $2.600. No jump anywhere.
- [ ] Public calculator and `cobroAutomaticoMensual` produce the identical amount for the same input, from the same function.
- [ ] Crossing 70 students grants exactly one free sede, once, and it survives the count dropping back below 70.
- [ ] Exactly one code path answers "what is this tenant's sede/seat limit".
- [ ] A retired student stops being billed without deleting the record.
- [ ] `npm test -- --runInBand` and `npm run build` pass.
