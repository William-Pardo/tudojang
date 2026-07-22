# Design: Unificar flujo de publicar material

## Technical Approach

Replace "Clase activa" + "Publicación en lote" inside `AsignacionesView.tsx` with one modal, extracted to `components/academico/AsignarMaterialWizard.tsx` (modal-shaped UI lives under `components/academico/`, matching `MaterialPreviewModal.tsx`'s precedent — not `vistas/admin/`, which is for whole-screen views like `MisClasesView.tsx`). The wizard is a controlled component: `AsignacionesView` owns all state (draft, step, mode) and Firestore calls; the wizard only renders steps and calls back. Zero Cloud Function changes (confirmed): the batch CF already fits single-material×single-class create, and the single CF's unconditional `.set()` already fits edit-as-upsert with the same `id`.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Component split | New `components/academico/AsignarMaterialWizard.tsx` (StepBar/Step1/Step2/Step3 inline in that file); `AssignmentRow` stays inline in `AsignacionesView.tsx` | Wizard is modal-shaped + reusable-in-isolation like `MaterialPreviewModal.tsx`; `AssignmentRow` is thin list-rendering tied to parent-owned handlers, not worth a second file |
| Destinatario options | Step 2 dropdown = `grupo \| estudiante` only (drop `'grado'` as directly selectable, per proposal's resolved reconciliation), grados always collected in Step 3 regardless | Matches proposal's explicit "adopt mockup's split" call; `'grado'` tipo stays supported in the type/`aplicaAlEstudiante()` only for backward-compatible reads of old data |
| `crearDestinatario()` fix | Populate `grados` when `tipo==='grupo'` too (merge with existing `'grado'` branch) | Per spec `academico-programa`; `'estudiante'` still has no grados concept (orthogonal to `estudianteIds`) |
| Grado dot colors (Step 3 + `AssignmentRow`) | Derive family from `GradoTKD` string's first word (`"Blanco Punta Amarilla"→"Blanco"`, `"Negro 2do Dan"→"Negro"`) → 6 families → reuse mockup's 6-entry color palette keyed by family | Proposal left the 13-value color mapping unresolved; a real 13-color palette was never designed. Family-bucketing needs zero new design work and reuses the one palette that exists |
| Edit entry point | "Editar" opens wizard at Step 2 (material fixed, shown read-only like Step 2's material chip); Step 1 unreachable in edit mode | Mirrors existing `editarAsignacionPublicada()` which already does `setPasoPublicacion(2)`; material can't change on edit because `recursoId` is half of the deterministic doc id |
| Dirty-check | Reuse `serializarProgramaParaCambios`/`programaTieneCambiosSinGuardar` pattern: snapshot draft on wizard-open, `JSON.stringify` compare each render, gate "Asignar" | Proven pattern already in this file; per spec, only "Asignar" is gated — "Atrás"/"Continuar" stay always-enabled |
| `actualizarAsignacion` | Delegate to existing `publicarAsignacion()` (same `id`, same `jornadaId` from `asignacion.jornadaId`) instead of new server logic | CF's `.set()` is already an upsert; zero new CF code, matches proposal's approach |
| `eliminarAsignacion` | Real `deleteDoc(doc(db,'tenants',{t},'asignaciones',{id}))`, plain top-level-import style (not `bibliotecaService`'s factory-with-deps) | Matches this file's own existing style (`listarAsignacionesPorTenant` already does plain `getDocs(collection(db,...))`); factory pattern would be a second, inconsistent style in the same file |
| **`firestore.rules` delete permission** | Change `asignaciones` match block: `allow delete: if isAdmin()` → `if isInstructor()` | `AsignacionesView.test.tsx` mocks the persona as `rol: 'Editor'` — `isInstructor()`-only, not `isAdmin()`. A direct-client `deleteDoc` under today's rule would `permission-denied` for the exact role this view is built for. `isInstructor()` ⊇ `isAdmin()`'s roles, so this is a strict widening (Admin keeps delete), zero regression. No existing rules test pins the old behavior (checked both `firestore-rules.*.test.js`) |
| `asignacionesPublicadas` hydration | **Add real fetch now** (`listarAsignacionesPorTenant(tenantId)` on mount, filtered by `jornadaActiva.id` for list+exclusion), keep existing optimistic local patch on create/edit/delete | Edit/delete need real ids to operate on; `MisClasesView.tsx:67-85` already proves this exact fetch+filter pattern in the same tree — reuse, don't defer |
| Tema persistence | New `jornadaRepository.actualizarTemaJornada(tenantId, jornadaId, tema)`; **must `getDoc`-check existence before writing** | `jornadaActiva` in this view can be a synthetic, never-persisted preview row (`generarJornadasLocalesPrograma`, "Option B" from `asignacion-material-por-clase`). A blind `setDoc(...,{merge:true})` would silently create a malformed partial `JornadaInstruccion` doc. Mirror the CF's own "fail loud if not found" behavior instead |
| Biblioteca bridge (`recursoIdsParaLote`) | Repurpose (don't delete): on arrival, auto-open the wizard at Step 1 with the first id pre-selected as `draft.recursoId`; remaining ids stay visible/selectable in the (exclusion-filtered) list for a subsequent add | Old bridge fed a `Set` into `GrupoPublicacion`, now deleted; new wizard's `Draft` is single-material, so a Set can't map 1:1 — this is the lowest-risk adaptation satisfying "selección MUST integrarse a la lista" |

## Data Flow

```
BibliotecaView (selección) ──recursoIdsParaLote──▶ AsignacionesView ──▶ wizard(Step1, preseleccionado)
"+ Agregar material" ──▶ AsignacionesView.abrirWizard('crear') ──▶ Wizard(Step1→2→3) ──confirmar(draft)──▶
   asegurarJornadaPrograma() ──▶ publishAsignacion()+publicarAsignacionFn ──▶ Firestore asignaciones/{id}
"Editar" en AssignmentRow ──▶ abrirWizard('editar', draftDesdeAsignacion) ──▶ Wizard(Step2→3, dirty-gated)
   ──confirmar──▶ actualizarAsignacionFn (= actualizarAsignacion → publicarAsignacion, mismo id)
"X" en AssignmentRow ──▶ ModalConfirmacion ──▶ eliminarAsignacionFn (deleteDoc) ──▶ patch local state
Mount/tenantId change ──▶ listarAsignacionesPorTenant(tenantId) ──▶ setAsignacionesPublicadas (real hydration)
Pill tema ──click──▶ input inline ──blur/Enter──▶ actualizarTemaJornada (getDoc-guard + setDoc merge)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `components/academico/AsignarMaterialWizard.tsx` | Create | Modal + StepBar/Step1/Step2/Step3, `AsignacionDraft` type |
| `components/academico/AsignarMaterialWizard.test.tsx` | Create | Step gating, dirty-check, edit-locks-step1 |
| `vistas/admin/AsignacionesView.tsx` | Modify | Delete lines ~1374–1520, ~1522–1694, ~1928–1963; add real fetch, `AssignmentRow`, wizard wiring, tema pill, exclusion memo, `crearDestinatario` fix, `actualizarAsignacionFn`/`eliminarAsignacionFn` props (DI, mirrors `publicarAsignacionFn`) |
| `vistas/admin/AsignacionesView.test.tsx` | Modify | Substantial rewrite per proposal |
| `servicios/academico/asignacionService.ts` | Modify | Real `eliminarAsignacion`/`actualizarAsignacion`; add `deleteDoc` import |
| `servicios/academico/asignacionService.test.ts` | Modify | Mock `deleteDoc`; cover both functions incl. missing-id guards |
| `models/academico/jornada.ts` | Modify | Add `tema?: string` |
| `servicios/academico/jornadaRepository.ts` | Modify | Add `actualizarTemaJornada`; add `getDoc` to deps/imports |
| `servicios/academico/jornadaRepository.test.ts` | Modify | Cover existence-guard (missing jornada throws) |
| `firestore.rules` | Modify | Asignaciones delete: `isAdmin()` → `isInstructor()` |
| `functions/test/firestore-rules.behavior.test.js` | Modify | Add: Editor can delete own-tenant asignación |
| `functions/academico/asignaciones.js` | None | Confirmed both CFs fit as-is |

## Interfaces / Contracts

```ts
interface AsignacionDraft {
  recursoId: string;
  destinatario: 'grupo' | 'estudiante';
  grupoObjetivo: string;              // gruposObjetivo constante existente
  momento: MomentoAsignacion;
  criterio: 'estudio'|'repaso'|'refuerzo'|'evaluacion'|'quiz';
  fechaApertura: string; fechaCierre: string;
  grados: GradoTKD[];                 // Step 3, siempre poblado
}
interface AsignarMaterialWizardProps {
  modo: 'crear' | 'editar';
  materialesDisponibles: RecursoAcademico[]; // ya excluidos+priorizados por el padre
  tagsPrograma: string[]; gruposObjetivo: string[];
  draftInicial: AsignacionDraft | null;
  onCancelar: () => void;
  onConfirmar: (draft: AsignacionDraft) => Promise<void>;
}
```
Duplicate-exclusion lives in `AsignacionesView.tsx` as a `useMemo` over `recursosPriorizadosPorTag`, filtering out `recursoId`s present in `asignacionesPublicadas.filter(a => a.jornadaId === jornadaActiva.id)` — passed down as `materialesDisponibles`, keeping the wizard exclusion-agnostic.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `crearDestinatario` grupo-grados fix, grado-family color mapper, `actualizarTemaJornada` guard, real `eliminarAsignacion`/`actualizarAsignacion` | Jest, existing `firebase/firestore` module mocks |
| Integration | Wizard create+edit flows, dirty-gating, duplicate-exclusion, tema inline-edit, Biblioteca bridge preselect | Testing Library, DI props (`publicarAsignacionFn`, `actualizarAsignacionFn`, `eliminarAsignacionFn`) |
| Rules | Editor deletes own-tenant asignación; other-tenant still denied | `firestore-rules.behavior.test.js` emulator |
| E2E | Manual only | Cypress broken in this environment (carried risk) |

## Migration / Rollout

`tema` additive/optional, no backfill. `firestore.rules` change is a strict permission widening (Admin unaffected). No Firestore migration. Revert = revert commits.

## Open Questions

None blocking.
