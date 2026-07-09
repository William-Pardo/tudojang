# Design: Grupos de Publicación de Material

## Technical Approach

`AsignacionesView.tsx`'s batch section becomes an array of independent `GrupoPublicacion` entries, each with its own material/clase selection plus destinatario/grados/momento/criterio/fechas — replacing the flat `recursosLoteIds`/`jornadasLoteIds`/`filtroTagLote` and the batch section's silent reuse of the top-level state. "Publicar todo" sequentially calls the **unmodified** `crearServicioPublishAsignacionesBatch` once per group, reusing today's per-pair validation/dedup/commit logic. Server change is limited to the `tituloVisible` fallback (`asignaciones.js` ~line 165). `ProgramaAcademico.tags` becomes additive/persisted and drives sort-not-filter prioritization of the material list, shared across groups since it's programa-level, not group-level.

## Architecture Decisions

| Decision | Choice | Alternative rejected | Rationale |
|---|---|---|---|
| Call orchestration | Sequential `for` loop, one call per group | `Promise.all` | Proposal mandates sequential; also makes per-group error attribution unambiguous, matches existing `for` style |
| Partial failure | Each group in its own try/catch; a failing group appends an error entry, loop **continues**; `asignacionesPublicadas` updates incrementally per success | Abort-on-first-error / rollback | Spec: "un fallo en un grupo MUST NOT invalidar los resultados de los grupos publicados antes" — incremental commit needs no rollback logic |
| "Clase activa" coupling | Decoupled as a **structural side effect**: `GrupoPublicacion` fields are independent copies; top-level vars of the same name keep serving only `publicar()`/`editarAsignacionPublicada()` | Leave batch reading top-level state, or special-case the fix | Per-group fields necessarily stop the batch section reading top-level vars — bug #1 is eliminated by the data-shape change, no extra code |
| Grupo activo pointer | `grupoActivoId` state, set only in `agregarGrupo()`; Biblioteca bridge effect reads it via a ref | Track active group on every interaction | Spec only requires "default = last added"; a ref avoids widening the effect's deps beyond today's `[recursoIdsParaLote]` while reading a non-stale value |
| Tag prioritization | Stable `.sort()` on `recursosDisponibles`, matches (`ficha.tags` ∩ `programaSeleccionado.tags`, case-insensitive/trim) first; never hides non-matches; one shared order for all groups | Hard `.filter()` per group | Spec requires non-matches stay visible; tags are programa-level, not group-level |
| `tituloVisible` fallback order | `asignacionBase.titulo \|\| recurso.tituloVisible \|\| recurso.nombre` (insert, don't replace) | Drop `asignacionBase.titulo` | Matches individual-publish's "explicit override wins" pattern; client always sends `''` today so behavior is unchanged in practice |

### Post-Verify Amendment (Fix-up Phase 7, 2026-07-06) — Grupo activo pointer

The "Grupo activo pointer" decision above originally stated `grupoActivoId` is set **only** in `agregarGrupo()`, and the implementation matched that through verification. `sdd-verify` WARNING 4 then exposed a dangling-pointer path this left open: removing the active group via `quitarGrupo()` kept `grupoActivoId` pointing at a group that no longer existed, so the Biblioteca bridge effect matched no group and incoming `recursoIdsParaLote` selections were silently discarded (add Grupo 2 → quitar Grupo 2 → send selection from Biblioteca → nothing happens).

**Amendment**: `quitarGrupo()` now ALSO reassigns `grupoActivoId` (and its ref) when the removed group is the active one, falling back to the last remaining group. This extends — rather than contradicts — the decision's intent ("default = last added"): the active pointer always references an existing group. The rest of the original rationale is unchanged (ref pattern; bridge effect deps stay `[recursoIdsParaLote]`). Fixed with TDD in tasks 7.7 (RED, confirmed failing) / 7.8 (GREEN). The table row above is preserved as originally decided; this note records the post-verify evolution.

## Data Flow

    BibliotecaView "Recursos aprobados"
        │ onRecursoParaLote(id)
        ▼
    CentroEstudios.tsx (recursosParaLote: string[])
        │ recursoIdsParaLote prop
        ▼
    AsignacionesView effect ──(grupoActivoIdRef.current)──▶ gruposPublicacion[activo].recursoIds

    "Publicar todo" ──▶ for (grupo of gruposPublicacion):
        asegurarJornadaParaPreview × N  ──▶ crearDestinatario(grupo.*)
            ──▶ publicarAsignacionesBatchFn(grupo)  [unmodified Cloud Function]
                ├─ success ──▶ merge into asignacionesPublicadas + resultadosLote[i] = {ok:true,...}
                └─ failure ──▶ resultadosLote[i] = {ok:false, error} ── loop continues

## File Changes

| File | Action | Description |
|---|---|---|
| `vistas/admin/AsignacionesView.tsx` | Modify | `GrupoPublicacion[]` state, `agregarGrupo`/`quitarGrupo`, `grupoActivoId` + ref, `procesarPublicacionGrupo()`, rewritten `publicarTodo()`, per-group JSX (`<fieldset aria-label="Grupo N">`), tag-sort helper, `tags` threading in programa create/rehydrate |
| `functions/academico/asignaciones.js` | Modify | `titulo: asignacionBase.titulo \|\| recurso.tituloVisible \|\| recurso.nombre` (~line 165) |
| `models/academico/programa.ts` | Modify | `tags?: string[]` on `ProgramaAcademico` |
| `servicios/academico/programaService.ts` | Modify | `CrearProgramaInput.tags?`, threaded into `createPrograma()` return |
| Tests (5 files, per proposal Impact) | Modify | New assertions for N-call sequencing, partial failure, `tituloVisible`, `tags` |

## Interfaces / Contracts

```ts
interface GrupoPublicacion {
  id: string;
  recursoIds: Set<string>;
  jornadaIds: Set<string>;
  tipoDestinatario: DestinatarioAsignacion['tipo'];
  grupo: string;
  grados: string;
  momento: MomentoAsignacion;
  criterio: 'estudio' | 'repaso' | 'refuerzo' | 'evaluacion' | 'quiz';
  fechaApertura: string;
  fechaCierre: string;
}

interface ResultadoGrupoPublicacion {
  grupoId: string;
  ok: boolean;
  created: string[];
  skipped: AsignacionSalteada[];
  error?: string;
}
```

Active-group ref pattern (avoids stale closure without widening the effect's deps beyond today's `[recursoIdsParaLote]`):

```ts
const grupoActivoIdRef = React.useRef(grupoActivoId);
React.useEffect(() => { grupoActivoIdRef.current = grupoActivoId; }, [grupoActivoId]);
React.useEffect(() => {
  if (!recursoIdsParaLote?.length) return;
  setGruposPublicacion((actuales) => actuales.map((g) => (
    g.id === grupoActivoIdRef.current
      ? { ...g, recursoIds: new Set([...g.recursoIds, ...recursoIdsParaLote]) }
      : g
  )));
}, [recursoIdsParaLote]);
```

`PublicarAsignacionesBatchRequest`/Cloud Function contract: **unchanged**.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit/Integration | N-group publish sequencing, partial failure keeps prior groups' results, `grupoActivoId` defaults to last-added, tag sort keeps non-matches visible | `AsignacionesView.test.tsx`: scope queries with `within(screen.getByRole('group', {name: /Grupo 1/i}))` per group since checkbox labels repeat |
| Unit | `tituloVisible` fallback order (explicit override > tituloVisible > nombre) | `functions/academico/asignaciones.test.js`, extend existing batch describe block |
| Unit | `tags` persists through `createPrograma`/`guardarPrograma`, absent-tags treated as `[]` | `programaService.test.ts` |
| E2E | Not attempted — Cypress broken locally (pre-existing, disclosed in proposal) | Manual verification only |

## Migration / Rollout

No migration required. `tags` is additive/optional; existing `ProgramaAcademico` documents without it behave as "no tags" (empty-array default on rehydrate). No Cloud Function contract change beyond the internal `tituloVisible` line, so no client/server version skew risk.

## Open Questions

None — all items flagged in exploration (grupo-activo pointer, tag hard-filter vs. prioritize, shared-state decoupling) are resolved above.
