# Exploration: Cancelar y reprogramar clases (MisClasesView + Horarios)

## Current State

**`vistas/admin/MisClasesView.tsx`** — `etiquetaAccionPorEstado` only maps 3 states (`borrador→Confirmar`, `confirmada→Iniciar`, `en_curso→Cerrar`). `transicionar()` has an `if/else if` chain for exactly those 3 states; anything else falls through and does nothing (no button renders because `etiquetaAccion` is `undefined`). No cancel/reprogramar UI exists at all today.

**`servicios/academico/jornadaService.ts`** — `cancelarJornada(jornada, motivoCancelacion)` already exists and is pure/orphaned (still zero callers anywhere in the repo — confirmed via grep). There is **no `reprogramarJornada` function** — it does not exist yet, contrary to what "just wire it up" would suggest; it must be written from scratch.

**`transicionesPermitidas` map (same file)** — this is the crux of the whole design fork:
```
borrador:               ['confirmada', 'cancelada']
confirmada:             ['en_curso', 'cancelada', 'reprogramada']
en_curso:                ['pendiente_cierre', 'parcial', 'cancelada']
reprogramada:           ['pendiente_confirmacion', 'cancelada']
pendiente_confirmacion: ['confirmada', 'cancelada', 'pendiente_sustitucion']
```
Two consequences that change the shape of this feature:
1. **`reprogramada` is only a legal target from `confirmada`.** Not from `borrador`, not from `en_curso`. So "Reprogramar" as a button can only legally appear when `jornada.estado === 'confirmada'` — matches the user's "atrasar una clase ya confirmada" mental model, so this is fine, just needs to be an explicit constraint in the UI (button only shows for `confirmada`).
2. **Once a jornada reaches `reprogramada`, the map does NOT allow it to go straight back to `confirmada`.** The only legal next steps are `pendiente_confirmacion` or `cancelada`. `confirmarJornada()` (→ transicionar to `'confirmada'`) works from `borrador` or `pendiente_confirmacion`, but **not from `reprogramada` directly** — that transition would throw `Transicion invalida: reprogramada -> confirmada`. This map was written for the *original*, never-implemented parent/child reprogramming design (see below) and is a genuine blocker for the user's simpler in-place-edit approach unless addressed.

**Origin of the tension — a stale spec.** `openspec/changes/modulo-estudio/specs/jornadas-instruccion/spec.md` (this change folder is fully implemented per its own `verify-report.md`, 57/57 tasks, but **was never archived** — it still sits directly under `openspec/changes/`, not `openspec/changes/archive/`) contains:
> "Jornada reprogramada genera nueva jornada hija ... SHALL crear una nueva jornada con `parentJornadaId` referenciando la original, cambiar la original a estado `reprogramada` y mantener la posición del ciclo del programa hasta que la nueva jornada sea cerrada."

This was **never implemented** — `parentJornadaId` doesn't exist anywhere in `models/academico/jornada.ts` or any service; it's only text in that stale spec file. The `transicionesPermitidas` map is the one surviving artifact of that abandoned design (it still assumes a reprogrammed jornada needs a fresh confirmation cycle, as a new child jornada would). The user's decided approach (edit the same doc's `fecha`/`horaInicio`/`horaFin` in place, no child jornada) **explicitly supersedes** that old requirement. This needs to be called out and amended in the new spec delta — proposal/spec phases should note this requirement is being replaced, not just silently ignored, so a future reader of `jornadas-instruccion/spec.md` isn't confused.

**`servicios/academico/jornadaRepository.ts`** — `existeConflictoHorario` checks overlap only against jornadas whose estado is in `estadosActivos = ['confirmada', 'en_curso', 'pendiente_cierre']`. `cancelada` and `reprogramada` are already correctly excluded from blocking new bookings — no repository change needed for that part. The conflict check already self-excludes by `existente.id !== jornada.id`, so calling it with the *same jornada id* but *new fecha/hora* (the reprogram case) works correctly out of the box.

