# Proposal: Cancelar y reprogramar clases en MisClasesView

## Intent

`MisClasesView.tsx` handles only 3 estados (`borrador→Confirmar`, `confirmada→Iniciar`, `en_curso→Cerrar`); no UI cancels or reschedules, though `cancelarJornada()` exists unused. `agruparClasesAcademicas` also has zero estado filtering, so a cancelled class renders on `Horarios.tsx` forever, silently. This closes both gaps via a single-click, in-place-edit flow.

## Scope

### In Scope
- Relax `transicionesPermitidas['reprogramada']` to allow `'confirmada'` directly (single-click reprogram).
- Add `reprogramarJornada(jornada, { fecha, horaInicio, horaFin })`; reuse `existeConflictoHorario` as-is.
- Wire `cancelarJornada()` into `MisClasesView.tsx` via inline motivo input, expand-in-row (matches `en_curso`), persisted with `guardarJornada` + `registrarAuditoria`.
- Add inline "Reprogramar" control (date + 2 time inputs), same pattern; stack buttons where a row offers 3 actions.
- Fix `agruparClasesAcademicas` to exclude `cancelada` before picking "próxima"; drop all-cancelled groups.
- Add `estado` to `ClaseAcademicaAgenda`; badge + gray for `cancelada`/`reprogramada` (only while occurrence date ≥ hoy).
- Document supersession of `jornadas-instruccion/spec.md`'s "genera nueva jornada hija" requirement — never implemented, no callers.

### Out of Scope
- Hard delete / `eliminarJornada` (no cascade cleanup for `AsignacionAcademica`).
- Archiving the unrelated, unarchived `modulo-estudio/` change folder (follow-up).

## Approach

Relax the transition map over a two-step re-confirm; inline expand-in-row UI consistent with `en_curso`; badge+gray in `Horarios.tsx`, not silent hide.

## Affected Areas

|Area|Impact|Description|
|---|---|---|
|`jornadaService.ts`(+test)|Modified|Relax transitions, add `reprogramarJornada`|
|`MisClasesView.tsx`(+test)|Modified|Inline cancel/reprogram UI|
|`Horarios.tsx`(+test)|Modified|Badge/gray rendering per estado|
|`agendaAcademicaService.ts`(+test)|Modified|Filter cancelled before "próxima"|
|`specs/academico-programa/spec.md`|Modified|New cancelar/reprogramar requirements|

No test asserts illegal-transition behavior for `reprogramada→confirmada` yet (verify at spec phase); all areas above gain new cases.

## Risks

|Risk|Likelihood|Mitigation|
|---|---|---|
|Stale spec misread as still-intended|Med|Explicit supersession note in spec delta|
|`ClaseAcademicaAgenda.estado` breaks other consumers|Low|Re-grep at tasks phase; only `Horarios.tsx` found so far|
|Transition relaxation loosens map|Low|Map already served an abandoned design|

## Rollback Plan

Revert transition-map entry and UI controls independently (each additive); no data migration, fields edited in place.

## Dependencies

None.

## Success Criteria

- [ ] Admin can cancel a `confirmada`/`en_curso` jornada with motivo, inline
- [ ] Admin can reprogram a `confirmada` jornada in one click, conflict-checked
- [ ] Cancelled classes no longer render indefinitely on `Horarios.tsx`
- [ ] `npm test -- --runInBand` green; `npm run build` succeeds
