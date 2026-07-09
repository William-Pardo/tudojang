# Proposal: Centro de recursos — clasificación manual real

## Intent

El flujo actual auto-aprueba cada archivo de Drive con una ficha sintética, sin revisión humana, aunque el backend ya soporta `pendiente` como paso testeado. Regresión: el pipeline de 3 pasos (2026-07-01) unificaba clasificación+aprobación; `asignacion-material-por-clase` (2026-07-04) lo partió de nuevo, dejando código muerto y un tab "Reutilizar" sin datos reales.

## Scope

### In Scope
- `RecursoAcademico.tituloVisible?: string` (aditivo) vía `bibliotecaService.updateFicha`
- Modal de clasificación en `BibliotecaView.tsx` (handlers existentes + `tituloVisible`) deja `borrador` en `pendiente`; "aprobar" separado lo mueve a `aprobado`
- Mover grid "Recursos aprobados" + selección-lote a `BibliotecaView.tsx` vía callback nuevo
- Eliminar tab "Reutilizar" y toggle "Aprobado para"
- `CentroEstudios.tsx`: 4→3 pasos

### Out of Scope
- Destinatario/grupos de publicación (change 2)
- Cancelar/reprogramar clases (change 3)
- Backfill de `tituloVisible` en aprobados
- Bug preexistente de `publicarLote` (título/tags) — change 2
- Reglas/índices de Firestore (sin impacto)

## Approach

Approach 1 (`exploration.md`): reusar estado/handlers existentes, sin componente nuevo ni backfill.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `vistas/admin/BibliotecaView.tsx` | Modified | Modal + grid "aprobados" |
| `vistas/admin/AsignacionesView.tsx` | Modified | Pierde grid/tab/toggle; usa callback |
| `vistas/CentroEstudios.tsx` | Modified | 4→3 pasos, columnas grid |
| `models/academico/recurso.ts` | Modified | +`tituloVisible?: string` |
| `servicios/academico/bibliotecaService.ts` | Modified | Persiste `tituloVisible` |

## Impacto en Tests

- **Cobertura actual**: `bibliotecaService.test.ts` cubre el flujo en dos pasos; `BibliotecaView.test.tsx`/`AsignacionesView.test.tsx`/`CentroEstudios.test.tsx` documentan el flujo de 4 pasos (se reescriben).
- **Cobertura esperada**: TDD estricto por tarea; casos nuevos para el modal, `tituloVisible`, callback y selectors de 3 pasos.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|--------------|
| Diffs sin commitear de otro trabajo en curso (Codex/Antigravity) | Medium | Contrato relacionado, confirmado pausado; revisar WIP |
| Reescritura de tests existentes | Medium | Casos identificados en `exploration.md` |

## Rollback Plan

Aditivo salvo dos eliminaciones deliberadas (tab "Reutilizar", toggle "Aprobado para"): revertir = revert del commit; `tituloVisible` es opcional, sin migración destructiva.

## Dependencies

Ninguna externa. Prerrequisito de change 2 (`grupos-publicacion-material`); change 3 (`gestion-clases-cancelar-reprogramar`) independiente.

## Success Criteria

- [ ] Click en `borrador` abre modal y deja `pendiente`; "aprobar" separado mueve a `aprobado`
- [ ] Grid "aprobados" vive en `BibliotecaView.tsx`; tab "Reutilizar" y toggle "Aprobado para" eliminados
- [ ] `CentroEstudios.tsx` muestra 3 pasos con estado correcto
- [ ] Suite afectada en verde
