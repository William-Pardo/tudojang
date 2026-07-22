# Tasks: Cancelar y reprogramar clases en MisClasesView

## Phase 1: Foundation

- [x] 1.1 `servicios/academico/jornadaService.ts`: add `'confirmada'` to `transicionesPermitidas.reprogramada` → `['confirmada', 'pendiente_confirmacion', 'cancelada']`.
- [x] 1.2 `servicios/academico/agendaAcademicaService.ts`: import `EstadoJornada` from `../../models/academico`; add `estado: EstadoJornada` to `ClaseAcademicaAgenda`. (Also wired `estado: proxima.estado` into the `agruparClasesAcademicas` return object — required to keep the file compiling now that the field is non-optional; the actual `cancelada`-filtering behavior remains Phase 3 task 3.2.)

## Phase 2: Core Implementation — jornadaService

- [x] 2.1 RED: in `jornadaService.test.ts` add failing tests for `reprogramarJornada` — happy path (`confirmada` + cambios → `confirmada` with new fecha/horaInicio/horaFin) and throws on illegal source estado (e.g. `borrador`).
- [x] 2.2 GREEN: implement `export function reprogramarJornada(jornada, cambios)` — merge cambios into jornada, then `transicionar(transicionar(conNuevoHorario, 'reprogramada'), 'confirmada')`.
- [x] 2.3 Verify: `npm test -- --runInBand servicios/academico/jornadaService.test.ts` (covers spec scenarios "Reprogramar en un solo paso" and "Reprogramar solo disponible desde confirmada").

## Phase 3: Integration / Wiring

- [x] 3.1 RED: `agendaAcademicaService.test.ts` — add failing tests: standalone `cancelada` dropped, recurring group skips cancelled occurrence to next active, all-cancelled group dropped, `estado` exposed on surviving groups.
- [x] 3.2 GREEN: in `agruparClasesAcademicas`, filter `activas = ordenadas.filter(j => j.estado !== 'cancelada')`; return `null` when empty; change `.map` to `.map(...).filter((c): c is ClaseAcademicaAgenda => c !== null)`; set `estado: proxima.estado`.
- [x] 3.3 Verify: `npm test -- --runInBand servicios/academico/agendaAcademicaService.test.ts`.
- [x] 3.4 RED: `MisClasesView.test.tsx` — failing tests: `confirmada` row renders Iniciar+Reprogramar+Cancelar; cancelar persists `cancelada`+motivo, audits `accion:'cancelar'`; reprogramar w/o conflict persists `confirmada`+new fecha/hora, audits `accion:'actualizar'`; reprogramar w/ conflict blocks, preserves original.
- [x] 3.5 GREEN: replace `etiquetaAccionPorEstado` with `accionesDisponibles(estado): {clave, etiqueta}[]` (`borrador→[confirmar]`, `confirmada→[iniciar,reprogramar,cancelar]`, `en_curso→[cerrar,cancelar]`); add `accionExpandidaPorJornadaId` state; render actions stacked per row.
- [x] 3.6 GREEN: add inline expand-in-cell blocks reusing the `en_curso` pattern — motivo textarea for `cancelar`, fecha+horaInicio+horaFin inputs for `reprogramar`.
- [x] 3.7 GREEN: add `cancelarClase(jornada, motivo)` handler — `cancelarJornada` → `repository.guardarJornada` → `registrarAuditoria({accion:'cancelar', cambios:{estado:'cancelada', motivoCancelacion: motivo}})`.
- [x] 3.8 GREEN: add `reprogramarClase(jornada, cambios)` handler — build candidate, call `repository.existeConflictoHorario(candidate)`; if true `setError` and keep jornada unchanged; else `reprogramarJornada` → `guardarJornada` → `registrarAuditoria({accion:'actualizar', cambios})`.
- [x] 3.9 Verify: `npm test -- --runInBand vistas/admin/MisClasesView.test.tsx`.
- [x] 3.10 RED: `Horarios.test.tsx` — failing tests mocking `obtenerClasesAcademicasDelTenant` with `estado: 'cancelada'|'reprogramada'` fixtures: badge+gray when `proximaFecha >= hoy`, card dropped when `< hoy`.
- [x] 3.11 GREEN: in `vistas/Horarios.tsx`, compute `hoyIso`; drop stale (`estado in {cancelada,reprogramada} && proximaFecha < hoyIso`) from `clasesAcademicasFiltradas`; render amber/orange badge for `reprogramada`, gray/red badge for `cancelada` (reuse pill classes from `Estudiantes.tsx`), dimmed card when vigente.
- [x] 3.12 Verify: `npm test -- --runInBand vistas/Horarios.test.tsx`.

## Phase 4: Testing

- [x] 4.1 Add/confirm a test asserting an illegal transition into `reprogramada` (e.g. `borrador → reprogramada`) is still rejected — closes the coverage gap flagged in the proposal. *(Added `rechaza transicion directa borrador → reprogramada` test using `rechazarTransicionInvalida` — 11/11 pass.)*
- [x] 4.2 Full suite: `npm test -- --runInBand`; fix regressions from the `estado` field / `ClaveAccion` changes. *(Original note claimed 887/915 pass with 5 pre-existing failures; corrected per `verify-report.md`'s fresh re-run: 867/898 pass, 8 failing suites, all pre-existing/concurrent-and-unrelated to this change — `ModalImportacionMasiva`, `App.routing`, `FilaEstudiante`, `ModalRegistrarPago`, `pagosApi.complementaria`, plus `AsignacionesView`, `CentroEstudios`, `BibliotecaView` from a concurrent "Centro de Estudios" workstream sharing this working tree. The `ProgresoResumenCard.test.tsx` fix mentioned in the original note also belongs to that same concurrent workstream, not to a regression from this change — see `verify-report.md` addendum.)*
- [x] 4.3 `npm run test:coverage` scoped to the 4 touched files; confirm no drop vs. baseline. *(jornadaService: 100/87.5/100/100; agendaAcademicaService: 100/100/100/100; MisClasesView: 91.5/73.8/97.4/90.4; Horarios: 64.3/67.2/60/69.8 — no drops.)*
- [x] 4.4 `npm run build` — confirm clean TS compile. *(tsc --noEmit: zero errors in the 4 changed source files. All TS errors are preexisting in unrelated files — jest-dom type augmentation and TutorDashboardView prop mismatch.)*

## Phase 5: Cleanup

- [x] 5.1 In `openspec/changes/modulo-estudio/specs/jornadas-instruccion/spec.md`, annotate the "genera nueva jornada hija" requirement as superseded by this change (never implemented, no callers). *(Requirement strikethrough + blockquote added explaining in-place reprogramming via `reprogramarJornada`.)*
- [x] 5.2 Grep remaining consumers of `ClaseAcademicaAgenda` beyond `Horarios.tsx`; update any that need `estado` handling. *(Grepped: only consumers are `agendaAcademicaService.ts` (definition) and `Horarios.tsx` (already handles `estado` via badges in task 3.11). No other consumers found — no updates needed.)*

