# Design: Cancelar y reprogramar clases en MisClasesView

## Technical Approach

Relax `transicionesPermitidas` so `reprogramada → confirmada` is legal, add a pure `reprogramarJornada()` that chains two internal `transicionar()` calls (confirmada→reprogramada→confirmada) and persists only the final `confirmada` document — one write, one audit entry, one click. Wire the existing orphaned `cancelarJornada()` into `MisClasesView.tsx`. Both actions reuse the row's existing inline-expand-in-cell pattern (`en_curso`'s checkbox block), not a modal. Fix `agruparClasesAcademicas` to exclude `cancelada` before picking "próxima"; surface `estado` on `ClaseAcademicaAgenda` so `Horarios.tsx` can badge+gray instead of silently hiding or looping forever.

## Architecture Decisions

| Decision | Choice | Alternative rejected | Rationale |
|---|---|---|---|
| `reprogramada` exit transition | Add `'confirmada'` to `transicionesPermitidas.reprogramada` | Two-step re-confirm via `pendiente_confirmacion` | Map was built for an abandoned parent/child design (never implemented, no `parentJornadaId` anywhere); no re-validation need survives beyond the conflict check already run |
| Row action model | Row renders a **list** of actions per estado, not one label | Keep single `etiquetaAccionPorEstado[estado] → string` | `confirmada` must offer Iniciar + Reprogramar + Cancelar at once; a 1:1 map can't express this |
| Cancel/reprogram UI | Inline expand-in-cell (textarea for motivo; date+2 time inputs), toggled per-row per-action | New modal component(s) | Matches the view's own `en_curso` precedent; `ModalAgendarClase` isn't reusable (operates on `BloqueHorario.dia`, not `JornadaInstruccion.fecha`) |
| `agruparClasesAcademicas` filter scope | Exclude only `cancelada` when picking "próxima"; drop group if none remain | Also exclude `reprogramada` | Spec says "excluir cancelada" only; `reprogramarJornada` never persists `estado: 'reprogramada'` (only the chained final state), so a persisted one is an edge case that should still badge, not vanish |
| Past-dated badge suppression | Enforced in `Horarios.tsx` render filter | Push into `agruparClasesAcademicas` | Keeps existing fallback-to-last-occurrence behavior for normal display untouched — only cancelada/reprogramada get date-gated |

## Data Flow

    Reprogramar (click "Reprogramar" → fill fecha/horaInicio/horaFin → click "Guardar"):
    MisClasesView ── candidate = {...jornada, fecha, horaInicio, horaFin}
                  ── repository.existeConflictoHorario(candidate) ──→ true? setError, keep jornada as-is
                  └─→ false: reprogramarJornada(jornada, cambios) ──→ guardarJornada(confirmada) ──→ registrarAuditoria('actualizar')

    Cancelar (click "Cancelar" → fill motivo → click "Confirmar"):
    MisClasesView ── cancelarJornada(jornada, motivo) ──→ guardarJornada(cancelada) ──→ registrarAuditoria('cancelar')

    Horarios render:
    obtenerClasesAcademicasDelTenant → agruparClasesAcademicas (drop cancelada-only groups)
      → Horarios.tsx: estado in {cancelada, reprogramada} && proximaFecha < hoy → drop card
                       estado in {cancelada, reprogramada} && proximaFecha >= hoy → badge + gray
                       otherwise → render as today

## File Changes

| File | Action | Description |
|---|---|---|
| `servicios/academico/jornadaService.ts` (+test) | Modify | Relax `transicionesPermitidas.reprogramada`; add `reprogramarJornada()` |
| `vistas/admin/MisClasesView.tsx` (+test) | Modify | Replace single-label map with `accionesDisponibles(estado)`; add per-row expand state for cancelar/reprogramar; new handlers `cancelarClase`/`reprogramarClase` alongside existing `confirmarClase`/`iniciarClase`/`cerrarClase` |
| `servicios/academico/agendaAcademicaService.ts` (+test) | Modify | Filter `cancelada` before picking "próxima"; drop empty groups; keep exposing picked occurrence's `estado` |
| `models`/type for `ClaseAcademicaAgenda` (in `agendaAcademicaService.ts`) | Modify | Add `estado: EstadoJornada` field |
| `vistas/Horarios.tsx` (+test) | Modify | Badge + gray render branch, date-gated drop for stale cancelada/reprogramada |
| `openspec/specs/academico-programa/spec.md` | Modify (on archive) | Already drafted in delta spec |

## Interfaces / Contracts

```ts
// jornadaService.ts
transicionesPermitidas.reprogramada = ['confirmada', 'pendiente_confirmacion', 'cancelada'];

export function reprogramarJornada(
  jornada: JornadaInstruccion,
  cambios: { fecha: string; horaInicio: string; horaFin: string }
): JornadaInstruccion {
  const conNuevoHorario = { ...jornada, ...cambios };
  return transicionar(transicionar(conNuevoHorario, 'reprogramada'), 'confirmada');
}
```

```ts
// MisClasesView.tsx
type ClaveAccion = 'confirmar' | 'iniciar' | 'cerrar' | 'cancelar' | 'reprogramar';
function accionesDisponibles(estado: EstadoJornada): { clave: ClaveAccion; etiqueta: string }[] { /* borrador→[confirmar]; confirmada→[iniciar,reprogramar,cancelar]; en_curso→[cerrar,cancelar]; else→[] */ }
// New state: accionExpandidaPorJornadaId: Record<string, ClaveAccion | null>
```

```ts
// agendaAcademicaService.ts
export interface ClaseAcademicaAgenda { /* ...existing fields */ estado: EstadoJornada; }
const activas = ordenadas.filter((j) => j.estado !== 'cancelada');
if (activas.length === 0) return null; // filtered out via .filter(Boolean) after map
const proxima = activas.find((j) => j.fecha >= hoyIso) ?? activas[activas.length - 1];
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `reprogramarJornada` (happy path, conflict rejected, illegal source estado) | Jest, `jornadaService.test.ts` |
| Unit | `agruparClasesAcademicas` (standalone cancelada dropped, recurring skip-to-next-active, all-cancelled group dropped, `estado` exposed) | Jest, `agendaAcademicaService.test.ts` |
| Integration | `MisClasesView`: cancel persists+audits; reprogram no-conflict persists+audits; reprogram with conflict blocks, preserves original; confirmada row shows 3 actions | Testing Library + mock `JornadaRepository`, existing file's pattern |
| Integration | `Horarios.tsx`: badge+gray for vigente cancelada/reprogramada; card dropped when vencida | Testing Library, mock `obtenerClasesAcademicasDelTenant` |

## Migration / Rollout

No migration required. All changes are additive/behavioral on existing fields; no new persisted field beyond values already in `JornadaInstruccion`. Rollback per proposal: revert transition-map entry and UI controls independently.

## Open Questions

- [ ] Exact badge copy/color for `reprogramada` vs `cancelada` — cosmetic, non-blocking; default to two small badge labels reusing existing pill classes from `Estudiantes.tsx`.