**`AuditoriaJornadaInput.accion`** (`jornadaRepository.ts`) already includes `'cancelar'` and `'actualizar'` in its union — no type change needed to audit a cancel (`'cancelar'`) or a reschedule (`'actualizar'`, reused).

**`vistas/Horarios.tsx`** — confirmed bug #1: edit/delete buttons are gated by `esAdmin && !esAcademica` (line ~190), so any card sourced from `agendaAcademicaService` is 100% non-interactive. There is no per-state rendering at all today — no badge, no graying, no distinction between a `confirmada` and any other state.

**`servicios/academico/agendaAcademicaService.ts` — `agruparClasesAcademicas`** is the real hidden bug for cancelled classes. It groups jornadas by `bloqueRecurrenteId ?? id`, sorts by `fecha`, and picks `ordenadas.find(j => j.fecha >= hoyIso) ?? ordenadas[last]` **with no estado filtering whatsoever**. Concretely:
- A **standalone** cancelled jornada (no `bloqueRecurrenteId`, group size 1) will **always** be selected as "proxima" and rendered on the agenda forever — cancelling it today does nothing to remove it from `Horarios.tsx`. This is a real bug that must be fixed as part of this change, not optional polish.
- A cancelled occurrence **inside** a recurring `bloqueRecurrenteId` group is less severe today (the group still has other future occurrences to fall back to *if* the picker is fixed to skip cancelled ones), but currently it isn't skipped either — if the cancelled date happens to be the soonest one, it wins and gets shown as if it will happen.
- **Reprogramar needs no service change for the date/time move itself.** Since `dia` is derived live from `proxima.fecha` (`obtenerNombreDia`) every time this function runs, and reprogramar edits `fecha`/`horaInicio`/`horaFin` on the *same* document, the class automatically reappears at its new day/time slot on next fetch — confirmed, zero extra code needed for that specific part.

## Affected Areas

