# Design: Pricing por cupo real (metered)

## Technical Approach

Three structural moves, in dependency order:

1. **`estadoMatricula` on `Estudiante`** turns "active student" into a persisted fact. Without it there is no billable count and nothing else in this change can ship.
2. **One pure calculation contract** (`calcularFacturacionMensual` + `calcularCapacidad`) driven by one versioned data file, `functions/facturacion-config.json`. Both functions are **pure** — they never touch Firestore. That purity is what lets the Cloud Function (which resolves the count by query) and the public calculator (which gets it from a slider) share the same contract.
3. **No persisted derived totals.** The exact field billing multiplies is the exact field enforcement reads. `plan`, `limiteEstudiantes`, `limiteUsuarios`, `limiteSedes`, `cupos*Adicionales` are removed from `ConfiguracionClub` in `tipos.ts` so any surviving read becomes an `npm run typecheck` failure — the structural antidote to the ERR-0013 write-here/read-there pattern (see Out of Scope).

## Architecture Decisions

| # | Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|---|
| D1 | Where the shared formula lives | **Shared versioned JSON data + two thin implementations + a shared golden-vector file.** `functions/facturacion-config.json` (prices/tiers/thresholds) + `functions/facturacion-vectores.json` (expected outputs) consumed by `functions/facturacion.js` (CJS) and `utils/facturacion.ts` (TS). Both test suites iterate the **same** vector file. | (a) One shared `.js`/`.cjs` module imported by both. (b) Compile a root TS module into `functions/` at build. (c) npm workspace package. | (a) needs changes in three toolchains at once — root `package.json` is `"type":"module"`, `tsconfig.json:10` has `allowJs:false` with `functions` in `exclude`, and `jest.config.js:22` transforms only `^.+\.tsx?$`. The only cross-boundary import that exists today is `constantes.ts:4 → ./functions/planes-config.json`; the JSON path is the proven one. (b) `functions/package.json` has no build step (`main: index.js` is source, deployed as-is) — adds a compile stage and silent-drift risk. (c) repo is not a workspace; `functions/` deploys as an isolated folder. **Parity becomes a data contract, not a code contract**: if either implementation drifts, its own suite goes red. This makes the proposal's "calculator and cron produce the identical amount" a machine-checked criterion instead of a review promise. |
| D2 | Enrollment state values + storage | `estudiantes/{id}.estadoMatricula: 'activo' \| 'retirado'`, plus `fechaRetiro?` / `fechaReactivacion?` (ISO) for audit. | `activo/inactivo/egresado/suspendido`; reusing `estadoPago`. | Billing needs exactly one boolean question. A richer lifecycle invents states nothing enforces (the same mistake `PLANES_SAAS.caracteristicas` made). Dates are needed to answer billing disputes and to feed the guardrail (D5). |
| D3 | Default for the field's total absence | **Explicit two-part default**: (i) a single normalizer `normalizarEstadoMatricula(doc) → 'activo'` when absent, exported from `utils/facturacion.ts` / `functions/facturacion.js` — the *only* place the absence rule exists; (ii) an idempotent backfill `scripts/backfillEstadoMatricula.js` that materializes `estadoMatricula:'activo'` on every existing doc. `crearEstudiante` stamps it unconditionally from now on. | Absent ⇒ `retirado`; or scattered `!== 'retirado'` checks at each call site. | `retirado`-by-default would hide every existing student from the club, not just from billing — a data-visibility incident far worse than a billing one, and pre-launch there are zero paying tenants so `activo` bills nobody wrongly. Scattered `!== 'retirado'` **is** the ERR-0013 pattern; one normalizer + a real backfill is not. |
| D4 | Sede bonus persistence | `tenants/{tenantId}.sedeBonusOtorgada: boolean` + `sedeBonusOtorgadaEn: string`. Evaluated **once**, inside `crearEstudiante` **after** the doc is written, guarded by `sedeBonusOtorgada !== true`. `calcularCapacidad(tenant)` reads the **flag** and never receives the count as an input. | Recompute live from the count; a nightly job; a counter `sedesBonoAcumuladas: number`. | Live recompute revokes the bonus when the count dips — explicitly forbidden. A nightly job breaks "inmediato". A **boolean** makes the concurrent 69→70 race harmless: two racing calls write the same value, so the grant is idempotent by construction; a numeric counter would double-grant. Post-create because the 70th student must count themselves. |
| D5 | Growth guardrail placement | New scheduled function `vigilarCrecimientoFacturable` (`functions/vigilanciaFacturacion.js`, factory-DI style copied from `crearServicioCobroAutomaticoMensual`), wired in `index.js` as `pubsub.schedule("every day 07:00").timeZone("America/Bogota")`. | A hook inside `crearEstudiante`. | `crearEstudiante` is a per-row hot path — `ModalImportacionMasiva.tsx` calls it once per CSV row, so a hook means N extra reads and N duplicate alerts for one import. It also cannot see **drops**, which is the actual exploit surface (see Risks). Daily scheduling matches the existing `cobroAutomaticoMensual` / `recordatoriosPagoDiarios` precedent and reuses `functions/email.js::enviarCorreo` + `getResend()` already wired in `index.js`. |
| D6 | Guardrail history storage | New root collection `facturacion_vigilancia/{tenantId}` — `{ historial: [{fecha, facturables}] (30 max), ultimaAlertaEnviada }` — with `allow read, write: if false` in `firestore.rules` (same server-only pattern as `tickets_soporte`, rules:105-107). | `tenants/{id}/privado/facturacion`. | That subdoc is Admin read/**write** from the client (rules:160-163). Storing the baseline there lets a tenant tamper with the very series used to detect its own anomaly. |
| D7 | Protecting billing-affecting tenant fields | Add a `camposFacturacionInmutables()` guard to `allow update` on `tenants/{tenantId}` (rules:141) covering `sedeBonusOtorgada`, `sedeBonusOtorgadaEn`, `sedesExtraContratadas`, `equipoTecnicoExtraContratado`. Admin SDK bypasses rules, so Cloud Functions still write. Consequence: `actualizarCapacidadClub` (a client `updateDoc(increment)` today, `configuracionApi.ts:117-127`) becomes a thin `httpsCallable('actualizarExtrasContratados')` over a new `functions/academico/capacidad.js`. | Leave the fields client-writable. | Today `allow update: if isAdmin() && currentTenantId()==tenantId` lets any club Admin grant itself a free sede with one console call. Making the flag persistent without locking the write path just relocates the hole. |
| D8 | Owner seat accounting | `incluido.equipoTecnico = 3` counts the owner **inside** the 3. `utils/limitesSaas.ts:22`'s `limitePlan + 1 + cupos` (owner as a free extra) is deleted with the file. | Keep the `+1`. | Proposal is explicit ("owner counted inside the 3"), and the hidden `+1` is one of the four divergences being collapsed. Callers must be checked: `useGestionConfiguracion.ts:96-128` compares against `limiteUsuariosPermitido` and silently gains a seat if the `+1` is carried over. |

## Interfaces / Contracts

```ts
// utils/facturacion.ts — mirrored exactly by functions/facturacion.js (CJS)
export interface EntradaFacturacion {
  estudiantesFacturables: number;        // count, NOT a doc list — keeps the fn pure
  sedesExtraContratadas: number;         // beyond incluido.sedes + bonus
  equipoTecnicoExtraContratado: number;  // beyond incluido.equipoTecnico
}
export interface ResultadoFacturacion {
  estudiantes: { cantidad: number; subtotal: number; tramos: { desde: number; hasta: number | null; cantidad: number; tarifa: number; subtotal: number }[] };
  sedesExtra: { cantidad: number; subtotal: number };
  equipoTecnicoExtra: { cantidad: number; subtotal: number };
  totalPesos: number;
}
export function calcularFacturacionMensual(e: EntradaFacturacion): ResultadoFacturacion;

export interface CapacidadTenant { sedes: number; equipoTecnico: number; estudiantes: null } // null = sin tope
export function calcularCapacidad(t: Pick<ConfiguracionClub,
  'sedeBonusOtorgada' | 'sedesExtraContratadas' | 'equipoTecnicoExtraContratado'>): CapacidadTenant;

export function esFacturable(e: Pick<Estudiante, 'estadoMatricula'>): boolean; // absent ⇒ true (D3)
```

```jsonc
// functions/facturacion-config.json — the only place a price or threshold is written
{
  "version": 1,
  "incluido": { "sedes": 1, "equipoTecnico": 3 },
  "tramosEstudiantes": [
    { "desde": 1,   "hasta": 50,   "tarifa": 3800 },
    { "desde": 51,  "hasta": 150,  "tarifa": 3400 },
    { "desde": 151, "hasta": 350,  "tarifa": 3000 },
    { "desde": 351, "hasta": null, "tarifa": 2600 }
  ],
  "extras": { "sede": 89900, "equipoTecnico": 36000 },
  "bonoSede": { "umbralEstudiantes": 70, "sedesOtorgadas": 1 }
}
```

`calcularCapacidad().sedes = incluido.sedes + (sedeBonusOtorgada ? bonoSede.sedesOtorgadas : 0) + sedesExtraContratadas`. **No derived total is ever persisted** — the anti-ERR-0013 invariant.

## Data Flow

```
Matrícula (bono, D4)                       Corte mensual (D1)
─────────────────────                      ───────────────────
crearEstudiante(CF)                        cobroAutomaticoMensual(cron)
  ├ validar rol/tenant                       │ por cada tenant vencido:
  ├ add({...campos,                          ├ contar estudiantes con esFacturable() ──┐
  │      estadoMatricula:'activo'})          │   (snapshot en la fecha de corte,       │
  ├ n = contar facturables (post-create)     │    sin prorrateo)                       │
  ├ si n >= 70 && !tenant.sedeBonusOtorgada  ├ leer sedesExtra / equipoExtra del tenant│
  │   → tenant.update({sedeBonusOtorgada:1,  ├ calcularFacturacionMensual(entrada) ◄───┘
  │                    sedeBonusOtorgadaEn}) ├ ×100 → amount_in_cents → Wompi
  └ return doc                               └ (webhookWompi reconcilia, sin cambios)
                                                          ▲
Calculadora pública                                       │ misma función,
PublicLanding → PrecioCalculadora ──────► calcularFacturacionMensual (utils/facturacion.ts)
  (slider de alumnos + steppers de extras)                │
                                            functions/facturacion-vectores.json
                                            asegura que ambos lados coincidan

Guardrail (D5, solo notifica — nunca bloquea)
vigilarCrecimientoFacturable(cron 07:00)
  ├ n_hoy = contar facturables por tenant
  ├ leer facturacion_vigilancia/{tenantId}.historial
  ├ evaluar señales 1-3 (ver abajo)  ── ninguna ─► append historial, fin
  ├ dedupe: ultimaAlertaEnviada < 24h ─► append historial, fin
  └ enviarCorreo(→ plataforma/SuperAdmin) + set ultimaAlertaEnviada  ► el club NO se entera, NO se bloquea
```

**Guardrail signals** (all notify-only; the `resource-exhausted` throw in `estudiantes.js:137-141` is deleted):

| # | Condition | Why this threshold |
|---|---|---|
| S1 | `n_hoy >= max(30, n_hace_7d × 2)` | A real club grows by cohorts (a new sede opens with 20-40 kids). Doubling within 7 days off a non-trivial base is a script or an error. The absolute floor of 30 kills the noise at 3→6, which is normal during onboarding. |
| S2 | `n_hoy − n_ayer >= 100` | A single-day +100 is a bulk import. Legitimate ones exist (a club migrating its roster), so it informs rather than gates. |
| S3 | `n_hoy <= n_hace_7d × 0.5` **and** `días hasta fechaVencimiento <= 3` | The retire-before-cutoff exploit that "snapshot sin prorrateo" opens (see Risks). Alert includes the `fechaRetiro` list. |

Recipient: the platform administrative role (SuperAdmin), via `enviarCorreo(getResend(), { to: [SOPORTE_PLATAFORMA_EMAIL] })` plus the `facturacion_vigilancia` doc, which `vistas/MasterDashboard.tsx` can surface. The tenant is never notified and never blocked.

## File Changes

### Structural (real design + new logic)

| File | Action | Description |
|---|---|---|
| `functions/facturacion-config.json` | Create | Replaces `planes-config.json`. Single source of prices/tiers/threshold |
| `functions/facturacion-vectores.json` | Create | Golden vectors — the cross-runtime parity contract (D1) |
| `functions/facturacion.js` (+`.test.js`) | Create | CJS: `calcularFacturacionMensual`, `calcularCapacidad`, `esFacturable`, `normalizarEstadoMatricula`. Root-level, so `functions/package.json`'s `*.test.js` glob picks it up with no config change |
| `utils/facturacion.ts` (+`.test.ts`) | Create | TS mirror, same JSON, same vectors |
| `functions/wompiCobroAutomatico.js` | Modify | Delete `calcularMontoMensualPesos` (addon inference). Cron resolves the billable count per tenant before charging — use `.count()` aggregation, not a full `.get()`, to avoid an N-doc read per tenant per day |
| `functions/academico/estudiantes.js` | Modify | Delete the hard cap; stamp `estadoMatricula:'activo'`; post-create bonus evaluation (D4) |
| `functions/academico/sedes.js` | Modify | `obtenerLimiteSedes` → `calcularCapacidad(tenantData).sedes`; delete `LIMITE_SEDES_POR_PLAN` and the `cuposSedesAdicionales` read |
| `functions/academico/capacidad.js` (+`.test.js`) | Create | Callable `actualizarExtrasContratados` (D7). **Must be appended to `functions/package.json`'s enumerated test list** |
| `functions/vigilanciaFacturacion.js` (+`.test.js`) | Create | Guardrail (D5), factory-DI |
| `functions/index.js` | Modify | Register 2 new functions, wire DI + email |
| `firestore.rules` (+`functions/test/firestore-rules.behavior.test.js`) | Modify | `camposFacturacionInmutables()` guard on `tenants`; `facturacion_vigilancia` server-only |
| `tipos.ts` | Modify | `Estudiante`: `estadoMatricula`/`fechaRetiro`/`fechaReactivacion`. `ConfiguracionClub`: **delete** `plan`/`limite*`/`cupos*`, add `sedeBonusOtorgada`/`sedeBonusOtorgadaEn`/`sedesExtraContratadas`/`equipoTecnicoExtraContratado` |
| `components/PrecioCalculadora.tsx` (+test) | Create | Presentational; receives `ResultadoFacturacion`, owns no math |
| `vistas/PublicLanding.tsx` | Modify | Plan grid (~164) → calculator |
| `vistas/Configuracion.tsx` | Modify | Plan cards (~1182) + addon cards (~1260) → usage + extras panel |
| `servicios/configuracionApi.ts` | Modify | Drop `actualizarPlanClub`; `actualizarCapacidadClub` → callable wrapper (D7) |
| `servicios/estudiantesApi.ts` | Modify | Add `retirarEstudiante` / `reactivarEstudiante` — the single writers of `estadoMatricula`, stamping the dates |
| `scripts/backfillEstadoMatricula.js` (+`.test.js`) | Create | Idempotent backfill (D3); `node --test` per `scripts/` precedent |

### Mechanical (delete/repoint a reference, no new decision)

`constantes.ts` (delete `PLANES_SAAS`, reshape `COSTOS_ADICIONALES`, strip plan/limit keys from `CONFIGURACION_CLUB_POR_DEFECTO:75-79`) · `utils/limitesSaas.ts` (**delete file**) · `vistas/Estudiantes.tsx:85-88` (drop the raw-plan read and `porcentajeCapacidad`) · `hooks/useGestionEstudiantes.ts:86-87` (drop the client-side cap warning) · `hooks/useGestionConfiguracion.ts:96-128` (repoint `limiteUsuariosPermitido` to `calcularCapacidad().equipoTecnico`; **verify the `+1` does not survive**, per D8) · `hooks/useEstadoLicencia.ts:15,33,58` (stop returning `plan`) · `vistas/LicenciaSuspendida.tsx:6,17,115` (copy only) · `vistas/PasarelaPagos.tsx`, `vistas/RegistroEscuela.tsx` (remove plan selection; the 7-day `estadoSuscripcion:'demo'` trial is untouched) · `vistas/MasterDashboard.tsx:271` (badge) · `utils/userSeeder.ts:77` (fallback) · `servicios/wompiApi.ts` (review copy) · test fixtures in the 9 suites the proposal lists, incl. `functions/academico/sedes.test.js:132`.

`hooks/useEstadoLicencia.ts` suspension logic itself is confirmed plan-agnostic (only `estadoSuscripcion`/`fechaVencimiento`) — the proposal's "confirm at design" is closed: no behavioral change.

## Testing Strategy

Strict TDD is active (`openspec/config.yaml:2`, `.agent/tdd-tracker/`). **Test-first is mandatory for every row below; the first three are non-negotiable RED-first** — they are where a subtle bug charges a real customer the wrong amount.

| Priority | Layer | What | Approach / mocking |
|---|---|---|---|
| **1 (RED first)** | Unit | `calcularFacturacionMensual` tier math — boundaries 0, 1, 50, 51, 150, 151, 350, 351; marginal continuity (50→51 adds exactly $3.400, 150→151 $3.000, 350→351 $2.600); extras; full branch coverage | Pure function, zero mocks. **Both** `functions/facturacion.test.js` (`node --test`) and `utils/facturacion.test.ts` (Jest) iterate `functions/facturacion-vectores.json` — write the vectors first, then both implementations |
| **1** | Unit | `calcularCapacidad` — bonus on/off × extras 0..n; capacity never reads a count | Pure, vector-driven |
| **1** | Unit | `esFacturable` / `normalizarEstadoMatricula` — absent ⇒ `activo` (D3) | Pure |
| 2 | Unit | Bonus idempotency: 69→70 grants once; 70→69→70 does not re-grant; two concurrent calls at 70 converge to one grant | `functions/academico/estudiantes.test.js`, existing in-memory `firestore` fake |
| 2 | Unit | Guardrail S1/S2/S3 fire and do **not** throw; 24h dedupe; empty/short history is inert | `functions/vigilanciaFacturacion.test.js`, inject `enviarCorreo` + history reader/writer as DI (mirrors `crearServicioCobroAutomaticoMensual`) |
| 2 | Unit | Cron charges the metered amount for the counted snapshot; a `retirado` student is excluded | `functions/wompiCobroAutomatico.test.js`, inject the counter |
| 3 | Integration | `Configuracion` extras panel, `PrecioCalculadora` slider, `Estudiantes` retire/reactivate | Testing Library + existing `firebase/firestore` module mocks |
| 3 | Rules | Admin **cannot** write `sedeBonusOtorgada`/`sedesExtraContratadas`; `facturacion_vigilancia` denied to every client | `functions/test/firestore-rules.behavior.test.js` (emulator) |
| 4 | E2E | Signup no longer selects a plan | `cypress/e2e/onboarding.cy.ts` — carried risk: Cypress is unreliable in this environment |

## Migration / Rollout

1. Ship `estadoMatricula` (type + normalizer + `crearEstudiante` stamp + backfill script) **before** anything reads the billable count. Run `scripts/backfillEstadoMatricula.js` immediately after deploy; it is idempotent and re-runnable.
2. Legacy tenant fields (`plan`, `limite*`, `cupos*`) are **left in the documents**, unread by new code — this is what keeps the proposal's rollback plan (revert commits, no data migration) valid. Removing them from `tipos.ts` is what prevents a new reader from appearing.
3. New fields are additive and optional; `sedeBonusOtorgada` absent ⇒ `false`.
4. `firestore.rules` and Cloud Functions must deploy together with the frontend — the rules tightening (D7) breaks the current client-side `actualizarCapacidadClub` write the moment it lands.
5. No pricing grandfathering: zero clubs onboarded.

## Open Questions

- [ ] `SOPORTE_PLATAFORMA_EMAIL` for guardrail alerts — no platform-wide recipient constant exists today (`index.js` only sends `from: info@tudojang.com` to tenants). Non-blocking; default to `info@tudojang.com` until product names one.
- [ ] Whether `estadoMatricula:'retirado'` should also grey out the student in `Estudiantes.tsx` or only mark them. Cosmetic; the design only requires that retirement **never hides** the record.

## Notes on Constraints

- **Out of scope, deliberately**: ERR-0013 (`cuposSedesAdicionales` written nowhere) is not fixed here. Confirmed by grep: it is read at `functions/academico/sedes.js:75` and `utils/limitesSaas.ts:5-10`, written in zero production files. Both readers are **deleted** by this change, so the divergence disappears as a side effect — the bug's own remediation stays tracked separately in `bitacora.json`.
- **Artifact size**: this design exceeds the SDD 800-word guidance. `openspec/config.yaml rules.design` requires sequence diagrams, mocking strategy and per-decision rationale, and the change spans six distinct design areas (state model, shared-calculation boundary, capacity unification, guardrail, bonus persistence, blast-radius classification). Density was preferred over omission.
