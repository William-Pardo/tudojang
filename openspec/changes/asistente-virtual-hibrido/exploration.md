## Exploration: asistente-virtual-hibrido

### Current State
The authenticated application mounts `AsistenteVirtual` for every signed-in user. The current implementation already follows a three-layer flow:

1. **Local manual first.** `soporteService.ts` normalizes the current question plus the last three chat messages and searches 14 hard-coded response entries. Matching answers do not consume the hourly AI counter.
2. **Browser-side Gemini fallback.** When no local entry matches, the browser calls `gemini-1.5-flash` directly with `MANUAL_TUDOJANG` as the system source. The counter is 15 successful AI calls per browser per rolling hour and is stored only in `localStorage`.
3. **Human escalation.** A response containing `[ESCALAR_SOPORTE_MASTER]` exposes a button. The client then writes the full chat transcript, user identity and tenant directly to `tickets_soporte`. `MasterDashboard` listens to all unresolved tickets and can advance stages, create a Jitsi room, or resolve the ticket.

The real local catalog currently covers:

| Area | Local coverage |
|---|---|
| Students | Create student; view/edit technical profile |
| Payments | Register a student payment or treasury movement |
| Communications | Alerts, WhatsApp and Tudojang Relay |
| KICHO | Public census, review and legalization |
| Live class | QR attendance, ready status and authorized pickup |
| Documents | Carnets and certifications |
| Administration | Agenda/schedules |
| Commerce | Store and events |
| Configuration | Branding, branches, programs and license |
| Staff and access | Technical team, roles and password recovery |

The application exposes a broader catalog than the AI source: Administration has Summary, Treasury, Payment Validation, Agenda and Analysis; Students has KICHO, Directory, Live Class, Certifications and Carnets; top-level areas add Store, Events, Alerts, Configuration and Profile. Configuration itself has Identity & Payments, Technical Team, Branches, Extra Programs, Alerts and License. `MANUAL_TUDOJANG` omits or under-specifies several of these flows, while some local answers contain details absent from the manual. The two knowledge sources can therefore drift and produce different answers for the same domain.

The local matcher is inexpensive but fragile: it uses substring matching, mixes previous conversation topics into the current intent, has no confidence threshold, and action-gates only some entries. Broad keywords can select an unrelated answer, while valid questions such as payment status may unnecessarily fall through to AI.

Security and cost controls are not enforceable today:

- Vite injects `GEMINI_API_KEY` into the public browser bundle. Any user can recover and use it outside the application.
- The AI quota is client-only, anonymous, resettable and bypassable; it is not scoped by user or tenant.
- Every AI call sends the complete static manual plus recent conversation, increasing token cost.
- Ticket creation and updates are direct Firestore client operations. No `firestore.rules` file is present in the repository or configured in `firebase.json`, so tenant isolation and Master-only update authorization cannot be verified.
- Tickets persist user name, email, tenant and full conversation without redaction, retention policy or consent boundary.
- Master authorization is enforced in routing by one hard-coded email, which is a UI guard rather than a backend authorization control.
- `functions/index.js` contains a tracked provider credential, calls an undefined `manejarRequest` helper, and still uses legacy `functions.config()` while deployment disallows legacy runtime config. It has no assistant endpoint and is not ready to be used as the secure proxy without remediation.

Focused evidence: `soporteService.test.ts` passes 6/6 tests. `AsistenteVirtual.test.tsx` passes 14/15 assertions but the error-path test exceeds its 5-second timeout in the current environment. There are no focused tests for `soporteApi.ts`, Firestore authorization, AI quota enforcement, or an assistant Cloud Function.

### Affected Areas
- `components/AsistenteVirtual.tsx` — chat state, source presentation, escalation UX, authenticated requests and ticket status.
- `components/AsistenteVirtual.test.tsx` — local/AI source states, exhausted quota behavior, escalation and error handling.
- `servicios/soporteService.ts` — local routing, AI fallback, quota logic and escalation marker.
- `servicios/soporteService.test.ts` — deterministic matching, context handling, quota and fallback behavior.
- `servicios/baseConocimiento.ts` — current AI-only manual and source-of-truth drift.
- `servicios/soporteApi.ts` — direct ticket writes, cross-tenant reads/updates and realtime listeners.
- `tipos.ts` — ticket model and future typed assistant response contract.
- `vistas/MasterDashboard.tsx` — global support queue and privileged ticket transitions.
- `App.tsx` — assistant availability and client-only Master route guard.
- `vite.config.ts` — public Gemini secret injection.
- `functions/index.js` — future secure AI/ticket boundary, secrets, auth, App Check, quotas and logging.
- `functions/package.json` — server AI SDK and test/runtime dependencies.
- `firebase.json` and future `firestore.rules` — deployable authorization policy for support data.
- `vistas/Administracion.tsx`, `vistas/Estudiantes.tsx`, `vistas/Configuracion.tsx` — canonical product catalog and route/action names.