- `servicios/academico/jornadaService.ts` — add `reprogramarJornada(jornada, { fecha, horaInicio, horaFin })`; decide/adjust `transicionesPermitidas['reprogramada']` (see Approaches).
- `servicios/academico/jornadaService.test.ts` — new tests for `reprogramarJornada` and the adjusted transition.
- `vistas/admin/MisClasesView.tsx` — extend `etiquetaAccionPorEstado`, extend `transicionar()`, add inline UI for motivo (cancel) and fecha/hora (reprogramar), reuse `existeConflictoHorario` for the reprogram path exactly like the existing borrador→confirmada path.
- `vistas/admin/MisClasesView.test.tsx` — new tests for both actions plus the conflict-check-on-reprogram case.
- `vistas/Horarios.tsx` — remove/relax the `!esAcademica` gate for `esAdmin` (bug #1) OR add a narrower per-state gate; add badge/graying for `cancelada`/`reprogramada`.
- `vistas/Horarios.test.tsx` — new tests for the visual state handling.
- `servicios/academico/agendaAcademicaService.ts` — fix `agruparClasesAcademicas` to filter out `cancelada` jornadas before picking "proxima" per group (and decide the all-cancelled-group edge case).
- `servicios/academico/agendaAcademicaService.test.ts` — new tests for cancelled-jornada exclusion.
- `openspec/specs/academico-programa/spec.md` — add the new Requirement(s) for cancelar/reprogramar; this is the correct spec (already covers `MisClasesView.tsx` and jornada lifecycle).
- `openspec/changes/modulo-estudio/specs/jornadas-instruccion/spec.md` — **not edited directly** (that change's specs get folded into `specs/` only on archive of *that* change, which hasn't happened), but the new proposal/spec MUST explicitly note it supersedes/replaces the "genera nueva jornada hija" requirement so the discrepancy is documented rather than silently orphaned.

## Approaches

### Fork 1 — how "Reprogramar" returns to an actionable state

1. **Keep `reprogramada` as a real terminal-ish waypoint, add a re-confirm step** — `reprogramarJornada()` sets `estado: 'reprogramada'` + new fecha/hora; add a new pure function to move `reprogramada → pendiente_confirmacion`, then reuse existing `confirmarJornada()` for `pendiente_confirmacion → confirmada`. Two clicks for the teacher/admin (Reprogramar, then Confirmar again).
   - Pros: keeps the existing transition map untouched; mirrors the spirit of "reprogramming needs re-validation" from the original spec.
   - Cons: adds a state hop and a second click the user never asked for; more surface (new function, new button, new test) for a "just move the date" action that in this in-place model has no real new risk to re-validate beyond the conflict check already run at reprogram time.
   - Effort: Medium.

2. **Relax the map: allow `reprogramada → confirmada` directly** — one-line change (`reprogramada: ['confirmada', 'pendiente_confirmacion', 'cancelada']`), and `reprogramarJornada()` runs the conflict check itself (same call as the borrador→confirmada path) and transitions straight to `confirmada` with the new fecha/hora, in a single click. `reprogramada` is then only ever a fleeting/logged state (or can be skipped as a stored `estado` altogether if desired, but the user explicitly said "mark it reprogramada" so it's still set, just not stuck there).
   - Pros: single click, matches "atrasar una clase" as the user described it; no new function beyond `reprogramarJornada`; no new UI state to design for `pendiente_confirmacion` display.
   - Cons: slightly loosens the original transition-integrity map (though that map was already designed for an abandoned data model, so this isn't really a regression against anything real).
   - Effort: Low.

### Fork 2 — Cancelar/Reprogramar UI shape in `MisClasesView.tsx`

1. **Inline expand-in-row** (matches existing precedent: the `en_curso` row already expands into checkboxes + button in the same `<td>`, no modal). Cancelar reveals a `<textarea>`/`<input>` for motivo + a confirm button in place of the row's action cell; Reprogramar reveals `<input type="date">` + two `<input type="time">` + a confirm button, same pattern.
   - Pros: zero new components, consistent with the one UI pattern this view already established for `en_curso`; simplest to test with existing Testing Library queries.
   - Cons: table cell gets visually busy if a row supports 2 actions (e.g. `confirmada` state has both "Iniciar" and now "Cancelar"/"Reprogramar" available) — needs a small sub-menu or stacked buttons, not just one action per row like today.
   - Effort: Low-Medium.

2. **Modal per action** (new `ModalCancelarClase`/`ModalReprogramarClase`, or one generic modal reused for both). Cancel button opens a modal with motivo textarea; Reprogramar button opens a modal with date/time fields (visually similar to `ModalAgendarClase` but operating on `JornadaInstruccion.fecha`/`horaInicio`/`horaFin` directly — NOT reusable as-is since `ModalAgendarClase` works on `BloqueHorario.dia`, a different data shape).
   - Pros: cleaner separation when a row has 3 possible actions (Iniciar/Cancelar/Reprogramar all available on a `confirmada` jornada); matches the codebase's broader modal convention used everywhere else (`ModalRegistrarPago`, `ModalConfirmacion`, etc.) for anything destructive or multi-field.
   - Cons: 1-2 new components to build and test; breaks the one local precedent this specific view already set for itself.
   - Effort: Medium.

### Fork 3 — how cancelled/rescheduled classes render in `Horarios.tsx` / `agendaAcademicaService.ts`

1. **Hide cancelled classes entirely, keep rescheduled ones showing at their new slot with a small "Reprogramada" badge.** `agruparClasesAcademicas` filters `estado !== 'cancelada'` before picking `proxima`; if a group ends up empty, drop it from the returned list.
   - Pros: keeps the operational agenda clean — no dead entries; simplest mental model ("if it's not going to happen, it's not on the agenda").
   - Cons: if an admin cancels by mistake, there's no visible trace in the agenda itself to catch the error (only in `MisClasesView`/audit log); silent disappearance could look like a bug to someone unfamiliar with the flow.
   - Effort: Low.

2. **Show cancelled classes grayed-out with a "Cancelada" badge (only while their fecha hasn't passed yet), rescheduled ones with a "Reprogramada" badge at their new slot.** Requires passing `estado` through `ClaseAcademicaAgenda` (it isn't there today — only `origen`, `dia`, times, ids, `nombrePrograma`, `proximaFecha`, `materialAsignado`) and picking, per group, the *soonest non-cancelled* occurrence but still surfacing a still-cancelled one if it's the only option for a badge-and-gray render instead of disappearing.
   - Pros: visible confirmation that the cancel "took" (matches the user's own bug report — they want proof the click did something, having just found the current UI to be silently unresponsive); consistent with the badge-pill convention already used elsewhere (`Estudiantes.tsx`, `GestionClase.tsx`).
   - Cons: slightly more logic in `agruparClasesAcademicas` (need both "next active occurrence" and "most relevant cancelled/rescheduled one to badge" in the same pass); `ClaseAcademicaAgenda` needs a new `estado` field, which is a (small, additive) type change other consumers of that type must tolerate.
   - Effort: Medium.

## Recommendation

- **Fork 1: Option 2** (relax the map, single-click reprogram). The 2-step re-confirm dance in Option 1 is a leftover of an abandoned parent/child design; nothing about the in-place-edit model actually needs a second gate beyond the conflict check already run at reprogram time.
- **Fork 2: Option 1** (inline expand-in-row) for consistency with this view's own established pattern, with a small addendum: when a `confirmada` row can offer both "Iniciar" and "Cancelar"/"Reprogramar", stack 2-3 small buttons instead of one, matching the existing `flex flex-col gap-2` block already used for `en_curso`.
- **Fork 3: Option 2** (badge + gray, don't silently hide) — directly addresses the user's own frustration discovering that academic cards look "dead" with no feedback; a class that vanishes right after being cancelled reads exactly like the current dead-button bug, just relocated. Recommend showing the badge only while `proximaFecha >= hoy` (or the group's soonest occurrence, whichever is more recent) so old cancelled entries don't accumulate forever — falls back to Option 1's "just drop it" behavior once the date is in the past.

## Risks

- **Stale spec text.** `jornadas-instruccion/spec.md`'s "genera nueva jornada hija" requirement must be explicitly called out as superseded in the proposal, or a future reader will think parent/child reprogramming is the intended model when it was never built and isn't being built now either.
- **`transicionesPermitidas` relaxation is a shared, tested pure function.** Changing `reprogramada`'s legal targets touches `jornadaService.test.ts` assertions if any exist for illegal-transition behavior around that state — must grep/verify before editing (a quick check during spec/design phase, not blocking exploration).
- **`ClaseAcademicaAgenda.estado` is a new field on a shared type.** Any other current consumer of `obtenerClasesAcademicasDelTenant`/`agruparClasesAcademicas` beyond `Horarios.tsx` must be checked before adding it (only `Horarios.tsx` and its test were found referencing `ClaseAcademicaAgenda` in this investigation, but tasks phase should re-grep to be sure).
- **All-cancelled-group edge case** (a whole recurring `bloqueRecurrenteId` series where every occurrence to date is cancelled) needs an explicit scenario in the spec — silently dropping the group is the simplest safe default, should be made explicit rather than left implicit in code.
- **No hard-delete, by design** — reconfirmed: no `eliminarJornada` exists or should be built; Firestore rules permit admin hard-delete server-side but no client path should be added given the lack of cascade cleanup for `AsignacionAcademica` records tied to a jornada. This change stays soft/state-based only, matching the user's earlier decision.

## Ready for Proposal

Yes. Both bugs are root-caused with exact file/line targets, the one real architectural fork (transition-map relaxation) has a clear low-effort recommendation, and the UI approach for both `MisClasesView.tsx` and `Horarios.tsx` has codebase precedent to follow. sdd-propose can proceed directly; recommend the proposal explicitly flag the `jornadas-instruccion/spec.md` supersession note so it's not lost by the time of archive.
