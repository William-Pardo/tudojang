# Tasks: Hybrid Virtual Assistant

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,800–2,600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Autonomous result | Likely PR / base |
|---|---|---|
| 1 | Versioned catalog and local support | PR 1; base `feat/asistente-virtual-hibrido` |
| 2 | Authenticated AI and atomic quotas | PR 2; base PR 1 branch |
| 3 | Authorized escalation and telemetry | PR 3; base PR 2 branch |
| 4 | Integrated UI, E2E and rollout | PR 4; base PR 3 branch |

## Phase 1: Catalog and Local Engine — PR 1

- [x] 1.1 RED: Add golden tests in `shared/soporte/catalogo.v1.test.ts` and `scripts/validar-catalogo.test.ts` for every inventory row, metadata, roles, routes, sources and checksum drift.
- [x] 1.2 GREEN: Create `shared/soporte/catalogo.v1.ts`, `shared/soporte/tipos.ts`, `scripts/generar-catalogo.mjs` and generated assets; make 1.1 pass with coverage.
- [x] 1.3 RED/GREEN: Test then implement thresholds, role filtering, negative terms and four-turn redacted context in `servicios/soporte/{matcher,contexto}.test.ts`; update `tipos.ts` and stabilize `components/AsistenteVirtual.test.tsx`.
- [x] 1.4 REFACTOR: Remove duplicated knowledge from `servicios/soporteService.ts`; document catalog expansion, owner review and Estudiante/Tutor activation in `docs/asistente/catalogo.md`; run `npm run test:coverage`.

## Phase 2: AI Backend and Quotas — PR 2

- [x] 2.1 RED: Add tests under `functions/asistente/*.test.js` for redaction, prompt injection, token/cost calculation, typed responses and provider failures.
- [x] 2.2 RED: Add Emulator tests in `functions/test/asistente.integration.test.js` for Auth/App Check, trusted tenant/role, concurrent quota reservations, reconciliation and exhausted-budget degradation.
- [x] 2.3 GREEN: Implement `functions/asistente/{callable,modelo,cuotas,costos,redaccion}.js`, wire `functions/index.js` and indexes/config; make 2.1–2.2 pass, keeping quotas disabled pending metric approval.
- [x] 2.4 REFACTOR: Remove `GEMINI_API_KEY` injection from `vite.config.ts`, use Secret Manager, and verify browser bundles expose no secrets/quotas; run Functions tests and `npm run build`.

## Phase 3: Escalation, WhatsApp and Telemetry — PR 3

- [x] 3.1 RED: Add Emulator security tests for minimal tickets, tenant isolation, Master transitions, denied client quota writes, consent and sensitive-data WhatsApp cancellation.
- [x] 3.2 GREEN: Implement `functions/asistente/{tickets,whatsapp,telemetria}.js`, `firestore.rules`, `firestore.indexes.json` and `firebase.json`; make 3.1 pass and limit `wa.me` to ticket ID/category.
- [x] 3.3 REFACTOR: Replace direct writes in `servicios/soporteApi.ts`; test retention, hashed identifiers, 50/75/90/100% cost alerts and absence of prompts/transcripts; run focused coverage.

## Phase 4: Integration and Rollout — PR 4

- [x] 4.1 RED/GREEN: Update `servicios/soporte/cliente.ts` and `components/AsistenteVirtual.tsx` tests/UI for local, clarify, AI, quota, ticket and WhatsApp states.
- [x] 4.2 Add `cypress/e2e/asistente-virtual.cy.ts` covering six journeys, cross-tenant denial and rollback flags; run `npx cypress run`, `npx tsc --noEmit`, Jest and build.
- [ ] 4.3 Rotate/revoke exposed credentials, verify Secret Manager/App Check, then document evidence and emergency disablement in `docs/asistente/seguridad-rollout.md`.
  - [x] Resend: revoke the previous API key, retain `tudojang-production-v3`, destroy Secret Manager versions 1–5 and verify version 6.
  - [x] Resend: remove the hardcoded credential and unauthenticated production test endpoint; verify synthetic delivery.
  - [x] Resend: remove three unused public email endpoints and retain payment confirmation only in the trusted Wompi webhook flow.
  - [x] Wompi: implement and test dynamic SHA-256 event-signature verification; prepare Secret Manager binding.
  - [x] Wompi: rotate exposed credentials, create `WOMPI_EVENTS_SECRET`, move checkout integrity signing to backend and deploy safely.
  - [ ] Gemini/App Check: complete provider secret and console enforcement evidence.
- [ ] 4.4 Enable `assistantCatalogV1`, shadow telemetry, internal/Master, 10% tenants and plan waves; record 30-day fallback, token, cost and catalog-gap review before approving quotas.