### Approaches
1. **Local-first catalog plus secure server fallback** — Keep deterministic answers in the client, but replace the duplicated arrays/manual with one versioned structured catalog. Send only low-confidence questions to an authenticated callable/HTTP Cloud Function that selects relevant catalog sections, calls AI with a server secret, applies per-user/per-tenant quotas, and returns a typed result such as `{ answer, source, escalate, remaining }`. Create/escalate tickets through the same trusted boundary or strict Firestore rules.
   - Pros: Preserves instant free answers; protects secrets and budgets; enables auditable quotas, redaction and tenant authorization; reduces prompt tokens; supports graceful no-AI operation.
   - Cons: Requires backend remediation, catalog migration, authorization rules and integration tests.
   - Effort: Medium/High

2. **Local-only guided assistant plus human escalation** — Expand the structured catalog and remove generative AI. Unknown or low-confidence questions ask for module/action clarification and then offer a support ticket.
   - Pros: Lowest operating cost; deterministic and easy to test; no model secret or hallucination risk.
   - Cons: Limited natural-language coverage; catalog maintenance becomes product work; more human tickets for long-tail questions.
   - Effort: Medium

3. **Retain browser-side AI and refine matching** — Improve keywords, local confidence and UI while keeping Gemini and quotas in the browser.
   - Pros: Smallest implementation change; preserves current interaction.
   - Cons: Cannot protect the API key or enforce cost limits; weak auditability and tenant controls remain; unsuitable for production.
   - Effort: Low

### Recommendation
Choose **Local-first catalog plus secure server fallback**, implemented in two safety-first slices.

First, establish a single canonical, versioned catalog derived from the real routes and actions. Each entry should include stable intent ID, module, allowed roles, aliases, steps, related route, escalation policy and sensitivity. Use deterministic scoring with token boundaries, current-question priority, a minimum confidence threshold and explicit clarification. The UI should disclose whether an answer came from the local manual, AI, or human support.

Second, move AI and escalation decisions behind Firebase. Use Firebase Auth and App Check, Secret Manager, transactional quotas per user and tenant, maximum input/history sizes, relevant-snippet prompts instead of the full manual, structured outputs, timeout/retry limits, redacted logs and spend alerts. Ticket creation must derive `userId` and tenant from trusted auth claims, not client payloads; Master updates must require a server-verified privileged claim. Rotate the exposed provider credentials before enabling the new endpoint.

A full vector database/RAG system is not justified yet: the verified catalog is small enough for structured retrieval. Reassess embeddings only after catalog size and failed-query telemetry demonstrate the need.

### Risks
- Existing provider credentials are exposed in tracked source or the browser bundle and require rotation, not only relocation.
- Firestore ticket isolation cannot be proven from this repository; direct client reads or updates may expose cross-tenant support data.
- Conversation transcripts can contain personal, financial or medical information and need minimization, redaction and retention rules.
- Catalog migration can preserve incorrect product claims unless entries are reviewed against real routes, roles and actions.
- Server quotas need concurrency-safe counters and clear behavior when AI is unavailable or budget is exhausted.
- AI output must not invent navigation, permissions, financial actions or data changes; structured retrieval and source labels are required.
- The existing Functions code has runtime/configuration defects that must be fixed before adding the assistant endpoint.
- Current test coverage does not exercise Firestore rules, backend authorization, quota races, prompt injection, PII redaction or cost ceilings.
- The current component suite has one timeout failure and should be stabilized before using it as a regression gate.

### Ready for Proposal
Yes — propose a security-first hybrid assistant with a canonical structured catalog, deterministic local routing, authenticated server-side AI fallback, enforceable quotas, protected ticket escalation, privacy controls and focused tests. Credential rotation and support-data authorization should be explicit prerequisite tasks.
